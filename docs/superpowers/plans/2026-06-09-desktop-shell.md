# Desktop-shell og responsivt designsystem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Innfor a desktop-versjon av Dugnadshub som matcher designhandoff `~/Downloads/design_handoff_desktop/`. Mobile-layouten beholdes uendret under 1024px (`lg`); desktop får en 264px sticky sidebar, en glass-topbar og maks 1320px content-bredde over 1024px.

**Architecture:** Responsivt på Tailwind-breakpoints (ingen separate page-trees). Eksisterende `(app)/layout.tsx` og `admin/layout.tsx` wrappes i en ny `DesktopShell` som rendrer chrome kun ved `lg+`. Mobile beholder dagens BottomNav under `lg`. Per-route metadata for topbar-tittel ligger i en sentral `META`-map slått opp via `usePathname`. Ingen ny data-modell, ingen DB-migrasjoner i denne runden.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4 med `@theme`-tokens, Framer Motion for animasjoner, lucide-react for ikoner, Mapbox GL JS for Kart (uendret), Supabase for auth/data (uendret).

**Designvalg (låst med Tor Martin 2026-06-09):**
- **Responsiv-strategi:** Sidebar over `lg` (≥1024px), BottomNav under. Mobil-flyt urørt.
- **Vakter:** Begge endringene fra designet — sub-nav under "Vakter" i sidebaren + Vaktplan-grid (én rad per dag, kolonne per rolle).
- **Merker:** Behold dagens 25-nivå-system, legg "neste merke"-hero som sekundær blokk under nivåbanneret.
- **Accent-tilpasning:** Droppes. Behold fast terrakotta-aksent. Theme-toggle (Lys/Mørk/System) er allerede ferdig på mobil.

**Filstruktur (nye filer):**
- `components/layout/DesktopShell.tsx` — orkestrator, switcher mellom mobile/desktop chrome
- `components/layout/DesktopSidebar.tsx` — 264px sticky sidebar med MEDLEM/ADMIN-grupper
- `components/layout/DesktopTopbar.tsx` — glass topbar, per-view tittel + bell
- `components/layout/VakterSubNav.tsx` — expanding sub-list under "Vakter"
- `components/layout/SidebarUserCard.tsx` — bunn-kort med avatar + navn + chevron
- `lib/layout/route-meta.ts` — `META`-map for titler per route
- `components/vakter/VaktplanGrid.tsx` — unified grid med DAG + rolle-kolonner
- `components/vakter/VMShiftCell.tsx` — flat cell i grid
- `components/vakter/SeatDots.tsx` — kapasitets-prikker
- `components/vakter/ShiftDetailModal.tsx` — desktop-variant av shift-claim (Modal, ikke BottomSheet)
- `components/merker/NesteMerkeHero.tsx` — beacon + count-up + neste merke-info
- `components/ui/Modal.tsx` — sentrert modal-primitiv for desktop (mobil bruker fortsatt BottomSheet)

**Filer som endres:**
- `app/(app)/layout.tsx` — wrap i DesktopShell, BottomNav får `lg:hidden`
- `app/admin/layout.tsx` — wrap i DesktopShell, fjern dagens topbar
- `components/layout/BottomNav.tsx` — legg på `lg:hidden`
- `app/(app)/arrangement/[id]/page.tsx` — desktop-variant av layout, bruk VaktplanGrid ved `lg+`
- `app/(app)/merker/page.tsx` — legg på NesteMerkeHero under nivåbanner
- `app/(app)/kart/page.tsx` — sikre at den breaker ut av topbar/padding på desktop
- `app/admin/hendelser/page.tsx` — kosmetisk polish (hover-elevate, SegmentBar-vurdering)
- `app/admin/medlemmer/page.tsx` — kosmetisk desktop-grid
- `app/admin/varsler/page.tsx` — kosmetisk desktop-layout

**Versjon:** Hver fase bumpes i `app/(app)/profil/page.tsx`. Start: v10.24 → ender på v10.28 etter alle 5 faser.

**Brukertesting:** Hver fase deployes til prod (Vercel auto-deploy fra main) før neste fase begynner. Tor Martin tester på dugnadshub.no før vi går videre.

---

## Fase 1 — App-shell foundation (v10.25)

Mål: Ny desktop-chrome (sidebar + topbar) rendres på `lg+`, mobile flyt urørt. Ingen view-endringer i denne fasen, kun shell.

### Task 1: Route META-map

**Files:**
- Create: `lib/layout/route-meta.ts`

- [ ] **Step 1: Skriv route-meta**

