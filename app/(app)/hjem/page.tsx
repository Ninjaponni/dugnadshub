'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { MapPin, Calendar, Users, ChevronRight, Check } from 'lucide-react'
import Link from 'next/link'
import type { Profile, DugnadEvent, ZoneAssignment, ZoneClaim } from '@/lib/supabase/types'

interface EventWithProgress extends DugnadEvent {
  totalZones: number
  claimedZones: number
  completedZones: number
}

interface MyZone {
  zoneId: string
  zoneName: string
  area: string
  status: string
  partnerName: string | null
}

// Dashboard — hovedside etter innlogging
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

      // Hent profil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profileData) setProfile(profileData as unknown as Profile)

      // Hent alle kommende/aktive hendelser
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .in('status', ['upcoming', 'active'])
        .order('date', { ascending: true })
      if (!eventData) return

      // Hent progresjon og mine soner for hver hendelse
      const eventsWithProgress: EventWithProgress[] = []
      const allMyZones: MyZone[] = []

      for (const event of eventData as unknown as DugnadEvent[]) {
        const { data: assignments } = await supabase
          .from('zone_assignments')
          .select('*')
          .eq('event_id', event.id)
        const assigns = (assignments || []) as unknown as ZoneAssignment[]

        // Tell status
        const total = assigns.length
        const claimed = assigns.filter(a =>
          a.status === 'claimed' || a.status === 'in_progress' || a.status === 'completed' || a.status === 'picked_up'
        ).length
        const completed = assigns.filter(a =>
          a.status === 'completed' || a.status === 'picked_up'
        ).length

        eventsWithProgress.push({ ...event, totalZones: total, claimedZones: claimed, completedZones: completed })

        // Hent mine claims for dette eventet
        const { data: myClaims } = await supabase
          .from('zone_claims')
          .select('*, zone_assignments(zone_id, status)')
          .eq('user_id', user.id)
          .in('assignment_id', assigns.map(a => a.id))

        if (myClaims) {
          for (const claim of myClaims as unknown as Array<ZoneClaim & { zone_assignments: { zone_id: string; status: string } }>) {
            const zoneId = claim.zone_assignments?.zone_id
            if (!zoneId) continue

            // Hent sonenavn
            const { data: zone } = await supabase
              .from('zones')
              .select('name, area')
              .eq('id', zoneId)
              .single()

            // Hent evt. partner
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
              partnerName: partner?.profiles?.full_name || null,
            })
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

  const firstName = profile?.full_name?.split(' ')[0] || ''

  // Nedtelling til neste hendelse
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

  const nextEvent = events[0] || null

  return (
    <div className="px-4 pt-14 safe-top">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <p className="text-text-secondary text-[15px]">{greeting()}</p>
        <h1 className="text-[34px] font-bold tracking-tight">
          {firstName || 'Dugnadshub'}
        </h1>
      </motion.div>

      {/* Skeleton mens data lastes */}
      {loading && (
        <div className="space-y-3 mb-5 animate-pulse">
          <div className="h-4 w-32 bg-black/5 rounded" />
          <div className="card p-4 space-y-3">
            <div className="h-5 w-48 bg-black/5 rounded" />
            <div className="h-4 w-36 bg-black/5 rounded" />
            <div className="h-1.5 bg-black/5 rounded-full" />
            <div className="h-10 bg-black/5 rounded-xl" />
          </div>
          <div className="card p-4 space-y-3">
            <div className="h-5 w-40 bg-black/5 rounded" />
            <div className="h-4 w-36 bg-black/5 rounded" />
            <div className="h-1.5 bg-black/5 rounded-full" />
            <div className="h-10 bg-black/5 rounded-xl" />
          </div>
        </div>
      )}

      {/* Mine soner (hvis noen er valgt) */}
      {!loading && myZones.length > 0 && (
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
                      {zone.area === 'NORD' ? 'Nord' : 'Sør'} · {zone.zoneId}
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

      {/* Hendelser */}
      {!loading && <div className="mb-5">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
          {events.length > 1 ? 'Kommende dugnader' : 'Neste dugnad'}
        </h2>

        {events.length === 0 && (
          <Card className="p-5">
            <p className="text-text-secondary text-center py-2">
              Ingen kommende dugnader
            </p>
          </Card>
        )}

        {events.map((event, i) => {
          const days = daysUntil(event.date)
          const isNext = i === 0
          const progressPct = event.totalZones > 0
            ? Math.round((event.claimedZones / event.totalZones) * 100)
            : 0

          return (
            <Card
              key={event.id}
              className={`p-4 mb-3 ${isNext ? 'bg-gradient-to-br from-accent/5 to-accent/10' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[15px] font-semibold">{event.title}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDate(event.date, event.start_time)}
                  </p>
                </div>
                <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                  {days <= 0 ? 'I dag!' : days === 1 ? 'I morgen' : `om ${days} dager`}
                </span>
              </div>

              {/* Progresjonslinje */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                  <span>{event.claimedZones}/{event.totalZones} soner tatt</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-accent rounded-full"
                  />
                </div>
              </div>

              <Link href="/kart">
                <Button size="sm" variant={isNext ? 'primary' : 'secondary'} className="w-full">
                  <MapPin size={14} />
                  {event.status === 'active' ? 'Åpne kart' : 'Velg soner'}
                </Button>
              </Link>
            </Card>
          )
        })}
      </div>}
    </div>
  )
}
