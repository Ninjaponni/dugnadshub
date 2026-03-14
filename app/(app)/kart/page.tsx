'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeZones, type ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import { useActiveEvent } from '@/lib/hooks/useEvent'
import ZoneClaimSheet from '@/components/features/ZoneClaimSheet'
import MapLegend from '@/components/map/MapLegend'

// Dynamisk import av kartet (SSR-inkompatibelt pga. Mapbox GL)
const DugnadMap = dynamic(() => import('@/components/map/DugnadMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-bg">
      <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  ),
})

// Fullskjerms kartside med soner og claiming
export default function MapPage() {
  const { event, loading: eventLoading } = useActiveEvent()
  const { zones, loading: zonesLoading, refetch } = useRealtimeZones(event?.id || null)
  const [selectedZone, setSelectedZone] = useState<ZoneWithStatus | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [supabase])

  return (
    <div className="fixed inset-0 z-0">
      {/* Kart — fyller hele skjermen */}
      <DugnadMap
        zones={zones}
        onZoneClick={setSelectedZone}
        selectedZoneId={selectedZone?.id}
      />

      {/* Legende */}
      <MapLegend />

      {/* Status-header */}
      {!eventLoading && (
        <div className="absolute top-14 left-4 right-4 z-10 safe-top">
          <div className="glass rounded-xl px-4 py-2.5 shadow-lg">
            {event ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-accent uppercase tracking-wide">
                    {event.status === 'active' ? 'Pågår nå' : 'Kommende'}
                  </p>
                  <p className="text-sm font-semibold">{event.title}</p>
                </div>
                <div className="text-right text-xs text-text-secondary">
                  <p>{zones.filter((z) => z.status === 'available').length} ledige</p>
                  <p>{zones.filter((z) => z.status === 'completed' || z.status === 'picked_up').length} ferdige</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary text-center">
                Ingen aktiv hendelse — viser alle soner
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom sheet — sonedetaljer */}
      <ZoneClaimSheet
        zone={selectedZone}
        eventId={event?.id || null}
        userId={userId}
        onClose={() => setSelectedZone(null)}
        onAction={() => {
          refetch()
          setSelectedZone(null)
        }}
      />
    </div>
  )
}
