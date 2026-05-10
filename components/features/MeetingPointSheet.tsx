'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { MapPin, Truck, UtensilsCrossed, X as XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MeetingPoint, DriverAssignmentWithProfile } from '@/lib/supabase/types'

interface MeetingPointSheetProps {
  point: MeetingPoint | null
  eventId: string | null
  eventTitle?: string | null
  userId: string | null
  isAdmin?: boolean
  onClose: () => void
}

// Slot-data for vertskap (strapper) eller søppelsjåfør (driver) på møteplassen
type SlotKind = 'host' | 'driver'

interface SlotConfig {
  kind: SlotKind
  role: 'driver' | 'strapper'
  slotNumber: number
  label: string
}

const slotConfigs: SlotConfig[] = [
  { kind: 'host', role: 'strapper', slotNumber: 1, label: 'Vert 1' },
  { kind: 'host', role: 'strapper', slotNumber: 2, label: 'Vert 2' },
  { kind: 'driver', role: 'driver', slotNumber: 1, label: 'Søppelsjåfør' },
]

// Bottom sheet for plastdugnad-møteplass
// Viser oppmøtetid, beskrivelse, og lar foreldre claime vertskap eller søppelsjåfør
export default function MeetingPointSheet({ point, eventId, eventTitle, userId, isAdmin, onClose }: MeetingPointSheetProps) {
  const supabaseRef = useRef(createClient())
  const [assignments, setAssignments] = useState<DriverAssignmentWithProfile[]>([])
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Avmeldings-confirm: holder slot-key for plassen brukeren vil melde seg av
  const [confirmingUnclaim, setConfirmingUnclaim] = useState<string | null>(null)

  const fetchAssignments = useCallback(async () => {
    if (!eventId) {
      setAssignments([])
      return
    }
    const { data } = await supabaseRef.current
      .from('driver_assignments')
      .select('*, profiles(full_name, phone)')
      .eq('event_id', eventId)
      .eq('area', 'NORD')
      .eq('trailer_group', 1) as unknown as { data: Array<DriverAssignmentWithProfile & { profiles?: { full_name: string | null; phone: string | null } }> | null }

    const mapped: DriverAssignmentWithProfile[] = (data || []).map(a => ({
      id: a.id,
      event_id: a.event_id,
      user_id: a.user_id,
      trailer_group: a.trailer_group,
      area: a.area,
      role: a.role,
      slot_number: a.slot_number,
      full_name: a.profiles?.full_name || null,
      phone: a.profiles?.phone || null,
    }))
    setAssignments(mapped)
  }, [eventId])

  useEffect(() => {
    if (point) fetchAssignments()
  }, [point, fetchAssignments])

  // Realtime: lytt på driver_assignments for dette eventet
  // Foreldre ser oppdateringer live hvis noen andre claimer/avmelder
  useEffect(() => {
    if (!point || !eventId) return
    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`meetingpoint-da-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_assignments',
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchAssignments()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [point, eventId, fetchAssignments])

  async function syncRole() {
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) return
    fetch('/api/driver/sync-role', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    }).catch(() => {})
  }

  async function handleClaim(cfg: SlotConfig) {
    if (!eventId) return
    const slotKey = `${cfg.role}-${cfg.slotNumber}`
    setLoadingSlot(slotKey)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('claim_base_slot', {
      p_event_id: eventId,
      p_area: 'NORD',
      p_role: cfg.role,
      p_trailer_group: 1,
      p_slot_number: cfg.slotNumber,
    })
    if (rpcError) {
      setError('Kunne ikke melde deg på. Prøv igjen.')
      setLoadingSlot(null)
      return
    }
    await syncRole()
    await fetchAssignments()
    setLoadingSlot(null)
  }

  async function handleUnclaim(cfg: SlotConfig) {
    if (!eventId) return
    const slotKey = `${cfg.role}-${cfg.slotNumber}`
    setLoadingSlot(slotKey)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('unclaim_base_slot', {
      p_event_id: eventId,
      p_area: 'NORD',
    })
    if (rpcError) {
      setError('Kunne ikke melde deg av. Prøv igjen.')
      setLoadingSlot(null)
      return
    }
    await syncRole()
    await fetchAssignments()
    setLoadingSlot(null)
  }

  async function handleAdminUnclaim(cfg: SlotConfig, targetUserId: string) {
    if (!eventId) return
    const slotKey = `${cfg.role}-${cfg.slotNumber}`
    setLoadingSlot(slotKey)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('admin_unclaim_base_slot', {
      p_event_id: eventId,
      p_area: 'NORD',
      p_user_id: targetUserId,
    })
    if (rpcError) {
      setError('Kunne ikke fjerne person. Prøv igjen.')
      setLoadingSlot(null)
      return
    }
    await fetchAssignments()
    setLoadingSlot(null)
  }

  if (!point) return null

  // Bruker har én aktiv plass per event/area — finn deres plass hvis de er meldt på
  const myAssignment = assignments.find(a => a.user_id === userId)

  function findSlotAssignment(cfg: SlotConfig) {
    return assignments.find(a => a.role === cfg.role && a.slot_number === cfg.slotNumber) || null
  }

  return (
    <BottomSheet open={!!point} onClose={onClose}>
      <div className="px-5 pb-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <MapPin size={18} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[16px] font-[var(--font-display)]">{point.name}</h3>
            {eventTitle && <p className="text-xs text-text-tertiary truncate">{eventTitle}</p>}
          </div>
        </div>

        {/* Beskrivelse */}
        {point.description && (
          <div className="p-3 rounded-2xl bg-surface-low text-sm text-text-secondary leading-relaxed">
            {point.description}
          </div>
        )}

        {/* Vertskap (2 plasser) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={14} className="text-accent" />
            <p className="text-[11px] uppercase tracking-widest text-text-secondary font-bold">Vertskap</p>
          </div>
          <p className="text-xs text-text-tertiary -mt-1">Deler ut sekker og hansker. Sørger for mat og drikke etter dugnaden.</p>
          {slotConfigs.filter(c => c.kind === 'host').map(cfg => {
            const assignment = findSlotAssignment(cfg)
            const isMe = assignment?.user_id === userId
            const slotKey = `${cfg.role}-${cfg.slotNumber}`
            const loading = loadingSlot === slotKey
            const disabled = !!myAssignment && !isMe // brukeren har allerede en annen plass

            return (
              <div key={slotKey} className="bg-card rounded-2xl p-3 ring-1 ring-text-tertiary/10">
                {!assignment && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium flex-1">{cfg.label}</span>
                    <span className="text-xs text-text-tertiary flex-1">Ledig</span>
                    {!disabled && (
                      <Button size="sm" variant="secondary" loading={loading} onClick={() => handleClaim(cfg)}>
                        Meld deg
                      </Button>
                    )}
                  </div>
                )}
                {assignment && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cfg.label}:</span>
                      <span className="text-sm flex-1 truncate">{assignment.full_name || 'Ukjent'}</span>
                      {isMe && (
                        <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">deg</span>
                      )}
                      {isAdmin && !isMe && (
                        <button
                          onClick={() => handleAdminUnclaim(cfg, assignment.user_id)}
                          disabled={loading}
                          className="p-1 rounded-full active:bg-surface-low"
                          aria-label="Fjern"
                        >
                          <XIcon size={14} className="text-text-tertiary" />
                        </button>
                      )}
                    </div>
                    {isMe && confirmingUnclaim !== slotKey && (
                      <button
                        onClick={() => setConfirmingUnclaim(slotKey)}
                        className="mt-2 text-xs text-danger font-semibold active:opacity-70"
                      >
                        Gi opp plassen
                      </button>
                    )}
                    {isMe && confirmingUnclaim === slotKey && (
                      <div className="mt-2 rounded-2xl overflow-hidden border border-warning/20">
                        <div className="bg-warning/5 p-3">
                          <p className="text-xs text-text-primary leading-relaxed">
                            Hvis du er forhindret fra å delta, setter vi stor pris på om du kan finne noen andre til å ta plassen din.
                          </p>
                        </div>
                        <div className="flex border-t border-warning/20">
                          <button
                            onClick={() => setConfirmingUnclaim(null)}
                            className="flex-1 py-2 text-xs font-medium text-text-secondary border-r border-warning/20 active:bg-surface-low"
                          >
                            Avbryt
                          </button>
                          <button
                            onClick={() => { setConfirmingUnclaim(null); handleUnclaim(cfg) }}
                            disabled={loading}
                            className="flex-1 py-2 text-xs font-medium text-danger active:bg-danger/10"
                          >
                            {loading ? 'Fjerner...' : 'Gi opp'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Søppelsjåfør (1 plass) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-warning" />
            <p className="text-[11px] uppercase tracking-widest text-text-secondary font-bold">Søppelhenger</p>
          </div>
          <p className="text-xs text-text-tertiary -mt-1">Sjåfør med tilhenger som kjører plastsøppelet bort etter dugnaden.</p>
          {slotConfigs.filter(c => c.kind === 'driver').map(cfg => {
            const assignment = findSlotAssignment(cfg)
            const isMe = assignment?.user_id === userId
            const slotKey = `${cfg.role}-${cfg.slotNumber}`
            const loading = loadingSlot === slotKey
            const disabled = !!myAssignment && !isMe

            return (
              <div key={slotKey} className="bg-card rounded-2xl p-3 ring-1 ring-text-tertiary/10">
                {!assignment && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium flex-1">{cfg.label}</span>
                    <span className="text-xs text-text-tertiary flex-1">Ledig</span>
                    {!disabled && (
                      <Button size="sm" variant="secondary" loading={loading} onClick={() => handleClaim(cfg)}>
                        Meld deg
                      </Button>
                    )}
                  </div>
                )}
                {assignment && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cfg.label}:</span>
                      <span className="text-sm flex-1 truncate">{assignment.full_name || 'Ukjent'}</span>
                      {isMe && (
                        <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">deg</span>
                      )}
                      {isAdmin && !isMe && (
                        <button
                          onClick={() => handleAdminUnclaim(cfg, assignment.user_id)}
                          disabled={loading}
                          className="p-1 rounded-full active:bg-surface-low"
                          aria-label="Fjern"
                        >
                          <XIcon size={14} className="text-text-tertiary" />
                        </button>
                      )}
                    </div>
                    {isMe && confirmingUnclaim !== slotKey && (
                      <button
                        onClick={() => setConfirmingUnclaim(slotKey)}
                        className="mt-2 text-xs text-danger font-semibold active:opacity-70"
                      >
                        Gi opp plassen
                      </button>
                    )}
                    {isMe && confirmingUnclaim === slotKey && (
                      <div className="mt-2 rounded-2xl overflow-hidden border border-warning/20">
                        <div className="bg-warning/5 p-3">
                          <p className="text-xs text-text-primary leading-relaxed">
                            Hvis du er forhindret fra å delta, setter vi stor pris på om du kan finne noen andre til å ta plassen din.
                          </p>
                        </div>
                        <div className="flex border-t border-warning/20">
                          <button
                            onClick={() => setConfirmingUnclaim(null)}
                            className="flex-1 py-2 text-xs font-medium text-text-secondary border-r border-warning/20 active:bg-surface-low"
                          >
                            Avbryt
                          </button>
                          <button
                            onClick={() => { setConfirmingUnclaim(null); handleUnclaim(cfg) }}
                            disabled={loading}
                            className="flex-1 py-2 text-xs font-medium text-danger active:bg-danger/10"
                          >
                            {loading ? 'Fjerner...' : 'Gi opp'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="p-2 rounded-2xl bg-danger/10 text-danger text-xs">
            {error}
          </div>
        )}

        <Button onClick={onClose} variant="secondary" className="w-full rounded-full">
          Lukk
        </Button>
      </div>
    </BottomSheet>
  )
}
