'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import BrandLink from '@/components/layout/BrandLink'
import Image from 'next/image'
import { getAvatarUrl } from '@/components/features/AvatarPicker'
import { Users, Search, ChevronRight, X, ArrowLeft, ArrowUpDown, ChevronDown, Music } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { badgeDefinitions, STACKABLE_BADGE_CATEGORIES } from '@/lib/badges/definitions'
import type { Child } from '@/lib/supabase/types'
import type { Profile, Role, UserBadge, ZoneClaim, ChildGroup } from '@/lib/supabase/types'
import { ROLE_LABELS } from '@/lib/roles'
import { fetchAll } from '@/lib/supabase/fetch-all'
import MemberDetailOverlay from '@/components/admin/MemberDetailOverlay'
import MemberDetailDesktop from '@/components/admin/MemberDetailDesktop'

type SortMode = 'alpha' | 'badges' | 'least_active'
type TypeFilter = 'alle' | 'foreldre' | 'musikanter'

const sortLabels: Record<SortMode, string> = {
  badges: 'Mest aktive',
  least_active: 'Minst aktive',
  alpha: 'A til Å',
}

// Rolle-chip fargeklasse — matcher rolle med tonet pille-design
function roleChipClass(role: Role): string {
  switch (role) {
    case 'admin': return 'bg-purple/10 text-purple'
    case 'driver': return 'bg-teal/10 text-teal'
    case 'strapper': return 'bg-warning/10 text-warning'
    case 'host': return 'bg-accent/10 text-accent'
    default: return 'bg-surface-low text-text-secondary'
  }
}

