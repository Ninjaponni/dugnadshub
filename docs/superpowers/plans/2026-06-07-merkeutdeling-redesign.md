# Merkeutdeling — admin-redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erstatte dagens chip-baserte merketildeling i `app/admin/medlemmer/page.tsx` med et enhetlig rutenett av runde merke-ikoner (farge = opptjent, grå = mangler), bottom-sheet detaljer/tildel-flyt, og ryddet rolle/type-editor — basert på handoffen i `~/Downloads/design_handoff_merkeutdeling/`.

**Architecture:** Medlem-detaljen flyttes ut av ekspandert kort og rendres som en full-screen overlay (slides in fra høyre) som ligger over medlemslisten. Overlayet får egen scroll-container med fast topptekst (tilbake + tittel). Et 3-kols rutenett viser alle 70 merker — auto-merker er readonly (popup viser "Tildeles automatisk"), manuelle merker har full gi/fjern-flyt. Bottom-sheets gjenbruker eksisterende `BottomSheet`-komponent. Roller forblir single-felt (`profile.role`) men editoren får designet-tro chip-utseende.

**Tech Stack:** Next.js 15, React 19, Tailwind v4 (CSS-variabler i `app/globals.css`), Framer Motion, lucide-react, eksisterende `components/ui/{BottomSheet,Button,Card}.tsx`, Supabase JS-klient.

---

## Filstruktur

**Nye filer:**
- `components/admin/MemberDetailOverlay.tsx` — overlay-container med tilbake-knapp + sticky header + scrollbart innhold. Eier all medlemsstate (badges, rolle, type, sletteflyt).
- `components/admin/BadgeTile.tsx` — én rund merke-knapp (66px sirkel + status-markør + navn).
- `components/admin/BadgeDetailSheet.tsx` — BottomSheet med 112px sirkel, beskrivelse, gi/fjern-knapper.
- `components/admin/RoleEditorSheet.tsx` — BottomSheet med rolle-chips + type-segment.
- `components/admin/MemberToast.tsx` — bunntoast med dark bg + grønn hake.

**Endrede filer:**
- `app/admin/medlemmer/page.tsx` — fjern ekspandert panel og inline rolle/badge-UI. Erstatt med kortliste der hvert kort åpner overlayet ved klikk.
- `app/(app)/profil/page.tsx` — bump versjon fra v10.22 → v10.23 (per commit).
- (Ingen endringer i `lib/badges/definitions.ts` eller datamodell.)

**Hvorfor splitte:** Hovedsiden er allerede 622 linjer — overlayet flyttes ut for å holde page.tsx fokusert på lista. BadgeTile/Sheet/RoleEditor/Toast er gjenbrukbare biter med tydelig ansvar.

---

## Designbeslutninger (fastlagt i forhandsdialog)

- **Layout:** Alt. C — full-screen overlay som glir inn fra høyre når et medlem velges. Lukker via tilbake-knapp eller ESC.
- **Roller:** Behold `profile.role` som single-felt. Editor-sheet ser ut som flerklikk men oppfører seg som radiobuttons (én aktiv om gangen). Type-segment uendret.
- **Merker:** Alle 70 vises. Auto-merker (`auto_criteria !== null`) er readonly i popup — viser status uten gi/fjern-knapper, med liten infotekst "Tildeles automatisk når kriteriet er oppfylt."

---

## Sentrale tokens og verdier (fra handoff)

