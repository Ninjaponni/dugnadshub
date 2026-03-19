'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { MapPin, ChevronRight, Check, Calendar } from 'lucide-react'
import Link from 'next/link'
import type { Profile, DugnadEvent } from '@/lib/supabase/types'
import PushPrompt from '@/components/features/PushPrompt'
import OnboardingWizard from '@/components/features/OnboardingWizard'
import { formatDate, daysUntilLabel } from '@/lib/utils/date'

interface EventWithProgress extends DugnadEvent {
  totalZones: number
  claimedZones: number
  completedZones: number
}

interface MyZone {
  zoneId: string
  eventId: string
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
  const [showOnboarding, setShowOnboarding] = useState(false)
  const supabase = createClient()

  // Sjekk onboarding-status ved mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('onboarding_complete')) {
      setShowOnboarding(true)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Parallelle kall i stedet for sekvensielle
      const [profileRes, eventsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single() as unknown as Promise<{ data: unknown }>,
        supabase.from('events').select('*').in('status', ['upcoming', 'active']).order('date', { ascending: true }) as unknown as Promise<{ data: unknown[] | null }>,
      ])

      if (profileRes.data) setProfile(profileRes.data as Profile)
      const allEvents = (eventsRes.data || []) as unknown as DugnadEvent[]
      if (allEvents.length === 0) { setLoading(false); return }

      // Hent ALLE assignments og claims i to kall (ikke per event/per sone)
      const eventIds = allEvents.map(e => e.id)

      const [assignRes, claimRes, zonesRes] = await Promise.all([
        supabase.from('zone_assignments').select('*').in('event_id', eventIds),
        supabase.from('zone_claims').select('*, profiles(full_name)').in(
          'assignment_id',
          // Trenger assignment IDer — hent alle
          (await supabase.from('zone_assignments').select('id').in('event_id', eventIds))
            .data?.map((a: { id: string }) => a.id) || []
        ),
        supabase.from('zones').select('id, name, area'),
      ])

      const assignments = (assignRes.data || []) as unknown as Array<{ id: string; event_id: string; zone_id: string; status: string }>
      const claims = (claimRes.data || []) as unknown as Array<{ id: string; assignment_id: string; user_id: string; profiles: { full_name: string } | null }>
      const zoneMap = new Map((zonesRes.data || []).map((z: { id: string; name: string; area: string }) => [z.id, z]))

      // Bygg progresjon per event
      const eventsWithProgress: EventWithProgress[] = allEvents.map(event => {
        const eventAssignments = assignments.filter(a => a.event_id === event.id)
        const total = eventAssignments.length

        // Tell soner som har minst én claim
        let zonesWithClaims = 0
        let completed = 0
        for (const a of eventAssignments) {
          const hasClaims = claims.some(c => c.assignment_id === a.id)
          if (hasClaims) zonesWithClaims++
          if (a.status === 'completed' || a.status === 'picked_up') completed++
        }

        return { ...event, totalZones: total, claimedZones: zonesWithClaims, completedZones: completed }
      })

      // Bygg mine soner — kun fra aktive hendelser
      const activeEventIds = new Set(allEvents.filter(e => e.status === 'active').map(e => e.id))
      const myClaims = claims.filter(c => c.user_id === user.id)
      const allMyZones: MyZone[] = myClaims.map(claim => {
        const assignment = assignments.find(a => a.id === claim.assignment_id)
        if (!assignment) return null

        // Vis kun soner fra aktive hendelser
        if (!activeEventIds.has(assignment.event_id)) return null

        const zone = zoneMap.get(assignment.zone_id) as { id: string; name: string; area: string } | undefined
        const event = allEvents.find(e => e.id === assignment.event_id)

        // Finn partner (andre claims på samme assignment)
        const partner = claims.find(c => c.assignment_id === claim.assignment_id && c.user_id !== user.id)

        return {
          zoneId: assignment.zone_id,
          eventId: assignment.event_id,
          zoneName: zone?.name || assignment.zone_id,
          area: zone?.area || '',
          status: assignment.status,
          eventTitle: event?.title || '',
          partnerName: partner?.profiles?.full_name || null,
        }
      }).filter(Boolean) as MyZone[]

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

  const activeEvents = events.filter(e => e.status === 'active')
  const futureEvents = events.filter(e => e.status === 'upcoming')

  // Lukk onboarding og marker som fullført
  function completeOnboarding() {
    localStorage.setItem('onboarding_complete', '1')
    setShowOnboarding(false)
    // Refresh profildata etter evt. lagring i onboarding
    async function reload() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data as unknown as Profile)
    }
    reload()
  }

  return (
    <div className="px-4 pt-14 safe-top">
      {showOnboarding && <OnboardingWizard onComplete={completeOnboarding} />}
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
          <PushPrompt />

          {myZones.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Mine soner
              </h2>
              <div className="flex flex-col gap-2">
                {myZones.map((zone) => (
                  <Link key={zone.zoneId} href={`/kart?event=${zone.eventId}&sone=${zone.zoneId}`}>
                    <Card className={`p-3 flex items-center gap-3 ${
                      zone.status === 'completed' ? 'border-l-4 border-l-success' : ''
                    }`}>
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
                          {zone.status === 'completed' && <span className="text-success font-medium">Ferdig · </span>}
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

          {activeEvents.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                {activeEvents.length === 1 ? 'Aktiv dugnad' : 'Aktive dugnader'}
              </h2>
              <div className="space-y-3">
                {activeEvents.map((event) => (
                  <Card key={event.id} className="p-4 bg-gradient-to-br from-accent/5 to-accent/10">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[15px] font-semibold">{event.title}</p>
                        <p className="text-sm text-text-secondary">
                          {formatDate(event.date, event.start_time)}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                        {daysUntilLabel(event.date)}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                        <span>{event.claimedZones}/{event.totalZones} soner tatt</span>
                        <span>{event.totalZones > 0 ? Math.round((event.claimedZones / event.totalZones) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${event.totalZones > 0 ? (event.claimedZones / event.totalZones) * 100 : 0}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-accent rounded-full"
                        />
                      </div>
                    </div>

                    <Link href={`/kart?event=${event.id}`}>
                      <Button size="sm" className="w-full">
                        <MapPin size={14} />
                        Åpne kart
                      </Button>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeEvents.length === 0 && (
            <Card className="p-5 mb-5">
              <p className="text-text-secondary text-center py-2 text-[15px]">
                Ingen aktive dugnader nå,<br />du kan ta livet helt med ro.
              </p>
              {futureEvents.length > 0 && (
                <div className="mt-4 pt-4 border-t border-black/5">
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2 text-center">
                    Planlagte dugnader
                  </p>
                  {futureEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 py-2">
                      <Calendar size={16} className="text-text-tertiary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-text-tertiary">
                          {formatDate(event.date, event.start_time)}
                        </p>
                      </div>
                      <span className="text-xs text-text-tertiary shrink-0">
                        {daysUntilLabel(event.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
