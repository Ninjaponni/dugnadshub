'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DugnadEvent } from '@/lib/supabase/types'
import { isMockMode } from '@/lib/mock/useMock'
import { mockEvents } from '@/lib/mock/data'

// Henter første aktive event, eller første kommende hvis ingen er aktive
export function useActiveEvent() {
  const [event, setEvent] = useState<DugnadEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const mock = isMockMode()

  useEffect(() => {
    if (mock) {
      setEvent(mockEvents[0])
      setLoading(false)
      return
    }
    async function fetch() {
      const { data } = await supabaseRef.current
        .from('events')
        .select('*')
        .in('status', ['active', 'upcoming'])
        .order('date', { ascending: true })

      const events = (data || []) as unknown as DugnadEvent[]
      const active = events.find(e => e.status === 'active')
      setEvent(active || events[0] || null)
      setLoading(false)
    }

    fetch()
  }, [mock])

  return { event, loading }
}

// Henter alle aktive/kommende kart-relevante hendelser
export function useActiveEvents() {
  const [events, setEvents] = useState<DugnadEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const mock = isMockMode()

  useEffect(() => {
    if (mock) {
      setEvents(mockEvents)
      setLoading(false)
      return
    }
    async function fetch() {
      const { data } = await supabaseRef.current
        .from('events')
        .select('*')
        .in('status', ['active', 'upcoming'])
        .in('type', ['bottle_collection', 'lapper', 'plast'])
        .order('date', { ascending: true })

      const all = (data || []) as unknown as DugnadEvent[]
      const active = all.filter(e => e.status === 'active')
      const upcoming = all.filter(e => e.status === 'upcoming')
      setEvents([...active, ...upcoming])
      setLoading(false)
    }

    fetch()
  }, [mock])

  return { events, loading }
}