| Element | Verdi |
|---|---|
| Sidebakgrunn | `bg-bg` (`--color-bg` #fbf6f0) |
| Kort/sirkel-bakgrunn | `bg-card` (#ffffff) |
| Lav surface | `bg-surface-low` (#f5f0ea) |
| Accent | `text-accent` (#a24a33) |
| Primær gradient | `linear-gradient(135deg, var(--color-accent), var(--color-primary-container))` |
| Merke-sirkel mobil | 66×66, `border-radius: 50%`, `overflow: hidden`, alltid hvit bg |
| Skygge opptjent | `0 2px 10px rgba(160,120,80,.18)` |
| Skygge mangler | `inset 0 0 0 1.5px rgba(57,56,43,.08)` |
| Bilde i sirkel | `width/height: 100%`, `object-fit: contain`, `transform: scale(0.82)`, `mix-blend-mode: multiply` |
| Mangler-stil | `filter: grayscale(1)`, `opacity: 0.4` |
| Status-markør størrelse | 22×22 sirkel, `bottom: -2; right: -2` |
| Hake (×1) | `bg-success` + hvit hake + `border: 2.5px solid var(--color-bg)` |
| Antallspille (×N) | `bg-accent` + hvit `×N` + hvit kant + `0 2px 6px rgba(162,74,51,.3)` |
| Mangler-markør | hvit bg + `border: 2px dashed var(--color-accent)` + accent `+` |
| Bottom sheet topp | `border-radius: 28px 28px 0 0`, drag-handle |
| Overlay-bakgrunn | `rgba(0,0,0,.3)` |
| Detaljsirkel | 112×112 i sheet |
| Status-pille opptjent | bg `rgba(107,143,113,.16)`, tekst `#3d6648` |
| Toast | `bg-text-primary` + hvit tekst + grønn hake, glir opp |

---

## Task 1: Sett opp overlayet og bytt medlemskort til klikkbare lenker

**Files:**
- Create: `components/admin/MemberDetailOverlay.tsx`
- Modify: `app/admin/medlemmer/page.tsx`

Steget legger til selve overlay-skallet (tom innhold) og endrer medlemskortene fra "ekspander" til "åpne overlay". All eksisterende badge/rolle/sletteflyt-state flyttes inn i overlayet i senere tasks.

- [ ] **Step 1: Lag MemberDetailOverlay-skall**

Opprett `components/admin/MemberDetailOverlay.tsx`:

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import type { Profile } from '@/lib/supabase/types'

interface Props {
  profile: Profile | null
  onClose: () => void
}

export default function MemberDetailOverlay({ profile, onClose }: Props) {
  // Lukk på ESC
  useEffect(() => {
    if (!profile) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profile, onClose])

  return (
    <AnimatePresence>
      {profile && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="fixed inset-0 z-50 bg-bg flex flex-col"
        >
          {/* Topptekst */}
          <header className="shrink-0 z-10 bg-card border-b border-black/[0.03] safe-top">
            <div className="flex items-center h-14 px-3 max-w-[430px] mx-auto w-full">
              <button
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
          <main className="flex-1 overflow-y-auto px-5 pt-5 pb-10 max-w-[430px] mx-auto w-full">
            {/* Innhold legges til i senere tasks */}
            <p className="text-text-tertiary text-sm">[Innhold kommer]</p>
            <p className="text-text-primary mt-4">{profile.full_name}</p>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Bytt medlemskortene fra accordion til klikkbar lenke + monter overlayet**

I `app/admin/medlemmer/page.tsx`:

1. Importer overlay-komponenten øverst:
```tsx
import MemberDetailOverlay from '@/components/admin/MemberDetailOverlay'
```

2. Erstatt `expandedId` med `selectedId`:
```tsx
const [selectedId, setSelectedId] = useState<string | null>(null)
const selectedProfile = profiles.find(p => p.id === selectedId) ?? null
```

3. I `filtered.map(...)`-rendringen: bytt `<button onClick={() => setExpandedId(...)}>` til å sette `selectedId` og fjern hele `<AnimatePresence>` med ekspandert panel. Korthovedet beholdes uendret (avatar, navn, merker-tall, rolle-chip), men `ChevronDown/Up` byttes til `ChevronRight`.

4. Rett før `</div>` som lukker `pt-16 pb-28`-wrapperen, monter overlayet:
```tsx
<MemberDetailOverlay
  profile={selectedProfile}
  onClose={() => setSelectedId(null)}
/>
```

5. Fjern alle ubrukte states og handlers fra page.tsx som flyttes til overlayet i senere tasks (la dem ligge inntil videre — vi flytter i Task 4).

- [ ] **Step 3: Verifiser i browser**

Kjør `npm run dev`. Gå til `/admin/medlemmer`. Sjekk:
- Korthovedet ser likt ut som før (avatar, navn, rolle-chip, chevron-right)
- Trykk på et kort → overlay glir inn fra høyre med navn og tilbake-knapp
- Tilbake-knapp lukker overlayet
- ESC lukker overlayet
- Ingen TypeScript-feil: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add components/admin/MemberDetailOverlay.tsx app/admin/medlemmer/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): legg til medlem-detalj-overlay som erstatter accordion

Skall for full-screen overlay som glir inn fra høyre når et medlem
velges. Innhold (mini-profil, kontakt, merker, faresone) kommer i
påfølgende commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 2: Mini-profil + kontaktinfo i overlayet

**Files:**
- Modify: `components/admin/MemberDetailOverlay.tsx`

Bygger den øverste delen av innholdet etter spec i README.md §1.1 og 1.2.

- [ ] **Step 1: Importer typer og lucide-ikoner**

Øverst i `MemberDetailOverlay.tsx`:
```tsx
import { ArrowLeft, Pencil, Music } from 'lucide-react'
import type { Profile, Child, Role } from '@/lib/supabase/types'

const roleLabels: Record<Role, string> = {
  collector: 'Samler',
  driver: 'Sjåfør',
  strapper: 'Stripser',
  host: 'Vert',
  admin: 'Admin',
}
```

- [ ] **Step 2: Utvid props med tellinger og rediger-callback**

```tsx
interface Props {
  profile: Profile | null
  badgeCount: number
  zoneCount: number
  onClose: () => void
  onEditRoles: () => void
}
```

(Side `medlemmer/page.tsx` må sende disse — vi gjør det i Task 4. Inntil videre kan defaults brukes for å holde stegene grønne.)

- [ ] **Step 3: Bytt ut placeholder-`<main>`-innholdet med mini-profil**

```tsx
<main className="flex-1 overflow-y-auto max-w-[430px] mx-auto w-full">
  <div className="px-5 pt-5 pb-10">
    {/* Mini-profil */}
    <div className="flex items-start gap-3.5 mb-2">
      <div className="w-14 h-14 rounded-full bg-surface-low flex items-center justify-center shrink-0">
        <span className="font-[var(--font-display)] text-[22px] font-bold text-accent">
          {(profile.full_name || profile.email)[0].toUpperCase()}
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
            {roleLabels[profile.role]}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold border-[1.5px] border-text-primary/[0.14] text-text-secondary">
            {profile.is_musician ? (
              <><Music size={11} /> Musikant{profile.musician_group ? ` · ${profile.musician_group}` : ''}</>
            ) : 'Forelder'}
          </span>
          <button
            onClick={onEditRoles}
            className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-transparent border-[1.5px] border-dashed border-accent/45 text-accent text-xs font-bold active:opacity-70"
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

    {/* Merker + faresone fylles i Task 3 og 5 */}
    <p className="text-text-tertiary text-sm">[Merker kommer]</p>
  </div>
</main>
```

- [ ] **Step 4: Send props fra page.tsx**

I `app/admin/medlemmer/page.tsx`, oppdater overlay-montering:
```tsx
<MemberDetailOverlay
  profile={selectedProfile}
  badgeCount={selectedProfile ? getBadgeCountForUser(selectedProfile.id) : 0}
  zoneCount={selectedProfile ? getClaimCount(selectedProfile.id) : 0}
  onClose={() => setSelectedId(null)}
  onEditRoles={() => { /* åpnes i Task 4 */ }}
/>
```

- [ ] **Step 5: Verifiser i browser**

- Velg medlem → mini-profil med avatar, navn, X merker · Y soner, rolle-chip, type-chip, Endre-knapp
- Kontaktinfo viser e-post, telefon, barn, registrert-dato
- Stilen matcher mockupen (sjekk mot `Merkeutdeling (admin).html` i nettleser)
- Tipografi: navn = Manrope 22/800, undertekst 13.5px
- TypeScript: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/admin/MemberDetailOverlay.tsx app/admin/medlemmer/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): bygg mini-profil og kontaktinfo i medlem-overlay

Tar inn badgeCount/zoneCount fra forelder og viser avatar, navn,
rolle/type-chips med 'Endre'-knapp samt e-post/telefon/barn/registrert.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 3: BadgeTile-komponent + rutenett + filter

**Files:**
- Create: `components/admin/BadgeTile.tsx`
- Modify: `components/admin/MemberDetailOverlay.tsx`

Bygger merke-rutenettet uten klikk-handler (popup kommer i Task 5).

- [ ] **Step 1: Lag BadgeTile**

Opprett `components/admin/BadgeTile.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'

interface Props {
  name: string
  icon: string
  earned: boolean
  count: number
  onClick: () => void
  awarded?: boolean
  bumped?: boolean
}

export default function BadgeTile({ name, icon, earned, count, onClick, awarded, bumped }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-3 px-0.5 pb-2.5 rounded-2xl bg-transparent active:opacity-70"
    >
      <div className="relative w-[66px] h-[66px]">
        {/* Ring-pop ved tildeling */}
        {awarded && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute -inset-[5px] rounded-full border-[3px] border-accent pointer-events-none"
          />
        )}
        {/* Sirkel */}
        <motion.div
          initial={false}
          animate={awarded ? { scale: [0.5, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.55, ease: [0.3, 1.4, 0.5, 1] }}
          className="w-[66px] h-[66px] rounded-full overflow-hidden bg-card"
          style={{
            boxShadow: earned
              ? '0 2px 10px rgba(160,120,80,.18)'
              : 'inset 0 0 0 1.5px rgba(57,56,43,.08)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={icon}
            alt={name}
            loading="lazy"
            className="w-full h-full object-contain transition-[filter,opacity] duration-450"
            style={{
              transform: 'scale(0.82)',
              mixBlendMode: 'multiply',
              filter: earned ? 'none' : 'grayscale(1)',
              opacity: earned ? 1 : 0.4,
            }}
          />
        </motion.div>
        {/* Status-markør */}
        {earned && count > 1 && (
          <motion.span
            initial={false}
            animate={bumped ? { scale: [1, 1.45, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, ease: [0.3, 1.4, 0.5, 1] }}
            className="absolute -bottom-0.5 -right-0.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent text-white text-[10.5px] font-bold flex items-center justify-center"
            style={{
              border: '2.5px solid var(--color-bg)',
              boxShadow: '0 2px 6px rgba(162,74,51,.3)',
            }}
          >
            ×{count}
          </motion.span>
        )}
        {earned && count === 1 && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-success text-white flex items-center justify-center"
            style={{ border: '2.5px solid var(--color-bg)' }}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {!earned && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-card text-accent flex items-center justify-center"
            style={{ border: '2px dashed var(--color-accent)' }}
          >
            <Plus size={12} strokeWidth={2.5} />
          </span>
        )}
      </div>
      <span
        className={`text-[11.5px] font-semibold text-center leading-tight ${
          earned ? 'text-text-secondary' : 'text-text-tertiary'
        }`}
      >
        {name}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Utvid overlay-props med badges-data**

I `MemberDetailOverlay.tsx`:

```tsx
import { badgeDefinitions } from '@/lib/badges/definitions'
import BadgeTile from './BadgeTile'

interface Props {
  profile: Profile | null
  badgeCount: number
  zoneCount: number
  badgeCounts: Map<number, number>  // badge_id -> antall ganger brukeren har det
  onClose: () => void
  onEditRoles: () => void
  onSelectBadge: (badgeId: number) => void
}
```

Inni komponenten, legg til filter-state:
```tsx
const [filter, setFilter] = useState<'alle' | 'opptjent' | 'mangler'>('alle')

const badges = badgeDefinitions.map(def => ({
  ...def,
  count: badgeCounts.get(def.id) ?? 0,
  earned: (badgeCounts.get(def.id) ?? 0) > 0,
}))

const visibleBadges = badges.filter(b =>
  filter === 'alle' ? true : filter === 'opptjent' ? b.earned : !b.earned
)
const earnedTotal = badges.reduce((s, b) => s + b.count, 0)
```

- [ ] **Step 3: Erstatt "[Merker kommer]"-paragrafen med seksjon + filter + rutenett**

```tsx
{/* Merker-seksjon */}
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

{/* Filter */}
<div className="flex gap-0.5 bg-surface-low rounded-full p-1 mb-5">
  {(['alle', 'opptjent', 'mangler'] as const).map(k => (
    <button
      key={k}
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

{/* Rutenett */}
<div className="grid grid-cols-3 gap-x-0.5 gap-y-1.5">
  {visibleBadges.map(b => (
    <BadgeTile
      key={b.id}
      name={b.name}
      icon={b.icon}
      earned={b.earned}
      count={b.count}
      onClick={() => onSelectBadge(b.id)}
    />
  ))}
</div>
```

- [ ] **Step 4: Send badgeCounts fra page.tsx**

Legg til helper i `page.tsx`:
```tsx
function getBadgeCountsForUser(userId: string): Map<number, number> {
  const m = new Map<number, number>()
  for (const ub of userBadges) {
    if (ub.user_id !== userId) continue
    m.set(ub.badge_id, (m.get(ub.badge_id) ?? 0) + 1)
  }
  return m
}
```

Send til overlayet:
```tsx
<MemberDetailOverlay
  profile={selectedProfile}
  badgeCount={selectedProfile ? getBadgeCountForUser(selectedProfile.id) : 0}
  zoneCount={selectedProfile ? getClaimCount(selectedProfile.id) : 0}
  badgeCounts={selectedProfile ? getBadgeCountsForUser(selectedProfile.id) : new Map()}
  onClose={() => setSelectedId(null)}
  onEditRoles={() => { /* Task 4 */ }}
  onSelectBadge={(id) => { /* Task 5 */ }}
/>
```

- [ ] **Step 5: Verifiser i browser**

- Velg medlem med kjente merker (f.eks. test-bruker)
- Sjekk at alle 70 merker vises i 3-kols grid
- Opptjente er farge + grønn hake / accent-pille
- Mangler er grå + stiplet pluss
- `mix-blend-mode: multiply` smelter bildet inn i sirkelen (ingen synlig firkant)
- Filter Alle/Opptjente/Mangler skifter delmengden
- TypeScript: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/admin/BadgeTile.tsx components/admin/MemberDetailOverlay.tsx app/admin/medlemmer/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): legg til merke-rutenett med filter i medlem-overlay

3-kols grid med runde 66px-sirkler, multiply-blend, status-markører
(grønn hake / accent ×N / stiplet pluss). Filter Alle/Opptjente/Mangler.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 4: Rolle-editor BottomSheet + flytt handleRoleChange/handleTypeChange

**Files:**
- Create: `components/admin/RoleEditorSheet.tsx`
- Modify: `components/admin/MemberDetailOverlay.tsx`, `app/admin/medlemmer/page.tsx`

Editoren beholder single-rolle-modellen — chips fungerer som radio (én aktiv av gangen).

- [ ] **Step 1: Lag RoleEditorSheet**

Opprett `components/admin/RoleEditorSheet.tsx`:

```tsx
'use client'

import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import type { Role, ChildGroup } from '@/lib/supabase/types'

const ROLES: Role[] = ['collector', 'driver', 'strapper', 'host', 'admin']
const ROLE_LABELS: Record<Role, string> = {
  collector: 'Samler',
  driver: 'Sjåfør',
  strapper: 'Stripser',
  host: 'Vert',
  admin: 'Admin',
}
const TYPES = ['Forelder', 'Musikant'] as const
const GROUPS: ChildGroup[] = ['Aspirant', 'Junior', 'Hovedkorps']

interface Props {
  open: boolean
  name: string
  role: Role
  isMusician: boolean
  musicianGroup: ChildGroup | null
  onClose: () => void
  onRoleChange: (role: Role) => void
  onTypeChange: (isMusician: boolean, group: ChildGroup | null) => void
}

export default function RoleEditorSheet(props: Props) {
  const { open, name, role, isMusician, musicianGroup, onClose, onRoleChange, onTypeChange } = props
  const typeValue = isMusician ? 'Musikant' : 'Forelder'

  return (
    <BottomSheet open={open} onClose={onClose} title="Roller og type">
      <p className="text-sm text-text-secondary mb-5 leading-[1.5]">
        Velg rolle og type for {name}. Endringer lagres med en gang.
      </p>

      <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2.5">
        Rolle
      </span>
      <div className="flex flex-wrap gap-2 mb-6">
        {ROLES.map(r => {
          const on = role === r
          return (
            <button
              key={r}
              onClick={() => onRoleChange(r)}
              className={`border-0 text-sm font-semibold py-2.5 px-4 rounded-full transition-all ${
                on ? 'text-white shadow-[0_6px_18px_rgba(162,74,51,0.25)]' : 'bg-surface-low text-text-secondary'
              }`}
              style={on ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' } : {}}
            >
              {ROLE_LABELS[r]}
            </button>
          )
        })}
      </div>

      <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2.5">
        Type
      </span>
      <div className="flex gap-1.5 bg-surface-low rounded-full p-1 mb-3">
        {TYPES.map(t => {
          const on = typeValue === t
          return (
            <button
              key={t}
              onClick={() => onTypeChange(t === 'Musikant', t === 'Musikant' ? (musicianGroup ?? 'Aspirant') : null)}
              className={`flex-1 border-0 text-sm font-semibold py-2.5 rounded-full transition-all ${
                on ? 'text-white shadow-[0_6px_18px_rgba(162,74,51,0.25)]' : 'bg-transparent text-text-secondary'
              }`}
              style={on ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' } : {}}
            >
              {t}
            </button>
          )
        })}
      </div>

      {isMusician && (
        <div className="grid grid-cols-3 gap-1.5 mb-5">
          {GROUPS.map(g => (
            <button
              key={g}
              onClick={() => onTypeChange(true, g)}
              className={`text-xs font-semibold py-2 rounded-full ${
                musicianGroup === g
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-surface-low text-text-secondary'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <Button variant="primary" size="lg" className="w-full rounded-full mt-2" onClick={onClose}>
        Ferdig
      </Button>
    </BottomSheet>
  )
}
```

- [ ] **Step 2: Flytt handleRoleChange/handleTypeChange-state inn i overlayet**

I `MemberDetailOverlay.tsx` kommer rolle-endring som callback fra forelder — vi holder Supabase-mutasjon i `page.tsx` (samme som i dag), så overlayet trenger bare en `onEditRoles`-prop + `open`-state.

I `MemberDetailOverlay.tsx`, legg til lokal sheet-state:
```tsx
const [roleEditorOpen, setRoleEditorOpen] = useState(false)
```

Bytt `onEditRoles` til `onRoleChange`/`onTypeChange` (forelder eier mutasjon):
```tsx
interface Props {
  // ...
  onRoleChange: (role: Role) => void
  onTypeChange: (isMusician: boolean, group: ChildGroup | null) => void
}
```

Og bruk `setRoleEditorOpen(true)` for "Endre"-knappen i mini-profil.

Monter sheeten nederst i overlay-JSX (innenfor motion.div):
```tsx
<RoleEditorSheet
  open={roleEditorOpen}
  name={profile.full_name || 'medlemmet'}
  role={profile.role}
  isMusician={profile.is_musician}
  musicianGroup={profile.musician_group ?? null}
  onClose={() => setRoleEditorOpen(false)}
  onRoleChange={onRoleChange}
  onTypeChange={onTypeChange}
/>
```

- [ ] **Step 3: Koble til i page.tsx**

```tsx
<MemberDetailOverlay
  profile={selectedProfile}
  badgeCount={selectedProfile ? getBadgeCountForUser(selectedProfile.id) : 0}
  zoneCount={selectedProfile ? getClaimCount(selectedProfile.id) : 0}
  badgeCounts={selectedProfile ? getBadgeCountsForUser(selectedProfile.id) : new Map()}
  onClose={() => setSelectedId(null)}
  onRoleChange={(role) => selectedProfile && handleRoleChange(selectedProfile.id, role)}
  onTypeChange={(isM, g) => selectedProfile && handleTypeChange(selectedProfile.id, isM, g)}
  onSelectBadge={(id) => { /* Task 5 */ }}
/>
```

- [ ] **Step 4: Verifiser i browser**

- Trykk "Endre" → bottom sheet glir opp
- Velg en annen rolle → chip får gradient + lagres til Supabase
- Bytt mellom Forelder/Musikant → segmentbryter virker
- Hvis Musikant → 3 grupper vises som radio
- "Ferdig" lukker sheeten
- TypeScript: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add components/admin/RoleEditorSheet.tsx components/admin/MemberDetailOverlay.tsx app/admin/medlemmer/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): rolle/type-editor som bottom sheet med gradient-chips

Beholder single-rolle-modellen (chips fungerer som radio). Type-segment
med Forelder/Musikant + gruppe-velger når Musikant.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 5: BadgeDetailSheet — gi/fjern + auto-merker readonly

**Files:**
- Create: `components/admin/BadgeDetailSheet.tsx`
- Modify: `components/admin/MemberDetailOverlay.tsx`, `app/admin/medlemmer/page.tsx`

- [ ] **Step 1: Lag BadgeDetailSheet**

Opprett `components/admin/BadgeDetailSheet.tsx`:

```tsx
'use client'

import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { Award, Check, Lock, Plus } from 'lucide-react'

type Category = 'starter' | 'vanlig' | 'veteran' | 'elite' | 'aktivitet' | '17mai' | 'styret' | 'komite' | 'vakt'

const STACKABLE = new Set<Category>(['aktivitet', '17mai', 'styret', 'komite', 'vakt'])

interface Props {
  open: boolean
  badge: {
    id: number
    name: string
    icon: string
    description: string
    category: Category
    auto_criteria: string | null
  } | null
  count: number
  onClose: () => void
  onAward: () => void
  onRemove: () => void
}

export default function BadgeDetailSheet({ open, badge, count, onClose, onAward, onRemove }: Props) {
  if (!badge) return <BottomSheet open={open} onClose={onClose}><div /></BottomSheet>

  const earned = count > 0
  const stackable = STACKABLE.has(badge.category)
  const isAuto = badge.auto_criteria !== null

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="text-center pt-1">
        <div
          className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-2 bg-card"
          style={{
            boxShadow: earned
              ? '0 4px 16px rgba(160,120,80,.22)'
              : 'inset 0 0 0 1.5px rgba(57,56,43,.08)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badge.icon}
            alt={badge.name}
            className="w-full h-full object-contain"
            style={{
              transform: 'scale(0.82)',
              mixBlendMode: 'multiply',
              filter: earned ? 'none' : 'grayscale(1)',
              opacity: earned ? 1 : 0.4,
            }}
          />
        </div>
        <h2 className="font-[var(--font-display)] text-[22px] font-extrabold tracking-tight mt-1.5 mb-2.5">
          {badge.name}
        </h2>
        {earned ? (
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(107,143,113,.16)', color: '#3d6648' }}
          >
            <Check size={12} strokeWidth={3} /> Opptjent{count > 1 ? ` ×${count}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-surface-low text-text-tertiary">
            <Lock size={12} /> Ikke opptjent ennå
          </span>
        )}
        <p className="text-[14.5px] text-text-secondary leading-[1.55] mt-4 mb-5 mx-1">
          {badge.description}
        </p>

        {isAuto ? (
          <p className="text-xs text-text-tertiary italic mt-2 mb-2">
            Tildeles automatisk når kriteriet er oppfylt.
          </p>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              className="w-full rounded-full"
              onClick={onAward}
              disabled={earned && !stackable}
            >
              {earned ? <><Plus size={16} strokeWidth={2.5} /> Gi merket igjen</> : <><Award size={16} /> Gi merket</>}
            </Button>
            {earned && (
              <button
                onClick={onRemove}
                className="w-full mt-1.5 py-3 text-sm font-semibold text-danger rounded-full bg-transparent active:bg-danger/5"
              >
                {count > 1 ? 'Fjern ett (−1)' : 'Ta tilbake merket'}
              </button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 2: Koble sheeten til overlayet**

I `MemberDetailOverlay.tsx`:

```tsx
import BadgeDetailSheet from './BadgeDetailSheet'

// I komponenten:
const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null)
const selectedBadge = badgeDefinitions.find(b => b.id === selectedBadgeId) ?? null
const selectedCount = selectedBadgeId ? (badgeCounts.get(selectedBadgeId) ?? 0) : 0
```

Bytt `onSelectBadge`-prop til `onAwardBadge` / `onRemoveBadge` (forelder eier Supabase-mutasjon):
```tsx
interface Props {
  // ...
  onAwardBadge: (badgeId: number) => void
  onRemoveBadge: (badgeId: number) => void
}
```

I BadgeTile `onClick`: `() => setSelectedBadgeId(b.id)`.

Monter sheeten:
```tsx
<BadgeDetailSheet
  open={selectedBadgeId !== null}
  badge={selectedBadge}
  count={selectedCount}
  onClose={() => setSelectedBadgeId(null)}
  onAward={() => {
    if (selectedBadgeId !== null) onAwardBadge(selectedBadgeId)
    setSelectedBadgeId(null)
  }}
  onRemove={() => {
    if (selectedBadgeId !== null) onRemoveBadge(selectedBadgeId)
    setSelectedBadgeId(null)
  }}
/>
```

- [ ] **Step 3: Koble til i page.tsx**

```tsx
<MemberDetailOverlay
  // ... eksisterende props
  onAwardBadge={(id) => selectedProfile && handleAwardBadge(selectedProfile.id, id)}
  onRemoveBadge={(id) => selectedProfile && handleRemoveBadge(selectedProfile.id, id)}
/>
```

- [ ] **Step 4: Verifiser i browser**

- Trykk et opptjent merke → sheet viser 112px sirkel, "Opptjent ×N"-pille, beskrivelse, "Gi merket igjen" + "Ta tilbake"
- Trykk et ikke-opptjent manuelt merke → "Gi merket"-knapp, ingen fjern
- Trykk et auto-merke (f.eks. Frøspire) → ingen knapper, "Tildeles automatisk"-tekst
- Tildel og fjern fungerer, merket i griden oppdateres
- TypeScript: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add components/admin/BadgeDetailSheet.tsx components/admin/MemberDetailOverlay.tsx app/admin/medlemmer/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): merke-detalj som bottom sheet med gi/fjern-flyt

112px sirkel, status-pille (grønn hake eller lås), beskrivelse, primær
gradient-knapp + danger ghost. Auto-merker er readonly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 6: Faresone (Nullstill + Slett medlem) + Toast

**Files:**
- Create: `components/admin/MemberToast.tsx`
- Modify: `components/admin/MemberDetailOverlay.tsx`, `app/admin/medlemmer/page.tsx`

- [ ] **Step 1: Lag MemberToast**

Opprett `components/admin/MemberToast.tsx`:

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'

interface Props {
  message: string | null
}

export default function MemberToast({ message }: Props) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1.1] }}
          className="fixed left-4 right-4 bottom-6 z-[60] flex justify-center pointer-events-none"
        >
          <div className="inline-flex items-center gap-2.5 bg-text-primary text-white py-3 px-4.5 rounded-full text-[13.5px] font-semibold shadow-[0_12px_30px_rgba(45,38,32,0.3)] max-w-full">
            <span className="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0">
              <Check size={14} strokeWidth={3} />
            </span>
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Legg faresone-seksjonen i overlayet**

Etter rutenett-`</div>`, før closing `</main>`:

```tsx
<div className="mt-7 flex flex-col gap-3.5">
  <button
    onClick={() => onResetBadges()}
    className="bg-transparent border-0 text-danger text-sm font-semibold p-1 text-center active:opacity-70"
  >
    Nullstill alle merker
  </button>
  <button
    onClick={() => onDeleteMember()}
    className="inline-flex items-center justify-center gap-2.5 bg-danger/[0.08] text-danger border-0 rounded-full py-[15px] font-[var(--font-display)] font-bold text-[15px] active:bg-danger/15"
  >
    <Trash2 size={17} /> Slett medlem
  </button>
</div>
```

Importer `Trash2`. Legg `onResetBadges` og `onDeleteMember` i props.

- [ ] **Step 3: Bekreftelsesdialog for sletting**

Bruk eksisterende `ConfirmDialog`-komponent — sjekk `components/ui/ConfirmDialog.tsx` for API. I `page.tsx`, behold dagens `deleteConfirmId`-state men flytt selve bekreftelsesvisningen til en `<ConfirmDialog>`-komponent som monteres på toppnivå.

Hvis ConfirmDialog ikke passer (sjekk filen):

```tsx
// Enkleste vei: behold dagens "deleteConfirmId"-flow men trigger fra overlayet,
// og vis bekreftelsen som en BottomSheet i overlay-skallet.
```

- [ ] **Step 4: Toast på alle handlinger**

I `MemberDetailOverlay.tsx`:
```tsx
const [toast, setToast] = useState<string | null>(null)
const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

const showToast = useCallback((msg: string) => {
  setToast(msg)
  if (toastTimer.current) clearTimeout(toastTimer.current)
  toastTimer.current = setTimeout(() => setToast(null), 2400)
}, [])
```

Etter `onAward`/`onRemove`/`onRoleChange`/`onTypeChange` kalles fra forelder, vis toast lokalt:
- "«Frøspire» tildelt Aina"
- "«Frøspire» gitt på nytt — nå ×2"
- "«Frøspire» fjernet"
- "Rolle oppdatert: Sjåfør"
- "Alle merker nullstilt"

Monter `<MemberToast message={toast} />` nederst i overlay-JSX.

- [ ] **Step 5: Verifiser i browser**

- "Nullstill alle merker" tømmer grid + viser toast
- "Slett medlem" → bekreftelse → sletter + lukker overlay
- Alle handlinger viser tilsvarende toast 2.4s
- TypeScript: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/admin/MemberToast.tsx components/admin/MemberDetailOverlay.tsx app/admin/medlemmer/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): faresone-knapper og toast-bekreftelser i medlem-overlay

Nullstill-knapp (tekst) + danger-pille for sletting med bekreftelse.
Toast (dark bg, grønn hake) bekrefter alle handlinger i 2.4s.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 7: Rydd page.tsx + bump versjon

**Files:**
- Modify: `app/admin/medlemmer/page.tsx`, `app/(app)/profil/page.tsx`

- [ ] **Step 1: Slett ubrukt state i page.tsx**

Disse er ikke lenger i bruk når overlayet eier UI:
- `expandedId` (erstattet av `selectedId`)
- `roleLabels` (flyttet til RoleEditorSheet og BadgeDetailSheet hvis brukt)
- `manualBadges` (overlayet henter fra `badgeDefinitions`)
- `STACKABLE_CATEGORIES` (flyttet til BadgeDetailSheet)

Behold alle handlers (`handleRoleChange`, `handleTypeChange`, `handleAwardBadge`, `handleRemoveBadge`, `handleResetBadges`, `handleDeleteMember`) — de er fortsatt mutasjons-API mot Supabase og brukes av overlayet via callbacks.

- [ ] **Step 2: Korthovedet — gjør det rent**

I `filtered.map(...)`-blokken, slett alle linjer fra `<AnimatePresence>` (ekspandert panel) og ned til closing `</AnimatePresence>` rett før `</Card>`. Behold avatar, navn, merker-count, rolle-chip + bytt chevron til høyre.

- [ ] **Step 3: Verifiser**

```bash
npx tsc --noEmit
npm run lint
```

Ingen feil. Browser-sjekk på:
- Listevisning ser ut som før, men med chevron-right
- Klikk åpner overlay
- Hele flyten (tildel, fjern, endre rolle, slett) virker fra overlayet

- [ ] **Step 4: Bump versjon**

I `app/(app)/profil/page.tsx`, finn versjonsstreng (v10.22) og bump til v10.23.

- [ ] **Step 5: Commit**

```bash
git add app/admin/medlemmer/page.tsx app/(app)/profil/page.tsx
git commit -m "$(cat <<'EOF'
refactor(admin): rydd ut ubrukt accordion-state i medlemmer/page

Etter at detalj-overlayet eier all merke/rolle-UI fjernes manualBadges,
STACKABLE_CATEGORIES, expandedId og ekspandert panel-JSX. Versjon → v10.23.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 8: Sluttverifisering mot mockup

**Files:** ingen kodeendringer — kun browser-sjekk

- [ ] **Step 1: Side-ved-side med mockup**

1. Åpne `~/Downloads/design_handoff_merkeutdeling/Merkeutdeling (admin).html` i nettleser
2. Åpne `npm run dev` → `/admin/medlemmer` → velg medlem
3. Sjekk pikselpresisjon:
   - Avatar 56px sirkel
   - Navn 22/800
   - "X merker · Y soner" (accent på tall)
   - Rolle-chip + type-chip + Endre-knapp (stiplet omriss)
   - Kontaktinfo: e-post/telefon-lenker i accent
   - Skillelinje
   - "MERKER" + opptjent-teller
   - Filter-segment
   - 3-kols rutenett med multiply-blend
   - Status-markører på riktig posisjon
   - Faresone nederst

- [ ] **Step 2: Bottom sheet-detaljer**

- Trykk et opptjent stackbart merke → "Opptjent ×N" + "Gi merket igjen" + "Fjern ett (−1)"
- Trykk et opptjent ikke-stackbart merke (f.eks. starter) → "Gi merket igjen" disabled
- Trykk et auto-merke → "Tildeles automatisk"-tekst
- Trykk et ikke-opptjent manuelt → kun "Gi merket"

- [ ] **Step 3: Animasjoner**

- Tildel merke: ring-pop + scale-up på sirkelen
- Gi flere ganger: ×N-pille bumper
- Sheet glir opp/ned
- Overlay glir inn/ut fra høyre
- Toast glir opp og forsvinner etter 2.4s

- [ ] **Step 4: Mobile-størrelser**

- Sjekk i 375px-bred Safari iPhone-simulator
- 430px-bred (iPhone 17 Pro Max)
- Sjekk safe-area-padding (notch) på `safe-top`-headeren

- [ ] **Step 5: Live-data**

- Sjekk mot en faktisk Supabase-bruker med kjente merker (din egen profil eller test-bruker)
- Tildel et merke → refresh siden → merket er fortsatt der

Hvis alt OK: ingen flere commits. Hvis avvik: lag oppfølgings-commits per liten fiks.

---

## Sjekkliste etter implementering

- [ ] Alle 7 oppgaver fullført + bekreftet i browser
- [ ] `npx tsc --noEmit` rent
- [ ] `npm run lint` rent
- [ ] Versjon bumpet til v10.23
- [ ] Memory oppdatert med v10.23 i `dugnadshub.md`
- [ ] [Dugnadshub designsystem-klasser](feedback_dugnadshub_designsystem.md) overholdt — `bg-card`, `bg-surface-low`, `text-accent` osv. (ikke `bg-surface`/`bg-foreground`)
- [ ] Norske bokstaver overalt — ingen ae/oe/aa
- [ ] Ingen em dash i kode eller commit-meldinger
