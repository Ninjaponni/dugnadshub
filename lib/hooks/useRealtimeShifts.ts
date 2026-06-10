'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ShiftWithClaims } from '@/lib/types/shifts'

export function useRealtimeShifts(eventId: string) {
  const supabaseRef = useRef(createClient())
  const [shifts, setShifts] = useState<ShiftWithClaims[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Holder vakt-IDene tilgjengelig for realtime-callback uten å trigge re-subscription
  const shiftIdsRef = useRef<Set<string>>(new Set())
  // Sekvensvakt: to samtidige fetches kan resolves i feil rekkefølge —
  // bare den nyeste får lov å skrive state
  const fetchSeqRef = useRef(0)

  const fetchShifts = useCallback(async () => {
    const seq = ++fetchSeqRef.current
    const { data, error: fetchError } = await supabaseRef.current
      .from('event_shifts')
      .select(`
        id, event_id, role, shift_date, start_time, end_time, capacity, notes, created_at,
        claims:shift_claims(
          user_id, claimed_at,
          profile:profiles(full_name, phone)
        )
      `)
      .eq('event_id', eventId)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (seq !== fetchSeqRef.current) return // en nyere fetch er underveis/ferdig

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }
    const rows = (data as unknown as ShiftWithClaims[]) ?? []
    shiftIdsRef.current = new Set(rows.map(s => s.id))
    setShifts(rows)
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    fetchShifts()

    const channel = supabaseRef.current
      .channel(`shifts-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_shifts', filter: `event_id=eq.${eventId}` },
        () => fetchShifts()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shift_claims' },
        async (payload) => {
          // Filtrer i klient: bare refetch hvis endringen gjelder en vakt i dette arrangementet
          const newRow = payload.new as { shift_id?: string } | null
          const oldRow = payload.old as { shift_id?: string } | null
          const affected = newRow?.shift_id ?? oldRow?.shift_id
          if (!affected) return
          if (shiftIdsRef.current.has(affected)) {
            fetchShifts()
            return
          }
          // Ukjent vakt-id: kan være en NYLIG opprettet vakt i dette arrangementet
          // som vi ikke har rukket å hente enda. Sjekk med et billig oppslag i
          // stedet for å ignorere claimet til neste refetch.
          const { data } = await supabaseRef.current
            .from('event_shifts')
            .select('event_id')
            .eq('id', affected)
            .maybeSingle() as { data: { event_id: string } | null }
          if (data?.event_id === eventId) fetchShifts()
        }
      )
      .subscribe()

    return () => {
      supabaseRef.current.removeChannel(channel)
    }
  }, [eventId, fetchShifts])

  return { shifts, loading, error, refetch: fetchShifts }
}
