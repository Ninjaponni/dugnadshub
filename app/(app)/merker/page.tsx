'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { motion, AnimatePresence } from 'framer-motion'
import { badgeDefinitions } from '@/lib/badges/definitions'
import { Check, Lock, X } from 'lucide-react'

const categoryLabels: Record<string, string> = {
  starter: 'Startermerker',
  vanlig: 'Vanlige merker',
  veteran: 'Veteranmerker',
  elite: 'Elitemerker',
  aktivitet: 'Aktivitetsmerker',
}

const categoryDescriptions: Record<string, string> = {
  starter: 'Kom i gang med din første dugnad',
  vanlig: 'For den faste dugnadsgåer',
  veteran: 'For de mest erfarne',
  elite: 'De aller gjeveste',
  aktivitet: 'For alt det andre du gjør',
}

// Konfetti-partikkel
function Confetti() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 200 - 50,
    rotate: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
    color: ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA'][Math.floor(Math.random() * 6)],
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: p.scale, rotate: p.rotate }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 w-2 h-2 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  )
}

export default function BadgesPage() {
  // Map: badge_id → count (for aktivitetsmerker som kan gis flere ganger)
  const [badgeCounts, setBadgeCounts] = useState<Map<number, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState<typeof badgeDefinitions[0] | null>(null)
  const [revealBadge, setRevealBadge] = useState<typeof badgeDefinitions[0] | null>(null)
  const [newBadgeIds, setNewBadgeIds] = useState<Set<number>>(new Set())
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabaseRef.current
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id) as unknown as { data: Array<{ badge_id: number }> | null }

      // Tell antall per badge
      const counts = new Map<number, number>()
      for (const b of (data || [])) {
        counts.set(b.badge_id, (counts.get(b.badge_id) || 0) + 1)
      }
      setBadgeCounts(counts)

      const ids = new Set((data || []).map(b => b.badge_id))

      // Sjekk om det er nye merker brukeren ikke har sett
      const seenKey = `seen_badges_${user.id}`
      const seenRaw = localStorage.getItem(seenKey)
      const seen = seenRaw ? new Set(JSON.parse(seenRaw) as number[]) : new Set<number>()

      const unseen = new Set<number>()
      ids.forEach(id => { if (!seen.has(id)) unseen.add(id) })
      setNewBadgeIds(unseen)

      // Vis reveal for første usette badge
      if (unseen.size > 0) {
        const firstUnseen = [...unseen][0]
        const badge = badgeDefinitions.find(b => b.id === firstUnseen)
        if (badge) {
          setTimeout(() => setRevealBadge(badge), 500)
        }
      }

      // Marker alle som sett
      localStorage.setItem(seenKey, JSON.stringify([...ids]))

      setLoading(false)
    }
    load()
  }, [])

  const earnedBadgeIds = new Set(badgeCounts.keys())
  const totalEarned = earnedBadgeIds.size
  const totalBadges = badgeDefinitions.length

  return (
    <div className="px-4 pt-14 pb-28 safe-top">
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
      {!loading && (['starter', 'vanlig', 'veteran', 'elite', 'aktivitet'] as const).map((category) => {
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
                const isNew = newBadgeIds.has(badge.id)
                const count = badgeCounts.get(badge.id) || 0
                const isActivity = badge.category === 'aktivitet'

                return (
                  <motion.button
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedBadge(badge)}
                    className="text-left"
                  >
                    <div className="text-center relative">
                      {/* Teller for aktivitetsmerker */}
                      {earned && isActivity && count > 1 && (
                        <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-accent flex items-center justify-center shadow-sm z-10">
                          <span className="text-[10px] font-bold text-white">×{count}</span>
                        </div>
                      )}
                      {/* Hake for vanlige opptjente */}
                      {earned && (!isActivity || count <= 1) && (
                        <div className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-full bg-accent flex items-center justify-center shadow-sm z-10">
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                      {/* Ny-indikator */}
                      {isNew && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: 3, duration: 0.6 }}
                          className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-danger z-10"
                        />
                      )}
                      {/* Ikonet med rounded corners, outline og shadow direkte */}
                      <img
                        src={badge.icon}
                        alt={badge.name}
                        className={`w-full aspect-square rounded-[20px] ring-1 shadow-sm transition-all ${
                          earned
                            ? 'ring-amber-300/50 shadow-md'
                            : 'ring-black/8 grayscale opacity-40'
                        }`}
                      />
                      <p className={`text-xs font-medium leading-tight mt-2 ${earned ? 'text-text-primary' : 'text-text-tertiary'}`}>{badge.name}</p>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Badge-detalj modal */}
      <AnimatePresence>
        {selectedBadge && !revealBadge && (
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
              className={`fixed left-6 right-6 top-1/3 z-50 rounded-2xl p-6 shadow-xl max-w-sm mx-auto ${
                earnedBadgeIds.has(selectedBadge.id)
                  ? 'bg-card ring-2 ring-amber-400'
                  : 'bg-card'
              }`}
            >
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/5 flex items-center justify-center z-10"
              >
                <X size={14} className="text-text-secondary" />
              </button>

              <div className="text-center relative">
                <img
                  src={selectedBadge.icon}
                  alt={selectedBadge.name}
                  className={`w-20 h-20 mx-auto mb-3 rounded-[16px] ${
                    earnedBadgeIds.has(selectedBadge.id) ? '' : 'grayscale opacity-40'
                  }`}
                />
                <h3 className="text-xl font-bold mb-1">{selectedBadge.name}</h3>

                {earnedBadgeIds.has(selectedBadge.id) ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/50 text-amber-700 text-sm font-medium mb-3">
                    <Check size={14} strokeWidth={3} />
                    {(badgeCounts.get(selectedBadge.id) || 0) > 1
                      ? `Opptjent ×${badgeCounts.get(selectedBadge.id)}`
                      : 'Opptjent'}
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

      {/* Reveal-animasjon for nye merker */}
      <AnimatePresence>
        {revealBadge && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setRevealBadge(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, y: -50 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="fixed left-6 right-6 top-1/4 z-50 bg-card rounded-3xl p-8 shadow-2xl max-w-sm mx-auto overflow-hidden"
            >
              {/* Konfetti */}
              <Confetti />

              <div className="text-center relative">
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs font-bold text-accent uppercase tracking-widest mb-4"
                >
                  Nytt merke!
                </motion.p>

                {/* Glow */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 150, damping: 12 }}
                  className="relative inline-block"
                >
                  <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl scale-150" />
                  <div className="relative py-4">
                    <img src={revealBadge.icon} alt={revealBadge.name} className="w-20 h-20 mx-auto" />
                  </div>
                </motion.div>

                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-2xl font-bold mt-2 mb-2"
                >
                  {revealBadge.name}
                </motion.h3>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-text-secondary text-[15px] mb-6"
                >
                  {revealBadge.description}
                </motion.p>

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  onClick={() => setRevealBadge(null)}
                  className="bg-accent text-white font-semibold px-8 py-3 rounded-xl text-[15px]"
                >
                  Fantastisk!
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
