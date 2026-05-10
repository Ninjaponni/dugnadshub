'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ZoneAssignment, ZoneClaim, Zone } from '@/lib/supabase/types'
import { isMockMode } from '@/lib/mock/useMock'
import { mockZones } from '@/lib/mock/data'

export interface ZoneWithStatus extends Zone {
  assignment_id: string | null
  status: ZoneAssignment['status']
  claims: Array<{ user_id: string; full_name: string | null; notes: string | null; phone: string | null }>
}

// Lytter på sone-endringer i sanntid via Supabase Realtime
export function useRealtimeZones(eventId: string | null) {
  const [zones, setZones] = useState<ZoneWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const mock = isMockMode()

  // Mock-modus: returner statiske soner uten Supabase
  useEffect(() => {
    if (!mock) return
    setZones(mockZones)
    setLoading(false)
  }, [mock, eventId])

  const fetchZones = useCallback(async () => {
    if (mock) return
    // null = ikke hent noe (venter på event-data)
    if (!eventId) {
      setZones([])
      setLoading(false)
      return
    }

    const supabase = supabaseRef.current

    // Permanente soner (event_id IS NULL) + ad-hoc plast-soner for dette eventet
    let zoneQuery = supabase.from('zones').select('*').order('id')
    if (eventId === 'all') {
      // Vis kun permanente soner i 'all'-modus
      zoneQuery = zoneQuery.is('event_id', null)
    } else {
      zoneQuery = zoneQuery.or(`event_id.is.null,event_id.eq.${eventId}`)
    }
    const { data: allZones } = await zoneQuery

    if (!allZones) return

    let assignments: ZoneAssignment[] = []
    let claims: (ZoneClaim & { profiles?: { full_name: string | null; phone: string | null } } & { notes: string | null })[] = []

    // 'all' = vis alle soner uten event-filtrering
    if (eventId && eventId !== 'all') {
      const { data: assignData } = await supabase
        .from('zone_assignments')
        .select('*')
        .eq('event_id', eventId)

      if (assignData) assignments = assignData as unknown as ZoneAssignment[]

      if (assignments.length > 0) {
        const { data: claimData } = await supabase
          .from('zone_claims')
          .select('*, notes, profiles(full_name, phone)')
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
          notes: c.notes || null,
          phone: c.profiles?.phone || null,
        })),
      }
    })

    setZones(zonesWithStatus)
    setLoading(false)
  }, [eventId])

  // Tøm soner og vis loading ved bytte av hendelse — forhindrer flash av gamle soner
  useEffect(() => {
    if (mock) return
    setZones([])
    setLoading(true)
  }, [eventId, mock])

  useEffect(() => {
    if (mock) return
    fetchZones()

    if (!eventId || eventId === 'all') return

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
