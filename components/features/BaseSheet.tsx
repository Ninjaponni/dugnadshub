'use client'

import { useState, useEffect, useRef } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import MemberPicker from '@/components/features/MemberPicker'
import { Phone, X as XIcon, UserPlus, Truck, Wrench, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ZoneArea, DriverAssignmentWithProfile } from '@/lib/supabase/types'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'

// Base-definisjon (brukes fra BaseMarker)
export interface Base {
  id: string
  name: string
  area: ZoneArea
  coordinates: [number, number]
}

interface BaseSheetProps {
  base: Base | null
  eventId: string | null
  userId: string | null
  isAdmin: boolean
  onClose: () => void
  onAction: () => void
  zones: ZoneWithStatus[]
}

// Henger-kort med sonenavn og sjåfør-info
interface TrailerCardProps {
  trailerGroup: number
  zoneNames: string[]
  assignment: DriverAssignmentWithProfile | null
  userId: string | null
  isAdmin: boolean
  loading: boolean
  disabled: boolean
  onClaim: () => void
  onUnclaim: () => void
  onAdminUnclaim: () => void
  onAdminAssign: () => void
}

function TrailerCard({ trailerGroup, zoneNames, assignment, userId, isAdmin, loading, disabled, onClaim, onUnclaim, onAdminUnclaim, onAdminAssign }: TrailerCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAdminConfirm, setShowAdminConfirm] = useState(false)
  const [showZones, setShowZones] = useState(false)
  const isMe = assignment?.user_id === userId

  return (
    <div className="rounded-2xl bg-black/[0.03] p-4">
      <div className="flex items-center gap-2 mb-1">
        <Truck size={14} className="text-accent" />
        <span className="text-sm font-semibold">Henger {trailerGroup}</span>
        {/* Trekkspill for sonenavn */}
        {zoneNames.length > 0 && (
          <button
            onClick={() => setShowZones(v => !v)}
            className="ml-auto flex items-center gap-1 text-[11px] text-text-tertiary active:opacity-70"
          >
            {zoneNames.length} soner
            <ChevronDown size={12} className={`transition-transform ${showZones ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Sonenavn — skjult bak trekkspill */}
      {showZones && zoneNames.length > 0 && (
        <p className="text-xs text-text-tertiary mb-3 leading-relaxed">
          {zoneNames.join(' · ')}
        </p>
      )}

      {assignment ? (
        <div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent">
              {assignment.full_name?.charAt(0) || '?'}
            </div>
            <span className="flex-1">{assignment.full_name || 'Ukjent'}</span>
            {isMe && (
              <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">deg</span>
            )}
            {isAdmin && assignment.phone && (
              <a href={`tel:${assignment.phone}`} className="p-1 rounded-full active:bg-black/10" aria-label="Ring">
                <Phone size={14} className="text-accent" />
              </a>
            )}
            {isAdmin && !isMe && (
              showAdminConfirm ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowAdminConfirm(false)} className="text-xs text-text-tertiary px-1.5 py-0.5 rounded active:bg-black/5">
                    Avbryt
                  </button>
                  <button onClick={() => { setShowAdminConfirm(false); onAdminUnclaim() }} className="text-xs text-danger font-medium px-1.5 py-0.5 rounded active:bg-danger/10">
                    Fjern
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAdminConfirm(true)} className="p-1 rounded-full active:bg-black/10" aria-label="Fjern sjåfør">
                  <XIcon size={14} className="text-text-tertiary" />
                </button>
              )
            )}
          </div>
          {isMe && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="mt-2 text-xs text-danger font-medium active:opacity-70"
            >
              Gi opp
            </button>
          )}
          {isMe && showConfirm && (
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => setShowConfirm(false)} className="text-xs text-text-tertiary px-2 py-1 rounded active:bg-black/5">
                Avbryt
              </button>
              <button onClick={() => { setShowConfirm(false); onUnclaim() }} disabled={loading} className="text-xs text-danger font-medium px-2 py-1 rounded active:bg-danger/10">
                {loading ? 'Fjerner...' : 'Bekreft'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-tertiary flex-1">Ledig</span>
          {!disabled && (
            <Button size="sm" onClick={onClaim} loading={loading}>
              Meld deg
            </Button>
          )}
          {isAdmin && (
            <button onClick={onAdminAssign} className="p-1.5 rounded-full active:bg-black/10" aria-label="Tildel">
              <UserPlus size={14} className="text-text-tertiary" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Stripser-plass
interface StrapperSlotProps {
  slotNumber: number
  assignment: DriverAssignmentWithProfile | null
  userId: string | null
  isAdmin: boolean
  loading: boolean
  disabled: boolean
  onClaim: () => void
  onUnclaim: () => void
  onAdminUnclaim: () => void
  onAdminAssign: () => void
}

function StrapperSlot({ slotNumber, assignment, userId, isAdmin, loading, disabled, onClaim, onUnclaim, onAdminUnclaim, onAdminAssign }: StrapperSlotProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAdminConfirm, setShowAdminConfirm] = useState(false)
  const isMe = assignment?.user_id === userId

  return (
    <div className="flex items-center gap-2 py-2">
      <span className="text-sm text-text-secondary w-16 shrink-0">Plass {slotNumber}:</span>
      {assignment ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent shrink-0">
            {assignment.full_name?.charAt(0) || '?'}
          </div>
          <span className="text-sm truncate">{assignment.full_name || 'Ukjent'}</span>
          {isMe && (
            <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full shrink-0">deg</span>
          )}
          {isAdmin && assignment.phone && (
            <a href={`tel:${assignment.phone}`} className="p-1 rounded-full active:bg-black/10 shrink-0" aria-label="Ring">
              <Phone size={14} className="text-accent" />
            </a>
          )}
          {isMe && !showConfirm && (
            <button onClick={() => setShowConfirm(true)} className="text-xs text-danger font-medium active:opacity-70 shrink-0">
              Gi opp
            </button>
          )}
          {isMe && showConfirm && (
            <>
              <button onClick={() => setShowConfirm(false)} className="text-xs text-text-tertiary shrink-0">Avbryt</button>
              <button onClick={() => { setShowConfirm(false); onUnclaim() }} disabled={loading} className="text-xs text-danger font-medium shrink-0">Bekreft</button>
            </>
          )}
          {isAdmin && !isMe && (
            showAdminConfirm ? (
              <>
                <button onClick={() => setShowAdminConfirm(false)} className="text-xs text-text-tertiary shrink-0">Avbryt</button>
                <button onClick={() => { setShowAdminConfirm(false); onAdminUnclaim() }} className="text-xs text-danger font-medium shrink-0">Fjern</button>
              </>
            ) : (
              <button onClick={() => setShowAdminConfirm(true)} className="p-1 rounded-full active:bg-black/10 shrink-0" aria-label="Fjern">
                <XIcon size={14} className="text-text-tertiary" />
              </button>
            )
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-text-tertiary flex-1">Ledig</span>
          {!disabled && (
            <Button size="sm" onClick={onClaim} loading={loading}>
              Meld deg
            </Button>
          )}
          {isAdmin && (
            <button onClick={onAdminAssign} className="p-1.5 rounded-full active:bg-black/10" aria-label="Tildel">
              <UserPlus size={14} className="text-text-tertiary" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Hoved-komponent: bottom sheet for base-påmelding
export default function BaseSheet({ base, eventId, userId, isAdmin, onClose, onAction, zones }: BaseSheetProps) {
  const [assignments, setAssignments] = useState<DriverAssignmentWithProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [memberPickerTarget, setMemberPickerTarget] = useState<{ role: string; trailerGroup: number; slotNumber: number } | null>(null)
  const supabaseRef = useRef(createClient())

  // Hent data når sheet åpnes (initial load viser skeleton)
  useEffect(() => {
    if (!base || !eventId) return
    fetchAssignments(true)
  }, [base, eventId])

  async function fetchAssignments(showSkeleton = false) {
    if (!base || !eventId) return
    if (showSkeleton) setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: queryError } = await (supabaseRef.current
      .from('driver_assignments')
      .select('id, event_id, user_id, trailer_group, area, role, slot_number, profiles(full_name, phone)')
      .eq('event_id', eventId)
      .eq('area', base.area) as any)

    if (queryError) {
      setError('Kunne ikke laste plasser. Prøv igjen.')
      setLoading(false)
      return
    }

    const mapped = (data || []).map((d: Record<string, unknown> & { profiles?: { full_name: string | null; phone: string | null } }) => ({
      id: d.id as string,
      event_id: d.event_id as string,
      user_id: d.user_id as string,
      trailer_group: d.trailer_group as number,
      area: d.area as string,
      role: d.role as string,
      slot_number: d.slot_number as number,
      full_name: d.profiles?.full_name || null,
      phone: d.profiles?.phone || null,
    }))
    setAssignments(mapped as DriverAssignmentWithProfile[])
    setLoading(false)
  }

  // Sjekk om brukeren allerede har en plass i dette området
  const userHasSlot = assignments.some(a => a.user_id === userId)

  async function handleClaim(role: string, trailerGroup: number, slotNumber: number) {
    if (!eventId || !base) return
    const key = `${role}-${trailerGroup}-${slotNumber}`
    setClaimLoading(key)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('claim_base_slot', {
      p_event_id: eventId,
      p_area: base.area,
      p_role: role,
      p_trailer_group: trailerGroup,
      p_slot_number: slotNumber,
    })
    if (rpcError) {
      setError(rpcError.message || 'Kunne ikke ta plassen.')
      setClaimLoading(null)
      return
    }
    setClaimLoading(null)
    await fetchAssignments()
    onAction()
  }

  async function handleUnclaim() {
    if (!eventId || !base) return
    setClaimLoading('unclaim')
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('unclaim_base_slot', {
      p_event_id: eventId,
      p_area: base.area,
    })
    if (rpcError) {
      setError(rpcError.message || 'Kunne ikke gi opp plassen.')
      setClaimLoading(null)
      return
    }
    setClaimLoading(null)
    await fetchAssignments()
    onAction()
  }

  async function handleAdminUnclaim(targetUserId: string) {
    if (!eventId || !base) return
    setClaimLoading('admin-unclaim')
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('admin_unclaim_base_slot', {
      p_event_id: eventId,
      p_area: base.area,
      p_user_id: targetUserId,
    })
    if (rpcError) {
      setError(rpcError.message || 'Kunne ikke fjerne brukeren.')
      setClaimLoading(null)
      return
    }
    setClaimLoading(null)
    await fetchAssignments()
    onAction()
  }

  async function handleAdminAssign(targetUserId: string) {
    if (!eventId || !base || !memberPickerTarget) return
    setClaimLoading('admin-assign')
    setError(null)
    const { role, trailerGroup, slotNumber } = memberPickerTarget
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('admin_claim_base_slot', {
      p_event_id: eventId,
      p_area: base.area,
      p_role: role,
      p_trailer_group: trailerGroup,
      p_slot_number: slotNumber,
      p_user_id: targetUserId,
    })
    if (rpcError) {
      setError(rpcError.message || 'Kunne ikke tildele plassen.')
      setClaimLoading(null)
      return
    }
    setMemberPickerTarget(null)
    setClaimLoading(null)
    await fetchAssignments()
    onAction()
  }

  if (!base) return null

  // Sonenavn gruppert per trailer_group for dette området
  const areaZones = zones.filter(z => z.area === base.area && z.zone_type === 'bottle')
  const trailerGroups = [1, 2, 3]
  const zonesByTrailer = new Map<number, string[]>()
  for (const tg of trailerGroups) {
    zonesByTrailer.set(tg, areaZones.filter(z => z.trailer_group === tg).map(z => z.name))
  }

  // Finn tildeling per henger
  function getDriverAssignment(trailerGroup: number): DriverAssignmentWithProfile | null {
    return assignments.find(a => a.role === 'driver' && a.trailer_group === trailerGroup) || null
  }

  // Finn stripser-tildeling per plass
  function getStrapperAssignment(slotNumber: number): DriverAssignmentWithProfile | null {
    return assignments.find(a => a.role === 'strapper' && a.slot_number === slotNumber) || null
  }

  const baseName = base.area === 'NORD' ? 'Base Nord' : 'Base Sør'
  const baseDesc = base.name.split('—')[1]?.trim() || ''

  return (
    <BottomSheet open={!!base} onClose={onClose} title={baseName}>
      {baseDesc && (
        <p className="text-sm text-text-secondary -mt-1 mb-4">{baseDesc}</p>
      )}

      {/* Feilmelding */}
      {error && (
        <div className="mb-3 p-3 rounded-xl bg-danger/10 text-danger text-sm text-center">
          {error}
        </div>
      )}

      {/* Bruker har allerede plass — info */}
      {userHasSlot && !loading && (
        <div className="mb-3 p-3 rounded-xl bg-accent/5 text-sm text-accent text-center">
          Du har allerede en plass i dette området
        </div>
      )}

      {!eventId && (
        <p className="text-sm text-text-tertiary text-center py-2">
          Ingen aktiv hendelse — kan ikke melde seg
        </p>
      )}

      {/* MemberPicker overlay */}
      {memberPickerTarget && (
        <div className="mb-4">
          <MemberPicker
            onSelect={(uid) => handleAdminAssign(uid)}
            onCancel={() => setMemberPickerTarget(null)}
            excludeUserIds={assignments.map(a => a.user_id)}
          />
        </div>
      )}

      {eventId && !memberPickerTarget && !loading && (
        <>
          {/* Sjåfører */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Truck size={12} />
              Sjåfører
            </p>
            <div className="space-y-2">
              {trailerGroups.map(tg => (
                <TrailerCard
                  key={tg}
                  trailerGroup={tg}
                  zoneNames={zonesByTrailer.get(tg) || []}
                  assignment={getDriverAssignment(tg)}
                  userId={userId}
                  isAdmin={isAdmin}
                  loading={claimLoading === `driver-${tg}-1` || claimLoading === 'unclaim'}
                  disabled={userHasSlot}
                  onClaim={() => handleClaim('driver', tg, 1)}
                  onUnclaim={handleUnclaim}
                  onAdminUnclaim={() => {
                    const a = getDriverAssignment(tg)
                    if (a) handleAdminUnclaim(a.user_id)
                  }}
                  onAdminAssign={() => setMemberPickerTarget({ role: 'driver', trailerGroup: tg, slotNumber: 1 })}
                />
              ))}
            </div>
          </div>

          {/* Stripsere */}
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Wrench size={12} />
              Stripsere
            </p>
            <div className="rounded-2xl bg-black/[0.03] px-4 py-1 divide-y divide-black/5">
              {[1, 2].map(slot => (
                <StrapperSlot
                  key={slot}
                  slotNumber={slot}
                  assignment={getStrapperAssignment(slot)}
                  userId={userId}
                  isAdmin={isAdmin}
                  loading={claimLoading === `strapper-0-${slot}` || claimLoading === 'unclaim'}
                  disabled={userHasSlot}
                  onClaim={() => handleClaim('strapper', 0, slot)}
                  onUnclaim={handleUnclaim}
                  onAdminUnclaim={() => {
                    const a = getStrapperAssignment(slot)
                    if (a) handleAdminUnclaim(a.user_id)
                  }}
                  onAdminAssign={() => setMemberPickerTarget({ role: 'strapper', trailerGroup: 0, slotNumber: slot })}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-black/[0.03] h-24" />
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
