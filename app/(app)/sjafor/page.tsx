'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import { Truck, MapPin, Check, Package, Info, Phone, StickyNote } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import KorpsLogo from '@/components/ui/KorpsLogo'
import type { DugnadEvent } from '@/lib/supabase/types'
import { isMockMode } from '@/lib/mock/useMock'
import { mockEvents, mockDriverZones, mockTrailerGroups } from '@/lib/mock/data'

interface DriverZone {
  assignmentId: string
  eventId: string
  zoneId: string
  zoneName: string
  area: string
  status: string
  households: number
  trailerGroup: number
  collectors: Array<{ full_name: string | null; phone: string | null; notes: string | null }>
}

// Hengergruppe med sjåførnavn og soner
interface TrailerGroup {
  area: string
  trailerGroup: number
  driverName: string | null
  zones: DriverZone[]
}

// Sjåførvisning — viser soner klare for henting, gruppert per henger
export default function DriverPage() {
  const [zones, setZones] = useState<DriverZone[]>([])
  const [events, setEvents] = useState<DugnadEvent[]>([])
  const [trailerGroups, setTrailerGroups] = useState<TrailerGroup[]>([])
  const [myTrailer, setMyTrailer] = useState<{ area: string; trailerGroup: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pickingUp, setPickingUp] = useState<string | null>(null)
  const [confirmPickUp, setConfirmPickUp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (isMockMode()) {
      setEvents(mockEvents)
      setZones(mockDriverZones)
      setTrailerGroups(mockTrailerGroups)
      setMyTrailer({ area: 'NORD', trailerGroup: 1 })
      setLoading(false)
      return
    }
    loadData()
  }, [])

  async function loadData() {
    const sb = supabaseRef.current

    // Hent aktive hendelser — kun flaskeinnsamling (andre typer har ikke henting)
    const { data: eventsData } = await sb
      .from('events')
      .select('*')
      .eq('status', 'active')
      .eq('type', 'bottle_collection')
      .order('date') as unknown as { data: DugnadEvent[] | null }

    const activeEvents = eventsData || []
    setEvents(activeEvents)

    if (activeEvents.length === 0) {
      setZones([])
      setLoading(false)
      return
    }

    const eventIds = activeEvents.map(e => e.id)

    // Hent innlogget bruker
    const { data: { user } } = await sb.auth.getUser()

    // Hent sjåførtildelinger med profilnavn
    const { data: driverAssignments } = await sb
      .from('driver_assignments')
      .select('user_id, trailer_group, area, profiles(full_name)')
      .in('event_id', eventIds)
      .eq('role', 'driver') as unknown as {
        data: Array<{
          user_id: string
          trailer_group: number
          area: string
          profiles: { full_name: string | null } | null
        }> | null
      }

    // Bygg lookup: "NORD-1" → sjåførnavn
    const driverNameMap = new Map<string, string>()
    // Finn alle unike henger-grupper per område
    const allTrailerKeys = new Set<string>()

    for (const da of (driverAssignments || [])) {
      const key = `${da.area}-${da.trailer_group}`
      driverNameMap.set(key, da.profiles?.full_name || 'Ukjent sjåfør')
      allTrailerKeys.add(key)

      // Sjekk om dette er innlogget brukers henger
      if (user && da.user_id === user.id) {
        setMyTrailer({ area: da.area, trailerGroup: da.trailer_group })
      }
    }

    // Hent assignments med status completed eller picked_up
    const { data: assignments } = await sb
      .from('zone_assignments')
      .select('id, event_id, zone_id, status')
      .in('event_id', eventIds)
      .in('status', ['completed', 'picked_up']) as unknown as {
        data: Array<{ id: string; event_id: string; zone_id: string; status: string }> | null
      }

    if (!assignments || assignments.length === 0) {
      // Ingen soner klare, men vis likevel hengergruppene
      buildTrailerGroups([], driverNameMap, allTrailerKeys)
      setZones([])
      setLoading(false)
      return
    }

    // Hent soneinfo med trailer_group
    const zoneIds = [...new Set(assignments.map(a => a.zone_id))]
    const { data: zonesData } = await sb
      .from('zones')
      .select('id, name, area, households, trailer_group')
      .in('id', zoneIds) as unknown as {
        data: Array<{ id: string; name: string; area: string; households: number; trailer_group: number }> | null
      }

    const zoneMap = new Map((zonesData || []).map(z => [z.id, z]))

    // Hent claims med profil (for kontaktinfo)
    const assignmentIds = assignments.map(a => a.id)
    const { data: claims } = await sb
      .from('zone_claims')
      .select('assignment_id, user_id, notes, profiles(full_name, phone)')
      .in('assignment_id', assignmentIds) as unknown as {
        data: Array<{
          assignment_id: string
          user_id: string
          notes: string | null
          profiles: { full_name: string | null; phone: string | null } | null
        }> | null
      }

    // Bygg sjåfør-soner
    const driverZones: DriverZone[] = assignments.map(a => {
      const zone = zoneMap.get(a.zone_id)
      const zoneClaims = (claims || []).filter(c => c.assignment_id === a.id)

      return {
        assignmentId: a.id,
        eventId: a.event_id,
        zoneId: a.zone_id,
        zoneName: zone?.name || a.zone_id,
        area: zone?.area || '',
        status: a.status,
        households: zone?.households || 0,
        trailerGroup: zone?.trailer_group || 1,
        collectors: zoneClaims.map(c => ({
          full_name: c.profiles?.full_name || null,
          phone: c.profiles?.phone || null,
          notes: c.notes || null,
        })),
      }
    })

    // Sorter: completed først, deretter alfabetisk
    driverZones.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return -1
      if (a.status !== 'completed' && b.status === 'completed') return 1
      return a.zoneName.localeCompare(b.zoneName, 'nb')
    })

    buildTrailerGroups(driverZones, driverNameMap, allTrailerKeys)
    setZones(driverZones)
    setLoading(false)
  }

  // Bygg grupperte henger-grupper fra soner og sjåførtildelinger
  function buildTrailerGroups(
    driverZones: DriverZone[],
    driverNameMap: Map<string, string>,
    allTrailerKeys: Set<string>
  ) {
    // Legg til nøkler fra soner som kanskje mangler i driver_assignments
    for (const z of driverZones) {
      allTrailerKeys.add(`${z.area}-${z.trailerGroup}`)
    }

    const groups: TrailerGroup[] = []
    for (const key of allTrailerKeys) {
      const [area, tgStr] = key.split('-')
      const tg = parseInt(tgStr)
      groups.push({
        area,
        trailerGroup: tg,
        driverName: driverNameMap.get(key) || null,
        zones: driverZones.filter(z => z.area === area && z.trailerGroup === tg),
      })
    }

    // Sorter: per område, deretter henger-nummer
    groups.sort((a, b) => {
      if (a.area !== b.area) return a.area.localeCompare(b.area)
      return a.trailerGroup - b.trailerGroup
    })

    setTrailerGroups(groups)
  }

  async function handlePickUp(assignmentId: string) {
    setPickingUp(assignmentId)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('mark_zone_picked_up', {
      p_assignment_id: assignmentId,
    })
    if (rpcError) {
      setError('Kunne ikke markere som hentet. Prøv igjen.')
      setPickingUp(null)
      return
    }
    // Oppdater lokal state — både zones og trailerGroups
    setZones(prev => {
      const updated = prev.map(z =>
        z.assignmentId === assignmentId ? { ...z, status: 'picked_up' } : z
      )
      // Synkroniser trailerGroups med oppdaterte soner
      setTrailerGroups(groups => groups.map(g => ({
        ...g,
        zones: g.zones.map(z =>
          z.assignmentId === assignmentId ? { ...z, status: 'picked_up' } : z
        ),
      })))
      return updated
    })
    setPickingUp(null)
  }

  // Sjekk om en gruppe er brukerens egen henger
  function isMyGroup(group: TrailerGroup) {
    return myTrailer && group.area === myTrailer.area && group.trailerGroup === myTrailer.trailerGroup
  }

  // Hent unike områder fra hengergruppene
  const areas = [...new Set(trailerGroups.map(g => g.area))]
  const hasMultipleAreas = areas.length > 1

  // Hjelper: initialer fra navn
  function getInitials(name: string | null) {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  // Rendrer en sone — enkel, flat layout uten nesting
  function renderZone(zone: DriverZone, i: number) {
    return (
      <motion.div
        key={zone.assignmentId}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        className="card rounded-2xl p-5"
      >
        {/* Sonenavn + kart-lenke */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-text-primary font-[var(--font-display)]">{zone.zoneName}</p>
            <p className="text-xs text-text-secondary">
              {zone.area === 'NORD' ? 'Nord' : 'Sør'}{zone.households > 0 && ` · ${zone.households} hus`}
            </p>
          </div>
          <Link href={`/kart?event=${zone.eventId}&sone=${zone.zoneId}`}
            className="text-xs text-accent font-bold flex items-center gap-1">
            <MapPin size={12} /> Kart
          </Link>
        </div>

        {/* Samlere — enkel liste med eventuelt notat per claim */}
        {zone.collectors.length > 0 && (
          <div className="mb-4 space-y-2.5">
            {zone.collectors.map((c, j) => (
              <div key={j} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-accent">{getInitials(c.full_name)}</span>
                    </div>
                    <span className="text-sm text-text-primary truncate">{c.full_name || 'Ukjent'}</span>
                  </div>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-xs text-accent font-medium ml-2 shrink-0">
                      Ring
                    </a>
                  )}
                </div>
                {c.notes && (
                  <div className="ml-9 flex items-start gap-1.5 bg-warning/10 rounded-[10px] px-2.5 py-1.5">
                    <StickyNote size={12} className="text-warning shrink-0 mt-0.5" />
                    <span className="text-xs text-text-primary leading-snug">{c.notes}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hent-knapp eller bekreftelse */}
        {confirmPickUp === zone.assignmentId ? (
          <div className="space-y-2.5 bg-surface-low rounded-[16px] p-3">
            <p className="text-sm font-bold text-text-primary text-center">
              Bekreft henting av {zone.zoneName}?
            </p>
            <p className="text-xs text-text-secondary text-center">
              Trykk «Ja, hentet» når flaskene er lastet i hengeren
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmPickUp(null)}
                className="flex-1 py-2.5 text-sm font-medium text-text-secondary bg-card rounded-full"
              >
                Ikke ennå
              </button>
              <button
                disabled={pickingUp === zone.assignmentId}
                onClick={() => { setConfirmPickUp(null); handlePickUp(zone.assignmentId) }}
                className="flex-1 py-3 text-sm font-bold text-white bg-success rounded-full flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                <Check size={16} /> Ja, hentet
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmPickUp(zone.assignmentId)}
            className="w-full py-3 text-sm font-bold text-success border-2 border-success rounded-full active:scale-[0.98] transition-all"
          >
            Marker som hentet
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <>
      {/* Header — fast topp med logo */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <div className="flex items-center gap-3">
            <KorpsLogo size={32} />
            <span className="text-xl font-bold text-accent tracking-tight font-[var(--font-display)]">
              Dugnadshub
            </span>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="pt-20 pb-28 px-5 space-y-6">
        {/* Sidetittel */}
        <section className="pt-2">
          <h1 className="text-3xl font-extrabold tracking-tight font-[var(--font-display)] text-text-primary">
            Klar for rute
          </h1>
          <p className="text-text-secondary mt-1">
            {events.length > 0 ? events.map(e => e.title).join(' · ') : 'Ingen aktive hendelser'}
          </p>
        </section>

        {/* Sjåførnotater fra aktive hendelser */}
        {!loading && events.filter(e => e.driver_notes).map(e => (
          <div key={e.id} className="bg-surface-low rounded-2xl p-4 flex items-start gap-3">
            <Info size={18} className="text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-accent mb-0.5">{e.title}</p>
              <p className="text-sm text-text-primary">{e.driver_notes}</p>
            </div>
          </div>
        ))}

        {/* Feilmelding */}
        {error && (
          <div className="p-3 rounded-2xl bg-danger/10 text-danger text-sm text-center">
            {error}
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="card rounded-[2.5rem] p-6 h-32" />
            ))}
          </div>
        )}

        {/* Tom tilstand */}
        {!loading && zones.length === 0 && trailerGroups.length === 0 && (
          <div className="card rounded-[2.5rem] p-8 text-center">
            <Package size={32} className="text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary">
              {events.length === 0
                ? 'Ingen aktive hendelser akkurat nå.'
                : 'Ingen soner er ferdigplukket ennå.'}
            </p>
          </div>
        )}

        {/* Soner — flat liste, gruppert per henger */}
        {!loading && trailerGroups.length > 0 && trailerGroups.map(group => {
          const readyZones = group.zones.filter(z => z.status === 'completed')
          const pickedZones = group.zones.filter(z => z.status === 'picked_up')
          const isMine = isMyGroup(group)
          if (readyZones.length === 0 && pickedZones.length === 0) return null

          return (
            <div key={`${group.area}-${group.trailerGroup}`} className="space-y-3">
              {/* Henger-header — enkel linje */}
              <div className="flex items-center gap-2 px-1">
                <Truck size={16} className={isMine ? 'text-accent' : 'text-text-tertiary'} />
                <span className="text-sm font-bold text-text-primary font-[var(--font-display)]">
                  Henger {group.trailerGroup}
                </span>
                {isMine && (
                  <span className="text-[10px] font-bold text-white bg-accent px-1.5 py-0.5 rounded-full">Din</span>
                )}
                {group.driverName && (
                  <span className="text-xs text-text-secondary ml-auto">{group.driverName}</span>
                )}
              </div>

              {/* Klare soner */}
              {readyZones.map((zone, i) => renderZone(zone, i))}

              {/* Hentede soner — kompakt, dempet */}
              {pickedZones.length > 0 && (
                <div className="bg-surface-low rounded-2xl p-4 opacity-60">
                  {pickedZones.map(zone => (
                    <div key={zone.assignmentId} className="flex items-center gap-2 py-1">
                      <Check size={14} className="text-success shrink-0" />
                      <span className="text-sm text-text-primary">{zone.zoneName}</span>
                      <span className="text-xs text-text-tertiary ml-auto">Hentet</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </main>
    </>
  )
}