```ts
// Per-route metadata for desktop topbar. Mapped via usePathname.
export type RouteMeta = {
  title: string
  sub?: string
  fullBleed?: boolean
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/hjem': { title: 'God dag', sub: 'Her er det som skjer i korpset akkurat nå.' },
  '/kart': { title: 'Kart', fullBleed: true },
  '/sjafor': { title: 'Henting', sub: 'Sjåfør-oversikt og rute' },
  '/vakter': { title: 'Vakter' },
  '/merker': { title: 'Merker' },
  '/profil': { title: 'Profil' },
  '/admin/hendelser': { title: 'Hendelser', sub: 'Opprett og styr dugnader og arrangementer' },
  '/admin/medlemmer': { title: 'Medlemmer' },
  '/admin/varsler': { title: 'Varsler', sub: 'Send push til medlemmer' },
  '/admin/oversikt': { title: 'Oversikt' },
}

// Slår opp metadata. Faller tilbake på lengste matching prefix for dynamiske ruter (f.eks. /arrangement/[id]).
export function getRouteMeta(pathname: string): RouteMeta {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]
  if (pathname.startsWith('/arrangement/')) return { title: 'Vakter' }
  return { title: 'Dugnadshub' }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/layout/route-meta.ts
git commit -m "feat(layout): legg til route-META for desktop-topbar"
git push origin main
```

### Task 2: DesktopSidebar + UserCard

**Files:**
- Create: `components/layout/DesktopSidebar.tsx`
- Create: `components/layout/SidebarUserCard.tsx`

- [ ] **Step 1: Skriv SidebarUserCard**

```tsx
'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'

type Props = {
  name: string
  type: string // "Forelder" | "Musikant"
  role: string // "Samler", "Admin", osv.
  avatarSrc?: string | null
}

export default function SidebarUserCard({ name, type, role, avatarSrc }: Props) {
  return (
    <Link
      href="/profil"
      className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-low hover:bg-surface-low/80 transition-colors"
    >
      <Avatar name={name} src={avatarSrc} size={40} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-bold text-text-primary truncate">{name}</div>
        <div className="text-[11.5px] text-text-secondary truncate">{type} · {role}</div>
      </div>
      <ChevronDown size={15} className="text-text-tertiary shrink-0" />
    </Link>
  )
}
```

- [ ] **Step 2: Skriv DesktopSidebar**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, Truck, Ticket, Award, User, Calendar, Users, Bell } from 'lucide-react'
import SidebarUserCard from './SidebarUserCard'
import VakterSubNav from './VakterSubNav'
import type { Profile } from '@/lib/supabase/types'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  driversOnly?: boolean
  badge?: number
  count?: number
}

const MEMBER_NAV: NavItem[] = [
  { href: '/hjem', label: 'Hjem', icon: Home },
  { href: '/kart', label: 'Kart', icon: Map },
  { href: '/sjafor', label: 'Henting', icon: Truck, driversOnly: true },
  { href: '/vakter', label: 'Vakter', icon: Ticket },
  { href: '/merker', label: 'Merker', icon: Award },
  { href: '/profil', label: 'Profil', icon: User },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/hendelser', label: 'Hendelser', icon: Calendar },
  { href: '/admin/medlemmer', label: 'Medlemmer', icon: Users },
  { href: '/admin/varsler', label: 'Varsler', icon: Bell },
]

type Props = {
  profile: Pick<Profile, 'full_name' | 'role' | 'avatar_url'> & { type?: string }
  memberCount?: number
  unseenBadges?: number
  shiftEvents?: Array<{ id: string; title: string; navLabel?: string; closed?: boolean }>
}

