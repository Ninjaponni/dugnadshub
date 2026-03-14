'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { MapPin, Calendar, Award, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { Profile, DugnadEvent } from '@/lib/supabase/types'

// Dashboard — hovedside etter innlogging
export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [nextEvent, setNextEvent] = useState<DugnadEvent | null>(null)
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
        .limit(1)
        .single()

      if (eventData) setNextEvent(eventData as unknown as DugnadEvent)
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

      {/* Hero-kort — neste hendelse */}
      {nextEvent ? (
        <Card className="p-5 mb-4 bg-gradient-to-br from-accent/5 to-accent/10">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-accent uppercase tracking-wide">
                {nextEvent.status === 'active' ? 'Pågår nå' : 'Neste dugnad'}
              </p>
              <h2 className="text-xl font-semibold mt-1">{nextEvent.title}</h2>
            </div>
            <Calendar size={20} className="text-accent mt-1" />
          </div>
          <p className="text-text-secondary text-[15px] mb-4">
            {new Date(nextEvent.date).toLocaleDateString('nb-NO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            {nextEvent.start_time && ` kl. ${nextEvent.start_time}`}
          </p>
          <Link href="/kart">
            <Button size="md" className="w-full">
              <MapPin size={16} />
              {nextEvent.status === 'active' ? 'Åpne kart' : 'Velg soner'}
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="p-5 mb-4">
          <p className="text-text-secondary text-center py-4">
            Ingen kommende dugnader akkurat nå
          </p>
        </Card>
      )}

      {/* Hurtiglenker */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href="/kart">
          <Card className="p-4 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <MapPin size={20} className="text-accent" />
            </div>
            <span className="text-sm font-medium">Sonekart</span>
          </Card>
        </Link>
        <Link href="/merker">
          <Card className="p-4 flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center">
              <Award size={20} className="text-teal" />
            </div>
            <span className="text-sm font-medium">Mine merker</span>
          </Card>
        </Link>
      </div>

      {/* Siste aktivitet (placeholder) */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Siste aktivitet</h3>
          <ChevronRight size={18} className="text-text-tertiary" />
        </div>
        <Card className="p-4">
          <p className="text-text-secondary text-sm text-center py-2">
            Ingen aktivitet ennå
          </p>
        </Card>
      </div>
    </div>
  )
}
