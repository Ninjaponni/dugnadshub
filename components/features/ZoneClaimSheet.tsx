'use client'

import { useState, useRef } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { StickyNote, Navigation, CheckCircle, MessageSquare, Pencil, X as XIcon, UserPlus } from 'lucide-react'
import MemberPicker from '@/components/features/MemberPicker'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import dropPointsData from '@/lib/map/drop-points-data'
import { evaluateBadges } from '@/lib/badges/evaluator'

interface ZoneClaimSheetProps {
  zone: ZoneWithStatus | null
  eventId: string | null
  userId: string | null
  onClose: () => void
  onAction: () => void
  isAdmin?: boolean
  onFlyTo?: (lng: number, lat: number, zoom?: number) => void
}

// Finn oppsamlingspunkt for en sone basert på område og navn
function findDropPoint(zoneName: string, area: string) {
  const areaPoints = dropPointsData.features.filter(f => f.properties.area === area)
  const nameKey = zoneName.toLowerCase().split(' ')[0]
  return areaPoints.find(f => f.properties.name.toLowerCase().includes(nameKey)) || null
}

// Visuell status basert på claims og sonetype
function getDisplayStatus(zone: ZoneWithStatus): { label: string; color: string } {
  const isLapper = zone.zone_type === 'lapper'
  if (zone.status === 'picked_up') return { label: 'Hentet', color: 'bg-purple-500' }
  if (zone.status === 'completed') return { label: isLapper ? 'Ferdig levert' : 'Ferdigplukket', color: 'bg-success' }
  if (zone.claims.length >= zone.collectors_needed) return { label: 'Fullt bemannet', color: 'bg-accent' }
  if (zone.claims.length > 0) return { label: 'Delvis tatt', color: 'bg-warning' }
  return { label: 'Ledig', color: 'bg-zone-available' }
}

