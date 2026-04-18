'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeZones, type ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import { useActiveEvent, useActiveEvents } from '@/lib/hooks/useEvent'
import ZoneClaimSheet from '@/components/features/ZoneClaimSheet'
import BaseSheet from '@/components/features/BaseSheet'
import type { Base } from '@/components/features/BaseSheet'
import { bases } from '@/components/map/BaseMarker'
import type { ZoneArea, DugnadEvent } from '@/lib/supabase/types'
import { MAP_CONFIG } from '@/lib/map/config'
import zonesGeoJson from '@/lib/map/combined-zones-data'
import MapInfoSheet from '@/components/features/MapInfoSheet'
import { Map as MapIcon, Satellite, ChevronDown, Info } from 'lucide-react'
import { useTheme } from '@/lib/hooks/useTheme'
import { isMockMode, MOCK_USER_ID } from '@/lib/mock/useMock'
import { mockEvents, mockZones } from '@/lib/mock/data'

const DugnadMap = dynamic(() => import('@/components/map/DugnadMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-bg">
      <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  ),
})

// Beregner senterpunkt av Polygon eller MultiPolygon
function getGeometryCenter(geometry: { type: string; coordinates: number[][][] | number[][][][] }): [number, number] {
  let allPoints: number[][] = []
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates as number[][][][]) {
      allPoints = allPoints.concat(polygon[0])
    }
  } else {
    allPoints = (geometry.coordinates as number[][][])[0]
  }
  let sumLng = 0, sumLat = 0
  for (const [lng, lat] of allPoints) {
    sumLng += lng
    sumLat += lat
  }
  return [sumLng / allPoints.length, sumLat / allPoints.length]
}

// Wrapper med Suspense for useSearchParams
export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-bg">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    }>
      <MapPageContent />
    </Suspense>
  )
}

