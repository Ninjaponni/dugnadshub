'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Truck, MapPin, Check, Package } from 'lucide-react'
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
  collectors: Array<{ full_name: string | null; phone: string | null }>
}

// Sjåførvisning — viser soner klare for henting
export default function DriverPage() {
  const [zones, setZones] = useState<DriverZone[]>([])
  const [events, setEvents] = useState<DugnadEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [pickingUp, setPickingUp] = useState<string | null>(null)
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

    // Hent assignments med status completed eller picked_up
    const { data: assignments } = await sb
      .from('zone_assignments')
      .select('id, event_id, zone_id, status')
      .in('event_id', eventIds)
      .in('status', ['completed', 'picked_up']) as unknown as {
        data: Array<{ id: string; event_id: string; zone_id: string; status: string }> | null
      }

    if (!assignments || assignments.length === 0) {
      setZones([])
      setLoading(false)
      return
    }

    // Hent soneinfo
    const zoneIds = [...new Set(assignments.map(a => a.zone_id))]
    const { data: zonesData } = await sb
      .from('zones')
      .select('id, name, area, households')
      .in('id', zoneIds) as unknown as {
        data: Array<{ id: string; name: string; area: string; households: number }> | null
      }

    const zoneMap = new Map((zonesData || []).map(z => [z.id, z]))

    // Hent claims med profil (for kontaktinfo)
    const assignmentIds = assignments.map(a => a.id)
    const { data: claims } = await sb
      .from('zone_claims')
      .select('assignment_id, user_id, profiles(full_name, phone)')
      .in('assignment_id', assignmentIds) as unknown as {
        data: Array<{
          assignment_id: string
          user_id: string
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
        collectors: zoneClaims.map(c => ({
          full_name: c.profiles?.full_name || null,
          phone: c.profiles?.phone || null,
        })),
      }
    })

    // Sorter: completed først (klare for henting), picked_up sist
    driverZones.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return -1
      if (a.status !== 'completed' && b.status === 'completed') return 1
      return a.zoneName.localeCompare(b.zoneName, 'nb')
    })

    setZones(driverZones)
    setLoading(false)
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
    // Oppdater lokal state
    setZones(prev => prev.map(z =>
      z.assignmentId === assignmentId ? { ...z, status: 'picked_up' } : z
    ))
    setPickingUp(null)
  }

  const readyZones = zones.filter(z => z.status === 'completed')
  const pickedUpZones = zones.filter(z => z.status === 'picked_up')

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

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 h-24" />
          ))}
        </div>
      )}

      {!loading && zones.length === 0 && (
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

      {!loading && readyZones.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Klare for henting ({readyZones.length})
          </h2>
          <div className="space-y-3">
            {readyZones.map((zone, i) => (
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
                        <div key={j} className="flex items-center gap-2 text-sm">
                          <span>{c.full_name || 'Ukjent'}</span>
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="text-accent text-xs">
                              {c.phone}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    loading={pickingUp === zone.assignmentId}
                    onClick={() => handlePickUp(zone.assignmentId)}
                  >
                    <Check size={14} />
                    Marker som hentet
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {!loading && pickedUpZones.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Hentet ({pickedUpZones.length})
          </h2>
          <div className="space-y-2">
            {pickedUpZones.map((zone) => (
              <Card key={zone.assignmentId} className="p-3 flex items-center gap-3 opacity-60">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Check size={16} className="text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{zone.zoneName}</p>
                  <p className="text-xs text-text-tertiary">{zone.area === 'NORD' ? 'Nord' : 'Sør'}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
