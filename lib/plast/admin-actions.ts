// Admin-handlinger for plastdugnad: opprett soner fra KMZ, importer musikanter fra CSV
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedKmz } from './kmz-parser'

// Pent visningsnavn for target_group (brukes i sone-navn)
export function displayTargetGroup(targetGroup: string): string {
  if (targetGroup === 'Hovedkorps-1') return 'Hovedkorps gruppe 1'
  if (targetGroup === 'Hovedkorps-2') return 'Hovedkorps gruppe 2'
  if (targetGroup === 'Hovedkorps-3') return 'Hovedkorps gruppe 3'
  return targetGroup
}

// Mapper fra Tutti-CSV "Avdeling" til target_group brukt i plast-soner
function avdelingToTargetGroup(avdeling: string): string | null {
  const a = avdeling.trim()
  if (a === 'Aspirantkorps') return 'Aspirantkorps'
  if (a === 'Junior 1') return 'Junior 1'
  if (a === 'Junior 2') return 'Junior 2'
  if (a === 'Hovedkorps') return null // HK fordeles manuelt på HK1/HK2/HK3
  return null
}

// Lager kort hash av event-id for sone-id-generering
function shortEid(eventId: string): string {
  return eventId.replace(/-/g, '').slice(0, 8)
}

// Lager unik sone-id fra event + target_group
// Eksempel: 'plast-a1b2c3d4-HK1', 'plast-a1b2c3d4-AK'
export function makeZoneId(eventId: string, targetGroup: string): string {
  const eid = shortEid(eventId)
  const suffix = targetGroup === 'Aspirantkorps' ? 'AK'
    : targetGroup === 'Junior 1' ? 'JK1'
    : targetGroup === 'Junior 2' ? 'JK2'
    : targetGroup === 'Hovedkorps-1' ? 'HK1'
    : targetGroup === 'Hovedkorps-2' ? 'HK2'
    : targetGroup === 'Hovedkorps-3' ? 'HK3'
    : targetGroup.replace(/[^a-zA-Z0-9]/g, '')
  return `plast-${eid}-${suffix}`
}

export interface ImportZonesResult {
  zonesCreated: number
  meetingPointSet: boolean
  errors: string[]
}