function MapPageContent() {
  const searchParams = useSearchParams()
  const focusZoneId = searchParams.get('sone')
  const overrideEventId = searchParams.get('event')
  const showAll = searchParams.get('alle') === '1'

  const { events: allEventsRaw, loading: eventsLoading } = useActiveEvents()
  // Kun aktive hendelser kan velges i kartet
  const allEvents = allEventsRaw.filter(e => e.status === 'active')
  const { event: autoEvent, loading: eventLoading } = useActiveEvent()

  // Bruk override-event fra URL, ellers den automatiske (nærmeste)
  const [overrideEvent, setOverrideEvent] = useState<DugnadEvent | null>(null)
  const [selectedEventIndex, setSelectedEventIndex] = useState(0)
  const [showEventPicker, setShowEventPicker] = useState(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!overrideEventId) return
    supabaseRef.current
      .from('events')
      .select('*')
      .eq('id', overrideEventId)
      .single()
      .then(({ data }) => {
        if (data) setOverrideEvent(data as unknown as DugnadEvent)
      })
  }, [overrideEventId])

  // Velg event: URL-override > valgt fra liste > auto (første aktive)
  const event = overrideEventId
    ? overrideEvent
    : allEvents.length > 1
      ? allEvents[selectedEventIndex] || allEvents[0]
      : autoEvent
  // 'all' = vis alle soner, null = ikke hent noe (venter på event), ellers event-id
  const effectiveEventId = showAll ? 'all' : (event?.id || null)

  // Vis soner kun ved aktiv hendelse, eksplisitt event-ID i URL (og lastet), eller "vis alle"
  const hasActiveEvent = showAll || (!!overrideEventId && !!overrideEvent) || (!!event && event.status === 'active')
  const { zones: rawZones, loading: zonesLoading, refetch } = useRealtimeZones(effectiveEventId)
  const zones = hasActiveEvent ? rawZones : []
  const [selectedZone, setSelectedZone] = useState<ZoneWithStatus | null>(null)
  const [selectedBase, setSelectedBase] = useState<Base | null>(null)
  const [isSatellite, setIsSatellite] = useState(false)
  const { isDark } = useTheme()
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null)
  const [initialZoom, setInitialZoom] = useState<number | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lng: number; lat: number; zoom: number } | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    if (isMockMode()) {
      setUserId(MOCK_USER_ID)
      setUserRole('admin')
      return
    }
    supabaseRef.current.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabaseRef.current.from('profiles') as any)
          .select('role').eq('id', user.id).single()
        if (profile) setUserRole(profile.role as string)
      }
    })
  }, [])

  // Når soner er lastet og vi har en fokus-sone, åpne den og sentrer kartet
  useEffect(() => {
    if (!focusZoneId || zonesLoading || zones.length === 0) return

    const zone = zones.find((z) => z.id === focusZoneId)
    if (zone) {
      setSelectedZone(zone)

      // Finn polygon-senter for kart-sentrering
      const feature = zonesGeoJson.features.find((f) => f.properties?.id === focusZoneId)
      if (feature) {
        const [lng, lat] = getGeometryCenter(feature.geometry)
        setInitialCenter([lng, lat])
        setInitialZoom(15)
      }
    }
  }, [focusZoneId, zones, zonesLoading])

  // Bestem aktivt område fra hendelsens area-felt (ikke soner — unngår flash)
  const activeArea = useMemo<ZoneArea | null>(() => {
    if (!event || showAll) return null
    if (event.area === 'nord') return 'NORD'
    if (event.area === 'sor') return 'SOR'
    return null // 'begge' → vis alt
  }, [event, showAll])

  // Beregn bounding box fra tildelte soner (+ base for flaskeinnsamling)
  const initialBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (focusZoneId || showAll) return null
    const assigned = zones.filter((z) => z.assignment_id)
    if (assigned.length === 0) return null

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity

    for (const zone of assigned) {
      const feature = zonesGeoJson.features.find((f) => f.properties?.id === zone.id)
      if (!feature) continue
      const coords = feature.geometry.type === 'MultiPolygon'
        ? (feature.geometry.coordinates as number[][][][]).flatMap(p => p[0])
        : (feature.geometry.coordinates as number[][][])[0]
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }

    // Inkluder base-koordinater for flaskeinnsamling
    if (event?.type === 'bottle_collection') {
      const relevantBases = activeArea ? bases.filter(b => b.area === activeArea) : bases
      for (const base of relevantBases) {
        const [lng, lat] = base.coordinates
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }

    if (!isFinite(minLng)) return null
    return [[minLng, minLat], [maxLng, maxLat]]
  }, [zones, zonesLoading, event?.type, activeArea, focusZoneId, showAll])

  const assignedZones = zones.filter((z) => z.assignment_id)
  const availableCount = assignedZones.filter((z) => z.claims.length === 0).length
  const partialCount = assignedZones.filter((z) => z.claims.length > 0 && z.claims.length < z.collectors_needed && z.status !== 'completed' && z.status !== 'picked_up').length
  const fullCount = assignedZones.filter((z) => z.claims.length >= z.collectors_needed && z.status !== 'completed' && z.status !== 'picked_up').length
  const doneCount = assignedZones.filter((z) => z.status === 'completed').length
  const pickedUpCount = assignedZones.filter((z) => z.status === 'picked_up').length

  return (
    <div className="fixed inset-0 z-0">
      <DugnadMap
        zones={zones}
        onZoneClick={(zone) => { setSelectedZone(zone); setSelectedBase(null) }}
        selectedZoneId={selectedZone?.id}
        userId={userId}
        activeArea={activeArea}
        eventType={event?.type || null}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        initialBounds={initialBounds}
        flyTarget={flyTarget}
        onFlyComplete={() => setFlyTarget(null)}
        mapStyle={isSatellite ? MAP_CONFIG.satelliteStyle : (isDark ? MAP_CONFIG.darkStyle : MAP_CONFIG.style)}
        onBaseClick={(base) => { setSelectedBase(base); setSelectedZone(null) }}
      />

      {/* Satellitt/kart-toggle */}
      <button
        onClick={() => setIsSatellite(s => !s)}
        className="absolute top-[168px] right-[10px] z-10 safe-top w-[29px] h-[29px] bg-card rounded-lg shadow-sm flex items-center justify-center"
        aria-label={isSatellite ? 'Vis kart' : 'Vis satellitt'}
      >
        {isSatellite ? <MapIcon size={16} className="text-text-secondary" /> : <Satellite size={16} className="text-text-secondary" />}
      </button>

      {/* Info-knapp */}
      <button
        onClick={() => setShowInfo(true)}
        className="absolute bottom-36 right-4 z-10 w-10 h-10 bg-card rounded-full shadow-sm flex items-center justify-center"
        aria-label="Hjelp"
      >
        <Info size={18} className="text-accent" />
      </button>

      <MapInfoSheet
        open={showInfo}
        onClose={() => setShowInfo(false)}
        eventType={event?.type || null}
        contactPhone={event?.contact_phone || null}
      />

      {!eventLoading && !eventsLoading && (
        <div className="absolute top-14 left-4 right-16 z-10 safe-top">
          <div className="bg-bg rounded-[20px] px-4 py-3 shadow-[0_8px_24px_rgba(61,53,48,0.06)]">
            {hasActiveEvent && event ? (
              <div>
                {/* Klikkbar header hvis flere hendelser */}
                <button
                  onClick={() => allEvents.length > 1 && !overrideEventId ? setShowEventPicker(v => !v) : undefined}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest">
                      {event.status === 'active' ? 'Pågår nå' : 'Kommende'}
                    </p>
                    {allEvents.length > 1 && !overrideEventId && (
                      <span className="flex items-center gap-0.5 text-[11px] text-text-tertiary">
                        {selectedEventIndex + 1}/{allEvents.length}
                        <ChevronDown size={12} className={`transition-transform ${showEventPicker ? 'rotate-180' : ''}`} />
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-text-primary mb-2 font-[var(--font-display)]">{event.title}</p>
                </button>
                <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
                  {availableCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zone-available" />
                    {availableCount}
                  </span>}
                  {partialCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zone-partial" />
                    {partialCount}
                  </span>}
                  {fullCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal" />
                    {fullCount}
                  </span>}
                  {doneCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zone-complete" />
                    {doneCount}
                  </span>}
                  {pickedUpCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zone-picked-up" />
                    {pickedUpCount}
                  </span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary text-center">
                Ingen aktiv dugnad
              </p>
            )}
          </div>

          {/* Hendelse-velger dropdown */}
          {showEventPicker && allEvents.length > 1 && (
            <div className="bg-card rounded-2xl mt-2 shadow-lg overflow-hidden">
              {allEvents.map((ev, i) => (
                <button
                  key={ev.id}
                  onClick={() => {
                    setSelectedEventIndex(i)
                    setShowEventPicker(false)
                    setSelectedZone(null)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm active:bg-surface-low ${
                    i === selectedEventIndex ? 'bg-accent/5 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{ev.title}</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                      ev.status === 'active' ? 'bg-success/10 text-success' : 'bg-teal/10 text-teal'
                    }`}>
                      {ev.status === 'active' ? 'Aktiv' : 'Kommende'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ZoneClaimSheet
        zone={selectedZone}
        eventId={event?.id || null}
        userId={userId}
        onClose={() => setSelectedZone(null)}
        onAction={() => {
          refetch()
          setSelectedZone(null)
        }}
        isAdmin={userRole === 'admin'}
        onFlyTo={(lng, lat, zoom) => {
          setFlyTarget({ lng, lat, zoom: zoom || 16 })
        }}
      />

      <BaseSheet
        base={selectedBase}
        eventId={event?.id || null}
        userId={userId}
        isAdmin={userRole === 'admin'}
        onClose={() => setSelectedBase(null)}
        onAction={() => {
          refetch()
        }}
        zones={zones}
      />
    </div>
  )
}
