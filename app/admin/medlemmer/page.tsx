'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import BrandLink from '@/components/layout/BrandLink'
import Image from 'next/image'
import { getAvatarUrl } from '@/components/features/AvatarPicker'
import { Users, Search, ChevronRight, X, ArrowLeft, ArrowUpDown, Music, Shield } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { badgeDefinitions, STACKABLE_BADGE_CATEGORIES } from '@/lib/badges/definitions'
import type { Child } from '@/lib/supabase/types'
import type { Profile, Role, UserBadge, ZoneClaim, ChildGroup } from '@/lib/supabase/types'
import { ROLE_LABELS } from '@/lib/roles'
import MemberDetailOverlay from '@/components/admin/MemberDetailOverlay'

type SortMode = 'alpha' | 'badges' | 'least_active'
type TypeFilter = 'alle' | 'foreldre' | 'musikanter'

const sortLabels: Record<SortMode, string> = {
  alpha: 'A–Å',
  badges: 'Flest merker',
  least_active: 'Minst aktiv',
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
function MemberAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const initial = ((name || '?')[0] || '?').toUpperCase()
  const url = avatarUrl ? getAvatarUrl(avatarUrl) : null
  if (!url) {
    return (
      <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center text-accent font-bold shrink-0">
        {initial}
      </div>
    )
  }
  return (
    <Image
      src={url}
      alt=""
      width={40}
      height={40}
      className="rounded-full w-10 h-10 object-cover shrink-0"
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
  const [sortMode, setSortMode] = useState<SortMode>('alpha')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('alle')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  // Aktivt valgt medlem (vises i overlay). Slås opp på id for å holde data ferskt
  // etter mutasjoner (rolle, merker osv.) i samme render.
  const selectedProfile = profiles.find(p => p.id === selectedId) ?? null

  // Supabase har server-side hard cap på 1000 rader per request.
  // Vi henter alt i 1000-bolker til tabellen er tom.
  async function fetchAll<T>(table: string, select: string): Promise<T[]> {
    const PAGE = 1000
    const out: T[] = []
    for (let offset = 0; ; offset += PAGE) {
      const { data } = await supabaseRef.current
        .from(table)
        .select(select)
        .range(offset, offset + PAGE - 1) as unknown as { data: T[] | null }
      if (!data || data.length === 0) break
      out.push(...data)
      if (data.length < PAGE) break
    }
    return out
  }

  async function loadData() {
    const [profilesRes, badges, claims, shiftClaims] = await Promise.all([
      supabaseRef.current.from('profiles').select('*').order('full_name') as unknown as Promise<{ data: Profile[] | null }>,
      fetchAll<UserBadge>('user_badges', '*'),
      fetchAll<ZoneClaim>('zone_claims', '*'),
      fetchAll<{ user_id: string }>('shift_claims', 'user_id'),
    ])

    setProfiles(profilesRes.data || [])
    setUserBadges(badges)
    setAllClaims(claims)
    setAllShiftClaims(shiftClaims)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData() }, [])

  // Antall sone-claims (vises i lista som "X soner")
  function getClaimCount(userId: string): number {
    return allClaims.filter(c => c.user_id === userId).length
  }

  // Total aktivitet for sortering = sone-claims + vakt-claims, så vakttakere
  // på arrangement ikke fremstår som inaktive.
  function getActivityCount(userId: string): number {
    return getClaimCount(userId) + allShiftClaims.filter(c => c.user_id === userId).length
  }

  function getBadgeCountForUser(userId: string): number {
    return userBadges.filter(ub => ub.user_id === userId).length
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

  // Filtrer på type (foreldre/musikanter) og søk, deretter sorter
  const filteredByType = profiles.filter(p => {
    if (typeFilter === 'foreldre') return !p.is_musician
    if (typeFilter === 'musikanter') return p.is_musician
    return true
  })

  const sortedProfiles = filteredByType
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
          return getBadgeCountForUser(b.id) - getBadgeCountForUser(a.id)
        case 'least_active':
          return (getBadgeCountForUser(a.id) + getActivityCount(a.id)) - (getBadgeCountForUser(b.id) + getActivityCount(b.id))
        case 'alpha':
        default:
          return (a.full_name || '').localeCompare(b.full_name || '', 'nb')
      }
    })

  // Endre rolle
  async function handleRoleChange(userId: string, newRole: Role) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('profiles') as any).update({ role: newRole }).eq('id', userId)
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p))
  }

  // Bytt mellom forelder og musikant, eller endre musikant-gruppe
  async function handleTypeChange(userId: string, isMusician: boolean, group: ChildGroup | null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('profiles') as any)
      .update({ is_musician: isMusician, musician_group: isMusician ? group : null })
      .eq('id', userId)
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_musician: isMusician, musician_group: isMusician ? group : null } : p))
  }

  // Tildel merke — stable-bare kategorier kan gis flere ganger
  async function handleAwardBadge(userId: string, badgeId: number) {
    const badge = badgeDefinitions.find(b => b.id === badgeId)
    const canStack = badge ? STACKABLE_BADGE_CATEGORIES.has(badge.category) : false

    // Engangs-merker: blokker om allerede har
    if (!canStack) {
      const alreadyHas = userBadges.some(ub => ub.user_id === userId && ub.badge_id === badgeId)
      if (alreadyHas) return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseRef.current.from('user_badges') as any).insert({
      user_id: userId,
      badge_id: badgeId,
      event_id: null,
    }).select().single() as { data: UserBadge | null }

    if (data) {
      setUserBadges(prev => [...prev, data])
    }
  }

  // Fjern ett merke (siste instans)
  async function handleRemoveBadge(userId: string, badgeId: number) {
    const badges = userBadges.filter(ub => ub.user_id === userId && ub.badge_id === badgeId)
    const badge = badges[badges.length - 1]
    if (!badge) return

    await supabaseRef.current.from('user_badges').delete().eq('id', badge.id)
    setUserBadges(prev => prev.filter(ub => ub.id !== badge.id))
  }

  // Fjern alle merker for en bruker
  async function handleResetBadges(userId: string) {
    await supabaseRef.current.from('user_badges').delete().eq('user_id', userId)
    setUserBadges(prev => prev.filter(ub => ub.user_id !== userId))
  }

  // Slett medlem — fjerner profil, merker, claims og auth-bruker
  async function handleDeleteMember(userId: string) {
    // Slett relaterte data forst
    await supabaseRef.current.from('user_badges').delete().eq('user_id', userId)
    await supabaseRef.current.from('zone_claims').delete().eq('user_id', userId)
    await supabaseRef.current.from('push_subscriptions').delete().eq('user_id', userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('profiles') as any).delete().eq('id', userId)

    // Slett auth-bruker via admin API
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (session) {
      await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {})
    }

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

      {/* Tilbake + tittel */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/oversikt" className="w-8 h-8 rounded-full flex items-center justify-center active:bg-surface-low">
          <ArrowLeft size={20} className="text-accent" />
        </Link>
        <h2 className="text-xl font-bold text-accent font-[var(--font-display)] flex-1">Medlemmer</h2>
        <span className="text-sm text-text-secondary">
          {loading ? '...' : `${profiles.length} totalt`}
        </span>
      </div>

      {/* Desktop: filter-pills + søk + sort i samme rad */}
      <div className="hidden lg:flex items-center gap-3 mb-5">
        {/* Type-filter pills */}
        <div className="flex bg-card border border-text-primary/[0.06] rounded-full p-1 gap-1">
          {([
            ['alle', 'Alle'],
            ['foreldre', 'Foreldre'],
            ['musikanter', 'Musikanter'],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTypeFilter(k)}
              className={`font-display text-sm font-bold px-4 py-1.5 rounded-full transition-colors ${
                typeFilter === k ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-low'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Elastisk mellomrom */}
        <div className="flex-1" />

        {/* Sort-knapper */}
        {!loading && profiles.length > 1 && (
          <div className="flex items-center gap-2">
            <ArrowUpDown size={14} className="text-text-tertiary shrink-0" />
            {(Object.keys(sortLabels) as SortMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  sortMode === mode
                    ? 'bg-accent text-white'
                    : 'bg-surface-low text-text-secondary hover:bg-surface-low/70'
                }`}
              >
                {sortLabels[mode]}
              </button>
            ))}
          </div>
        )}

        {/* Søk på desktop */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Søk..."
            className="pl-9 pr-9 py-2 rounded-full bg-card ring-1 ring-text-tertiary/20 text-[14px] outline-none focus:ring-2 focus:ring-accent/30 w-52"
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
      </div>

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

      {/* Ingen resultater */}
      {!loading && sortedProfiles.length === 0 && (
        <Card className="p-6 text-center rounded-2xl">
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
                    <MemberAvatar name={profile.full_name} avatarUrl={profile.avatar_url} />

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

      {/* Desktop: tabell-stil radvisning */}
      {!loading && sortedProfiles.length > 0 && (
        <div className="hidden lg:block bg-card border border-text-primary/[0.09] rounded-3xl overflow-hidden shadow-sm">
          {/* Tabell-hode med kolonne-labels */}
          <div className="grid grid-cols-[1fr_180px_120px_80px_24px] gap-4 px-6 py-3 bg-surface-low border-b border-text-primary/[0.06]">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary">Medlem</span>
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary">Rolle</span>
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary">Type</span>
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary text-right">Merker</span>
            <span />
          </div>

          {/* Rader */}
          {sortedProfiles.map(profile => {
            const badgeCount = getBadgeCountForUser(profile.id)
            // Sub-linje: musikant viser gruppe, forelder viser barn eller e-post
            const subLine = profile.is_musician
              ? (profile.musician_group || 'Musikant')
              : (profile.children && profile.children.length > 0
                  ? profile.children.map((c: Child) => `${c.name} (${c.group})`).join(', ')
                  : profile.email)

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedId(profile.id)}
                className="w-full grid grid-cols-[1fr_180px_120px_80px_24px] gap-4 px-6 py-4 border-b border-text-primary/[0.06] last:border-b-0 hover:bg-surface-low/40 transition-colors text-left"
              >
                {/* Kolonne 1: avatar + navn + sub-linje */}
                <div className="flex items-center gap-3 min-w-0">
                  <MemberAvatar name={profile.full_name} avatarUrl={profile.avatar_url} />
                  <div className="min-w-0">
                    <div className="font-bold text-text-primary truncate">{profile.full_name || 'Ukjent'}</div>
                    <div className="text-xs text-text-tertiary truncate">{subLine}</div>
                  </div>
                </div>

                {/* Kolonne 2: rolle-chip */}
                <div className="flex items-center">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${roleChipClass(profile.role as Role)}`}>
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>

                {/* Kolonne 3: type (Forelder / Musikant) */}
                <div className="flex items-center text-sm text-text-secondary">
                  {profile.is_musician ? (
                    <span className="inline-flex items-center gap-1">
                      <Music size={13} className="text-accent" />
                      Musikant
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Shield size={13} className="text-text-tertiary" />
                      Forelder
                    </span>
                  )}
                </div>

                {/* Kolonne 4: merke-antall høyrejustert */}
                <div className="flex items-center justify-end font-bold text-accent">
                  {badgeCount > 0 ? badgeCount : (
                    <span className="text-text-tertiary font-normal">0</span>
                  )}
                </div>

                {/* Kolonne 5: chevron */}
                <div className="flex items-center justify-end text-text-tertiary">
                  <ChevronRight size={16} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <MemberDetailOverlay
        profile={selectedProfile}
        badgeCount={selectedProfile ? getBadgeCountForUser(selectedProfile.id) : 0}
        zoneCount={selectedProfile ? getClaimCount(selectedProfile.id) : 0}
        badgeCounts={selectedProfile ? getBadgeCountsForUser(selectedProfile.id) : new Map()}
        onClose={() => setSelectedId(null)}
        onRoleChange={(role) => { if (selectedProfile) handleRoleChange(selectedProfile.id, role) }}
        onTypeChange={(isM, g) => { if (selectedProfile) handleTypeChange(selectedProfile.id, isM, g) }}
        onAwardBadge={(id) => { if (selectedProfile) handleAwardBadge(selectedProfile.id, id) }}
        onRemoveBadge={(id) => { if (selectedProfile) handleRemoveBadge(selectedProfile.id, id) }}
        onResetBadges={() => { if (selectedProfile) handleResetBadges(selectedProfile.id) }}
        onDeleteMember={() => { if (selectedProfile) handleDeleteMember(selectedProfile.id) }}
      />
    </div>
    </>
  )
}
