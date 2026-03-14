'use client'

import { useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import StatusDot from '@/components/ui/StatusDot'
import { MapPin, Users, Home, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'

interface ZoneClaimSheetProps {
  zone: ZoneWithStatus | null
  eventId: string | null
  userId: string | null
  onClose: () => void
  onAction: () => void
}

// Bottom sheet med sonedetaljer og handlingsknapper
export default function ZoneClaimSheet({ zone, eventId, userId, onClose, onAction }: ZoneClaimSheetProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  if (!zone) return null

  const userHasClaimed = zone.claims.some((c) => c.user_id === userId)
  const isFull = zone.claims.length >= zone.collectors_needed
  const canClaim = eventId && !userHasClaimed && !isFull && zone.status !== 'completed' && zone.status !== 'picked_up'
  const canUnclaim = eventId && userHasClaimed && zone.status !== 'completed' && zone.status !== 'picked_up'
  const canMarkComplete = eventId && userHasClaimed && (zone.status === 'claimed' || zone.status === 'in_progress')

  async function handleClaim() {
    if (!eventId) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)('claim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    onAction()
    setLoading(false)
  }

  async function handleUnclaim() {
    if (!eventId) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)('unclaim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    onAction()
    setLoading(false)
  }

  async function handleComplete() {
    if (!zone?.assignment_id) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)('mark_zone_complete', { p_assignment_id: zone.assignment_id })
    onAction()
    setLoading(false)
  }

  return (
    <BottomSheet open={!!zone} onClose={onClose} title={zone.name}>
      {/* Status, område og nøkkelinfo — kompakt rad */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <StatusDot status={zone.status} showLabel />
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

      {/* Notater (kun hvis finnes) */}
      {zone.notes && (
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <StickyNote size={14} className="text-text-tertiary shrink-0" />
          <span>{zone.notes}</span>
        </div>
      )}

      {/* Hvem har tatt sonen */}
      {zone.claims.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
            Samlere
          </p>
          <div className="space-y-1.5">
            {zone.claims.map((claim) => (
              <div
                key={claim.user_id}
                className="flex items-center gap-2 text-sm"
              >
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent">
                  {claim.full_name?.charAt(0) || '?'}
                </div>
                <span>{claim.full_name || 'Ukjent'}</span>
                {claim.user_id === userId && (
                  <span className="text-xs text-accent">(deg)</span>
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
          {canUnclaim && (
            <Button size="md" variant="danger" loading={loading} onClick={handleUnclaim} className="w-full">
              Gi opp sonen
            </Button>
          )}
          {isFull && !userHasClaimed && zone.status !== 'completed' && (
            <p className="text-sm text-text-tertiary text-center py-2">
              Sonen er full — alle plasser er tatt
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