// Rund avatar med bilde eller initial-fallback
function MemberAvatar({ name, avatarUrl, size = 42 }: { name: string | null; avatarUrl: string | null; size?: number }) {
  const initial = ((name || '?')[0] || '?').toUpperCase()
  const url = avatarUrl ? getAvatarUrl(avatarUrl) : null
  if (!url) {
    return (
      <div
        className="rounded-full bg-surface-low flex items-center justify-center text-accent font-bold shrink-0"
        style={{ width: size, height: size }}
      >
        {initial}
      </div>
    )
  }
  return (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

// Medlemsadministrasjon — se, rediger og tildel merker
export default function MembersAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userBadges, setUserBadges] = useState<UserBadge[]>([])
  const [allClaims, setAllClaims] = useState<ZoneClaim[]>([])
  const [allShiftClaims, setAllShiftClaims] = useState<Array<{ user_id: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('badges')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('alle')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  // Aktivt valgt medlem (vises i overlay). Slås opp på id for å holde data ferskt
  // etter mutasjoner (rolle, merker osv.) i samme render.
  const selectedProfile = profiles.find(p => p.id === selectedId) ?? null

  async function loadData() {
    // fetchAll chunker i 1000-bolker (PostgREST-taket) — også profiles,
    // så nyeste medlemmer ikke forsvinner stille fra lista den dagen
    // korpset passerer 1000 profiler.
    const [allProfiles, badges, claims, shiftClaims] = await Promise.all([
      fetchAll<Profile>(supabaseRef.current, 'profiles', '*'),
      fetchAll<UserBadge>(supabaseRef.current, 'user_badges', '*'),
      fetchAll<ZoneClaim>(supabaseRef.current, 'zone_claims', '*'),
      fetchAll<{ user_id: string }>(supabaseRef.current, 'shift_claims', 'user_id'),
    ])

    // Sortér klient-side (fetchAll har ingen order-param)
    // Navnløse profiler sist (som gammel DB-sortering med NULLS LAST)
    setProfiles([...allProfiles].sort((a, b) => (a.full_name ?? '\uffff').localeCompare(b.full_name ?? '\uffff', 'nb')))
    setUserBadges(badges)
    setAllClaims(claims)
    setAllShiftClaims(shiftClaims)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [])

  // Forhåndsberegnede tellinger per bruker — én gjennomgang av hver liste
  // i stedet for filter-per-profil-per-sammenligning (O(n×m) per tastetrykk).
  const claimCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of allClaims) m.set(c.user_id, (m.get(c.user_id) ?? 0) + 1)
    return m
  }, [allClaims])

  const shiftClaimCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of allShiftClaims) m.set(c.user_id, (m.get(c.user_id) ?? 0) + 1)
    return m
  }, [allShiftClaims])

  const badgeCountByUser = useMemo(() => {
    const m = new Map<string, number>()
    for (const ub of userBadges) m.set(ub.user_id, (m.get(ub.user_id) ?? 0) + 1)
    return m
  }, [userBadges])

  // Antall sone-claims (vises i lista som "X soner")
  function getClaimCount(userId: string): number {
    return claimCounts.get(userId) ?? 0
  }

  // Total aktivitet for sortering = sone-claims + vakt-claims, så vakttakere
  // på arrangement ikke fremstår som inaktive.
  function getActivityCount(userId: string): number {
    return getClaimCount(userId) + (shiftClaimCounts.get(userId) ?? 0)
  }

  function getBadgeCountForUser(userId: string): number {
    return badgeCountByUser.get(userId) ?? 0
  }

  // Antall ganger brukeren har hvert merke, så BadgeTile kan vise x2/x3 osv
  function getBadgeCountsForUser(userId: string): Map<number, number> {
    const m = new Map<number, number>()
    for (const ub of userBadges) {
      if (ub.user_id !== userId) continue
      m.set(ub.badge_id, (m.get(ub.badge_id) ?? 0) + 1)
    }
    return m
  }

  // Filtrer på type (foreldre/musikanter) og søk, deretter sorter.
  // Memoisert så lista ikke re-beregnes ved urelatert state-endring.
  const sortedProfiles = useMemo(() => {
    const filteredByType = profiles.filter(p => {
      if (typeFilter === 'foreldre') return !p.is_musician
      if (typeFilter === 'musikanter') return p.is_musician
      return true
    })

    return filteredByType
      .filter(p => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        const roleLabel = ROLE_LABELS[p.role as Role] || ''
        return (
          (p.full_name || '').toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.children || []).some((c: Child) => c.name?.toLowerCase().includes(q)) ||
          roleLabel.toLowerCase().includes(q) ||
          (p.role || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'badges':
            return (badgeCountByUser.get(b.id) ?? 0) - (badgeCountByUser.get(a.id) ?? 0)
          case 'least_active': {
            const act = (id: string) => (badgeCountByUser.get(id) ?? 0) + (claimCounts.get(id) ?? 0) + (shiftClaimCounts.get(id) ?? 0)
            return act(a.id) - act(b.id)
          }
          case 'alpha':
          default:
            return (a.full_name || '').localeCompare(b.full_name || '', 'nb')
        }
      })
  }, [profiles, typeFilter, searchQuery, sortMode, badgeCountByUser, claimCounts, shiftClaimCounts])

  // Endre rolle
  // Handlerne returnerer true/false så detail-komponentene kan toaste
  // riktig utfall — lokal state oppdateres KUN når DB-skrivingen lyktes.
  async function handleRoleChange(userId: string, newRole: Role): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseRef.current.from('profiles') as any).update({ role: newRole }).eq('id', userId)
    if (error) { console.error('Rollebytte feilet:', error); return false }
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p))
    return true
  }

  // Bytt mellom forelder og musikant, eller endre musikant-gruppe
  async function handleTypeChange(userId: string, isMusician: boolean, group: ChildGroup | null): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseRef.current.from('profiles') as any)
      .update({ is_musician: isMusician, musician_group: isMusician ? group : null })
      .eq('id', userId)
    if (error) { console.error('Typebytte feilet:', error); return false }
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_musician: isMusician, musician_group: isMusician ? group : null } : p))
    return true
  }

  // Tildel merke — stable-bare kategorier kan gis flere ganger
  async function handleAwardBadge(userId: string, badgeId: number): Promise<boolean> {
    const badge = badgeDefinitions.find(b => b.id === badgeId)
    const canStack = badge ? STACKABLE_BADGE_CATEGORIES.has(badge.category) : false

    // Engangs-merker: blokker om allerede har
    if (!canStack) {
      const alreadyHas = userBadges.some(ub => ub.user_id === userId && ub.badge_id === badgeId)
      if (alreadyHas) return false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseRef.current.from('user_badges') as any).insert({
      user_id: userId,
      badge_id: badgeId,
      event_id: null,
    }).select().single() as { data: UserBadge | null; error: unknown }

    if (error || !data) { console.error('Merke-tildeling feilet:', error); return false }
    setUserBadges(prev => [...prev, data])
    return true
  }

  // Fjern ett merke (siste instans)
  async function handleRemoveBadge(userId: string, badgeId: number): Promise<boolean> {
    const badges = userBadges.filter(ub => ub.user_id === userId && ub.badge_id === badgeId)
    const badge = badges[badges.length - 1]
    if (!badge) return false

    const { error } = await supabaseRef.current.from('user_badges').delete().eq('id', badge.id)
    if (error) { console.error('Merke-fjerning feilet:', error); return false }
    setUserBadges(prev => prev.filter(ub => ub.id !== badge.id))
    return true
  }

  // Fjern alle merker for en bruker
  async function handleResetBadges(userId: string): Promise<boolean> {
    const { error } = await supabaseRef.current.from('user_badges').delete().eq('user_id', userId)
    if (error) { console.error('Merke-nullstilling feilet:', error); return false }
    setUserBadges(prev => prev.filter(ub => ub.user_id !== userId))
    return true
  }

  // Slett medlem — API-et rydder ALT (merker, claims, vakter, sjåfør-tildelinger,
  // musikant-koblinger, push) og sletter auth-brukeren. Lokal state oppdateres
  // kun ved suksess, ellers vises feilen.
  async function handleDeleteMember(userId: string) {
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) {
      setDeleteError('Ikke innlogget — last siden på nytt.')
      return
    }

    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: userId }),
    }).catch(() => null)

    if (!res || !res.ok) {
      const j = res ? await res.json().catch(() => ({ error: 'Ukjent feil' })) : { error: 'Nettverksfeil' }
      setDeleteError(`Kunne ikke slette medlemmet: ${j.error}`)
      return
    }

    setDeleteError(null)
    setProfiles(prev => prev.filter(p => p.id !== userId))
    setUserBadges(prev => prev.filter(ub => ub.user_id !== userId))
    setAllClaims(prev => prev.filter(c => c.user_id !== userId))
    setSelectedId(null)
  }

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <BrandLink />
          <div className="w-9" />
        </div>
      </header>
      <div className="pt-16 lg:pt-0 pb-28">

      {/* Tilbake + tittel. Skjules paa desktop naar et medlem er valgt
          — MemberDetailDesktop har egen tilbake-lenke. */}
      <div className={`${selectedProfile ? 'flex lg:hidden' : 'flex'} items-center gap-3 mb-6`}>
        <Link href="/admin/oversikt" className="w-8 h-8 rounded-full flex items-center justify-center active:bg-surface-low">
          <ArrowLeft size={20} className="text-accent" />
        </Link>
        <h2 className="text-xl font-bold text-accent font-[var(--font-display)] flex-1">Medlemmer</h2>
        <span className="text-sm text-text-secondary">
          {loading ? '...' : `${profiles.length} totalt`}
        </span>
      </div>

      {/* Feilbanner for sletting — vises til neste vellykkede handling */}
      {deleteError && (
        <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-start justify-between gap-3">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="font-bold shrink-0">OK</button>
        </div>
      )}

      {/* Desktop: dedikert side-by-side merkeutdeling naar et medlem er valgt.
          Skjuler hele lista + filterene saa fokus er paa medlemmet. */}
      {selectedProfile && (
        <div className="hidden lg:block">
          <MemberDetailDesktop
            profile={selectedProfile}
            badgeCount={getBadgeCountForUser(selectedProfile.id)}
            badgeCounts={getBadgeCountsForUser(selectedProfile.id)}
            onBack={() => setSelectedId(null)}
            onRoleChange={(role) => handleRoleChange(selectedProfile.id, role)}
            onTypeChange={(isM, g) => handleTypeChange(selectedProfile.id, isM, g)}
            onAwardBadge={(id) => handleAwardBadge(selectedProfile.id, id)}
            onRemoveBadge={(id) => handleRemoveBadge(selectedProfile.id, id)}
            onResetBadges={() => handleResetBadges(selectedProfile.id)}
            onDeleteMember={() => handleDeleteMember(selectedProfile.id)}
          />
        </div>
      )}

      {/* Mobil: søkefelt + sort-pills */}
      <div className="lg:hidden">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Søk etter navn, e-post eller barn..."
            className="w-full pl-9 pr-9 py-2.5 rounded-[12px] bg-card ring-1 ring-text-tertiary/20 text-[15px] outline-none focus:ring-2 focus:ring-accent/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={16} className="text-text-tertiary" />
            </button>
          )}
        </div>

        {!loading && profiles.length > 1 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
            <ArrowUpDown size={14} className="text-text-tertiary shrink-0" />
            {(Object.keys(sortLabels) as SortMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  sortMode === mode
                    ? 'bg-accent text-white'
                    : 'bg-surface-low text-text-secondary active:bg-surface-low'
                }`}
              >
                {sortLabels[mode]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Skeleton loading */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-card rounded-2xl shadow-[0_8px_30px_rgb(57,56,43,0.08)] p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-low rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-surface-low rounded" />
                <div className="h-3 w-48 bg-surface-low rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobil: ingen resultater (desktop viser tom-tilstand inne i Card-en) */}
      {!loading && sortedProfiles.length === 0 && (
        <Card className="lg:hidden p-6 text-center rounded-2xl">
          <Users size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary font-[var(--font-display)]">
            {searchQuery ? 'Ingen treff på søket' : 'Ingen medlemmer registrert ennå'}
          </p>
        </Card>
      )}

      {/* Mobil: kort-grid (uendret fra opprinnelig design) */}
      {!loading && sortedProfiles.length > 0 && (
        <div className="lg:hidden space-y-2">
          {sortedProfiles.map((profile, i) => {
            return (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Card animate={false} className="p-0 overflow-hidden rounded-2xl">
                  {/* Kort-header — åpner overlay */}
                  <button
                    onClick={() => setSelectedId(profile.id)}
                    className="w-full text-left p-4 flex items-center gap-3"
                  >
                    {/* Avatar */}
                    <MemberAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size={40} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium text-[15px] truncate font-[var(--font-display)]">
                          {profile.full_name || 'Ukjent'}
                        </p>
                        {profile.is_musician && (
                          <span
                            title={profile.musician_group ? `Musikant · ${profile.musician_group}` : 'Musikant'}
                            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Music size={10} />
                            {profile.musician_group ? profile.musician_group.slice(0, 2).toUpperCase() : 'M'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                        <span>{getBadgeCountForUser(profile.id)} {getBadgeCountForUser(profile.id) === 1 ? 'merke' : 'merker'}</span>
                        <span className="text-text-tertiary">·</span>
                        <span>{getClaimCount(profile.id)} {getClaimCount(profile.id) === 1 ? 'sone' : 'soner'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleChipClass(profile.role as Role)}`}>
                        {ROLE_LABELS[profile.role]}
                      </span>
                      <ChevronRight size={14} className="text-text-tertiary" />
                    </div>
                  </button>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Desktop: én Card med toolbar + tabell. Skjules naar medlem er valgt
          (desktop viser MemberDetailDesktop i stedet). */}
      {!loading && (
        <div className={`${selectedProfile ? 'hidden' : 'hidden lg:block'} bg-card rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(57,56,43,0.06)]`}>
          {/* Toolbar-rad: filter-pills + sort-dropdown + søk */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-text-primary/[0.06] flex-wrap">
            {/* Type-filter pills */}
            <div className="flex bg-surface-low rounded-full p-1 gap-1">
              {([
                ['alle', 'Alle'],
                ['foreldre', 'Foreldre'],
                ['musikanter', 'Musikanter'],
              ] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTypeFilter(k)}
                  className={`font-display text-sm font-bold px-4 py-2 rounded-full transition ${
                    typeFilter === k
                      ? 'bg-card text-accent shadow-[0_1px_4px_rgba(57,56,43,0.1)]'
                      : 'text-text-secondary'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Sort-dropdown */}
            <label className="inline-flex items-center gap-2 bg-surface-low rounded-full px-4 py-2 cursor-pointer">
              <ArrowUpDown size={15} className="text-text-tertiary" />
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="bg-transparent outline-none text-[13.5px] font-bold text-text-secondary cursor-pointer appearance-none pr-1"
              >
                <option value="badges">Mest aktive</option>
                <option value="least_active">Minst aktive</option>
                <option value="alpha">A til Å</option>
              </select>
              <ChevronDown size={14} className="text-text-tertiary" />
            </label>

            {/* Søk */}
            <label className="flex items-center gap-2 bg-surface-low rounded-full px-4 py-2 w-[200px]">
              <Search size={16} className="text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Søk medlem…"
                className="bg-transparent outline-none text-sm w-full"
              />
            </label>
          </div>

          {/* Tabell-hode */}
          <div className="grid grid-cols-[2.4fr_1.5fr_1fr_0.7fr_40px] gap-4 px-7 py-3 border-b border-text-primary/[0.05]">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary">Medlem</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary">Rolle</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary">Type</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary">Merker</span>
            <span />
          </div>

          {/* Tom-tilstand */}
          {sortedProfiles.length === 0 && (
            <div className="py-10 text-center text-text-tertiary text-sm">
              {searchQuery ? 'Ingen treff på søket' : 'Ingen medlemmer registrert ennå'}
            </div>
          )}

          {/* Rader */}
          {sortedProfiles.map((profile, i) => {
            const badgeCount = getBadgeCountForUser(profile.id)
            // Sub-linje: musikant viser gruppe, forelder viser første barn eller e-post
            const subLine = profile.is_musician
              ? (profile.musician_group || 'Musikant')
              : (profile.children && profile.children.length > 0
                  ? `${profile.children[0].name} · ${profile.children[0].group}`
                  : profile.email)

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedId(profile.id)}
                className={`w-full grid grid-cols-[2.4fr_1.5fr_1fr_0.7fr_40px] gap-4 items-center px-7 py-3.5 hover:bg-surface-low/50 transition-colors text-left ${
                  i > 0 ? 'border-t border-text-primary/[0.05]' : ''
                }`}
              >
                {/* Kolonne 1: avatar + navn + sub-linje */}
                <div className="flex items-center gap-3 min-w-0">
                  <MemberAvatar name={profile.full_name} avatarUrl={profile.avatar_url} />
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-bold text-text-primary truncate">{profile.full_name || 'Ukjent'}</div>
                    <div className="text-[12.5px] text-text-tertiary truncate">{subLine}</div>
                  </div>
                </div>

                {/* Kolonne 2: rolle-pill (neutral) */}
                <div className="flex items-center">
                  <span className="bg-surface-low text-text-secondary px-2.5 py-1 rounded-full text-xs font-bold">
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>

                {/* Kolonne 3: type (Forelder / Musikant) — bare tekst */}
                <div className="text-[13.5px] font-semibold text-text-secondary">
                  {profile.is_musician ? 'Musikant' : 'Forelder'}
                </div>

                {/* Kolonne 4: merke-antall */}
                <div className="font-display text-[16px] font-extrabold text-accent">
                  {badgeCount}
                </div>

                {/* Kolonne 5: chevron */}
                <div className="flex items-center justify-end text-text-tertiary">
                  <ChevronRight size={17} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Mobil-overlay: kun synlig under lg. Desktop bruker MemberDetailDesktop
          som rendres oeverst i sideflyten i stedet. */}
      <div className="lg:hidden">
        <MemberDetailOverlay
          profile={selectedProfile}
          badgeCount={selectedProfile ? getBadgeCountForUser(selectedProfile.id) : 0}
          zoneCount={selectedProfile ? getClaimCount(selectedProfile.id) : 0}
          badgeCounts={selectedProfile ? getBadgeCountsForUser(selectedProfile.id) : new Map()}
          onClose={() => setSelectedId(null)}
          onRoleChange={(role) => selectedProfile ? handleRoleChange(selectedProfile.id, role) : Promise.resolve(false)}
          onTypeChange={(isM, g) => selectedProfile ? handleTypeChange(selectedProfile.id, isM, g) : Promise.resolve(false)}
          onAwardBadge={(id) => selectedProfile ? handleAwardBadge(selectedProfile.id, id) : Promise.resolve(false)}
          onRemoveBadge={(id) => selectedProfile ? handleRemoveBadge(selectedProfile.id, id) : Promise.resolve(false)}
          onResetBadges={() => { if (selectedProfile) handleResetBadges(selectedProfile.id) }}
          onDeleteMember={() => { if (selectedProfile) handleDeleteMember(selectedProfile.id) }}
        />
      </div>
    </div>
    </>
  )
}
