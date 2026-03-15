'use client'

import { useState, useRef } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { MapPin, StickyNote, Navigation } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import dropPointsData from '@/lib/map/drop-points-data'

interface ZoneClaimSheetProps {
  zone: ZoneWithStatus | null
  eventId: string | null
  userId: string | null
  onClose: () => void
  onAction: () => void
}

// Finn nærmeste oppsamlingspunkt for en sone basert på område og navn
function findDropPoint(zoneId: string, zoneName: string, area: string) {
  const areaPoints = dropPointsData.features.filter(f => f.properties.area === area)

  // Prøv å matche på sonenavn
  const nameKey = zoneName.toLowerCase().split(' ')[0]
  const match = areaPoints.find(f =>
    f.properties.name.toLowerCase().includes(nameKey)
  )

  return match || null
}

// Beregn visuell status basert på claims (ikke assignment-status)
function getDisplayStatus(zone: ZoneWithStatus): { label: string; color: string } {
  if (zone.status === 'completed') return { label: 'Ferdig', color: 'bg-success' }
  if (zone.status === 'picked_up') return { label: 'Hentet', color: 'bg-purple' }
  if (zone.claims.length >= zone.collectors_needed) return { label: 'Fullt', color: 'bg-success' }
  if (zone.claims.length > 0) return { label: 'Delvis tatt', color: 'bg-warning' }
  return { label: 'Ledig', color: 'bg-zone-available' }
}

export default function ZoneClaimSheet({ zone, eventId, userId, onClose, onAction }: ZoneClaimSheetProps) {
  const [loading, setLoading] = useState(false)
  const [showUnclaimConfirm, setShowUnclaimConfirm] = useState(false)
  const supabaseRef = useRef(createClient())

  if (!zone) return null

  const userHasClaimed = zone.claims.some((c) => c.user_id === userId)
  const isFull = zone.claims.length >= zone.collectors_needed
  const isFinished = zone.status === 'completed' || zone.status === 'picked_up'
  const canClaim = eventId && !userHasClaimed && !isFull && !isFinished
  const canUnclaim = eventId && userHasClaimed && !isFinished
  // Vis "marker ferdig" så lenge brukeren har tatt sonen og den ikke er ferdig
  const canMarkComplete = eventId && userHasClaimed && !isFinished

  const displayStatus = getDisplayStatus(zone)
  const dropPoint = findDropPoint(zone.id, zone.name, zone.area)

  async function handleClaim() {
    if (!eventId) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.rpc as any)('claim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    onAction()
    setLoading(false)
  }

  async function handleUnclaim() {
    if (!eventId) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.rpc as any)('unclaim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    onAction()
    setLoading(false)
  }

  async function handleComplete() {
    if (!zone?.assignment_id) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.rpc as any)('mark_zone_complete', { p_assignment_id: zone.assignment_id })
    onAction()
    setLoading(false)
  }

  return (
    <BottomSheet open={!!zone} onClose={onClose} title={zone.name}>
      {/* Status, område og nøkkelinfo */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${displayStatus.color}`} />
          <span className="text-sm text-text-secondary">{displayStatus.label}</span>
        </span>
        <span className="text-xs text-text-tertiary">·</span>
        <span className="text-sm text-text-secondary">{zone.area === 'NORD' ? 'Nord' : 'Sør'} {zone.id}</span>
        <span className="text-xs text-text-tertiary">·</span>
        <span className="text-sm text-text-secondary">{zone.claims.length}/{zone.collectors_needed} samlere</span>
        {zone.households > 0 && (
          <>
            <span className="text-xs text-text-tertiary">·</span>
            <span className="text-sm text-text-secondary">{zone.households} hus</span>
          </>
        )}
      </div>

      {/* Notater */}
      {zone.notes && (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <StickyNote size={14} className="text-text-tertiary shrink-0" />
          <span>{zone.notes}</span>
        </div>
      )}

      {/* Oppsamlingspunkt */}
      {dropPoint && (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <Navigation size={14} className="text-text-tertiary shrink-0" />
          <span>Oppsamling: {dropPoint.properties.name}</span>
        </div>
      )}

      {/* Samlere */}
      {zone.claims.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
            Samlere
          </p>
          <div className="space-y-1.5">
            {zone.claims.map((claim) => (
              <div key={claim.user_id} className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent">
                  {claim.full_name?.charAt(0) || '?'}
                </div>
                <span>{claim.full_name || 'Ukjent'}</span>
                {claim.user_id === userId && (
                  <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">deg</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Handlingsknapper */}
      {!eventId ? (
        <p className="text-sm text-text-tertiary text-center py-2">
          Ingen aktiv hendelse — soner kan ikke tas
        </p>
      ) : (
        <div className="space-y-2">
          {canClaim && (
            <Button size="lg" loading={loading} onClick={handleClaim} className="w-full">
              Ta denne sonen
            </Button>
          )}
          {canMarkComplete && (
            <Button size="lg" loading={loading} onClick={handleComplete} className="w-full bg-success hover:bg-success/90">
              Marker som ferdig
            </Button>
          )}
          {canUnclaim && !showUnclaimConfirm && (
            <Button size="md" variant="danger" loading={loading} onClick={() => setShowUnclaimConfirm(true)} className="w-full">
              Gi opp sonen
            </Button>
          )}
          {showUnclaimConfirm && (
            <div className="card p-4 bg-warning/5 border border-warning/20 rounded-xl space-y-3">
              <p className="text-sm text-text-primary">
                Hvis du er forhindret fra å delta, setter vi stor pris på om du kan finne noen andre til å ta sonen din.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowUnclaimConfirm(false)} className="flex-1">
                  Avbryt
                </Button>
                <Button size="sm" variant="danger" loading={loading} onClick={handleUnclaim} className="flex-1">
                  Gi opp
                </Button>
              </div>
            </div>
          )}
          {isFull && !userHasClaimed && !isFinished && (
            <p className="text-sm text-text-tertiary text-center py-2">
              Sonen er full — alle plasser er tatt
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
