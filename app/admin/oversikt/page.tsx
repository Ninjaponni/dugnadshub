'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Users, Calendar, ChevronRight, Zap, Map } from 'lucide-react'
import Link from 'next/link'
import type { DugnadEvent } from '@/lib/supabase/types'

interface EventSummary extends DugnadEvent {
  totalZones: number
  claimedZones: number
}

export default function AdminOverviewPage() {
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    async function load() {
      const sb = supabaseRef.current

      const [profilesRes, eventsRes, assignmentsRes, claimsRes] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }),
        sb.from('events').select('*').in('status', ['upcoming', 'active']).order('date') as unknown as Promise<{ data: DugnadEvent[] | null }>,
        sb.from('zone_assignments').select('id, event_id, zone_id') as unknown as Promise<{ data: Array<{ id: string; event_id: string; zone_id: string }> | null }>,
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
        return { ...event, totalZones: eventAssignments.length, claimedZones }
      })

      setEvents(eventSummaries)
      setLoading(false)
    }
    load()
  }, [])

  async function handleActivate(eventId: string) {
    setActivating(eventId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('events') as any).update({ status: 'active' }).eq('id', eventId)
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'active' as const } : e))
    setActivating(null)
  }

  function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  function formatDate(dateStr: string, time: string | null): string {
    const d = new Date(dateStr)
    const formatted = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
    if (time) return `${formatted} kl. ${time.slice(0, 5)}`
    return formatted
  }

  const nextEvent = events[0] || null

  return (
    <div>
      {/* Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="card p-5 space-y-3">
            <div className="h-5 w-48 bg-black/5 rounded" />
            <div className="h-4 w-36 bg-black/5 rounded" />
            <div className="h-10 bg-black/5 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 h-20" />
            <div className="card p-4 h-20" />
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Neste hendelse — hero */}
          {nextEvent && (
            <Card className="p-5 mb-5 bg-gradient-to-br from-accent/5 to-accent/10">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-medium text-accent uppercase tracking-wide">
                    {nextEvent.status === 'active' ? 'Aktiv nå' : 'Neste hendelse'}
                  </p>
                  <p className="text-lg font-semibold mt-0.5">{nextEvent.title}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDate(nextEvent.date, nextEvent.start_time)}
                  </p>
                </div>
                <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                  {(() => {
                    const d = daysUntil(nextEvent.date)
                    if (d <= 0) return 'I dag!'
                    if (d === 1) return 'I morgen'
                    return `om ${d} dager`
                  })()}
                </span>
              </div>

              {/* Progresjon */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                  <span>{nextEvent.claimedZones}/{nextEvent.totalZones} soner tatt</span>
                  <span>{nextEvent.totalZones > 0 ? Math.round((nextEvent.claimedZones / nextEvent.totalZones) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${nextEvent.totalZones > 0 ? (nextEvent.claimedZones / nextEvent.totalZones) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Hurtighandling */}
              {nextEvent.status === 'upcoming' && (
                <Button
                  size="sm"
                  className="w-full"
                  loading={activating === nextEvent.id}
                  onClick={() => handleActivate(nextEvent.id)}
                >
                  <Zap size={14} />
                  Aktiver hendelse
                </Button>
              )}
              {nextEvent.status === 'active' && (
                <Link href="/kart">
                  <Button size="sm" variant="secondary" className="w-full">
                    <Map size={14} />
                    Se kart
                  </Button>
                </Link>
              )}
            </Card>
          )}

          {/* Statistikk */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Card animate={false} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} className="text-text-secondary" />
                <span className="text-xs text-text-secondary">Medlemmer</span>
              </div>
              <p className="text-2xl font-bold font-mono">{memberCount}</p>
            </Card>
            <Card animate={false} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={16} className="text-text-secondary" />
                <span className="text-xs text-text-secondary">Hendelser</span>
              </div>
              <p className="text-2xl font-bold font-mono">{events.length}</p>
            </Card>
          </div>

          {/* Navigasjon */}
          <div className="space-y-3">
            {[
              { href: '/admin/hendelser', icon: Calendar, label: 'Hendelser', desc: 'Opprett og administrer dugnader' },
              { href: '/admin/medlemmer', icon: Users, label: 'Medlemmer', desc: 'Roller, merker og oversikt' },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href}>
                <Card className="p-4 flex items-center gap-4 mb-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-text-secondary">{desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-text-tertiary shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
