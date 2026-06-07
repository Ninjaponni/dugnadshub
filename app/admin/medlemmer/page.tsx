'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import BrandLink from '@/components/layout/BrandLink'
import { Users, Search, ChevronRight, X, ArrowLeft, ArrowUpDown, Music } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { badgeDefinitions } from '@/lib/badges/definitions'
import type { Child } from '@/lib/supabase/types'
import type { Profile, Role, UserBadge, ZoneClaim, ChildGroup } from '@/lib/supabase/types'
import MemberDetailOverlay from '@/components/admin/MemberDetailOverlay'

type SortMode = 'alpha' | 'badges' | 'least_active'

const sortLabels: Record<SortMode, string> = {
  alpha: 'A–Å',
  badges: 'Flest merker',
  least_active: 'Minst aktiv',
}

// Merker som kan tildeles manuelt av admin
const manualBadges = badgeDefinitions.filter(b => b.auto_criteria === null)

// Kategorier som kan stables ×N (samme merke flere ganger)
const STACKABLE_CATEGORIES = new Set(['aktivitet', '17mai', 'styret', 'komite', 'vakt'])

const roleLabels: Record<Role, string> = {
  collector: 'Samler',
  driver: 'Sjåfør',
  strapper: 'Stripser',
  host: 'Vert',
  admin: 'Admin',
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [updatingType, setUpdatingType] = useState<string | null>(null)
  const [awardingBadge, setAwardingBadge] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
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

  // Filtrer og sorter profiler
  const filtered = profiles
    .filter(p => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      const roleLabel = roleLabels[p.role as Role] || ''
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
    setUpdatingRole(userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('profiles') as any).update({ role: newRole }).eq('id', userId)
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p))
    setUpdatingRole(null)
  }

  // Bytt mellom forelder og musikant, eller endre musikant-gruppe
  async function handleTypeChange(userId: string, isMusician: boolean, group: ChildGroup | null) {
    setUpdatingType(userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('profiles') as any)
      .update({ is_musician: isMusician, musician_group: isMusician ? group : null })
      .eq('id', userId)
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_musician: isMusician, musician_group: isMusician ? group : null } : p))
    setUpdatingType(null)
  }

  // Tildel merke — stable-bare kategorier kan gis flere ganger
  async function handleAwardBadge(userId: string, badgeId: number) {
    const badge = badgeDefinitions.find(b => b.id === badgeId)
    const canStack = badge ? STACKABLE_CATEGORIES.has(badge.category) : false

    // Engangs-merker: blokker om allerede har
    if (!canStack) {
      const alreadyHas = userBadges.some(ub => ub.user_id === userId && ub.badge_id === badgeId)
      if (alreadyHas) return
    }

    setAwardingBadge(`${userId}-${badgeId}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseRef.current.from('user_badges') as any).insert({
      user_id: userId,
      badge_id: badgeId,
      event_id: null,
    }).select().single() as { data: UserBadge | null }

    if (data) {
      setUserBadges(prev => [...prev, data])
    }
    setAwardingBadge(null)
  }

  // Fjern ett merke (siste instans)
  async function handleRemoveBadge(userId: string, badgeId: number) {
    const badges = userBadges.filter(ub => ub.user_id === userId && ub.badge_id === badgeId)
    const badge = badges[badges.length - 1]
    if (!badge) return

    setAwardingBadge(`${userId}-${badgeId}`)
    await supabaseRef.current.from('user_badges').delete().eq('id', badge.id)
    setUserBadges(prev => prev.filter(ub => ub.id !== badge.id))
    setAwardingBadge(null)
  }

  // Fjern alle merker for en bruker
  async function handleResetBadges(userId: string) {
    setAwardingBadge(`${userId}-reset`)
    await supabaseRef.current.from('user_badges').delete().eq('user_id', userId)
    setUserBadges(prev => prev.filter(ub => ub.user_id !== userId))
    setAwardingBadge(null)
  }

  // Slett medlem — fjerner profil, merker, claims og auth-bruker
  async function handleDeleteMember(userId: string) {
    setDeleting(true)

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
    setDeleteConfirmId(null)
    setSelectedId(null)
    setDeleting(false)
  }

  // Tell antall ganger en bruker har fått et badge
  function getBadgeCount(userId: string, badgeId: number): number {
    return userBadges.filter(ub => ub.user_id === userId && ub.badge_id === badgeId).length
  }

  // Hent unike merker for en bruker
  function getBadgesForUser(userId: string) {
    const badgeIds = [...new Set(userBadges.filter(ub => ub.user_id === userId).map(ub => ub.badge_id))]
    return badgeDefinitions.filter(b => badgeIds.includes(b.id))
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <BrandLink />
          <div className="w-9" />
        </div>
      </header>
      <div className="pt-16 pb-28">

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

      {/* Sokefelt */}
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

      {/* Sortering */}
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
      {!loading && filtered.length === 0 && (
        <Card className="p-6 text-center rounded-2xl">
          <Users size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary font-[var(--font-display)]">
            {searchQuery ? 'Ingen treff på søket' : 'Ingen medlemmer registrert ennå'}
          </p>
        </Card>
      )}

      {/* Medlemsliste */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((profile, i) => {
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
                    <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-accent">
                        {(profile.full_name || profile.email)[0].toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium text-[15px] truncate font-[var(--font-display)]">
                          {profile.full_name || 'Ukjent'}
                        </p>
                        {profile.is_musician && (
                          <span
                            title={profile.musician_group ? `Musikant — ${profile.musician_group}` : 'Musikant'}
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        profile.role === 'admin' ? 'bg-purple/10 text-purple' :
                        profile.role === 'driver' ? 'bg-teal/10 text-teal' :
                        profile.role === 'strapper' ? 'bg-warning/10 text-warning' :
                        profile.role === 'host' ? 'bg-accent/10 text-accent' :
                        'bg-surface-low text-text-secondary'
                      }`}>
                        {roleLabels[profile.role]}
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

      <MemberDetailOverlay
        profile={selectedProfile}
        badgeCount={selectedProfile ? getBadgeCountForUser(selectedProfile.id) : 0}
        zoneCount={selectedProfile ? getClaimCount(selectedProfile.id) : 0}
        badgeCounts={selectedProfile ? getBadgeCountsForUser(selectedProfile.id) : new Map()}
        onClose={() => setSelectedId(null)}
        onRoleChange={(role) => { if (selectedProfile) handleRoleChange(selectedProfile.id, role) }}
        onTypeChange={(isM, g) => { if (selectedProfile) handleTypeChange(selectedProfile.id, isM, g) }}
        onSelectBadge={() => { /* Task 5 wirer dette */ }}
      />
    </div>
    </>
  )
}
