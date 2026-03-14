'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ZoneAssignment, ZoneClaim, Zone } from '@/lib/supabase/types'

export interface ZoneWithStatus extends Zone {
  assignment_id: string | null
  status: ZoneAssignment['status']
  claims: Array<{ user_id: string; full_name: string | null }>
}

// Lytter på sone-endringer i sanntid via Supabase Realtime
export function useRealtimeZones(eventId: string | null) {
  const [zones, setZones] = useState<ZoneWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  const fetchZones = useCallback(async () => {
    const supabase = supabaseRef.current

    const { data: allZones } = await supabase
      .from('zones')
      .select('*')
      .order('id')

    if (!allZones) return

    let assignments: ZoneAssignment[] = []
    let claims: (ZoneClaim & { profiles?: { full_name: string | null } })[] = []

    if (eventId) {
      const { data: assignData } = await supabase
        .from('zone_assignments')
        .select('*')
        .eq('event_id', eventId)

      if (assignData) assignments = assignData as unknown as ZoneAssignment[]

      if (assignments.length > 0) {
        const { data: claimData } = await supabase
          .from('zone_claims')
          .select('*, profiles(full_name)')
          .in('assignment_id', assignments.map(a => a.id))

        if (claimData) claims = claimData as unknown as typeof claims
      }
    }

    const zonesWithStatus: ZoneWithStatus[] = (allZones as unknown as Zone[]).map(zone => {
      const assignment = assignments.find(a => a.zone_id === zone.id)
      const zoneClaims = assignment
        ? claims.filter(c => c.assignment_id === assignment.id)
        : []

      return {
        ...zone,
        assignment_id: assignment?.id || null,
        status: assignment?.status || 'available',
        claims: zoneClaims.map(c => ({
          user_id: c.user_id,
          full_name: c.profiles?.full_name || null,
        })),
      }
    })

    setZones(zonesWithStatus)
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    fetchZones()

    if (!eventId) return

    const supabase = supabaseRef.current

    const assignChannel = supabase
      .channel(`zone-assignments-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zone_assignments',
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchZones()
      )
      .subscribe()

    const claimChannel = supabase
      .channel(`zone-claims-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zone_claims',
        },
        () => fetchZones()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(assignChannel)
      supabase.removeChannel(claimChannel)
    }
  }, [eventId, fetchZones])

  return { zones, loading, refetch: fetchZones }
}
