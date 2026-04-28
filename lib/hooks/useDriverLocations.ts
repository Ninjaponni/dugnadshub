'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isMockMode } from '@/lib/mock/useMock'

export interface DriverLocation {
  user_id: string
  full_name: string | null
  trailer_group: number
  latitude: number
  longitude: number
  accuracy: number | null
  updated_at: string
}

const STALE_MS = 60_000

// Lytter på sjåfør-posisjoner i sanntid via Supabase Realtime.
// Returnerer kun ferske posisjoner (oppdatert innen 60 sek).
export function useDriverLocations(eventId: string | null) {
  const [drivers, setDrivers] = useState<DriverLocation[]>([])
  const supabaseRef = useRef(createClient())
  const mock = isMockMode()

  const fetchDrivers = useCallback(async () => {
    if (mock || !eventId || eventId === 'all') {
      setDrivers([])
      return
    }
    const supabase = supabaseRef.current
    const { data } = await supabase
      .from('driver_assignments')
      .select('user_id, trailer_group, latitude, longitude, accuracy, location_updated_at, profiles(full_name)')
      .eq('event_id', eventId)
      .eq('role', 'driver')
      .eq('location_sharing', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (!data) {
      setDrivers([])
      return
    }

    const now = Date.now()
    type Row = {
      user_id: string
      trailer_group: number
      latitude: number
      longitude: number
      accuracy: number | null
      location_updated_at: string
      profiles?: { full_name: string | null } | null
    }
    const fresh: DriverLocation[] = (data as unknown as Row[])
      .filter(r => {
        const updated = new Date(r.location_updated_at).getTime()
        return now - updated < STALE_MS
      })
      .map(r => ({
        user_id: r.user_id,
        full_name: r.profiles?.full_name || null,
        trailer_group: r.trailer_group,
        latitude: r.latitude,
        longitude: r.longitude,
        accuracy: r.accuracy,
        updated_at: r.location_updated_at,
      }))

    setDrivers(fresh)
  }, [eventId, mock])

  useEffect(() => {
    if (mock) return
    fetchDrivers()
    if (!eventId || eventId === 'all') return

    const supabase = supabaseRef.current

    const channel = supabase
      .channel(`driver-locations-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_assignments',
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchDrivers()
      )
      .subscribe()

    // Re-evaluer staleness hvert 30. sek (selv uten Realtime-event)
    const interval = setInterval(fetchDrivers, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [eventId, fetchDrivers, mock])

  return { drivers, refetch: fetchDrivers }
}
