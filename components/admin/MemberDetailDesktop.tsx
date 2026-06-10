'use client'

// Side-by-side merkeutdeling-visning for desktop (lg+). Erstatter
// MemberDetailOverlay paa store skjermer: venstre kort med profil,
// hoeyre panel med tabs og badge-rutenett. Mobil-flyten bruker fortsatt
// overlayet uendret.

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, Pencil, Trash2, Award } from 'lucide-react'
import type { Profile, Role, ChildGroup } from '@/lib/supabase/types'
import { badgeDefinitions } from '@/lib/badges/definitions'
import { ROLE_LABELS } from '@/lib/roles'
import { getAvatarUrl } from '@/components/features/AvatarPicker'
import { useToast } from '@/lib/hooks/useToast'
import BadgeTile from './BadgeTile'
import RoleEditorSheet from './RoleEditorSheet'
import BadgeDetailSheet from './BadgeDetailSheet'
import MemberToast from './MemberToast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Props {
  profile: Profile
  badgeCount: number
  // Antall ganger brukeren har hvert merke (badge_id -> antall)
  badgeCounts: Map<number, number>
  onBack: () => void
  onRoleChange: (role: Role) => Promise<boolean>
  onTypeChange: (isMusician: boolean, group: ChildGroup | null) => Promise<boolean>
  onAwardBadge: (badgeId: number) => Promise<boolean>
  onRemoveBadge: (badgeId: number) => Promise<boolean>
  onResetBadges: () => void
  onDeleteMember: () => void
}

type Filter = 'alle' | 'opptjent' | 'mangler'

// Rad i kontaktinfo-listen. Label venstre, verdi hoeyrejustert.
// Accent-farge for e-post/telefon-lenker.
function InfoRow({ label, value, accent, href }: {
  label: string
  value: string
  accent?: boolean
  href?: string
}) {
  const valueClass = `font-semibold text-right flex-1 min-w-0 break-words ${accent ? 'text-accent' : 'text-text-secondary'}`
  return (
    <div className="flex justify-between gap-3.5 text-[13.5px]">
      <span className="text-text-tertiary shrink-0">{label}</span>
      {href ? (
        <a href={href} className={valueClass}>{value}</a>
      ) : (
        <span className={valueClass}>{value}</span>
      )}
    </div>
  )
}