export default function DesktopSidebar({ profile, memberCount, unseenBadges, shiftEvents = [] }: Props) {
  const pathname = usePathname()
  const isDriver = profile.role === 'driver' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'

  const memberItems = MEMBER_NAV.filter(it => !it.driversOnly || isDriver).map(it => ({
    ...it,
    badge: it.href === '/merker' && unseenBadges ? unseenBadges : undefined,
  }))

  const adminItems = ADMIN_NAV.map(it => ({
    ...it,
    count: it.href === '/admin/medlemmer' ? memberCount : undefined,
  }))

  return (
    <aside className="hidden lg:flex w-[264px] shrink-0 h-screen sticky top-0 flex-col bg-card border-r border-text-primary/[0.06] px-[18px] pt-[26px] pb-[18px]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-[30px]">
        <div className="w-[34px] h-[34px] rounded-full bg-accent text-white flex items-center justify-center font-display font-extrabold text-sm">TS</div>
        <div>
          <div className="font-display text-[19px] font-extrabold text-accent leading-none tracking-tight">Dugnadshub</div>
          <div className="text-[10.5px] font-semibold text-text-tertiary mt-[3px]">Tillerbyen Skolekorps</div>
        </div>
      </div>

      {/* MEDLEM */}
      <nav className="flex flex-col gap-[3px]">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-text-tertiary px-3.5 pb-2">Medlem</div>
        {memberItems.map(it => (
          <div key={it.href}>
            <NavLink item={it} active={pathname.startsWith(it.href)} />
            {it.href === '/vakter' && pathname.startsWith('/vakter') && shiftEvents.length > 0 && (
              <VakterSubNav events={shiftEvents} />
            )}
          </div>
        ))}
      </nav>

      <div className="h-px bg-text-primary/[0.07] my-[26px] mx-2" />

      {/* ADMIN — kun for admins */}
      {isAdmin && (
        <nav className="flex flex-col gap-[3px]">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-text-tertiary px-3.5 pb-2">Admin</div>
          {adminItems.map(it => (
            <NavLink key={it.href} item={it} active={pathname.startsWith(it.href)} />
          ))}
        </nav>
      )}

      <div className="flex-1" />

      <SidebarUserCard
        name={profile.full_name || 'Bruker'}
        type={profile.type || 'Forelder'}
        role={profile.role === 'admin' ? 'Admin' : profile.role === 'driver' ? 'Sjåfør' : 'Samler'}
        avatarSrc={profile.avatar_url}
      />
    </aside>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-[13px] px-3.5 py-2.5 rounded-[14px] transition-all ${
        active
          ? 'text-white shadow-[0_6px_18px_rgba(162,74,51,0.25)]'
          : 'text-text-secondary hover:bg-surface-low'
      }`}
      style={active ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' } : undefined}
    >
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      <span className={`text-[14.5px] flex-1 ${active ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
      {item.count != null && (
        <span className={`text-xs font-bold ${active ? 'text-white/85' : 'text-text-tertiary'}`}>{item.count}</span>
      )}
      {item.badge != null && !active && (
        <span className="min-w-[19px] h-[19px] px-1.5 rounded-full bg-danger text-white text-[10.5px] font-bold flex items-center justify-center">
          {item.badge}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/DesktopSidebar.tsx components/layout/SidebarUserCard.tsx
git commit -m "feat(layout): legg til DesktopSidebar med MEDLEM/ADMIN-grupper"
git push origin main
```

### Task 3: VakterSubNav (stub)

**Files:**
- Create: `components/layout/VakterSubNav.tsx`

- [ ] **Step 1: Skriv VakterSubNav (kun chrome i denne fasen, data kommer i fase 3)**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Event = {
  id: string
  title: string
  navLabel?: string
  closed?: boolean
}

export default function VakterSubNav({ events }: { events: Event[] }) {
  const pathname = usePathname()
  return (
    <div className="relative ml-[27px] pl-[15px] my-1 flex flex-col gap-px">
      <span className="absolute left-0 top-1 bottom-1 w-[1.5px] bg-text-primary/[0.07] rounded-full" />
      {events.map((e, i) => {
        const href = `/arrangement/${e.id}`
        const selected = pathname === href
        return (
          <Link
            key={e.id}
            href={href}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-[10px] transition-colors ${
              selected ? 'bg-surface-low text-accent font-bold' : 'text-text-secondary hover:bg-surface-low'
            }`}
            style={{ animation: `subItemIn .3s ease ${i * 45}ms` }}
          >
            {selected && (
              <span className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-[1.5px] h-[18px] bg-accent rounded-full" />
            )}
            <span className="text-[13.5px] flex-1 truncate">{e.navLabel || e.title}</span>
            {e.closed && (
              <span
                title="Påmelding stengt"
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: '#d6a417' }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Legg til subItemIn-keyframe i globals.css**

I `app/globals.css`, finn `@keyframes`-blokken (eller legg til ny seksjon):

```css
@keyframes subItemIn {
  from { opacity: 0; transform: translateX(-6px); }
  to { opacity: 1; transform: translateX(0); }
}
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/VakterSubNav.tsx app/globals.css
git commit -m "feat(layout): VakterSubNav-stub med guide-rail og subItemIn-animasjon"
git push origin main
```

### Task 4: DesktopTopbar

**Files:**
- Create: `components/layout/DesktopTopbar.tsx`

- [ ] **Step 1: Skriv DesktopTopbar**

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { getRouteMeta } from '@/lib/layout/route-meta'

type Props = {
  hasUnread?: boolean
  onBellClick?: () => void
}

export default function DesktopTopbar({ hasUnread = false, onBellClick }: Props) {
  const pathname = usePathname()
  const meta = getRouteMeta(pathname)
  if (meta.fullBleed) return null

  return (
    <header
      className="hidden lg:flex sticky top-0 z-50 items-center gap-5 px-9 py-5 border-b border-surface-low"
      style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight m-0 leading-tight text-text-primary">
          {meta.title}
        </h1>
        {meta.sub && <p className="text-[13.5px] text-text-secondary mt-[3px] m-0">{meta.sub}</p>}
      </div>
      <button
        type="button"
        onClick={onBellClick}
        className="relative w-11 h-11 rounded-full bg-card shadow-sm flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Varsler"
      >
        <Bell size={19} />
        {hasUnread && (
          <span
            className="absolute top-[9px] right-[10px] w-[9px] h-[9px] rounded-full bg-danger"
            style={{ border: '2px solid var(--color-card)' }}
          />
        )}
      </button>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/DesktopTopbar.tsx
git commit -m "feat(layout): glass-topbar med per-route tittel og bell"
git push origin main
```

### Task 5: DesktopShell + integrer i (app)/layout.tsx

**Files:**
- Create: `components/layout/DesktopShell.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `components/layout/BottomNav.tsx`

- [ ] **Step 1: Skriv DesktopShell**

```tsx
import { createClient } from '@/lib/supabase/server'
import DesktopSidebar from './DesktopSidebar'
import DesktopTopbar from './DesktopTopbar'
import type { Profile } from '@/lib/supabase/types'
import { usePathname } from 'next/navigation'
import { getRouteMeta } from '@/lib/layout/route-meta'

// Wrapper som rendrer desktop chrome over lg+ og passer mobile innhold gjennom uendret.
export default async function DesktopShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Pick<Profile, 'full_name' | 'role' | 'avatar_url'> & { type?: string } = {
    full_name: 'Bruker',
    role: 'member',
    avatar_url: null,
    type: 'Forelder',
  }

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role, avatar_url, is_musician')
      .eq('id', user.id)
      .single()
    if (data) {
      profile = {
        full_name: (data as any).full_name,
        role: (data as any).role,
        avatar_url: (data as any).avatar_url,
        type: (data as any).is_musician ? 'Musikant' : 'Forelder',
      }
    }
  }

  return (
    <div className="lg:flex lg:min-h-screen lg:bg-bg">
      <DesktopSidebar profile={profile} />
      <div className="flex-1 lg:flex lg:flex-col lg:min-w-0">
        <DesktopTopbar />
        <main className="lg:max-w-[1320px] lg:w-full lg:mx-auto lg:px-9 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Oppdater (app)/layout.tsx**

```tsx
import BottomNav from '@/components/layout/BottomNav'
import DesktopShell from '@/components/layout/DesktopShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mobil-flyt — under lg */}
      <div className="lg:hidden max-w-[430px] mx-auto min-h-dvh pb-20">
        {children}
        <BottomNav />
      </div>
      {/* Desktop-flyt — lg+ */}
      <div className="hidden lg:block">
        <DesktopShell>{children}</DesktopShell>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verifiser at BottomNav allerede har `fixed` posisjonering — den skal forsvinne automatisk siden parent har `lg:hidden`. Ingen endring nødvendig i BottomNav.tsx**

- [ ] **Step 4: Bump versjon til 10.25 i `app/(app)/profil/page.tsx`**

```bash
# Søk etter "v10.24" og erstatt med "v10.25" i profil/page.tsx
```

- [ ] **Step 5: Commit + deploy + brukertest**

```bash
git add app/\(app\)/layout.tsx components/layout/DesktopShell.tsx app/\(app\)/profil/page.tsx
git commit -m "feat(layout): desktop-shell rendres på lg+, mobile uendret (v10.25)"
git push origin main
```

Pause: Tor Martin tester på dugnadshub.no på desktop. Sjekk: sidebar synlig, topbar synlig, alle eksisterende sider rendres inni shell uten brudd. Mobile-flyt (BottomNav) urørt.

### Task 6: Integrer i admin/layout.tsx

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Erstatt admin layout-innmaten med DesktopShell**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'
import DesktopShell from '@/components/layout/DesktopShell'
import BottomNav from '@/components/layout/BottomNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/logg-inn')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const p = profile as unknown as Pick<Profile, 'role'> | null
  if (!p || p.role !== 'admin') redirect('/hjem')

  return (
    <>
      <div className="lg:hidden max-w-4xl mx-auto min-h-dvh px-4 pt-14 pb-20 safe-top">
        {children}
        <BottomNav />
      </div>
      <div className="hidden lg:block">
        <DesktopShell>{children}</DesktopShell>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(layout): admin bruker samme desktop-shell på lg+"
git push origin main
```

Pause: Verifiser admin-sider (hendelser, medlemmer, varsler) rendrer riktig i ny shell. Mobile-admin urørt.

---

## Fase 2 — Kosmetisk polish av eksisterende views (v10.26)

Mål: Eksisterende mobile-views ser polerte ut i desktop-shell. Ingen funksjonelle endringer.

### Task 7: Hjem-siden — desktop padding + hover-elevation

**Files:**
- Modify: `app/(app)/hjem/page.tsx` (eller komponenter den bruker)

- [ ] **Step 1: Les nåværende `app/(app)/hjem/page.tsx` og finn ArrangementCard/event-kortene**

- [ ] **Step 2: Legg til `lg:hover:-translate-y-0.5 lg:transition-transform` på event-kortene**

- [ ] **Step 3: Verifiser at hjem-siden ikke har `px-` eller margin som krasjer mot desktop-paddingen i `<main>` (lg:px-9 lg:py-8 settes av shell)**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(hjem): hover-elevation på event-kort på desktop"
git push origin main
```

### Task 8: Profil-siden — desktop-layout

**Files:**
- Modify: `app/(app)/profil/page.tsx`

- [ ] **Step 1: Wrap settings-rader i `lg:grid lg:grid-cols-2 lg:gap-6` for to-kolonne på desktop**

- [ ] **Step 2: Avatar + name-blokk får `lg:flex lg:items-center lg:gap-8` for større visuell hierarki**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(profil): to-kolonne settings-grid på desktop"
git push origin main
```

### Task 9: Sjåfør-siden — empty state ved ingen aktive hentinger

**Files:**
- Modify: `app/(app)/sjafor/page.tsx`

- [ ] **Step 1: Les eksisterende sjafor-side, sjekk om empty state allerede finnes**

- [ ] **Step 2: Hvis ikke, legg til: sentrert kort, 66px sirkel med Truck-ikon, "Ingen aktive hentinger akkurat nå", en linje med forklaring**

```tsx
<div className="lg:max-w-md lg:mx-auto bg-card border border-text-primary/[0.09] rounded-3xl p-8 shadow-sm text-center">
  <div className="w-[66px] h-[66px] mx-auto rounded-full bg-surface-low flex items-center justify-center mb-4">
    <Truck size={28} className="text-text-secondary" strokeWidth={1.8} />
  </div>
  <h2 className="font-display text-lg font-bold text-text-primary mb-2">Ingen aktive hentinger akkurat nå</h2>
  <p className="text-sm text-text-secondary">Når neste plastdugnad eller bottle collection åpner, ser du sonene dine her.</p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sjafor): empty state når ingen aktive hentinger"
git push origin main
```

### Task 10: Admin medlemmer + varsler + hendelser — desktop kosmetikk

**Files:**
- Modify: `app/admin/medlemmer/page.tsx`
- Modify: `app/admin/varsler/page.tsx`
- Modify: `app/admin/hendelser/page.tsx`

- [ ] **Step 1: Medlemmer — wrap member-listen i `lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4` for grid på desktop**

- [ ] **Step 2: Hendelser — legg `lg:hover:-translate-y-1 lg:transition-transform` på EventCard**

- [ ] **Step 3: Varsler — wrap skjema og preview side-ved-side på lg+ (`lg:grid lg:grid-cols-2 lg:gap-8`)**

- [ ] **Step 4: Bump versjon til 10.26 og commit**

```bash
git commit -m "feat(admin): desktop-grid og hover-elevation (v10.26)"
git push origin main
```

Pause: Brukertest hele appen på desktop. Sjekk at intet er brutt. Sammenlign mot prototype.

---

## Fase 3 — Vakter-omlegging (v10.27)

Mål: Vakter-siden får sub-nav i sidebar + Vaktplan-grid med rolle-kolonner. Modal i stedet for BottomSheet på desktop.

### Task 11: Hent upcoming shift-events for sub-nav

**Files:**
- Modify: `components/layout/DesktopShell.tsx`
- Create: `lib/layout/getShiftEvents.ts`

- [ ] **Step 1: Skriv server-helper som henter upcoming arrangement-events med vakter**

```ts
import { createClient } from '@/lib/supabase/server'

export async function getShiftEventsForNav() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('events')
    .select('id, title, date, status, signup_deadline')
    .eq('type', 'arrangement')
    .in('status', ['active', 'upcoming'])
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(8)
  if (!data) return []
  return (data as any[]).map(e => ({
    id: e.id as string,
    title: e.title as string,
    navLabel: shortLabel(e.title as string),
    closed: e.signup_deadline ? new Date(e.signup_deadline) < new Date() : false,
  }))
}

function shortLabel(title: string): string {
  if (title.length <= 14) return title
  const firstWord = title.split(' ')[0]
  return firstWord.length <= 14 ? firstWord : title.slice(0, 12) + '…'
}
```

- [ ] **Step 2: Bruk den i DesktopShell og videreformidle til DesktopSidebar**

```tsx
import { getShiftEventsForNav } from '@/lib/layout/getShiftEvents'
// ...
const shiftEvents = await getShiftEventsForNav()
return (
  <div className="lg:flex lg:min-h-screen lg:bg-bg">
    <DesktopSidebar profile={profile} shiftEvents={shiftEvents} />
    {/* ... */}
  </div>
)
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(vakter): sub-nav får live upcoming-events fra DB"
git push origin main
```

### Task 12: SeatDots + VMShiftCell

**Files:**
- Create: `components/vakter/SeatDots.tsx`
- Create: `components/vakter/VMShiftCell.tsx`

- [ ] **Step 1: Skriv SeatDots**

```tsx
type Props = { cap: number; claimed: number; mine?: boolean }

export default function SeatDots({ cap, claimed, mine }: Props) {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: cap }).map((_, i) => {
        const filled = i < claimed
        const style = filled
          ? mine
            ? { background: 'var(--color-accent)' }
            : { background: 'var(--color-text-secondary)' }
          : { boxShadow: 'inset 0 0 0 1.5px var(--color-text-tertiary)' }
        return <span key={i} className="w-[7px] h-[7px] rounded-full" style={style} />
      })}
    </span>
  )
}
```

- [ ] **Step 2: Skriv VMShiftCell — flat cell, mono time, names + SeatDots**

```tsx
'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import SeatDots from './SeatDots'

type Shift = {
  id: string
  time: string
  capacity: number
  people: string[] // navn på påmeldte
  mine?: boolean
}

type Props = { shift: Shift; onClick: () => void }

export default function VMShiftCell({ shift, onClick }: Props) {
  const [hover, setHover] = useState(false)
  const claimed = shift.people.length
  const left = shift.capacity - claimed
  const full = left <= 0
  const muted = full && !shift.mine
  const shown = shift.people.slice(0, 3)
  const extra = shift.people.length - shown.length

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full text-left rounded-xl px-[15px] py-2.5 flex items-center gap-3 transition-all"
      style={{
        background: shift.mine
          ? 'rgba(162,74,51,0.06)'
          : hover
            ? 'var(--color-surface-low)'
            : 'transparent',
        boxShadow: shift.mine ? 'inset 2.5px 0 0 var(--color-accent)' : 'none',
        opacity: muted && !hover ? 0.55 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-semibold tabular-nums text-text-primary -tracking-[0.02em]">{shift.time}</div>
        <div className="text-xs mt-0.5 truncate">
          {shift.people.length === 0 ? (
            <span className="text-text-tertiary">Ingen påmeldt ennå</span>
          ) : (
            <>
              {shown.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-text-primary/30"> · </span>}
                  <span
                    className={p === 'Du' ? 'text-accent font-bold' : 'text-text-secondary font-medium'}
                  >
                    {p}
                  </span>
                </span>
              ))}
              {extra > 0 && <span className="text-text-tertiary font-medium"> +{extra}</span>}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <SeatDots cap={shift.capacity} claimed={claimed} mine={shift.mine} />
        <span
          className="text-[10.5px] font-bold"
          style={{
            color: full ? 'var(--color-success)' : 'var(--color-text-tertiary)',
          }}
        >
          {full ? 'Fullt' : `${left} ledig${left === 1 ? '' : 'e'}`}
        </span>
      </div>
      <ChevronRight
        size={15}
        className="text-text-tertiary shrink-0 transition-opacity"
        style={{ opacity: hover ? 0.7 : 0.3 }}
      />
    </button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(vakter): SeatDots og VMShiftCell-primitiver"
git push origin main
```

### Task 13: VaktplanGrid

**Files:**
- Create: `components/vakter/VaktplanGrid.tsx`

- [ ] **Step 1: Skriv unified grid med DAG-kolonne + N rolle-kolonner**

```tsx
'use client'

import { useState, useMemo } from 'react'
import VMShiftCell from './VMShiftCell'

type Shift = {
  id: string
  time: string
  role: string
  capacity: number
  people: string[]
  date: string // ISO date
  weekday: string
  dateLabel: string
  mine?: boolean
}

type Props = {
  shifts: Shift[]
  roles: string[] // f.eks. ["Renhold", "Host/servering"]
  onShiftClick: (shift: Shift) => void
  totalCount: number
  openCount: number
}

export default function VaktplanGrid({ shifts, roles, onShiftClick, totalCount, openCount }: Props) {
  const [filter, setFilter] = useState<'alle' | 'ledige'>('alle')

  const days = useMemo(() => {
    const byDate = new Map<string, Shift[]>()
    for (const s of shifts) {
      const key = s.date
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push(s)
    }
    return Array.from(byDate.entries())
      .map(([date, dayShifts]) => ({
        date,
        weekday: dayShifts[0].weekday,
        dateLabel: dayShifts[0].dateLabel,
        shifts: filter === 'ledige'
          ? dayShifts.filter(s => s.capacity - s.people.length > 0)
          : dayShifts,
      }))
      .filter(d => d.shifts.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [shifts, filter])

  const colTemplate = `148px ${roles.map(() => '1fr').join(' ')}`

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-[18px] flex-wrap">
        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Vaktplan</div>
        <div className="inline-flex bg-surface-low rounded-full p-1 gap-0.5">
          {(
            [
              ['alle', `Alle (${totalCount})`],
              ['ledige', `Ledige (${openCount})`],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`font-display text-[13px] font-bold px-4 py-1.5 rounded-full transition-all ${
                filter === k ? 'bg-card text-accent shadow-sm' : 'text-text-secondary'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div
        className="bg-card border border-text-primary/[0.09] rounded-[20px] overflow-hidden"
        style={{ boxShadow: '0 10px 34px rgba(160,120,80,0.16)' }}
      >
        {/* Column headers */}
        <div
          className="grid items-center px-[22px] py-3 bg-surface-low border-b border-text-primary/[0.09]"
          style={{ gridTemplateColumns: colTemplate }}
        >
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary">Dag</span>
          {roles.map(r => (
            <span
              key={r}
              className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary pl-[15px]"
            >
              {r}
            </span>
          ))}
        </div>

        {/* Day rows */}
        {days.map((day, di) => {
          const byRole = new Map<string, Shift>()
          day.shifts.forEach(s => byRole.set(s.role, s))
          const hasMine = day.shifts.some(s => s.mine)
          return (
            <div
              key={day.date}
              className={`grid items-stretch ${di ? 'border-t border-text-primary/[0.09]' : ''}`}
              style={{
                gridTemplateColumns: colTemplate,
                background: hasMine ? 'rgba(162,74,51,0.03)' : 'transparent',
              }}
            >
              <div className="py-3.5 pl-[22px] flex flex-col justify-center">
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-tertiary">{day.weekday}</span>
                <span className="font-display text-[16.5px] font-bold -tracking-[0.01em] mt-px text-text-primary">{day.dateLabel}</span>
              </div>
              {roles.map(r => (
                <div key={r} className="py-1.5 px-2.5 flex items-center">
                  {byRole.has(r) ? (
                    <VMShiftCell shift={byRole.get(r)!} onClick={() => onShiftClick(byRole.get(r)!)} />
                  ) : (
                    <span className="w-full text-center text-text-primary/15">–</span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(vakter): VaktplanGrid med rolle-kolonner og dag-rader"
git push origin main
```

### Task 14: Modal-primitiv for desktop shift-detail

**Files:**
- Create: `components/ui/Modal.tsx`

- [ ] **Step 1: Skriv sentrert modal med backdrop, blur, springy entrance**

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}

export default function Modal({ open, onClose, children, maxWidth = 540 }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(45,38,32,.42)', backdropFilter: 'blur(3px)' }}
          />
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="relative bg-card rounded-[28px] border border-text-primary/[0.09] w-full"
            style={{ maxWidth, boxShadow: '0 24px 60px rgba(45,38,32,.32)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Lukk"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-low hover:bg-text-primary/10 flex items-center justify-center text-text-secondary"
            >
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ui): Modal-primitiv for desktop"
git push origin main
```

### Task 15: Bytt arrangement/[id] til VaktplanGrid på lg+, behold liste på mobil

**Files:**
- Modify: `app/(app)/arrangement/[id]/page.tsx` (eller komponenten som rendrer vakter)

- [ ] **Step 1: Les nåværende arrangement-side. Identifiser hvor vaktene rendres.**

- [ ] **Step 2: Transformer eksisterende `shifts`-data til formatet `VaktplanGrid` venter (legg på `weekday`, `dateLabel`, `people: string[]`-mapping)**

- [ ] **Step 3: Wrap visning i responsive switch:**

```tsx
<div className="lg:hidden">
  {/* dagens flate liste */}
</div>
<div className="hidden lg:block">
  <VaktplanGrid
    shifts={transformedShifts}
    roles={uniqueRoles}
    onShiftClick={(s) => setSelectedShift(s)}
    totalCount={shifts.length}
    openCount={shifts.filter(s => s.capacity - s.people.length > 0).length}
  />
</div>
```

- [ ] **Step 4: Erstatt BottomSheet med Modal på lg+:**

```tsx
{/* Mobil — BottomSheet (dagens) */}
<div className="lg:hidden">
  <ShiftClaimSheet ... />
</div>
{/* Desktop — Modal */}
<div className="hidden lg:block">
  <Modal open={!!selectedShift} onClose={() => setSelectedShift(null)}>
    {/* samme content som BottomSheet — refaktorer til delt komponent */}
  </Modal>
</div>
```

- [ ] **Step 5: Bump versjon til 10.27 og commit**

```bash
git commit -m "feat(vakter): VaktplanGrid på desktop, Modal i stedet for sheet (v10.27)"
git push origin main
```

Pause: Tor Martin tester Vakter-omlegging på desktop. Sjekk: sub-nav vises når man er på `/arrangement/[id]`, grid stemmer mot Fotball-VM-prototypen, Modal lukkes med ESC og bakdrop-klikk, mobile-flyt urørt.

---

## Fase 4 — Merker hero + admin polish (v10.28)

Mål: "Neste merke"-hero lagt til på Merker-siden under nivåbanneret. Hendelser, Medlemmer, Varsler får siste polish-touch.

### Task 16: NesteMerkeHero

**Files:**
- Create: `components/merker/NesteMerkeHero.tsx`

- [ ] **Step 1: Skriv hero med beacon-pulse + count-up**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'

type Props = {
  earned: number
  total: number
  nextBadge?: { name: string; iconUrl: string; description: string }
}

export default function NesteMerkeHero({ earned, total, nextBadge }: Props) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame = 0
    const target = earned
    const duration = 800
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setDisplay(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [earned])

  return (
    <div className="bg-card border border-text-primary/[0.09] rounded-[28px] p-7 lg:p-10 shadow-sm flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
      {nextBadge && (
        <div className="relative shrink-0">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)', opacity: 0.18 }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.18, 0.05, 0.18] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div
            className="relative w-[112px] h-[112px] rounded-full bg-card flex items-center justify-center"
            style={{ isolation: 'isolate' }}
          >
            <Image
              src={nextBadge.iconUrl}
              alt=""
              width={112}
              height={112}
              className="rounded-full"
              style={{ mixBlendMode: 'multiply', transform: 'scale(0.82)' }}
            />
          </div>
        </div>
      )}
      <div className="flex-1 text-center lg:text-left">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.15em] text-text-tertiary mb-2">Neste merke</div>
        <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-text-primary -tracking-[0.01em] mb-2">
          {nextBadge?.name || 'Du har samlet alle!'}
        </h2>
        <p className="text-text-secondary text-sm lg:text-base max-w-md mx-auto lg:mx-0">
          {nextBadge?.description || 'Du har låst opp alle tilgjengelige merker.'}
        </p>
        <div className="mt-5 flex items-baseline justify-center lg:justify-start gap-2">
          <span className="font-display text-4xl font-extrabold text-accent tabular-nums">{display}</span>
          <span className="text-text-secondary">av {total} merker</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrer i `app/(app)/merker/page.tsx` under nivåbanneret**

Finn der nivåbanneret slutter og legg til:

```tsx
<NesteMerkeHero earned={earnedCount} total={totalBadges} nextBadge={computedNext} />
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(merker): NesteMerkeHero med beacon-pulse og count-up"
git push origin main
```

### Task 17: SegmentBar i Hendelser

**Files:**
- Modify: `app/admin/hendelser/page.tsx`
- Create: `components/admin/SegmentBar.tsx`

- [ ] **Step 1: Skriv SegmentBar**

```tsx
type Props = {
  ferdig: number
  paagaar: number
  ledige: number
}

// Segmentert progress for aktive dugnader. Tre segmenter: ferdig (accent), pågår (accent@38%), ledige (surface-low).
export default function SegmentBar({ ferdig, paagaar, ledige }: Props) {
  const total = ferdig + paagaar + ledige
  if (total === 0) return null
  return (
    <div className="h-2 rounded-full overflow-hidden flex gap-[2px] bg-surface-low">
      {ferdig > 0 && <span className="bg-accent" style={{ flex: ferdig }} />}
      {paagaar > 0 && <span style={{ flex: paagaar, background: 'rgba(162,74,51,0.38)' }} />}
      {ledige > 0 && <span style={{ flex: ledige, background: 'transparent' }} />}
    </div>
  )
}
```

- [ ] **Step 2: Bruk SegmentBar i EventCard for aktive zone-baserte dugnader**

- [ ] **Step 3: Bump versjon til 10.28 og commit**

```bash
git commit -m "feat(hendelser): SegmentBar for aktive dugnader (v10.28)"
git push origin main
```

Pause: Tor Martin tester hele desktop-flowen. Sammenligner mot prototype.

---

## Fase 5 — Verifikasjon

### Task 18: Manuell brukertesting

- [ ] **Step 1: På dugnadshub.no (desktop, lg+):**
  - Sjekk sidebar viser MEDLEM + ADMIN (kun for admin)
  - Sjekk Hjem-sidens event-kort har hover-elevation
  - Sjekk Kart fyller hele området til høyre for sidebaren (ingen topbar)
  - Sjekk Sjåfør viser empty state hvis ingen hentinger
  - Sjekk `/vakter` viser sub-nav med upcoming arrangement-events
  - Sjekk `/arrangement/[id]` viser VaktplanGrid med rolle-kolonner
  - Sjekk shift-detail Modal lukkes med ESC og bakdrop-klikk
  - Sjekk Merker har nivåbanner + NesteMerkeHero under
  - Sjekk Admin Hendelser har SegmentBar på aktive dugnader
  - Sjekk Profil viser to-kolonne settings på lg+
  - Sjekk dark mode aktiveres via Profil-toggle og påvirker hele shell

- [ ] **Step 2: På dugnadshub.no (mobil, <lg):**
  - Sjekk BottomNav fortsatt synlig
  - Sjekk ingen sidebar/topbar vises
  - Sjekk arrangement-siden viser flat liste (ikke grid)
  - Sjekk shift-claim bruker BottomSheet (ikke Modal)
  - Sjekk hele mobile-flyten er uendret

- [ ] **Step 3: Hvis alt OK, oppdater minne**

```
/Users/tormartin/.claude/projects/-Users-tormartin/memory/MEMORY.md
→ Bump versjon til 10.28
→ Legg pointer til ny dugnadshub-desktop-shell.md
```

```
Opprett /Users/tormartin/.claude/projects/-Users-tormartin/memory/dugnadshub-desktop-shell.md
Med: hva som ble bygget, mønstre verdt å huske (responsiv-strategi, route-META, VaktplanGrid-mønster, NesteMerkeHero-pattern, BottomSheet vs Modal-valg per bredde)
```
