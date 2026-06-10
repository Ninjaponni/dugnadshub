'use client'

// Delt logikk for medlems-detalj — brukes av BÅDE MemberDetailOverlay (mobil)
// og MemberDetailDesktop (lg+), så merke-tildeling, toasts og filter oppfører
// seg likt. Samme mønster som useShiftClaim for vaktene. Komponentene eier
// kun layout.

import { useState } from 'react'
import { badgeDefinitions } from '@/lib/badges/definitions'
import { ROLE_LABELS } from '@/lib/roles'
import { useToast } from '@/lib/hooks/useToast'
import type { Role, ChildGroup } from '@/lib/supabase/types'

export type BadgeFilter = 'alle' | 'opptjent' | 'mangler'

export function useMemberDetail({
  badgeCounts,
  onAwardBadge,
  onRemoveBadge,
  onRoleChange,
  onTypeChange,
}: {
  badgeCounts: Map<number, number>
  onAwardBadge: (badgeId: number) => Promise<boolean>
  onRemoveBadge: (badgeId: number) => Promise<boolean>
  onRoleChange: (role: Role) => Promise<boolean>
  onTypeChange: (isMusician: boolean, group: ChildGroup | null) => Promise<boolean>
}) {
  // Filter for merke-rutenettet
  const [filter, setFilter] = useState<BadgeFilter>('alle')
  // Styrer rolle-editor-sheeten
  const [roleEditorOpen, setRoleEditorOpen] = useState(false)
  // Hvilket merke som er valgt for detalj-visning
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null)
  // Bekreftelse for sletting av medlem
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Animasjons-state for nylig tildelt eller bumpet merke.
  // Trigger ring-pop ved første tildeling, og ×N-bump ved gjentatt.
  const [awardedBadgeId, setAwardedBadgeId] = useState<number | null>(null)
  const [bumpedBadgeId, setBumpedBadgeId] = useState<number | null>(null)

  // Toast for bekreftelse av handlinger
  const { message: toast, showToast } = useToast()

  const selectedBadge = badgeDefinitions.find(b => b.id === selectedBadgeId) ?? null
  const selectedBadgeCount = selectedBadgeId ? (badgeCounts.get(selectedBadgeId) ?? 0) : 0

  // Wrappere som kjører forelder-handler og viser toast etterpå.
  // Venter på DB-resultatet før suksess-toast — skal ikke lyve ved feil.
  const handleAward = async (badgeId: number) => {
    const b = badgeDefinitions.find(bb => bb.id === badgeId)
    const c = badgeCounts.get(badgeId) ?? 0
    const ok = await onAwardBadge(badgeId)
    if (!ok) { showToast('Kunne ikke lagre merket — prøv igjen'); return }
    if (b) {
      if (c > 0) {
        // Bump ×N-pille når merket allerede er gitt en gang
        setBumpedBadgeId(badgeId)
        setTimeout(() => setBumpedBadgeId(null), 520)
        showToast(`«${b.name}» gitt på nytt, nå ×${c + 1}`)
      } else {
        // Ring-pop og scale-up ved første tildeling
        setAwardedBadgeId(badgeId)
        setTimeout(() => setAwardedBadgeId(null), 650)
        showToast(`«${b.name}» tildelt`)
      }
    }
  }

  const handleRemove = async (badgeId: number) => {
    const b = badgeDefinitions.find(bb => bb.id === badgeId)
    const c = badgeCounts.get(badgeId) ?? 0
    const ok = await onRemoveBadge(badgeId)
    if (!ok) { showToast('Kunne ikke fjerne merket — prøv igjen'); return }
    if (b) {
      if (c > 1) showToast(`«${b.name}» redusert til ×${c - 1}`)
      else showToast(`«${b.name}» fjernet`)
    }
  }

  const handleRoleChangeWrapped = async (role: Role) => {
    const ok = await onRoleChange(role)
    showToast(ok ? `Rolle oppdatert: ${ROLE_LABELS[role]}` : 'Kunne ikke lagre rollen — prøv igjen')
  }

  const handleTypeChangeWrapped = async (isM: boolean, g: ChildGroup | null) => {
    const ok = await onTypeChange(isM, g)
    showToast(ok ? (isM ? `Type: Musikant${g ? ` · ${g}` : ''}` : 'Type: Forelder') : 'Kunne ikke lagre — prøv igjen')
  }

  // Slå sammen definisjoner med antall, så vi vet hva som er opptjent
  const badges = badgeDefinitions.map(def => ({
    ...def,
    count: badgeCounts.get(def.id) ?? 0,
    earned: (badgeCounts.get(def.id) ?? 0) > 0,
  }))

  const visibleBadges = badges.filter(b =>
    filter === 'alle' ? true : filter === 'opptjent' ? b.earned : !b.earned
  )
  // Sum av antall opptjente (teller multiple tildelinger flere ganger)
  const earnedTotal = badges.reduce((s, b) => s + b.count, 0)

  return {
    filter, setFilter,
    roleEditorOpen, setRoleEditorOpen,
    selectedBadgeId, setSelectedBadgeId, selectedBadge, selectedBadgeCount,
    showDeleteConfirm, setShowDeleteConfirm,
    awardedBadgeId, bumpedBadgeId,
    toast, showToast,
    handleAward, handleRemove, handleRoleChangeWrapped, handleTypeChangeWrapped,
    badges, visibleBadges, earnedTotal,
  }
}