// Oppretter plast-soner i zones-tabellen + assignments + setter event.meeting_point
export async function importPlastZones(
  supabase: SupabaseClient,
  eventId: string,
  parsed: ParsedKmz,
): Promise<ImportZonesResult> {
  const errors: string[] = []
  let zonesCreated = 0

  // 1. Slett eksisterende plast-soner for dette eventet (hvis re-import)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('zones') as any).delete().eq('event_id', eventId)

  // 2. Opprett soner med target_group
  for (const zone of parsed.zones) {
    if (zone.target_group === 'Ukjent') {
      errors.push(`Sone "${zone.raw_name}" har ukjent gruppe (beskrivelse: "${zone.description}")`)
      continue
    }

    const zoneId = makeZoneId(eventId, zone.target_group)
    const zoneName = `${zone.raw_name}: ${displayTargetGroup(zone.target_group)}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: zoneErr } = await (supabase.from('zones') as any).insert({
      id: zoneId,
      name: zoneName,
      area: 'NORD', // CHECK-constraint krever NORD/SOR — plast bruker bare NORD
      zone_type: 'plast',
      households: 0,
      collectors_needed: 2,
      trailer_group: 1,
      geometry: zone.geometry,
      target_group: zone.target_group,
      event_id: eventId,
    })
    if (zoneErr) {
      errors.push(`Sone "${zoneName}": ${(zoneErr as { message?: string }).message ?? 'ukjent feil'}`)
      continue
    }

    // 3. Opprett zone_assignment som kobler event ↔ sone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: assignErr } = await (supabase.from('zone_assignments') as any).insert({
      event_id: eventId,
      zone_id: zoneId,
      status: 'available',
    })
    if (assignErr) {
      errors.push(`Assignment "${zoneName}": ${(assignErr as { message?: string }).message ?? 'ukjent feil'}`)
      continue
    }

    zonesCreated++
  }

  // 4. Sett events.meeting_point
  let meetingPointSet = false
  if (parsed.meeting_point) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: mpErr } = await (supabase.from('events') as any)
      .update({ meeting_point: parsed.meeting_point })
      .eq('id', eventId)
    if (mpErr) {
      errors.push(`Møteplass: ${(mpErr as { message?: string }).message ?? 'ukjent feil'}`)
    } else {
      meetingPointSet = true
    }
  }

  return { zonesCreated, meetingPointSet, errors }
}

// Tutti-CSV strukturen
export interface TuttiCsvRow {
  Status: string
  Kommentar: string
  Navn: string
  Gruppe: string // instrument
  Avdeling: string // 'Aspirantkorps' | 'Junior 1' | 'Junior 2' | 'Hovedkorps' | ''
}

export interface ImportMusiciansResult {
  inserted: number
  skipped: number
  hkUnassigned: string[] // navn på HK-musikanter som mangler sone-tildeling
  others: string[] // rader uten Avdeling (dirigent o.l.)
  errors: string[]
}

// Importerer musikanter fra Tutti CSV til event_musicians-tabellen
// AK/JK1/JK2 auto-tildeles, HK legges i pool (zone_id=NULL) for manuell fordeling
export async function importMusicians(
  supabase: SupabaseClient,
  eventId: string,
  rows: TuttiCsvRow[],
): Promise<ImportMusiciansResult> {
  const errors: string[] = []
  const hkUnassigned: string[] = []
  const others: string[] = []
  let inserted = 0
  let skipped = 0

  // Hent eksisterende plast-soner for dette eventet
  const { data: zones } = await supabase
    .from('zones')
    .select('id, target_group')
    .eq('event_id', eventId)
    .eq('zone_type', 'plast') as unknown as { data: Array<{ id: string; target_group: string | null }> | null }

  const targetGroupToZoneId = new Map<string, string>()
  for (const z of zones || []) {
    if (z.target_group) targetGroupToZoneId.set(z.target_group, z.id)
  }

  // Normaliserings-funksjon for fuzzy match
  function norm(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  // Hent eksisterende fordelinger FØR sletting — bevarer manuell HK-fordeling ved re-import
  const { data: existingMusicians } = await supabase
    .from('event_musicians')
    .select('name, zone_id')
    .eq('event_id', eventId) as unknown as {
      data: Array<{ name: string; zone_id: string | null }> | null
    }
  const preservedZoneByName = new Map<string, string>()
  for (const m of existingMusicians || []) {
    if (m.zone_id) preservedZoneByName.set(norm(m.name), m.zone_id)
  }

  // Slett eksisterende musikanter for dette eventet (vi reinserter med bevart fordeling)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('event_musicians') as any).delete().eq('event_id', eventId)

  // Hent alle profiler for matching
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, children, is_musician') as unknown as {
      data: Array<{ id: string; full_name: string | null; children: Array<{ name: string }> | null; is_musician: boolean }> | null
    }

  // Bygg map: musikant-navn → profile_id
  function findProfileId(musicianName: string): string | null {
    const mn = norm(musicianName)
    for (const p of profiles || []) {
      if (p.is_musician && norm(p.full_name || '') === mn) return p.id
      for (const c of p.children || []) {
        if (norm(c.name) === mn) return p.id // forelderen — men denne brukes for filtering, ikke direkte
      }
    }
    return null
  }

  // Valider header — sjekk at minst Navn og Status finnes (papaparse lager dynamiske felt)
  if (rows.length > 0) {
    const sample = rows[0]
    const keys = Object.keys(sample)
    const requiredCols = ['Status', 'Navn', 'Avdeling']
    const missing = requiredCols.filter(c => !keys.includes(c))
    if (missing.length > 0) {
      errors.push(`CSV mangler kolonner: ${missing.join(', ')}. Forventet: Status, Kommentar, Navn, Gruppe, Avdeling.`)
      return { inserted: 0, skipped: rows.length, hkUnassigned, others, errors }
    }
  }

  // Filtrer rader: kun de som kommer
  const attending = rows.filter(r => r.Status?.trim() === 'Kommer' && r.Navn?.trim())

  const inserts: Array<{ event_id: string; name: string; group_name: string | null; instrument: string | null; zone_id: string | null; profile_id: string | null }> = []

  for (const row of attending) {
    const navn = row.Navn.trim()
    const avdeling = row.Avdeling?.trim() || ''
    const instrument = row.Gruppe?.trim() || ''
    const preservedZone = preservedZoneByName.get(norm(navn)) || null

    // Rader uten Avdeling = voksne (dirigent o.l.) — lagres i DB med null gruppe
    // Bevar zone_id hvis admin har tildelt en
    if (!avdeling) {
      others.push(navn)
      inserts.push({
        event_id: eventId,
        name: navn,
        group_name: null,
        instrument: instrument || null,
        zone_id: preservedZone,
        profile_id: findProfileId(navn),
      })
      continue
    }

    const targetGroup = avdelingToTargetGroup(avdeling)
    let zoneId: string | null = preservedZone

    // Hvis ingen bevart fordeling, bruk auto-logikk
    if (!zoneId) {
      if (targetGroup) {
        zoneId = targetGroupToZoneId.get(targetGroup) || null
        if (!zoneId) {
          errors.push(`${navn}: fant ingen sone for "${targetGroup}"`)
          skipped++
          continue
        }
      } else if (avdeling === 'Hovedkorps') {
        hkUnassigned.push(navn)
        // zone_id forblir null — admin må manuelt tildele
      } else {
        errors.push(`${navn}: ukjent avdeling "${avdeling}"`)
        skipped++
        continue
      }
    }

    inserts.push({
      event_id: eventId,
      name: navn,
      group_name: avdeling || null,
      instrument: instrument || null,
      zone_id: zoneId,
      profile_id: findProfileId(navn),
    })
  }

  if (inserts.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('event_musicians') as any).insert(inserts)
    if (error) {
      errors.push(`Bulk-insert feil: ${(error as { message?: string }).message ?? 'ukjent'}`)
    } else {
      inserted = inserts.length
    }
  }

  return { inserted, skipped, hkUnassigned, others, errors }
}

// Tildeler en HK-musikant til en spesifikk sone (HK1/HK2/HK3)
export async function assignHkMusician(
  supabase: SupabaseClient,
  musicianId: string,
  zoneId: string,
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('event_musicians') as any)
    .update({ zone_id: zoneId })
    .eq('id', musicianId)
  return { error: error ? ((error as { message?: string }).message ?? 'ukjent feil') : null }
}
