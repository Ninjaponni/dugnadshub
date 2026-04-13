'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Truck, MapPin, Check, Package, Info } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { DugnadEvent } from '@/lib/supabase/types'

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

  // Rendrer et sone-kort (klare for henting)
  function renderReadyZone(zone: DriverZone, i: number) {
    return (
      <motion.div
        key={zone.assignmentId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
      >
        <Card className="p-4 border-l-4 border-l-success">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold text-[15px]">{zone.zoneName}</p>
              <p className="text-xs text-text-secondary">
                {zone.area === 'NORD' ? 'Nord' : 'Sør'}
                {zone.households > 0 && ` · ${zone.households} hus`}
              </p>
            </div>
            <Link href={`/kart?event=${zone.eventId}&sone=${zone.zoneId}`}>
              <span className="text-xs text-accent font-medium flex items-center gap-1">
                <MapPin size={12} /> Kart
              </span>
            </Link>
          </div>

          {/* Samlere med kontaktinfo */}
          {zone.collectors.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-1">
                Samlere
              </p>
              {zone.collectors.map((c, j) => (
                <div key={j}>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{c.full_name || 'Ukjent'}</span>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-accent text-xs">
                        {c.phone}
                      </a>
                    )}
                  </div>
                  {c.notes && (
                    <p className="text-xs text-text-tertiary ml-0 mt-0.5">{c.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {confirmPickUp === zone.assignmentId ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary text-center">
                Er alle flasker hentet i denne sonen?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setConfirmPickUp(null)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  loading={pickingUp === zone.assignmentId}
                  onClick={() => { setConfirmPickUp(null); handlePickUp(zone.assignmentId) }}
                >
                  <Check size={14} />
                  Ja, hentet
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={() => setConfirmPickUp(zone.assignmentId)}
            >
              <Check size={14} />
              Marker som hentet
            </Button>
          )}
        </Card>
      </motion.div>
    )
  }

  // Rendrer en hengergruppe (for både klare og hentede soner)
  function renderTrailerGroup(group: TrailerGroup, filterStatus: 'completed' | 'picked_up') {
    const filteredZones = group.zones.filter(z => z.status === filterStatus)
    const isMine = isMyGroup(group)
    const isPickedUp = filterStatus === 'picked_up'

    return (
      <div
        key={`${group.area}-${group.trailerGroup}-${filterStatus}`}
        className={`rounded-xl p-3 mb-3 ${
          isMine
            ? 'border-l-4 border-l-accent bg-accent/5'
            : 'bg-black/[0.02]'
        } ${isPickedUp ? 'opacity-60' : ''}`}
      >
        {/* Henger-header */}
        <div className="flex items-center gap-2 mb-2">
          <Truck size={14} className={isMine ? 'text-accent' : 'text-text-tertiary'} />
          <span className="text-sm font-semibold">
            Henger {group.trailerGroup}
            {group.driverName && <span className="font-normal text-text-secondary"> — {group.driverName}</span>}
          </span>
          {isMine && (
            <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">din</span>
          )}
        </div>

        {/* Soner i gruppen */}
        {filteredZones.length > 0 ? (
          <div className="space-y-3">
            {isPickedUp ? (
              // Kompakt visning for hentede soner
              filteredZones.map(zone => (
                <div key={zone.assignmentId} className="flex items-center gap-2 py-1">
                  <Check size={14} className="text-purple-500 shrink-0" />
                  <span className="text-sm">{zone.zoneName}</span>
                  {zone.households > 0 && (
                    <span className="text-xs text-text-tertiary">({zone.households} hus)</span>
                  )}
                </div>
              ))
            ) : (
              filteredZones.map((zone, i) => renderReadyZone(zone, i))
            )}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary italic">
            {isPickedUp ? 'Ingen soner hentet ennå' : 'Ingen soner klare ennå'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 pt-14 pb-28 safe-top">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <Truck size={22} className="text-accent" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Henting</h1>
          {events.length > 0 && (
            <p className="text-sm text-text-secondary">{events.map(e => e.title).join(' · ')}</p>
          )}
        </div>
      </div>

      {/* Sjåførnotater fra aktive hendelser */}
      {!loading && events.filter(e => e.driver_notes).map(e => (
        <div key={e.id} className="mb-4 flex items-start gap-3 rounded-xl bg-blue-50 p-3">
          <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-600 mb-0.5">{e.title}</p>
            <p className="text-sm text-blue-800">{e.driver_notes}</p>
          </div>
        </div>
      ))}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 h-24" />
          ))}
        </div>
      )}

      {!loading && zones.length === 0 && trailerGroups.length === 0 && (
        <Card className="p-6 text-center">
          <Package size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">
            {events.length === 0
              ? 'Ingen aktive hendelser akkurat nå.'
              : 'Ingen soner er ferdigplukket ennå.'}
          </p>
        </Card>
      )}

      {/* Feilmelding */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger/10 text-danger text-sm text-center">
          {error}
        </div>
      )}

      {/* Klare for henting — gruppert per henger */}
      {!loading && trailerGroups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Klare for henting
          </h2>
          {hasMultipleAreas ? (
            // Grupper per område med overskrift
            areas.map(area => (
              <div key={`ready-${area}`}>
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mt-4 mb-2">
                  {area === 'NORD' ? 'Nord' : 'Sør'}
                </h3>
                {trailerGroups
                  .filter(g => g.area === area)
                  .map(group => renderTrailerGroup(group, 'completed'))}
              </div>
            ))
          ) : (
            trailerGroups.map(group => renderTrailerGroup(group, 'completed'))
          )}
        </div>
      )}

      {/* Hentet — gruppert per henger, kompakt */}
      {!loading && zones.some(z => z.status === 'picked_up') && (
        <div>
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Hentet
          </h2>
          {hasMultipleAreas ? (
            areas.map(area => (
              <div key={`picked-${area}`}>
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mt-4 mb-2">
                  {area === 'NORD' ? 'Nord' : 'Sør'}
                </h3>
                {trailerGroups
                  .filter(g => g.area === area && g.zones.some(z => z.status === 'picked_up'))
                  .map(group => renderTrailerGroup(group, 'picked_up'))}
              </div>
            ))
          ) : (
            trailerGroups
              .filter(g => g.zones.some(z => z.status === 'picked_up'))
              .map(group => renderTrailerGroup(group, 'picked_up'))
          )}
        </div>
      )}
    </div>
  )
}
