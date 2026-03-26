'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Users, Calendar, ChevronRight, ChevronDown, ChevronUp, Map, ArrowLeft, Bell, Zap, Check, AlertTriangle, Power } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { DugnadEvent, EventStatus } from '@/lib/supabase/types'
import { formatDate, daysUntilLabel } from '@/lib/utils/date'

interface EventSummary extends DugnadEvent {
  totalZones: number
  claimedZones: number
  completedZones: number
  availableZones: number
}

export default function AdminOverviewPage() {
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  const loadData = useCallback(async () => {
    const sb = supabaseRef.current

    const [profilesRes, eventsRes, assignmentsRes, claimsRes] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('events').select('*').in('status', ['upcoming', 'active']).order('date') as unknown as Promise<{ data: DugnadEvent[] | null }>,
      sb.from('zone_assignments').select('id, event_id, status') as unknown as Promise<{ data: Array<{ id: string; event_id: string; status: string }> | null }>,
      sb.from('zone_claims').select('assignment_id') as unknown as Promise<{ data: Array<{ assignment_id: string }> | null }>,
    ])

    setMemberCount(profilesRes.count || 0)

    const allAssignments = assignmentsRes.data || []
    const allClaims = claimsRes.data || []

    const eventSummaries: EventSummary[] = (eventsRes.data || []).map(event => {
      const eventAssignments = allAssignments.filter(a => a.event_id === event.id)
      const claimedZones = eventAssignments.filter(a =>
        allClaims.some(c => c.assignment_id === a.id)
      ).length
      const completedZones = eventAssignments.filter(a =>
        a.status === 'completed' || a.status === 'picked_up'
      ).length
      const availableZones = eventAssignments.length - claimedZones

      return { ...event, totalZones: eventAssignments.length, claimedZones, completedZones, availableZones }
    })

    setEvents(eventSummaries)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleStatusChange(eventId: string, newStatus: EventStatus) {
    setUpdatingId(eventId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('events') as any).update({ status: newStatus }).eq('id', eventId)

    // Send push ved aktivering
    if (newStatus === 'active') {
      const event = events.find(e => e.id === eventId)
      if (event) {
        const { data: { session } } = await supabaseRef.current.auth.getSession()
        if (session) {
          await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({
              title: 'Dugnad er i gang!',
              body: `${event.title} er nå aktiv — ta en sone!`,
              url: `/kart?event=${eventId}`,
              filter: { all: true },
            }),
          }).catch(() => {})
        }
      }
    }

    await loadData()
    setUpdatingId(null)
    setDeactivateConfirmId(null)
  }

  async function handleSendHelp(event: EventSummary) {
    if (event.availableZones === 0) return
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) return

    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        title: `${event.title} trenger hjelp!`,
        body: `${event.availableZones} soner mangler folk — kan du ta en?`,
        url: `/kart?event=${event.id}`,
        filter: { all: true },
      }),
    }).catch(() => {})
  }

  function handleDeactivateClick(event: EventSummary) {
    if (event.claimedZones > 0) {
      setDeactivateConfirmId(event.id)
    } else {
      handleStatusChange(event.id, 'upcoming')
    }
  }

  const activeEvents = events.filter(e => e.status === 'active')
  const upcomingEvents = events.filter(e => e.status === 'upcoming')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/hjem" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
          <ArrowLeft size={18} className="text-text-secondary" />
        </Link>
        <h1 className="text-[28px] font-bold">Administrasjon</h1>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="card p-5 space-y-3">
            <div className="h-5 w-48 bg-black/5 rounded" />
            <div className="h-4 w-36 bg-black/5 rounded" />
            <div className="h-10 bg-black/5 rounded-xl" />
          </div>
          <div className="card p-4 h-16" />
          <div className="card p-4 h-16" />
        </div>
      )}

      {!loading && (
        <>
          {/* Aktive hendelser — operasjonssenter */}
          {activeEvents.length === 0 && (
            <Card className="p-5 mb-5 text-center">
              <p className="text-text-secondary">Ingen aktive hendelser</p>
            </Card>
          )}

          {activeEvents.map((event) => {
            const isExpanded = expandedId === event.id
            const progress = event.totalZones > 0
              ? (event.claimedZones / event.totalZones) * 100 : 0

            return (
              <Card key={event.id} className="p-5 mb-4">
                {/* Header — klikkbar for å ekspandere */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : event.id)
                    setDeactivateConfirmId(null)
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-accent uppercase tracking-wide">Aktiv nå</p>
                      <p className="text-lg font-semibold mt-0.5">{event.title}</p>
                      <p className="text-sm text-text-secondary">
                        {formatDate(event.date, event.start_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                        {daysUntilLabel(event.date)}
                      </span>
                      {isExpanded
                        ? <ChevronUp size={16} className="text-text-tertiary" />
                        : <ChevronDown size={16} className="text-text-tertiary" />
                      }
                    </div>
                  </div>

                  {/* Progresjon */}
                  <div className="mb-1">
                    <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                      <span>{event.claimedZones}/{event.totalZones} soner tatt</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Statistikk-chips */}
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {event.availableZones > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {event.availableZones} ledige
                      </span>
                    )}
                    {(event.claimedZones - event.completedZones) > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {event.claimedZones - event.completedZones} pågår
                      </span>
                    )}
                    {event.completedZones > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {event.completedZones} ferdig
                      </span>
                    )}
                  </div>
                </button>

                {/* Ekspanderte handlinger */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-black/5 mt-3 pt-3 space-y-3">
                        {/* Kart */}
                        <Link href={`/kart?event=${event.id}`}>
                          <Button size="sm" variant="secondary" className="w-full">
                            <Map size={14} /> Se kart
                          </Button>
                        </Link>

                        {/* Hjelp-varsel */}
                        {event.availableZones > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full bg-warning/10 text-warning"
                            onClick={() => handleSendHelp(event)}
                          >
                            <Bell size={14} />
                            Send hjelp-varsel ({event.availableZones} ledige)
                          </Button>
                        )}

                        {/* Deaktiver / Fullført */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={updatingId === event.id}
                            onClick={() => handleDeactivateClick(event)}
                          >
                            <Power size={14} />
                            Deaktiver
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-success/10 text-success hover:bg-success/20"
                            loading={updatingId === event.id}
                            onClick={() => handleStatusChange(event.id, 'completed')}
                          >
                            <Check size={14} />
                            Fullført
                          </Button>
                        </div>

                        {/* Deaktiverings-bekreftelse */}
                        <AnimatePresence>
                          {deactivateConfirmId === event.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="rounded-2xl overflow-hidden border border-warning/20">
                                <div className="bg-warning/5 p-4 text-center">
                                  <AlertTriangle size={28} className="text-warning mx-auto mb-2" />
                                  <p className="text-[15px] font-medium mb-1">Deaktivere?</p>
                                  <p className="text-sm text-text-secondary">
                                    {event.claimedZones} soner er tatt. Claims beholdes men skjules.
                                  </p>
                                </div>
                                <div className="flex border-t border-warning/20">
                                  <button
                                    onClick={() => setDeactivateConfirmId(null)}
                                    className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-warning/20 active:bg-black/5"
                                  >
                                    Avbryt
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(event.id, 'upcoming')}
                                    className="flex-1 py-3 text-sm font-medium text-warning active:bg-warning/10"
                                  >
                                    Deaktiver
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}

          {/* Navigasjon */}
          <div className="flex flex-col gap-3">
            <Link href="/admin/hendelser">
              <Card className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Calendar size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Hendelser</p>
                  <p className="text-sm text-text-secondary">Opprett og administrer</p>
                </div>
                {upcomingEvents.length > 0 && (
                  <span className="text-xs text-text-tertiary mr-1">{upcomingEvents.length} kommende</span>
                )}
                <ChevronRight size={16} className="text-text-tertiary shrink-0" />
              </Card>
            </Link>

            <Link href="/admin/medlemmer">
              <Card className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Users size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Medlemmer</p>
                  <p className="text-sm text-text-secondary">Roller, merker og oversikt</p>
                </div>
                <span className="text-lg font-bold font-mono text-text-secondary mr-1">{memberCount}</span>
                <ChevronRight size={16} className="text-text-tertiary shrink-0" />
              </Card>
            </Link>

            <Link href="/admin/varsler">
              <Card className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Bell size={20} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Varsler</p>
                  <p className="text-sm text-text-secondary">Send push-meldinger</p>
                </div>
                <ChevronRight size={16} className="text-text-tertiary shrink-0" />
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
