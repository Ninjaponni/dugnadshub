'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DugnadEvent } from '@/lib/supabase/types'

// Henter aktivt eller kommende event
export function useActiveEvent() {
  const [event, setEvent] = useState<DugnadEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    async function fetch() {
      const { data } = await supabaseRef.current
        .from('events')
        .select('*')
        .in('status', ['active', 'upcoming'])
        .order('date', { ascending: true })
        .limit(1)
        .single()

      if (data) setEvent(data as unknown as DugnadEvent)
      setLoading(false)
    }

    fetch()
  }, [])

  return { event, loading }
}
