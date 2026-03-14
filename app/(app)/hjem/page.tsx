'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { MapPin, ChevronRight, Check, Calendar } from 'lucide-react'
import Link from 'next/link'
import type { Profile, DugnadEvent, ZoneAssignment, ZoneClaim } from '@/lib/supabase/types'

interface EventWithProgress extends DugnadEvent {
  totalZones: number
  claimedZones: number  // Antall soner med minst én claim
  completedZones: number
}

interface MyZone {
  zoneId: string
  zoneName: string
  area: string
  status: string
  eventTitle: string
  partnerName: string | null
}

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<EventWithProgress[]>([])
  const [myZones, setMyZones] = useState<MyZone[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profileData) setProfile(profileData as unknown as Profile)

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .in('status', ['upcoming', 'active'])
        .order('date', { ascending: true })
      if (!eventData) { setLoading(false); return }

      const eventsWithProgress: EventWithProgress[] = []
      const allMyZones: MyZone[] = []

      for (const event of eventData as unknown as DugnadEvent[]) {
        const { data: assignments } = await supabase
          .from('zone_assignments')
          .select('*')
          .eq('event_id', event.id)
        const assigns = (assignments || []) as unknown as ZoneAssignment[]

        // Tell soner med minst én claim (uavhengig av assignment-status)
        let zonesWithClaims = 0
        for (const a of assigns) {
          const { count } = await supabase
            .from('zone_claims')
            .select('*', { count: 'exact', head: true })
            .eq('assignment_id', a.id)
          if (count && count > 0) zonesWithClaims++
        }

        const total = assigns.length
        const completed = assigns.filter(a =>
          a.status === 'completed' || a.status === 'picked_up'
        ).length

        eventsWithProgress.push({
          ...event,
          totalZones: total,
          claimedZones: zonesWithClaims,
          completedZones: completed,
        })

        // Hent mine claims
        if (assigns.length > 0) {
          const { data: myClaims } = await supabase
            .from('zone_claims')
            .select('*, zone_assignments(zone_id, status)')
            .eq('user_id', user.id)
            .in('assignment_id', assigns.map(a => a.id))

          if (myClaims) {
            for (const claim of myClaims as unknown as Array<ZoneClaim & { zone_assignments: { zone_id: string; status: string } }>) {
              const zoneId = claim.zone_assignments?.zone_id
              if (!zoneId) continue

              const { data: zone } = await supabase
                .from('zones')
                .select('name, area')
                .eq('id', zoneId)
                .single()

              const { data: partnerClaims } = await supabase
                .from('zone_claims')
                .select('*, profiles(full_name)')
                .eq('assignment_id', claim.assignment_id)
                .neq('user_id', user.id)

              const partner = (partnerClaims as unknown as Array<{ profiles: { full_name: string } }>)?.[0]

              allMyZones.push({
                zoneId,
                zoneName: (zone as unknown as { name: string; area: string })?.name || zoneId,
                area: (zone as unknown as { name: string; area: string })?.area || '',
                status: claim.zone_assignments?.status || 'claimed',
                eventTitle: event.title,
                partnerName: partner?.profiles?.full_name || null,
              })
            }
          }
        }
      }

      setEvents(eventsWithProgress)
      setMyZones(allMyZones)
      setLoading(false)
    }

    load()
  }, [supabase])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'God morgen'
    if (hour < 17) return 'God dag'
    return 'God kveld'
  }

  const fullName = profile?.full_name || ''

  function daysUntil(dateStr: string): number {
    const now = new Date()
    const target = new Date(dateStr)
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  function formatDate(dateStr: string, time: string | null): string {
    const d = new Date(dateStr)
    const formatted = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
    if (time) {
      const t = time.split(':').slice(0, 2).join(':')
      return `${formatted} kl. ${t}`
    }
    return formatted
  }

  // Første hendelse er "aktiv" (kan velge soner), resten er "kommende"
  const activeEvent = events[0] || null
  const futureEvents = events.slice(1)

  return (
    <div className="px-4 pt-14 safe-top">
      {/* Hilsning */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <p className="text-text-secondary text-[15px]">{greeting()}</p>
        {loading ? (
          <div className="h-10 w-40 bg-black/5 rounded animate-pulse mt-1" />
        ) : (
          <h1 className="text-[34px] font-bold tracking-tight">{fullName}</h1>
        )}
      </motion.div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3 mb-5 animate-pulse">
          <div className="h-4 w-32 bg-black/5 rounded" />
          <div className="card p-4 space-y-3">
            <div className="h-5 w-48 bg-black/5 rounded" />
            <div className="h-4 w-36 bg-black/5 rounded" />
            <div className="h-1.5 bg-black/5 rounded-full" />
            <div className="h-10 bg-black/5 rounded-xl" />
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Mine soner */}
          {myZones.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Mine soner
              </h2>
              <div className="space-y-2">
                {myZones.map((zone) => (
                  <Link key={zone.zoneId} href={`/kart?sone=${zone.zoneId}`}>
                    <Card className="p-3 flex items-center gap-3 mb-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        zone.status === 'completed' ? 'bg-success/10' : 'bg-accent/10'
                      }`}>
                        {zone.status === 'completed' ? (
                          <Check size={18} className="text-success" />
                        ) : (
                          <MapPin size={18} className="text-accent" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[15px] truncate">{zone.zoneName}</p>
                        <p className="text-xs text-text-secondary">
                          {zone.eventTitle}
                          {zone.partnerName && ` · med ${zone.partnerName}`}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-text-tertiary shrink-0" />
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Aktiv dugnad (den nærmeste — kan velge soner) */}
          {activeEvent && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Aktiv dugnad
              </h2>
              <Card className="p-4 bg-gradient-to-br from-accent/5 to-accent/10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[15px] font-semibold">{activeEvent.title}</p>
                    <p className="text-sm text-text-secondary">
                      {formatDate(activeEvent.date, activeEvent.start_time)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                    {(() => {
                      const d = daysUntil(activeEvent.date)
                      if (d <= 0) return 'I dag!'
                      if (d === 1) return 'I morgen'
                      return `om ${d} dager`
                    })()}
                  </span>
                </div>

                {/* Progresjon — teller claims, ikke assignment-status */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                    <span>{activeEvent.claimedZones}/{activeEvent.totalZones} soner tatt</span>
                    <span>{activeEvent.totalZones > 0 ? Math.round((activeEvent.claimedZones / activeEvent.totalZones) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${activeEvent.totalZones > 0 ? (activeEvent.claimedZones / activeEvent.totalZones) * 100 : 0}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-accent rounded-full"
                    />
                  </div>
                </div>

                <Link href="/kart">
                  <Button size="sm" className="w-full">
                    <MapPin size={14} />
                    {activeEvent.status === 'active' ? 'Åpne kart' : 'Velg soner'}
                  </Button>
                </Link>
              </Card>
            </div>
          )}

          {/* Kommende dugnader (minimalt — kun dato og nedtelling) */}
          {futureEvents.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Kommer senere
              </h2>
              {futureEvents.map((event) => (
                <Card key={event.id} className="p-3 flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-text-secondary/5 flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[15px]">{event.title}</p>
                    <p className="text-xs text-text-secondary">
                      {formatDate(event.date, event.start_time)}
                    </p>
                  </div>
                  <span className="text-xs text-text-tertiary shrink-0">
                    om {daysUntil(event.date)} dager
                  </span>
                </Card>
              ))}
            </div>
          )}

          {/* Ingen hendelser */}
          {events.length === 0 && (
            <Card className="p-5">
              <p className="text-text-secondary text-center py-2">
                Ingen kommende dugnader
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
