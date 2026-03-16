'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Users, Search, Award, ChevronDown, ChevronUp, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { badgeDefinitions } from '@/lib/badges/definitions'
import type { Profile, Role, UserBadge } from '@/lib/supabase/types'

// Merker som kan tildeles manuelt av admin
const manualBadges = badgeDefinitions.filter(b => b.auto_criteria === null)

const roleLabels: Record<Role, string> = {
  collector: 'Samler',
  driver: 'Sjåfor',
  strapper: 'Stripser',
  admin: 'Admin',
}

// Medlemsadministrasjon — se, rediger og tildel merker
export default function MembersAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userBadges, setUserBadges] = useState<UserBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [awardingBadge, setAwardingBadge] = useState<string | null>(null)
  const supabase = createClient()

  async function loadData() {
    const [profilesRes, badgesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name') as unknown as Promise<{ data: Profile[] | null }>,
      supabase.from('user_badges').select('*') as unknown as Promise<{ data: UserBadge[] | null }>,
    ])

    setProfiles(profilesRes.data || [])
    setUserBadges(badgesRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [supabase])

  // Filtrer profiler basert pa sok
  const filtered = profiles.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (p.full_name || '').toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.child_name || '').toLowerCase().includes(q)
    )
  })

  // Endre rolle
  async function handleRoleChange(userId: string, newRole: Role) {
    setUpdatingRole(userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).update({ role: newRole }).eq('id', userId)
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p))
    setUpdatingRole(null)
  }

  // Tildel merke
  async function handleAwardBadge(userId: string, badgeId: number) {
    // Sjekk om brukeren allerede har merket
    const alreadyHas = userBadges.some(ub => ub.user_id === userId && ub.badge_id === badgeId)
    if (alreadyHas) return

    setAwardingBadge(`${userId}-${badgeId}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('user_badges') as any).insert({
      user_id: userId,
      badge_id: badgeId,
      event_id: null,
    }).select().single() as { data: UserBadge | null }

    if (data) {
      setUserBadges(prev => [...prev, data])
    }
    setAwardingBadge(null)
  }

  // Fjern merke
  async function handleRemoveBadge(userId: string, badgeId: number) {
    const badge = userBadges.find(ub => ub.user_id === userId && ub.badge_id === badgeId)
    if (!badge) return

    setAwardingBadge(`${userId}-${badgeId}`)
    await supabase.from('user_badges').delete().eq('id', badge.id)
    setUserBadges(prev => prev.filter(ub => ub.id !== badge.id))
    setAwardingBadge(null)
  }

  // Hent merker for en bruker
  function getBadgesForUser(userId: string) {
    const badgeIds = userBadges.filter(ub => ub.user_id === userId).map(ub => ub.badge_id)
    return badgeDefinitions.filter(b => badgeIds.includes(b.id))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/oversikt" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
          <ArrowLeft size={18} className="text-text-secondary" />
        </Link>
        <h2 className="text-xl font-semibold flex-1">Medlemmer</h2>
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
          placeholder="Sok etter navn, e-post eller barn..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30"
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

      {/* Skeleton loading */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-black/5 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-black/5 rounded" />
                <div className="h-3 w-48 bg-black/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ingen resultater */}
      {!loading && filtered.length === 0 && (
        <Card className="p-6 text-center">
          <Users size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">
            {searchQuery ? 'Ingen treff pa soket' : 'Ingen medlemmer registrert ennå'}
          </p>
        </Card>
      )}

      {/* Medlemsliste */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((profile, i) => {
            const isExpanded = expandedId === profile.id
            const userBadgeList = getBadgesForUser(profile.id)

            return (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Card animate={false} className="p-0 overflow-hidden">
                  {/* Kort-header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                    className="w-full text-left p-4 flex items-center gap-3"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-accent">
                        {(profile.full_name || profile.email)[0].toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[15px] truncate">
                        {profile.full_name || 'Ukjent'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="truncate">{profile.email}</span>
                        {profile.child_name && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span className="shrink-0">{profile.child_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Merke-ikoner */}
                      {userBadgeList.length > 0 && (
                        <span className="text-sm" title={userBadgeList.map(b => b.name).join(', ')}>
                          {userBadgeList.slice(0, 3).map(b => b.icon).join('')}
                          {userBadgeList.length > 3 && `+${userBadgeList.length - 3}`}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        profile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        profile.role === 'driver' ? 'bg-blue-100 text-blue-700' :
                        profile.role === 'strapper' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {roleLabels[profile.role]}
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="text-text-tertiary" /> : <ChevronDown size={14} className="text-text-tertiary" />}
                    </div>
                  </button>

                  {/* Ekspandert panel */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-black/5 px-4 py-3 space-y-4">
                          {/* Rollevelger */}
                          <div>
                            <label className="text-xs font-medium text-text-secondary block mb-1.5">Rolle</label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(Object.keys(roleLabels) as Role[]).map(role => (
                                <button
                                  key={role}
                                  onClick={() => handleRoleChange(profile.id, role)}
                                  disabled={updatingRole === profile.id}
                                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    profile.role === role
                                      ? 'bg-accent text-white'
                                      : 'bg-black/5 text-text-secondary hover:bg-black/10'
                                  } ${updatingRole === profile.id ? 'opacity-50' : ''}`}
                                >
                                  {roleLabels[role]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Merker */}
                          <div>
                            <label className="text-xs font-medium text-text-secondary block mb-1.5">
                              <Award size={12} className="inline mr-1" />
                              Manuelle merker
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {manualBadges.map(badge => {
                                const hasBadge = userBadgeList.some(b => b.id === badge.id)
                                const isAwarding = awardingBadge === `${profile.id}-${badge.id}`

                                return (
                                  <button
                                    key={badge.id}
                                    onClick={() => hasBadge
                                      ? handleRemoveBadge(profile.id, badge.id)
                                      : handleAwardBadge(profile.id, badge.id)
                                    }
                                    disabled={isAwarding}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                      hasBadge
                                        ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
                                        : 'bg-black/5 text-text-secondary hover:bg-black/10'
                                    } ${isAwarding ? 'opacity-50' : ''}`}
                                  >
                                    <span>{badge.icon}</span>
                                    <span>{badge.name}</span>
                                    {hasBadge && <X size={12} />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Alle merker brukeren har */}
                          {userBadgeList.length > 0 && (
                            <div>
                              <label className="text-xs font-medium text-text-secondary block mb-1.5">
                                Alle merker ({userBadgeList.length})
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {userBadgeList.map(badge => (
                                  <span
                                    key={badge.id}
                                    title={badge.description}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5 text-xs"
                                  >
                                    <span>{badge.icon}</span>
                                    <span>{badge.name}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Detaljer */}
                          <div className="text-xs text-text-tertiary space-y-0.5">
                            {profile.phone && <p>Telefon: {profile.phone}</p>}
                            {profile.child_group && <p>Gruppe: {profile.child_group}</p>}
                            <p>Registrert: {new Date(profile.created_at).toLocaleDateString('nb-NO')}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
