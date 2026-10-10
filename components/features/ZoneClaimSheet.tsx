'use client'

import { useState, useRef, useEffect } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { StickyNote, Navigation, CheckCircle, MessageSquare, Pencil, X as XIcon, UserPlus, Phone, Music, Truck } from 'lucide-react'
import MemberPicker from '@/components/features/MemberPicker'
import { createClient } from '@/lib/supabase/client'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import type { EventMusician } from '@/lib/supabase/types'
import dropPointsData from '@/lib/map/drop-points-data'
import { evaluateMyBadges } from '@/lib/badges/evaluator'
import { isHelpOpen } from '@/lib/map/zone-colors'
import { isMockMode } from '@/lib/mock/useMock'
import { mockTrailerGroups } from '@/lib/mock/data'

interface ZoneClaimSheetProps {
  zone: ZoneWithStatus | null
  eventId: string | null
  userId: string | null
  onClose: () => void
  onAction: () => void
  isAdmin?: boolean
  onFlyTo?: (lng: number, lat: number, zoom?: number) => void
  // Kalles etter "Jeg har tatt med alt selv", så kartet kan vise angre-toast
  onSelfDelivered?: (info: { assignmentId: string; asClaimer: boolean }) => void
  // Arket er åpnet fra en hjelp-push (?hjelp=1) for akkurat denne sonen
  fromHelpLink?: boolean
  // Henter sonene på nytt uten å lukke arket (etter be om hjelp / avbryt)
  onRefresh?: () => void
  // Feil fra kartsiden som gjelder denne sonen (f.eks. angre fra toast feilet)
  externalError?: string | null
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
  const isPlast = zone.zone_type === 'plast'
  if (zone.status === 'picked_up') return { label: zone.self_delivered ? 'Tatt med selv' : 'Hentet', color: 'bg-purple' }
  if (zone.status === 'completed') return { label: isLapper ? 'Ferdig levert' : isPlast ? 'Ferdig ryddet' : 'Ferdigplukket', color: 'bg-success' }
  // Går foran Fullt bemannet og Delvis tatt
  if (isHelpOpen(zone)) return { label: 'Hjelp ønskes', color: 'bg-zone-help' }
  if (zone.claims.length >= zone.collectors_needed) return { label: isPlast ? 'Voksne meldt' : 'Fullt bemannet', color: 'bg-accent' }
  if (zone.claims.length > 0) return { label: 'Delvis tatt', color: 'bg-warning' }
  return { label: 'Ledig', color: 'bg-zone-available' }
}