export default function ZoneClaimSheet({ zone, eventId, userId, onClose, onAction, isAdmin, onFlyTo }: ZoneClaimSheetProps) {
  const [loading, setLoading] = useState(false)
  const [showUnclaimConfirm, setShowUnclaimConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [adminUnclaimTarget, setAdminUnclaimTarget] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  if (!zone) return null

  const userHasClaimed = zone.claims.some((c) => c.user_id === userId)
  const isFull = zone.claims.length >= zone.collectors_needed
  const isFinished = zone.status === 'completed' || zone.status === 'picked_up'
  const canClaim = eventId && !userHasClaimed && !isFull && !isFinished
  const canUnclaim = eventId && userHasClaimed && !isFinished
  const canMarkComplete = eventId && userHasClaimed && !isFinished

  const displayStatus = getDisplayStatus(zone)
  const dropPoint = findDropPoint(zone.name, zone.area)

  async function handleClaim() {
    if (!eventId) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('claim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    if (rpcError) {
      setError('Kunne ikke ta sonen. Prøv igjen.')
      setLoading(false)
      return
    }
    if (userId) evaluateBadges(userId).catch(() => {})
    onAction()
    setLoading(false)
  }

  async function handleUnclaim() {
    if (!eventId) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('unclaim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    if (rpcError) {
      setError('Kunne ikke gi opp sonen. Prøv igjen.')
      setLoading(false)
      return
    }
    setShowUnclaimConfirm(false)
    onAction()
    setLoading(false)
  }

  async function handleComplete() {
    if (!zone?.assignment_id) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('mark_zone_complete', { p_assignment_id: zone.assignment_id })
    if (rpcError) {
      setError('Kunne ikke markere som ferdig. Prøv igjen.')
      setLoading(false)
      return
    }
    if (userId) evaluateBadges(userId).catch(() => {})
    // Auto-push: sjåfører for flaskeinnsamling, admin for andre typer
    if (zone.zone_type === 'bottle') {
      notifyDrivers(zone.name)
    } else {
      notifyAdmin(zone.name)
    }
    setShowCompleteConfirm(false)
    onAction()
    setLoading(false)
  }

  async function notifyDrivers(zoneName: string) {
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) return
      await fetch('/api/push/notify-drivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ zoneName }),
      })
    } catch {
      // Push-feil er ikke kritisk — stille feil
    }
  }

  async function notifyAdmin(zoneName: string) {
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) return
      await fetch('/api/push/notify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ zoneName }),
      })
    } catch {
      // Push-feil er ikke kritisk — stille feil
    }
  }

  function handleDropPointClick() {
    if (!dropPoint || !onFlyTo) return
    const [lng, lat] = dropPoint.geometry.coordinates
    onFlyTo(lng, lat, 17)
    onClose()
  }

  // Lagre notat på brukerens claim
  async function handleSaveNote() {
    if (!zone?.assignment_id || !userId) return
    setSavingNote(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('zone_claims') as any)
      .update({ notes: noteText || null })
      .eq('assignment_id', zone.assignment_id)
      .eq('user_id', userId)
    setEditingNote(false)
    setSavingNote(false)
    onAction()
  }

  async function handleAdminAssign(targetUserId: string) {
    if (!eventId || !zone) return
    setAssignLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('admin_claim_zone', {
      p_event_id: eventId,
      p_zone_id: zone.id,
      p_user_id: targetUserId,
    })
    if (rpcError) {
      setError(rpcError.message || 'Kunne ikke tildele sonen.')
      setAssignLoading(false)
      return
    }
    setShowMemberPicker(false)
    setAssignLoading(false)
    onAction()
  }

  async function handleAdminUnclaim(targetUserId: string) {
    if (!eventId || !zone) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('admin_unclaim_zone', {
      p_event_id: eventId,
      p_zone_id: zone.id,
      p_user_id: targetUserId,
    })
    if (rpcError) {
      setError(rpcError.message || 'Kunne ikke fjerne samler.')
      setLoading(false)
      return
    }
    setAdminUnclaimTarget(null)
    setLoading(false)
    onAction()
  }

  return (
    <BottomSheet open={!!zone} onClose={onClose} title={zone.name}>
      {/* Status og nøkkelinfo */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${displayStatus.color}`} />
          <span className="text-sm text-text-secondary">{displayStatus.label}</span>
        </span>
        <span className="text-xs text-text-tertiary">·</span>
        <span className="text-sm text-text-secondary">{zone.area === 'NORD' ? 'Nord' : 'Sør'} {zone.id}</span>
        <span className="text-xs text-text-tertiary">·</span>
        <span className="text-sm text-text-secondary">
          {zone.claims.length}/{zone.collectors_needed} {zone.zone_type === 'lapper' ? 'frivillige' : 'samlere'}
        </span>
        {zone.zone_type === 'lapper' && zone.flyers != null && (
          <>
            <span className="text-xs text-text-tertiary">·</span>
            <span className="text-sm text-text-secondary">
              {zone.flyers} lapper{zone.posters ? `, ${zone.posters} plakater` : ''}
            </span>
          </>
        )}
        {zone.zone_type !== 'lapper' && zone.households > 0 && (
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

      {/* Oppsamlingspunkt — klikkbart (kun for flaskeinnsamling) */}
      {zone.zone_type !== 'lapper' && dropPoint && (
        <button
          onClick={handleDropPointClick}
          className="flex items-center gap-2 text-sm text-accent mb-3 active:opacity-70"
        >
          <Navigation size={14} className="shrink-0" />
          <span className="underline underline-offset-2">Oppsamling: {dropPoint.properties.name}</span>
        </button>
      )}

      {/* Samlere */}
      {zone.claims.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
            Samlere
          </p>
          <div className="space-y-2">
            {zone.claims.map((claim) => (
              <div key={claim.user_id}>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent">
                    {claim.full_name?.charAt(0) || '?'}
                  </div>
                  <span className="flex-1">{claim.full_name || 'Ukjent'}</span>
                  {claim.user_id === userId && (
                    <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">deg</span>
                  )}
                  {/* Admin kan fjerne andres claims */}
                  {isAdmin && claim.user_id !== userId && !isFinished && (
                    adminUnclaimTarget === claim.user_id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAdminUnclaimTarget(null)}
                          className="text-xs text-text-tertiary px-1.5 py-0.5 rounded active:bg-black/5"
                        >
                          Avbryt
                        </button>
                        <button
                          onClick={() => handleAdminUnclaim(claim.user_id)}
                          disabled={loading}
                          className="text-xs text-danger font-medium px-1.5 py-0.5 rounded active:bg-danger/10"
                        >
                          Fjern
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAdminUnclaimTarget(claim.user_id)}
                        className="p-1 rounded-full active:bg-black/10"
                        aria-label="Fjern samler"
                      >
                        <XIcon size={14} className="text-text-tertiary" />
                      </button>
                    )
                  )}
                </div>
                {/* Vis notat under samlerens navn */}
                {claim.notes && (
                  <p className="ml-8 text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                    <MessageSquare size={10} className="shrink-0" />
                    {claim.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Legg til / rediger eget notat */}
          {userHasClaimed && !isFinished && (
            <div className="mt-3">
              {editingNote ? (
                <div className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    rows={2}
                    placeholder="F.eks. Med 3 barn: Ola, Kari, Per"
                    className="w-full px-3 py-2 rounded-xl bg-black/5 text-sm outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingNote(false)}
                      className="flex-1 py-1.5 text-sm font-medium text-text-secondary rounded-lg active:bg-black/5"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={savingNote}
                      className="flex-1 py-1.5 text-sm font-medium text-accent rounded-lg active:bg-accent/10"
                    >
                      {savingNote ? 'Lagrer...' : 'Lagre'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const myClaim = zone.claims.find(c => c.user_id === userId)
                    setNoteText(myClaim?.notes || '')
                    setEditingNote(true)
                  }}
                  className="flex items-center gap-1.5 text-xs text-accent font-medium mt-1 active:opacity-70"
                >
                  <Pencil size={12} />
                  {zone.claims.find(c => c.user_id === userId)?.notes ? 'Rediger notat' : 'Legg til notat'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feilmelding */}
      {error && (
        <div className="mb-3 p-3 rounded-xl bg-danger/10 text-danger text-sm text-center">
          {error}
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

          {/* Admin: tildel medlem */}
          {isAdmin && !isFull && !isFinished && !showMemberPicker && (
            <Button
              size="md"
              loading={assignLoading}
              onClick={() => setShowMemberPicker(true)}
              className="w-full bg-black/5 !text-text-primary hover:bg-black/10"
            >
              <UserPlus size={16} className="mr-1.5" />
              Tildel medlem
            </Button>
          )}
          {isAdmin && showMemberPicker && (
            <MemberPicker
              onSelect={(uid) => handleAdminAssign(uid)}
              onCancel={() => setShowMemberPicker(false)}
              excludeUserIds={zone.claims.map((c) => c.user_id)}
            />
          )}

          {/* Marker som ferdig — med bekreftelse */}
          {canMarkComplete && !showCompleteConfirm && (
            <Button size="lg" loading={loading} onClick={() => setShowCompleteConfirm(true)} className="w-full bg-success hover:bg-success/90">
              Marker som ferdig
            </Button>
          )}
          {showCompleteConfirm && (
            <div className="rounded-2xl overflow-hidden border border-success/20">
              <div className="bg-success/5 p-4 text-center">
                <CheckCircle size={32} className="text-success mx-auto mb-2" />
                <p className="text-[15px] font-medium mb-1">Er du helt ferdig med sonen?</p>
                <p className="text-sm text-text-secondary">
                  {zone.zone_type === 'lapper'
                    ? 'Alle lapper og plakater er levert i sonen.'
                    : 'Sjåførene får varsel om at panten er klar for henting.'}
                </p>
              </div>
              <div className="flex border-t border-success/20">
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-success/20 active:bg-black/5"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 py-3 text-sm font-medium text-success active:bg-success/10"
                >
                  {loading ? 'Sender...' : 'Bekreft'}
                </button>
              </div>
            </div>
          )}

          {/* Gi opp sonen — med bekreftelse */}
          {canUnclaim && !showUnclaimConfirm && !showCompleteConfirm && (
            <Button size="md" variant="danger" loading={loading} onClick={() => setShowUnclaimConfirm(true)} className="w-full">
              Gi opp sonen
            </Button>
          )}
          {showUnclaimConfirm && (
            <div className="rounded-2xl overflow-hidden border border-warning/20">
              <div className="bg-warning/5 p-4">
                <p className="text-sm text-text-primary">
                  Hvis du er forhindret fra å delta, setter vi stor pris på om du kan finne noen andre til å ta sonen din.
                </p>
              </div>
              <div className="flex border-t border-warning/20">
                <button
                  onClick={() => setShowUnclaimConfirm(false)}
                  className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-warning/20 active:bg-black/5"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleUnclaim}
                  disabled={loading}
                  className="flex-1 py-3 text-sm font-medium text-danger active:bg-danger/10"
                >
                  {loading ? 'Fjerner...' : 'Gi opp'}
                </button>
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
