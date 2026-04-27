'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { MapPin, Check, ChevronRight, Calendar } from 'lucide-react'
import Link from 'next/link'
import KorpsLogo from '@/components/ui/KorpsLogo'
import type { Profile, DugnadEvent } from '@/lib/supabase/types'
import PushPrompt from '@/components/features/PushPrompt'
import OnboardingWizard from '@/components/features/OnboardingWizard'
import { formatDate, daysUntilLabel } from '@/lib/utils/date'
import { isMockMode } from '@/lib/mock/useMock'
import { mockProfile, mockEventsWithProgress, mockMyZones } from '@/lib/mock/data'

interface EventWithProgress extends DugnadEvent {
  totalZones: number
  claimedZones: number
  completedZones: number
  totalNeeded: number
  totalClaims: number
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
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('onboarding_complete')) {
      setShowOnboarding(true)
    }
  }, [])

  // Mock-modus
  useEffect(() => {
    if (!isMockMode()) return
    setProfile(mockProfile)
    setEvents(mockEventsWithProgress)
    setMyZones(mockMyZones)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isMockMode()) return
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) { setLoading(false); return }

      const [profileRes, eventsRes] = await Promise.all([
        supabaseRef.current.from('profiles').select('*').eq('id', user.id).single() as unknown as Promise<{ data: unknown }>,
        supabaseRef.current.from('events').select('*').in('status', ['upcoming', 'active']).order('date', { ascending: true }) as unknown as Promise<{ data: unknown[] | null }>,
      ])

      if (profileRes.data) setProfile(profileRes.data as Profile)
      const allEvents = (eventsRes.data || []) as unknown as DugnadEvent[]
      if (allEvents.length === 0) { setLoading(false); return }

      const eventIds = allEvents.map(e => e.id)

      const [assignRes, zonesRes] = await Promise.all([
        supabaseRef.current.from('zone_assignments').select('*').in('event_id', eventIds),
        supabaseRef.current.from('zones').select('id, name, area, collectors_needed'),
      ])

      const assignments = (assignRes.data || []) as unknown as Array<{ id: string; event_id: string; zone_id: string; status: string }>

      const assignmentIds = assignments.map(a => a.id)
      const { data: claimData } = assignmentIds.length > 0
        ? await supabaseRef.current.from('zone_claims').select('*, profiles(full_name)').in('assignment_id', assignmentIds)
        : { data: [] }

      const claims = (claimData || []) as unknown as Array<{ id: string; assignment_id: string; user_id: string; profiles: { full_name: string } | null }>
      const zoneMap = new Map((zonesRes.data || []).map((z: { id: string; name: string; area: string; collectors_needed: number }) => [z.id, z]))

      const eventsWithProgress: EventWithProgress[] = allEvents.map(event => {
        const eventAssignments = assignments.filter(a => a.event_id === event.id)
        const total = eventAssignments.length
        let zonesWithClaims = 0
        let completed = 0
        let totalNeeded = 0
        let totalClaims = 0
        for (const a of eventAssignments) {
          const claimsOnAssignment = claims.filter(c => c.assignment_id === a.id).length
          totalClaims += claimsOnAssignment
          totalNeeded += zoneMap.get(a.zone_id)?.collectors_needed || 0
          if (claimsOnAssignment > 0) zonesWithClaims++
          if (a.status === 'completed' || a.status === 'picked_up') completed++
        }
        return { ...event, totalZones: total, claimedZones: zonesWithClaims, completedZones: completed, totalNeeded, totalClaims }
      })

      const activeEventIds = new Set(allEvents.filter(e => e.status === 'active').map(e => e.id))
      const myClaims = claims.filter(c => c.user_id === user.id)
      const allMyZones: MyZone[] = myClaims.map(claim => {
        const assignment = assignments.find(a => a.id === claim.assignment_id)
        if (!assignment) return null
        if (!activeEventIds.has(assignment.event_id)) return null
        const zone = zoneMap.get(assignment.zone_id) as { id: string; name: string; area: string } | undefined
        const event = allEvents.find(e => e.id === assignment.event_id)
        const partner = claims.find(c => c.assignment_id === claim.assignment_id && c.user_id !== user.id)
        return {
          zoneId: assignment.zone_id, eventId: assignment.event_id,
          zoneName: zone?.name || assignment.zone_id, area: zone?.area || '',
          status: assignment.status, eventTitle: event?.title || '',
          partnerName: partner?.profiles?.full_name || null,
        }
      }).filter(Boolean) as MyZone[]

      setEvents(eventsWithProgress)
      setMyZones(allMyZones)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 6) return 'God natt'
    if (hour < 10) return 'God morgen'
    if (hour < 12) return 'God formiddag'
    if (hour < 17) return 'God ettermiddag'
    return 'God kveld'
  }

  const fullName = profile?.full_name || ''
  const activeEvents = events.filter(e => e.status === 'active')
  const futureEvents = events.filter(e => e.status === 'upcoming')

  function completeOnboarding() {
    localStorage.setItem('onboarding_complete', '1')
    setShowOnboarding(false)
    async function reload() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) return
      const { data } = await supabaseRef.current.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data as unknown as Profile)
    }
    reload()
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={completeOnboarding} />}

      {/* Header — fast topp med logo og varsler */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <div className="flex items-center gap-3">
            <KorpsLogo size={32} />
            <span className="text-xl font-bold text-accent tracking-tight font-[var(--font-display)]">
              Dugnadshub
            </span>
          </div>
          {/* Plass til evt. fremtidig varsel-ikon */}
          <div className="w-9" />
        </div>
      </header>

      <main className="pt-20 pb-28 px-5 space-y-8">
        <PushPrompt />

        {/* Hilsen */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-2"
        >
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 w-20 bg-surface-low rounded animate-pulse" />
              <div className="h-10 w-48 bg-surface-low rounded animate-pulse" />
            </div>
          ) : (
            <>
              <span className="text-[10px] font-semibold text-accent uppercase tracking-widest block mb-1">
                Velkommen
              </span>
              <h1 className="text-4xl font-extrabold text-text-primary tracking-tight leading-tight font-[var(--font-display)]">
                {greeting()},<br />{fullName}
              </h1>
            </>
          )}
        </motion.section>

        {/* Skeleton for lasting */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="card p-8 rounded-[2rem] space-y-4">
              <div className="h-6 w-48 bg-surface-low rounded" />
              <div className="h-4 w-32 bg-surface-low rounded" />
              <div className="h-3 bg-surface-low rounded-full" />
              <div className="h-12 bg-surface-low rounded-full" />
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* Aktive dugnader — store clay-kort */}
            {activeEvents.map((event) => {
              // Reell bemanning: andel av påkrevde plasser som er fylt
              const progress = event.totalNeeded > 0
                ? Math.round((event.totalClaims / event.totalNeeded) * 100) : 0

              return (
                <motion.section
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="card rounded-[2rem] p-7 relative overflow-hidden">
                    {/* Subtil glow-effekt */}
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-container/20 rounded-full blur-3xl" />

                    <div className="flex justify-between items-start mb-5 relative">
                      <div>
                        <h2 className="text-2xl font-bold text-text-primary font-[var(--font-display)] mb-1">
                          {event.title}
                        </h2>
                        <p className="text-text-secondary font-medium text-sm">
                          {formatDate(event.date, event.start_time)}
                        </p>
                      </div>
                      <span className="bg-accent/10 text-accent px-3 py-1 rounded-full text-xs font-bold shrink-0">
                        {daysUntilLabel(event.date)}
                      </span>
                    </div>

                    {/* Fremdrift */}
                    <div className="space-y-2 mb-6 relative">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-text-secondary">{event.claimedZones}/{event.totalZones} soner tatt</span>
                        <span className="text-sm font-bold text-accent">{progress}% bemannet</span>
                      </div>
                      <div className="w-full h-3 bg-surface-low rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: 'linear-gradient(to right, var(--color-accent), var(--color-primary-container))' }}
                        />
                      </div>
                    </div>

                    {/* Åpne kart-knapp */}
                    <Link href={`/kart?event=${event.id}`} className="block relative">
                      <button
                        className="w-full py-4 px-6 rounded-full text-white font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform font-[var(--font-display)]"
                        style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
                      >
                        <MapPin size={18} />
                        Åpne kart
                      </button>
                    </Link>
                  </div>
                </motion.section>
              )
            })}

            {/* Ingen aktive — vis info */}
            {activeEvents.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card rounded-[2rem] p-7 text-center"
              >
                <p className="text-text-secondary text-[15px]">
                  Ingen aktive dugnader nå,<br />du kan ta livet helt med ro.
                </p>
              </motion.div>
            )}

            {/* Mine soner */}
            {myZones.length > 0 && (
              <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xl font-bold text-text-primary font-[var(--font-display)]">Mine soner</h3>
                  <Link href="/kart" className="text-accent text-sm font-bold">Se alle</Link>
                </div>
                <div className="space-y-3">
                  {myZones.map((zone, i) => (
                    <motion.div
                      key={zone.zoneId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link href={`/kart?event=${zone.eventId}&sone=${zone.zoneId}`}>
                        <div className="flex items-center justify-between p-5 bg-surface-low rounded-[1.5rem] hover:bg-surface-low/70 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${
                              zone.status === 'completed' ? 'bg-success/10' : 'bg-card'
                            }`}>
                              {zone.status === 'completed'
                                ? <Check size={18} className="text-success" />
                                : <MapPin size={18} className="text-accent" />
                              }
                            </div>
                            <div>
                              <p className="font-bold text-text-primary">{zone.zoneName}</p>
                              <p className="text-xs text-text-secondary font-medium">{zone.eventTitle}</p>
                              {zone.partnerName && (
                                <p className="text-xs text-text-tertiary">med {zone.partnerName}</p>
                              )}
                            </div>
                          </div>
                          {zone.status === 'completed' ? (
                            <div className="flex items-center gap-1.5 text-success">
                              <span className="text-sm font-bold">Ferdig</span>
                              <Check size={16} />
                            </div>
                          ) : (
                            <ChevronRight size={16} className="text-text-tertiary" />
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Kommende dugnader — info-kort */}
            {futureEvents.length > 0 && (
              <section>
                <div className="bg-warning/10 rounded-[2rem] p-6 flex gap-5 items-center">
                  <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center shrink-0">
                    <Calendar size={24} className="text-warning" />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary font-[var(--font-display)]">
                      {futureEvents.length === 1 ? 'Neste dugnad' : `${futureEvents.length} kommende dugnader`}
                    </h4>
                    <p className="text-sm text-text-secondary">
                      {futureEvents[0].title} — {formatDate(futureEvents[0].date, futureEvents[0].start_time)}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}