export default function ZoneClaimSheet({ zone, eventId, userId, onClose, onAction, isAdmin, onFlyTo, onSelfDelivered, fromHelpLink, onRefresh, externalError }: ZoneClaimSheetProps) {
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
  const [musicians, setMusicians] = useState<EventMusician[]>([])
  const [showHelpConfirm, setShowHelpConfirm] = useState(false)
  // Nøytral beskjed (ikke feil), f.eks. tapt kappløp om hjelpeplassen
  const [notice, setNotice] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  // Arket forblir montert mellom soner, så all midlertidig tilstand nullstilles når
  // en annen sone åpnes (eller arket lukkes). Ellers kan en åpen "Hvor er panten nå?"
  // bli stående og brukes på feil sone.
  useEffect(() => {
    setShowCompleteConfirm(false)
    setShowUnclaimConfirm(false)
    setShowHelpConfirm(false)
    setShowMemberPicker(false)
    setEditingNote(false)
    setAdminUnclaimTarget(null)
    setNotice(null)
    setError(null)
  }, [zone?.id])

  // Sjåfør(er) på hengeren som henter denne flaskesonen. Samme kobling som
  // notify-drivers: sonens område + hengernummer mot driver_assignments (role = driver).
  const [drivers, setDrivers] = useState<Array<{ user_id: string; full_name: string | null; phone: string | null }>>([])
  const isBottleZone = zone?.zone_type === 'bottle'
  useEffect(() => {
    if (!isBottleZone || !eventId || !zone?.trailer_group) {
      setDrivers([])
      return
    }
    if (isMockMode()) {
      const g = mockTrailerGroups.find(tg => tg.area === zone.area && tg.trailerGroup === zone.trailer_group)
      setDrivers(g?.driverName ? [{ user_id: 'mock-driver', full_name: g.driverName, phone: '900 00 000' }] : [])
      return
    }
    let cancelled = false
    setDrivers([])  // ikke vis forrige sones sjåfør mens oppslaget pågår
    supabaseRef.current
      .from('driver_assignments')
      .select('user_id, slot_number, profiles(full_name, phone)')
      .eq('event_id', eventId)
      .eq('area', zone.area)
      .eq('trailer_group', zone.trailer_group)
      .eq('role', 'driver')
      .order('slot_number')
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data || []) as unknown as Array<{ user_id: string; profiles: { full_name: string | null; phone: string | null } | null }>
        setDrivers(rows.map(r => ({ user_id: r.user_id, full_name: r.profiles?.full_name ?? null, phone: r.profiles?.phone ?? null })))
      })
    return () => { cancelled = true }
  }, [isBottleZone, eventId, zone?.id, zone?.area, zone?.trailer_group])

  // Hent musikanter for plast-soner
  const isPlastZone = zone?.zone_type === 'plast'
  useEffect(() => {
    if (!isPlastZone || !eventId || !zone?.id) {
      setMusicians([])
      return
    }
    supabaseRef.current
      .from('event_musicians')
      .select('*')
      .eq('event_id', eventId)
      .eq('zone_id', zone.id)
      .order('name')
      .then(({ data }) => {
        setMusicians((data || []) as unknown as EventMusician[])
      })
  }, [isPlastZone, eventId, zone?.id])

  if (!zone) return null

  const userHasClaimed = zone.claims.some((c) => c.user_id === userId)
  const isFull = zone.claims.length >= zone.collectors_needed
  const isFinished = zone.status === 'completed' || zone.status === 'picked_up'
  const isBottle = zone.zone_type === 'bottle'
  const helpOpen = isHelpOpen(zone)
  // En åpen forespørsel gir én ekstra plass, også når sonen ellers er full
  const canClaim = eventId && !userHasClaimed && !isFinished && (!isFull || helpOpen)
  const canRequestHelp = !!eventId && isBottle && !isFinished && !helpOpen && zone.claims.length > 0 && (userHasClaimed || !!isAdmin)
  const canManageHelp = helpOpen && (userHasClaimed || !!isAdmin)
  const canUnclaim = eventId && userHasClaimed && !isFinished
  const canMarkComplete = eventId && (userHasClaimed || (isAdmin && zone.claims.length > 0)) && !isFinished

  const displayStatus = getDisplayStatus(zone)
  const dropPoint = findDropPoint(zone.name, zone.area)

  async function recomputeFirstUser() {
    if (!eventId) return
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) return
    fetch('/api/events/recompute-first-user', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    }).catch(() => {})
  }

  async function handleClaim() {
    if (!eventId) return
    const joiningAsHelper = helpOpen
    setLoading(true)
    setError(null)
    setNotice(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('claim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    if (rpcError) {
      // Tapt kappløp om hjelpeplassen er ingen feil: noen andre kom først
      if (joiningAsHelper && rpcError.message?.startsWith('ZONE_FULL')) {
        setNotice('Noen kom deg i forkjøpet. Sonen har fått hjelp.')
      } else {
        setError('Kunne ikke ta sonen. Prøv igjen.')
      }
      setLoading(false)
      return
    }
    if (joiningAsHelper) notifyZoneHelp('joined')
    if (userId) {
      try { await evaluateMyBadges() } catch (e) {
        setError(`Sone tatt, men merker ble ikke oppdatert: ${(e as Error).message}`)
      }
    }
    recomputeFirstUser()
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
    recomputeFirstUser()
    onAction()
    setLoading(false)
  }

  // selfDelivered = plukkeren har tatt med alt selv, ingenting å hente (bare flaske)
  async function handleComplete(selfDelivered = false) {
    if (!zone?.assignment_id) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('mark_zone_complete', {
      p_assignment_id: zone.assignment_id,
      p_self_delivered: selfDelivered,
    })
    if (rpcError) {
      setError('Kunne ikke markere som ferdig. Prøv igjen.')
      setLoading(false)
      return
    }
    if (userId) {
      try { await evaluateMyBadges() } catch (e) {
        setError(`Markert ferdig, men merker ble ikke oppdatert: ${(e as Error).message}`)
      }
    }
    // Auto-push: sjåfører for flaskeinnsamling, admin for lapper
    // Plast: ingen push — voksne tar søppelet med seg til møteplassen
    // Tatt med selv: ingen push — det er ingenting å hente
    if (zone.zone_type === 'bottle' && !selfDelivered) {
      notifyDrivers()
    } else if (zone.zone_type === 'lapper') {
      notifyAdmin(zone.name)
    }
    if (selfDelivered) onSelfDelivered?.({ assignmentId: zone.assignment_id, asClaimer: userHasClaimed })
    setShowCompleteConfirm(false)
    onAction()
    setLoading(false)
  }

  // Serveren henter sonenavn og mottakere selv ut fra assignmentId
  async function notifyDrivers() {
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) return
      await fetch('/api/push/notify-drivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ assignmentId: zone!.assignment_id, zoneId: zone!.id, eventId }),
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

  async function handleRequestHelp() {
    if (!zone?.assignment_id) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('request_zone_help', { p_assignment_id: zone.assignment_id })
    if (rpcError) {
      setError('Kunne ikke be om hjelp. Prøv igjen.')
      setLoading(false)
      return
    }
    notifyZoneHelp('request')
    // Arket blir stående åpent og viser "Venter på en ekstra hånd"
    onRefresh?.()
    setShowHelpConfirm(false)
    setShowUnclaimConfirm(false)
    setLoading(false)
  }

  async function handleCancelHelp() {
    if (!zone?.assignment_id) return
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('cancel_zone_help', { p_assignment_id: zone.assignment_id })
    if (rpcError) setError('Kunne ikke avbryte. Prøv igjen.')
    else onRefresh?.()
    setLoading(false)
  }

  // Serveren henter sonenavn og mottakere selv, og har 10 min cooldown
  async function notifyZoneHelp(kind: 'request' | 'joined') {
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) return
      await fetch('/api/push/notify-zone-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ assignmentId: zone!.assignment_id, kind }),
      })
    } catch {
      // Push-feil er ikke kritisk
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

  async function handleUncomplete() {
    if (!zone?.assignment_id) return
    setLoading(true)
    setError(null)
    const rpcName = userHasClaimed ? 'uncomplete_zone' : 'admin_uncomplete_zone'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)(rpcName, { p_assignment_id: zone.assignment_id })
    if (rpcError) {
      setError('Kunne ikke angre ferdigmelding. Prøv igjen.')
      setLoading(false)
      return
    }
    onAction()
    setLoading(false)
  }

  async function handleAdminAssign(targetUserId: string) {
    if (!eventId || !zone) return
    const fillingHelpSlot = helpOpen
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
    // Admin fylte hjelpeplassen: plukkerne får "Hjelpen er på vei"
    if (fillingHelpSlot) notifyZoneHelp('joined')
    setShowMemberPicker(false)
    setAssignLoading(false)
    recomputeFirstUser()
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
    recomputeFirstUser()
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
        {zone.zone_type !== 'plast' && (
          <>
            <span className="text-xs text-text-tertiary">·</span>
            <span className="text-sm text-text-secondary">{zone.area === 'NORD' ? 'Nord' : 'Sør'} {zone.id}</span>
          </>
        )}
        <span className="text-xs text-text-tertiary">·</span>
        <span className="text-sm text-text-secondary">
          {zone.claims.length}/{zone.collectors_needed} {zone.zone_type === 'lapper' ? 'frivillige' : zone.zone_type === 'plast' ? 'voksne ansvarlige' : 'samlere'}
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

      {/* Plast: musikanter knyttet til denne sona */}
      {isPlastZone && musicians.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide flex items-center gap-1.5">
            <Music size={12} className="text-accent" />
            {musicians.length} musikanter rydder her
          </p>
          <div className="p-3 rounded-2xl bg-accent/5 text-sm leading-relaxed">
            {musicians.map(m => m.name).join(' · ')}
          </div>
        </div>
      )}
      {isPlastZone && musicians.length === 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-warning/10 text-sm text-text-secondary">
          Ingen musikanter er tildelt sona enda. Admin må fordele musikanter.
        </div>
      )}

      {/* Oppsamlingspunkt — klikkbart (kun for flaskeinnsamling) */}
      {zone.zone_type === 'bottle' && dropPoint && (
        <button
          onClick={handleDropPointClick}
          className="flex items-center gap-3 p-3 bg-surface-low/60 rounded-xl mb-3 active:scale-[0.98] transition-all w-full text-left"
        >
          <div className="w-9 h-9 bg-success/15 rounded-full flex items-center justify-center shrink-0">
            <Navigation size={16} className="text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-success uppercase tracking-wider">Oppsamling</p>
            <p className="text-sm font-semibold text-text-primary">{dropPoint.properties.name}</p>
          </div>
          <span className="text-text-tertiary text-sm">›</span>
        </button>
      )}

      {/* Samlere / Voksne ansvarlige */}
      {zone.claims.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
            {zone.zone_type === 'lapper' ? 'Utdelere' : zone.zone_type === 'plast' ? 'Voksne ansvarlige' : 'Samlere'}
          </p>
          <div className="space-y-2">
            {zone.claims.map((claim) => (
              <div key={claim.user_id}>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent">
                    {claim.full_name?.charAt(0) || '?'}
                  </div>
                  <span className="flex-1 min-w-0">
                    {claim.full_name || 'Ukjent'}
                    {claim.via_help && (
                      <span className="ml-1.5 text-[11px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">hjelper</span>
                    )}
                  </span>
                  {(isAdmin || userHasClaimed) && claim.phone && claim.user_id !== userId && (
                    <a
                      href={`tel:${claim.phone}`}
                      className="p-1 rounded-full active:bg-surface-low"
                      aria-label={`Ring ${claim.full_name}`}
                    >
                      <Phone size={14} className="text-accent" />
                    </a>
                  )}
                  {claim.user_id === userId && (
                    <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">deg</span>
                  )}
                  {/* Admin kan fjerne andres claims */}
                  {isAdmin && claim.user_id !== userId && !isFinished && (
                    adminUnclaimTarget === claim.user_id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAdminUnclaimTarget(null)}
                          className="text-xs text-text-tertiary px-1.5 py-0.5 rounded active:bg-surface-low"
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
                        className="p-1 rounded-full active:bg-surface-low"
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
                    className="w-full px-3 py-2 rounded-[12px] bg-surface-low text-sm outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingNote(false)}
                      className="flex-1 py-1.5 text-sm font-medium text-text-secondary rounded-lg active:bg-surface-low"
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

      {/* Henter: sjåfør(er) på hengeren for sonen. Skjules når ingen har meldt seg.
          Ring-knapp med samme regel som for medplukkere: plukkerne på sonen og admin. */}
      {drivers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
            {drivers.length > 1 ? 'Hentere' : 'Henter'} · henger {zone.trailer_group}
          </p>
          <div className="space-y-2">
            {drivers.map(d => (
              <div key={d.user_id} className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                  <Truck size={12} className="text-accent" />
                </div>
                <span className="flex-1 min-w-0">{d.full_name || 'Ukjent'}</span>
                {(isAdmin || userHasClaimed) && d.phone && d.user_id !== userId && (
                  <a
                    href={`tel:${d.phone}`}
                    className="p-1 rounded-full active:bg-surface-low"
                    aria-label={`Ring ${d.full_name}`}
                  >
                    <Phone size={14} className="text-accent" />
                  </a>
                )}
                {d.user_id === userId && (
                  <span className="text-[11px] font-medium text-white bg-accent px-1.5 py-0.5 rounded-full">deg</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feilmelding */}
      {(error || externalError) && (
        <div className="mb-3 p-3 rounded-xl bg-danger/10 text-danger text-sm text-center">
          {error || externalError}
        </div>
      )}

      {/* Nøytral beskjed (ikke feil) */}
      {notice && (
        <div className="mb-3 p-3 rounded-xl bg-surface-low text-text-secondary text-sm text-center">
          {notice}
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
              {helpOpen ? 'Bli med som hjelper' : 'Ta denne sonen'}
            </Button>
          )}

          {/* Admin: tildel medlem */}
          {/* Tildel virker også mot hjelpeplassen */}
          {isAdmin && (!isFull || helpOpen) && !isFinished && !showMemberPicker && (
            <button
              onClick={() => setShowMemberPicker(true)}
              disabled={assignLoading}
              className="w-full text-text-secondary text-xs font-semibold uppercase tracking-wider py-2 hover:opacity-80 transition-opacity"
            >
              Tildel medlem
            </button>
          )}
          {isAdmin && showMemberPicker && (
            <MemberPicker
              onSelect={(uid) => handleAdminAssign(uid)}
              onCancel={() => setShowMemberPicker(false)}
              excludeUserIds={zone.claims.map((c) => c.user_id)}
            />
          )}

          {/* Marker som ferdig — sekundær grønn knapp */}
          {canMarkComplete && !showCompleteConfirm && !editingNote && (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={loading}
              className="w-full py-3 rounded-full border-2 border-success text-success font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
            >
              Marker som ferdig
            </button>
          )}
          {/* Flaske: plukkeren sier hvor panten er. Hovedvalget er det vanlige. */}
          {showCompleteConfirm && canMarkComplete && zone.zone_type === 'bottle' && (
            <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
              <p className="text-[15px] font-medium text-center mb-3">Hvor er panten nå?</p>
              <button
                onClick={() => handleComplete(false)}
                disabled={loading}
                className="w-full min-h-[44px] py-2.5 rounded-full bg-success text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {loading ? 'Sender...' : 'Klar for henting'}
                <span className="block text-xs font-medium opacity-90">Sjåførene får beskjed.</span>
              </button>
              <button
                onClick={() => handleComplete(true)}
                disabled={loading}
                className="w-full min-h-[44px] mt-3 py-2 rounded-full text-success font-semibold text-sm active:bg-success/10 disabled:opacity-40"
              >
                Jeg har tatt med alt selv
                <span className="block text-xs font-medium text-text-secondary">Ingenting å hente.</span>
              </button>
              <button
                onClick={() => setShowCompleteConfirm(false)}
                className="w-full mt-1 py-2 text-xs text-text-tertiary active:opacity-70"
              >
                Avbryt
              </button>
            </div>
          )}
          {showCompleteConfirm && canMarkComplete && zone.zone_type !== 'bottle' && (
            <div className="rounded-2xl overflow-hidden border border-success/20">
              <div className="bg-success/5 p-4 text-center">
                <CheckCircle size={32} className="text-success mx-auto mb-2" />
                <p className="text-[15px] font-medium mb-1">Er du helt ferdig med sonen?</p>
                <p className="text-sm text-text-secondary">
                  {zone.zone_type === 'lapper'
                    ? 'Alle lapper og plakater er levert i sonen.'
                    : zone.zone_type === 'plast'
                    ? 'Ta med oppsamlet søppel til møteplassen.'
                    : 'Sjåførene får varsel om at panten er klar for henting.'}
                </p>
              </div>
              <div className="flex border-t border-success/20">
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-success/20 active:bg-surface-low"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleComplete(false)}
                  disabled={loading}
                  className="flex-1 py-3 text-sm font-medium text-success active:bg-success/10"
                >
                  {loading ? 'Sender...' : 'Bekreft'}
                </button>
              </div>
            </div>
          )}

          {/* Åpen forespørsel: plukkere og admin ser at det ventes, og kan avbryte */}
          {canManageHelp && !showCompleteConfirm && (
            <p className="text-sm text-text-secondary text-center py-2">
              Venter på en ekstra hånd ·{' '}
              <button onClick={handleCancelHelp} disabled={loading} className="text-accent font-semibold disabled:opacity-40">
                Avbryt
              </button>
            </p>
          )}

          {/* Be om en ekstra hånd — tekstknapp på nivå med Gi opp sonen */}
          {canRequestHelp && !showHelpConfirm && !showUnclaimConfirm && !showCompleteConfirm && !editingNote && (
            <button
              onClick={() => setShowHelpConfirm(true)}
              disabled={loading}
              className="w-full text-accent text-xs font-semibold py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Be om en ekstra hånd
            </button>
          )}
          {showHelpConfirm && (
            <div className="rounded-2xl overflow-hidden border border-accent/20">
              <div className="bg-accent/5 p-4">
                <p className="text-sm text-text-primary">
                  Plukkerne i innsamlingen får varsel. Første som melder seg, blir med.
                </p>
              </div>
              <div className="flex border-t border-accent/20">
                <button
                  onClick={() => setShowHelpConfirm(false)}
                  className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-accent/20 active:bg-surface-low"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleRequestHelp}
                  disabled={loading}
                  className="flex-1 py-3 text-sm font-medium text-accent active:bg-accent/10"
                >
                  {loading ? 'Sender...' : 'Be om hjelp'}
                </button>
              </div>
            </div>
          )}

          {/* Gi opp sonen — tekst-lenke */}
          {canUnclaim && !showUnclaimConfirm && !showCompleteConfirm && !showHelpConfirm && !editingNote && (
            <button
              onClick={() => setShowUnclaimConfirm(true)}
              disabled={loading}
              className="w-full text-danger text-xs font-semibold py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Gi opp sonen
            </button>
          )}
          {showUnclaimConfirm && (
            <div className="rounded-2xl overflow-hidden border border-warning/20">
              <div className="bg-warning/5 p-4">
                <p className="text-sm text-text-primary">
                  Hvis du er forhindret fra å delta, setter vi stor pris på om du kan finne noen andre til å ta sonen din.
                </p>
                {/* Den som sliter, trykker oftere på gi opp enn den leter etter en hjelpeknapp */}
                {canRequestHelp && (
                  <p className="text-sm text-text-secondary mt-2">
                    Heller få hjelp?{' '}
                    <button onClick={handleRequestHelp} disabled={loading} className="text-accent font-semibold disabled:opacity-40">
                      Be om en ekstra hånd
                    </button>
                  </p>
                )}
              </div>
              <div className="flex border-t border-warning/20">
                <button
                  onClick={() => setShowUnclaimConfirm(false)}
                  className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-warning/20 active:bg-surface-low"
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

          {/* Angre ferdigmelding — for plukker/admin når sonen er ferdig eller tatt med selv.
              Aldri etter at en sjåfør har hentet (picked_up uten self_delivered). */}
          {(zone.status === 'completed' || (zone.status === 'picked_up' && zone.self_delivered)) && (userHasClaimed || isAdmin) && (
            <Button size="md" loading={loading} onClick={handleUncomplete} className="w-full bg-warning/10 !text-warning hover:bg-warning/20">
              Angre ferdigmelding
            </Button>
          )}

          {isFull && !userHasClaimed && !isFinished && !helpOpen && !notice && (
            <p className="text-sm text-text-tertiary text-center py-2">
              {fromHelpLink ? 'De klarte seg likevel. Takk!' : 'Sonen er full — alle plasser er tatt'}
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
