'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DugnadEvent } from '@/lib/supabase/types'

// Henter aktivt eller kommende event
export function useActiveEvent() {
  const [event, setEvent] = useState<DugnadEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetch() {
      // Prøv aktivt event først, deretter kommende
      const { data } = await supabase
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
  }, [supabase])

  return { event, loading }
}
