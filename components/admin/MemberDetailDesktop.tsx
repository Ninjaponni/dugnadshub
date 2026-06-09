'use client'

// Side-by-side merkeutdeling-visning for desktop (lg+). Erstatter
// MemberDetailOverlay paa store skjermer: venstre kort med profil,
// hoeyre panel med tabs og badge-rutenett. Mobil-flyten bruker fortsatt
// overlayet uendret.

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, Pencil, Music, Trash2, Mail, Phone, Baby, Calendar } from 'lucide-react'
import type { Profile, Child, Role, ChildGroup } from '@/lib/supabase/types'
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
  onRoleChange: (role: Role) => void
  onTypeChange: (isMusician: boolean, group: ChildGroup | null) => void
  onAwardBadge: (badgeId: number) => void
  onRemoveBadge: (badgeId: number) => void
  onResetBadges: () => void
  onDeleteMember: () => void
}

type Filter = 'alle' | 'opptjent' | 'mangler'

// Rolle-chip fargeklasse (matcher tabellens roller)
function roleChipClass(role: Role): string {
  switch (role) {
    case 'admin': return 'bg-purple/10 text-purple'
    case 'driver': return 'bg-teal/10 text-teal'
    case 'strapper': return 'bg-warning/10 text-warning'
    case 'host': return 'bg-accent/10 text-accent'
    default: return 'bg-surface-low text-text-secondary'
  }
}

// Rad i kontaktinfo-listen. Stoetter klikkbar accent-verdi for e-post/telefon.
function InfoRow({ icon, label, value, href }: {
  icon: React.ReactNode
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center text-text-tertiary shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary">{label}</div>
        {href ? (
          <a href={href} className="text-[13.5px] text-accent font-semibold break-words">{value}</a>
        ) : (
          <div className="text-[13.5px] text-text-secondary break-words">{value}</div>
        )}
      </div>
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

  // Wrappere med toast-bekreftelse (samme moenster som overlayet)
  const handleAward = (badgeId: number) => {
    const b = badgeDefinitions.find(bb => bb.id === badgeId)
    const c = badgeCounts.get(badgeId) ?? 0
    onAwardBadge(badgeId)
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

  const handleRemove = (badgeId: number) => {
    const b = badgeDefinitions.find(bb => bb.id === badgeId)
    const c = badgeCounts.get(badgeId) ?? 0
    onRemoveBadge(badgeId)
    if (b) {
      if (c > 1) showToast(`«${b.name}» redusert til ×${c - 1}`)
      else showToast(`«${b.name}» fjernet`)
    }
  }

  const handleRoleChangeWrapped = (role: Role) => {
    onRoleChange(role)
    showToast(`Rolle oppdatert: ${ROLE_LABELS[role]}`)
  }

  const handleTypeChangeWrapped = (isM: boolean, g: ChildGroup | null) => {
    onTypeChange(isM, g)
    showToast(isM ? `Type: Musikant${g ? ` · ${g}` : ''}` : 'Type: Forelder')
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

      <div className="grid grid-cols-[380px_1fr] gap-8 items-start">
        {/* VENSTRE: profil-kort */}
        <div className="bg-card border border-text-primary/[0.09] rounded-3xl p-6 shadow-sm space-y-5">
          {/* Avatar + navn + merke-telling */}
          <div className="flex flex-col items-center pt-2">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={120}
                height={120}
                className="rounded-full w-[120px] h-[120px] object-cover"
              />
            ) : (
              <div className="w-[120px] h-[120px] rounded-full bg-surface-low flex items-center justify-center">
                <span className="font-[var(--font-display)] text-5xl font-bold text-accent">
                  {initial}
                </span>
              </div>
            )}
            <h2 className="font-[var(--font-display)] text-2xl font-extrabold mt-4 text-text-primary text-center text-balance">
              {profile.full_name || 'Ukjent'}
            </h2>
            <div className="text-accent font-bold mt-1">
              {badgeCount} {badgeCount === 1 ? 'merke' : 'merker'}
            </div>
          </div>

          {/* Rolle- og type-chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleChipClass(profile.role as Role)}`}>
              {ROLE_LABELS[profile.role]}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border border-text-primary/15 text-text-secondary">
              {profile.is_musician ? (
                <><Music size={11} /> Musikant{profile.musician_group ? ` · ${profile.musician_group}` : ''}</>
              ) : 'Forelder'}
            </span>
          </div>

          {/* Endre roller */}
          <button
            type="button"
            onClick={() => setRoleEditorOpen(true)}
            className="w-full py-2.5 rounded-full border border-text-primary/15 text-sm font-bold flex items-center justify-center gap-2 hover:bg-surface-low transition-colors"
          >
            <Pencil size={14} /> Endre roller
          </button>

          {/* Kontaktinfo */}
          <div className="pt-4 border-t border-text-primary/[0.06]">
            {profile.email && (
              <InfoRow
                icon={<Mail size={14} />}
                label="E-post"
                value={profile.email}
                href={`mailto:${profile.email}`}
              />
            )}
            {profile.phone && (
              <InfoRow
                icon={<Phone size={14} />}
                label="Telefon"
                value={profile.phone}
                href={`tel:${profile.phone}`}
              />
            )}
            {!profile.is_musician && profile.children && profile.children.length > 0 && (
              <InfoRow
                icon={<Baby size={14} />}
                label="Barn"
                value={profile.children.map((c: Child) => `${c.name}${c.group ? ` (${c.group})` : ''}`).join(', ')}
              />
            )}
            <InfoRow
              icon={<Calendar size={14} />}
              label="Registrert"
              value={new Date(profile.created_at).toLocaleDateString('nb-NO')}
            />
          </div>

          {/* Faresone */}
          <div className="flex gap-2 pt-4 border-t border-text-primary/[0.06]">
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
              className="flex-1 py-2.5 rounded-full text-danger text-sm font-bold border border-danger/20 hover:bg-danger/5 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} /> Slett
            </button>
          </div>
        </div>

        {/* HOEYRE: merke-panel */}
        <div className="bg-card border border-text-primary/[0.09] rounded-3xl p-6 shadow-sm">
          {/* Tabs + telling */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
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
                  className={`font-display text-sm font-bold px-4 py-1.5 rounded-full transition ${
                    filter === k ? 'bg-card text-accent shadow-sm' : 'text-text-secondary'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-text-tertiary">
              {earnedTotal} opptjent · {badges.length} totalt
            </span>
          </div>

          {/* Badge-rutenett: 6 kolonner, 7 paa xl */}
          {visibleBadges.length === 0 ? (
            <div className="py-16 text-center text-text-tertiary text-sm">
              {filter === 'opptjent'
                ? 'Ingen merker opptjent ennå.'
                : 'Ingen merker som mangler.'}
            </div>
          ) : (
            <div className="grid grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-6">
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
