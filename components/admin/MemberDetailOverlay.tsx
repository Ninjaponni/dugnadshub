'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Pencil, Music, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Profile, Child, Role, ChildGroup } from '@/lib/supabase/types'
import { badgeDefinitions } from '@/lib/badges/definitions'
import { ROLE_LABELS } from '@/lib/roles'
import { useToast } from '@/lib/hooks/useToast'
import BadgeTile from './BadgeTile'
import RoleEditorSheet from './RoleEditorSheet'
import BadgeDetailSheet from './BadgeDetailSheet'
import MemberToast from './MemberToast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Props {
  profile: Profile | null
  badgeCount: number
  zoneCount: number
  // Antall ganger brukeren har hvert merke (badge_id -> antall)
  badgeCounts: Map<number, number>
  onClose: () => void
  onRoleChange: (role: Role) => void
  onTypeChange: (isMusician: boolean, group: ChildGroup | null) => void
  onAwardBadge: (badgeId: number) => void
  onRemoveBadge: (badgeId: number) => void
  onResetBadges: () => void
  onDeleteMember: () => void
}

export default function MemberDetailOverlay({
  profile,
  badgeCount,
  zoneCount,
  badgeCounts,
  onClose,
  onRoleChange,
  onTypeChange,
  onAwardBadge,
  onRemoveBadge,
  onResetBadges,
  onDeleteMember,
}: Props) {
  // Filter for merke-rutenettet
  const [filter, setFilter] = useState<'alle' | 'opptjent' | 'mangler'>('alle')
  // Styrer rolle-editor-sheeten
  const [roleEditorOpen, setRoleEditorOpen] = useState(false)
  // Hvilket merke som er valgt for detalj-visning
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null)
  const selectedBadge = badgeDefinitions.find(b => b.id === selectedBadgeId) ?? null
  const selectedBadgeCount = selectedBadgeId ? (badgeCounts.get(selectedBadgeId) ?? 0) : 0

  // Bekreftelse for sletting av medlem
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Animasjons-state for nylig tildelt eller bumpet merke.
  // Trigger ring-pop ved første tildeling, og ×N-bump ved gjentatt.
  const [awardedBadgeId, setAwardedBadgeId] = useState<number | null>(null)
  const [bumpedBadgeId, setBumpedBadgeId] = useState<number | null>(null)

  // Toast for bekreftelse av handlinger
  const { message: toast, showToast } = useToast()

  // Wrappere som kjører forelder-handler og viser toast etterpå.
  // Vi leser merkenavn og antall før kallet, så meldingen reflekterer
  // tilstanden brukeren akkurat utløste.
  const handleAward = (badgeId: number) => {
    const b = badgeDefinitions.find(bb => bb.id === badgeId)
    const c = badgeCounts.get(badgeId) ?? 0
    onAwardBadge(badgeId)
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
  // Lukk på ESC
  useEffect(() => {
    if (!profile) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profile, onClose])

  // Lås body-scroll mens overlayet er åpent, så bakgrunnssiden ikke skroller
  // under finger-drag på mobil. Hopper over på desktop (lg+) siden overlayet
  // er skjult der via lg:hidden, men komponenten mountes fortsatt.
  useEffect(() => {
    if (!profile) return
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [profile])

  return (
    <AnimatePresence>
      {profile && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          // Overlay må ligge strikt over sidens egen fixed-header (z-40), ellers
          // kan klikk på tilbake-knappen feile på desktop fordi paint-rekkefølgen
          // tipper feil vei i noen browsere når DOM-rekkefølgen ikke er garantert.
          // BottomSheet bumpes til z-[55]/z-[60] så den fortsatt legger seg over.
          className="fixed inset-0 z-[45] bg-bg flex flex-col"
        >
          {/* Topptekst */}
          <header className="shrink-0 z-10 bg-card border-b border-black/[0.03] safe-top">
            <div className="flex items-center h-14 px-3 max-w-[430px] mx-auto w-full">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center active:opacity-70"
                aria-label="Tilbake"
              >
                <ArrowLeft size={18} className="text-text-primary" />
              </button>
              <h1 className="flex-1 text-center font-[var(--font-display)] text-base font-bold -ml-10">
                Medlem
              </h1>
            </div>
          </header>

          {/* Scrollbart innhold */}
          <main className="flex-1 overflow-y-auto max-w-[430px] mx-auto w-full">
            <div className="px-5 pt-5 pb-10">
              {/* Mini-profil */}
              <div className="flex items-start gap-3.5 mb-2">
                <div className="w-14 h-14 rounded-full bg-surface-low flex items-center justify-center shrink-0">
                  <span className="font-[var(--font-display)] text-[22px] font-bold text-accent">
                    {((profile.full_name || profile.email || '?')[0] || '?').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-[var(--font-display)] text-[22px] font-extrabold tracking-tight m-0">
                    {profile.full_name || 'Ukjent'}
                  </h2>
                  <p className="text-[13.5px] text-text-secondary mt-0.5 mb-2.5">
                    <b className="text-accent font-bold">{badgeCount} merker</b>
                    {' · '}{zoneCount} soner
                  </p>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold bg-accent/10 text-accent">
                      {ROLE_LABELS[profile.role]}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold border-[1.5px] border-text-primary/[0.14] text-text-secondary">
                      {profile.is_musician ? (
                        <><Music size={11} /> Musikant{profile.musician_group ? ` · ${profile.musician_group}` : ''}</>
                      ) : 'Forelder'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRoleEditorOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-transparent border-[1.5px] border-dashed border-accent/45 text-accent text-xs font-bold active:opacity-70"
                    >
                      <Pencil size={12} /> Endre
                    </button>
                  </div>
                </div>
              </div>

              {/* Kontaktinfo */}
              <div className="mt-4 flex flex-col gap-1">
                {profile.email && (
                  <p className="text-[13.5px] text-text-tertiary">
                    <span className="text-text-secondary">E-post:</span>{' '}
                    <a href={`mailto:${profile.email}`} className="text-accent font-semibold">{profile.email}</a>
                  </p>
                )}
                {profile.phone && (
                  <p className="text-[13.5px] text-text-tertiary">
                    <span className="text-text-secondary">Telefon:</span>{' '}
                    <a href={`tel:${profile.phone}`} className="text-accent font-semibold">{profile.phone}</a>
                  </p>
                )}
                {!profile.is_musician && profile.children && profile.children.length > 0 &&
                  profile.children.map((c: Child, i: number) => (
                    <p key={i} className="text-[13.5px] text-text-tertiary">
                      <span className="text-text-secondary">Barn:</span> {c.name}{c.group ? ` (${c.group})` : ''}
                    </p>
                  ))
                }
                <p className="text-[13.5px] text-text-tertiary">
                  <span className="text-text-secondary">Registrert:</span> {new Date(profile.created_at).toLocaleDateString('nb-NO')}
                </p>
              </div>

              <hr className="my-5 border-0 border-t border-text-primary/[0.07]" />

              {/* Merker-seksjon: overskrift + telling */}
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-secondary">
                  Merker
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent whitespace-nowrap">
                  {earnedTotal} opptjent · {badges.length} totalt
                </span>
              </div>
              <p className="text-[13.5px] text-text-tertiary mt-0 mb-4 leading-[1.5]">
                Trykk på et merke for å lese hva det betyr og dele det ut.
                Farge = opptjent, grå = ikke gitt ennå.
              </p>

              {/* Filter mellom Alle / Opptjente / Mangler */}
              <div className="flex gap-0.5 bg-surface-low rounded-full p-1 mb-5">
                {(['alle', 'opptjent', 'mangler'] as const).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    className={`flex-1 border-0 cursor-pointer text-[12.5px] font-semibold py-2 px-1.5 rounded-full transition-all ${
                      filter === k
                        ? 'bg-card text-accent shadow-[0_1px_4px_rgba(57,56,43,0.1)]'
                        : 'bg-transparent text-text-secondary'
                    }`}
                  >
                    {k === 'alle' ? 'Alle' : k === 'opptjent' ? 'Opptjente' : 'Mangler'}
                  </button>
                ))}
              </div>

              {/* Merke-rutenett, 3 kolonner */}
              <div className="grid grid-cols-3 gap-x-0.5 gap-y-1.5">
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

              {/* Faresone — nullstill merker og slett medlem */}
              <div className="mt-7 flex flex-col gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetBadges()
                    showToast('Alle merker nullstilt')
                  }}
                  className="bg-transparent border-0 text-danger text-sm font-semibold py-3 text-center active:opacity-70"
                >
                  Nullstill alle merker
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center justify-center gap-2.5 bg-danger/[0.08] text-danger border-0 rounded-full py-[15px] font-[var(--font-display)] font-bold text-[15px] active:bg-danger/15"
                >
                  <Trash2 size={17} /> Slett medlem
                </button>
              </div>
            </div>
          </main>

          {/* Rolle- og type-editor — ligger inne i overlayet så den følger samme stack.
              pinToBottom: overlayet har ingen BottomNav, så sheeten må sitte helt nede. */}
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

          {/* Merke-detalj med gi/fjern-flyt — auto-merker er readonly */}
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

          {/* Bekreftelse før vi sletter medlemmet permanent */}
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
              onClose()
            }}
          />

          {/* Toast nederst som bekrefter siste handling */}
          <MemberToast message={toast} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