export default function MemberDetailDesktop({
  profile,
  badgeCount,
  badgeCounts,
  onBack,
  onRoleChange,
  onTypeChange,
  onAwardBadge,
  onRemoveBadge,
  onResetBadges,
  onDeleteMember,
}: Props) {
  const [filter, setFilter] = useState<Filter>('alle')
  const [roleEditorOpen, setRoleEditorOpen] = useState(false)
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Animasjons-state for ny-tildelt og bumpet merke (samme som i overlayet)
  const [awardedBadgeId, setAwardedBadgeId] = useState<number | null>(null)
  const [bumpedBadgeId, setBumpedBadgeId] = useState<number | null>(null)

  const { message: toast, showToast } = useToast()

  const selectedBadge = badgeDefinitions.find(b => b.id === selectedBadgeId) ?? null
  const selectedBadgeCount = selectedBadgeId ? (badgeCounts.get(selectedBadgeId) ?? 0) : 0

  // Wrappere med toast-bekreftelse (samme moenster som overlayet).
  // Venter paa DB-resultatet foer suksess-toast — skal ikke lyve ved feil.
  const handleAward = async (badgeId: number) => {
    const b = badgeDefinitions.find(bb => bb.id === badgeId)
    const c = badgeCounts.get(badgeId) ?? 0
    const ok = await onAwardBadge(badgeId)
    if (!ok) { showToast('Kunne ikke lagre merket — prøv igjen'); return }
    if (b) {
      if (c > 0) {
        setBumpedBadgeId(badgeId)
        setTimeout(() => setBumpedBadgeId(null), 520)
        showToast(`«${b.name}» gitt på nytt, nå ×${c + 1}`)
      } else {
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

  // Slaa sammen definisjoner med antall
  const badges = badgeDefinitions.map(def => ({
    ...def,
    count: badgeCounts.get(def.id) ?? 0,
    earned: (badgeCounts.get(def.id) ?? 0) > 0,
  }))

  const visibleBadges = badges.filter(b =>
    filter === 'alle' ? true : filter === 'opptjent' ? b.earned : !b.earned
  )
  const earnedTotal = badges.reduce((s, b) => s + b.count, 0)

  const avatarUrl = profile.avatar_url ? getAvatarUrl(profile.avatar_url) : null
  const initial = ((profile.full_name || profile.email || '?')[0] || '?').toUpperCase()

  return (
    <div className="pb-10">
      {/* Tilbake-lenke */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-accent hover:underline mb-6"
      >
        <ChevronLeft size={16} /> Alle medlemmer
      </button>

      <div className="grid grid-cols-[340px_1fr] gap-7 items-start">
        {/* VENSTRE: profil-kort — sticky så det blir stående mens man scroller gjennom merker */}
        <div className="bg-card border border-text-primary/[0.09] rounded-3xl p-7 shadow-sm sticky top-[88px]">
          {/* Avatar + navn + merke-telling */}
          <div className="flex flex-col items-center text-center">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={80}
                height={80}
                className="rounded-full w-20 h-20 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-surface-low flex items-center justify-center">
                <span className="font-[var(--font-display)] text-3xl font-bold text-accent">
                  {initial}
                </span>
              </div>
            )}
            <h2 className="font-[var(--font-display)] text-[23px] font-extrabold mt-3.5 text-text-primary text-balance">
              {profile.full_name || 'Ukjent'}
            </h2>
            <div className="text-[13.5px] text-text-secondary mt-1">
              <b className="text-accent font-bold">{badgeCount} merker</b>
            </div>

            {/* Rolle- og type-chips (neutral) */}
            <div className="flex flex-wrap gap-1.5 justify-center mt-4">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-surface-low text-text-secondary">
                <Award size={11} /> {ROLE_LABELS[profile.role]}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-low text-text-secondary">
                {profile.is_musician
                  ? `Musikant${profile.musician_group ? ` · ${profile.musician_group}` : ''}`
                  : 'Forelder'}
              </span>
            </div>

            {/* Endre roller — kompakt */}
            <div className="flex justify-center mt-3.5">
              <button
                type="button"
                onClick={() => setRoleEditorOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-text-primary/15 text-xs font-bold hover:bg-surface-low transition-colors"
              >
                <Pencil size={13} /> Endre roller
              </button>
            </div>
          </div>

          {/* Kontaktinfo */}
          <div className="pt-4.5 mt-5 border-t border-text-primary/[0.07] flex flex-col gap-3">
            {profile.email && (
              <InfoRow
                label="E-post"
                value={profile.email}
                href={`mailto:${profile.email}`}
                accent
              />
            )}
            {profile.phone && (
              <InfoRow
                label="Telefon"
                value={profile.phone}
                href={`tel:${profile.phone}`}
              />
            )}
            <InfoRow
              label="Barn"
              value={profile.children?.length ? profile.children.map(c => `${c.name} (${c.group})`).join(', ') : '—'}
            />
            <InfoRow
              label="Registrert"
              value={new Date(profile.created_at).toLocaleDateString('nb-NO')}
            />
          </div>

          {/* Faresone */}
          <div className="flex gap-2.5 pt-4.5 mt-5 border-t border-text-primary/[0.07]">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex-1 py-2.5 rounded-full bg-surface-low text-text-secondary text-sm font-bold hover:bg-surface-low/70 transition-colors"
            >
              Nullstill merker
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-danger text-sm font-bold hover:bg-danger/5 transition-colors"
            >
              <Trash2 size={15} /> Slett
            </button>
          </div>
        </div>

        {/* HOEYRE: merke-panel */}
        <div>
          {/* Tabs + telling — sticky */}
          <div className="sticky top-[88px] z-10 bg-bg py-2 -mt-2 flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="inline-flex bg-surface-low rounded-full p-1 gap-0.5">
              {([
                ['alle', 'Alle'],
                ['opptjent', 'Opptjente'],
                ['mangler', 'Mangler'],
              ] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`font-display text-sm font-bold px-5 py-2 rounded-full transition ${
                    filter === k
                      ? 'bg-card text-accent shadow-[0_1px_4px_rgba(57,56,43,0.1)]'
                      : 'text-text-secondary'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <span className="text-[12.5px] font-bold text-text-tertiary">
              {earnedTotal} opptjent · {badges.length} totalt
            </span>
          </div>

          {/* Badge-rutenett: auto-fill 120px minimum */}
          {visibleBadges.length === 0 ? (
            <div className="py-16 text-center text-text-tertiary text-sm">
              {filter === 'opptjent'
                ? 'Ingen merker opptjent ennå.'
                : 'Ingen merker som mangler.'}
            </div>
          ) : (
            <div
              className="grid gap-x-1.5 gap-y-6"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
            >
              {visibleBadges.map(b => (
                <BadgeTile
                  key={b.id}
                  name={b.name}
                  icon={b.icon}
                  earned={b.earned}
                  count={b.count}
                  awarded={awardedBadgeId === b.id}
                  bumped={bumpedBadgeId === b.id}
                  onClick={() => setSelectedBadgeId(b.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sheets — gjenbruker overlay-komponentene. pinToBottom siden vi
          ikke har BottomNav paa admin-flatene. */}
      <RoleEditorSheet
        open={roleEditorOpen}
        name={profile.full_name || 'medlemmet'}
        role={profile.role}
        isMusician={profile.is_musician}
        musicianGroup={profile.musician_group ?? null}
        onClose={() => setRoleEditorOpen(false)}
        onRoleChange={handleRoleChangeWrapped}
        onTypeChange={handleTypeChangeWrapped}
        pinToBottom
      />

      <BadgeDetailSheet
        open={selectedBadgeId !== null}
        badge={selectedBadge}
        count={selectedBadgeCount}
        onClose={() => setSelectedBadgeId(null)}
        onAward={() => {
          if (selectedBadgeId !== null) handleAward(selectedBadgeId)
          setSelectedBadgeId(null)
        }}
        onRemove={() => {
          if (selectedBadgeId !== null) handleRemove(selectedBadgeId)
          setSelectedBadgeId(null)
        }}
        pinToBottom
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Nullstill alle merker?"
        message="Alle merker for dette medlemmet fjernes. Auto-merker vil bli tildelt på nytt ved neste oppdatering."
        confirmLabel="Nullstill"
        cancelLabel="Avbryt"
        variant="danger"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          setShowResetConfirm(false)
          onResetBadges()
          showToast('Alle merker nullstilt')
        }}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Slett medlem?"
        message="Profil, merker og soner fjernes permanent. Dette kan ikke angres."
        confirmLabel="Slett medlem"
        cancelLabel="Avbryt"
        variant="danger"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false)
          onDeleteMember()
          onBack()
        }}
      />

      <MemberToast message={toast} />
    </div>
  )
}
