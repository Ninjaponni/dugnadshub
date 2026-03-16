'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { motion, AnimatePresence } from 'framer-motion'
import { badgeDefinitions } from '@/lib/badges/definitions'
import { Check, Lock, X } from 'lucide-react'
import type { UserBadge } from '@/lib/supabase/types'

const categoryLabels = {
  starter: 'Startermerker',
  vanlig: 'Vanlige merker',
  veteran: 'Veteranmerker',
  elite: 'Elitemerker',
  rolle: 'Rollemerker',
}

const categoryDescriptions = {
  starter: 'Kom i gang med din første dugnad',
  vanlig: 'For den faste dugnadsgåer',
  veteran: 'For de mest erfarne',
  elite: 'De aller gjeveste',
  rolle: 'Spesialroller i dugnaden',
}

export default function BadgesPage() {
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState<typeof badgeDefinitions[0] | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabaseRef.current
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id) as unknown as { data: Array<{ badge_id: number }> | null }

      if (data) {
        setEarnedBadgeIds(new Set(data.map(b => b.badge_id)))
      }
      setLoading(false)
    }
    load()
  }, [])

  const totalEarned = earnedBadgeIds.size
  const totalBadges = badgeDefinitions.length

  return (
    <div className="px-4 pt-14 pb-24 safe-top">
      <h1 className="text-[34px] font-bold tracking-tight mb-2">Merker</h1>

      {/* Oppsummering */}
      {loading ? (
        <div className="h-6 w-40 bg-black/5 rounded animate-pulse mb-6" />
      ) : (
        <div className="mb-6">
          <p className="text-text-secondary text-[15px]">
            {totalEarned === 0
              ? 'Du har ingen merker ennå — delta på en dugnad for å begynne!'
              : `Du har ${totalEarned} av ${totalBadges} merker`}
          </p>
          {/* Mini-progresjon */}
          <div className="h-1.5 bg-black/5 rounded-full overflow-hidden mt-2 max-w-xs">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(totalEarned / totalBadges) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-accent rounded-full"
            />
          </div>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="h-5 w-32 bg-black/5 rounded mb-3" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(j => (
                  <div key={j} className="card p-4 h-24" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kategorier */}
      {!loading && (['starter', 'vanlig', 'veteran', 'elite', 'rolle'] as const).map((category) => {
        const badges = badgeDefinitions.filter((b) => b.category === category)
        const earnedInCategory = badges.filter(b => earnedBadgeIds.has(b.id)).length

        return (
          <div key={category} className="mb-6">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-lg font-semibold text-text-primary">
                {categoryLabels[category]}
              </h2>
              {earnedInCategory > 0 && (
                <span className="text-xs text-accent font-medium">{earnedInCategory}/{badges.length}</span>
              )}
            </div>
            <p className="text-xs text-text-tertiary mb-3">{categoryDescriptions[category]}</p>

            <div className="grid grid-cols-3 gap-3">
              {badges.map((badge, i) => {
                const earned = earnedBadgeIds.has(badge.id)

                return (
                  <motion.button
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedBadge(badge)}
                    className="text-left"
                  >
                    <Card animate={false} className={`p-3 text-center relative transition-all ${
                      earned
                        ? 'opacity-100 ring-1 ring-accent/20 bg-accent/[0.03]'
                        : 'opacity-35'
                    }`}>
                      {/* Hake for opptjente */}
                      {earned && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                      <div className="text-2xl mb-1">{badge.icon}</div>
                      <p className="text-xs font-medium leading-tight">{badge.name}</p>
                    </Card>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Badge-detalj modal */}
      <AnimatePresence>
        {selectedBadge && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setSelectedBadge(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed left-6 right-6 top-1/3 z-50 bg-card rounded-2xl p-6 shadow-xl max-w-sm mx-auto"
            >
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/5 flex items-center justify-center"
              >
                <X size={14} className="text-text-secondary" />
              </button>

              <div className="text-center">
                <div className="text-5xl mb-3">{selectedBadge.icon}</div>
                <h3 className="text-xl font-bold mb-1">{selectedBadge.name}</h3>

                {/* Status */}
                {earnedBadgeIds.has(selectedBadge.id) ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-3">
                    <Check size={14} strokeWidth={3} />
                    Opptjent
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-text-tertiary text-sm font-medium mb-3">
                    <Lock size={14} />
                    Ikke opptjent
                  </div>
                )}

                <p className="text-text-secondary text-[15px]">
                  {selectedBadge.description}
                </p>

                {/* Admin-tildelt info */}
                {selectedBadge.auto_criteria === null && (
                  <p className="text-xs text-text-tertiary mt-2">
                    Tildeles av admin
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
