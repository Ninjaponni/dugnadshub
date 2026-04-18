'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { badgeDefinitions } from '@/lib/badges/definitions'
import { Check, Lock, X, Sparkles } from 'lucide-react'
import KorpsLogo from '@/components/ui/KorpsLogo'
import { isMockMode } from '@/lib/mock/useMock'
import { mockBadgeCounts } from '@/lib/mock/data'

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

// Nivåsystem — 25 nivåer fra fersking til legende
// 3 merker per nivå
const levels = [
  { min: 0, title: 'Sofaekspert' },
  { min: 3, title: 'Nysgjerrig nabo' },
  { min: 6, title: 'Dugnadsspire' },
  { min: 9, title: 'Pantejeger' },
  { min: 12, title: 'Sonevandrer' },
  { min: 15, title: 'Flaskesamler' },
  { min: 18, title: 'Dugnadsløve' },
  { min: 21, title: 'Sonekriger' },
  { min: 24, title: 'Nabolagshelt' },
  { min: 27, title: 'Dugnadshelt' },
  { min: 30, title: 'Pantekonge' },
  { min: 33, title: 'Frivilligveteran' },
  { min: 36, title: 'Dugnadsmaskin' },
  { min: 39, title: 'Korpskjempe' },
  { min: 42, title: 'Sonesjef' },
  { min: 45, title: 'Pantelegende' },
  { min: 48, title: 'Dugnadsdrott' },
  { min: 51, title: 'Tillerlegenden' },
  { min: 54, title: 'Dugnadsguru' },
  { min: 57, title: 'Sonegeneral' },
  { min: 60, title: 'Panteorakel' },
  { min: 63, title: 'Dugnadsjarl' },
  { min: 66, title: 'Korpslegende' },
  { min: 69, title: 'Dugnadsmytisk' },
  { min: 72, title: 'Tillerbyen Udødelig' },
]

// Finn nivå og neste nivå basert på totalt antall merker
function getLevel(totalBadgeCount: number) {
  let current = levels[0]
  let next = levels[1] || null
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalBadgeCount >= levels[i].min) {
      current = levels[i]
      next = levels[i + 1] || null
      break
    }
  }
  return { current, next }
}

// Konfetti-partikkel
function Confetti() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 200 - 50,
    rotate: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
    color: ['#a24a33', '#6B8F71', '#ff784e', '#843d99', '#FFD54F', '#ea9bff'][Math.floor(Math.random() * 6)],
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
    if (isMockMode()) {
      setBadgeCounts(mockBadgeCounts)
      setLoading(false)
      return
    }
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

  // Total badge-count inkludert duplikater (aktivitetsmerker kan gis flere ganger)
  let totalBadgeCount = 0
  badgeCounts.forEach(count => { totalBadgeCount += count })

  const { current: currentLevel, next: nextLevel } = getLevel(totalBadgeCount)

  // Progress mot neste nivå
  const progressToNext = nextLevel
    ? ((totalBadgeCount - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100
    : 100

  return (
    <>
      {/* Dugnadshub-header — samme som hjem */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <div className="flex items-center gap-3">
            <KorpsLogo size={32} />
            <span className="text-xl font-bold text-accent tracking-tight font-[var(--font-display)]">
              Dugnadshub
            </span>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="pt-20 pb-28 px-5 space-y-6">
        {/* Gradient merker-kort med nivåinfo */}
        {loading ? (
          <div className="rounded-2xl p-8 animate-pulse" style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}>
            <div className="h-10 w-32 bg-white/20 rounded mb-3" />
            <div className="h-4 w-48 bg-white/20 rounded mb-6" />
            <div className="h-4 bg-white/20 rounded-full" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-7 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-1">
                <h1 className="text-4xl font-extrabold tracking-tight font-[var(--font-display)]">Merker</h1>
                <span className="text-4xl font-bold font-[var(--font-display)]">{totalBadgeCount}</span>
              </div>
              <p className="text-white/80 font-medium text-sm mb-5">Din innsats betyr noe</p>
              <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToNext}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-white/90 rounded-full"
                />
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/70">
                Ditt nivå: {currentLevel.title}
              </p>
              {nextLevel && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  Neste: {nextLevel.title}
                </p>
              )}
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </motion.div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            {[1, 2].map(i => (
              <div key={i} className="card rounded-2xl p-8">
                <div className="h-5 w-32 bg-surface-low rounded mb-4" />
                <div className="grid grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 rounded-full bg-surface-low" />
                      <div className="h-3 w-16 bg-surface-low rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Kategorier — clay-kort per kategori */}
        {!loading && (['starter', 'vanlig', 'veteran', 'elite', 'aktivitet'] as const).map((category) => {
          const badges = badgeDefinitions.filter((b) => b.category === category)
          const earnedInCategory = badges.filter(b => earnedBadgeIds.has(b.id)).length
          const hasAnyEarned = earnedInCategory > 0

          return (
            <section key={category}>
              <div className="flex items-center gap-3 mb-3 px-1">
                {hasAnyEarned
                  ? <Sparkles size={18} className="text-accent" />
                  : <Lock size={18} className="text-text-tertiary opacity-60" />
                }
                <h2 className="text-xl font-bold text-text-primary font-[var(--font-display)]">
                  {categoryLabels[category]}
                </h2>
              </div>

              <div className="card rounded-2xl p-6">
                <div className="grid grid-cols-2 gap-y-8 gap-x-4">
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
                        className="flex flex-col items-center gap-3"
                      >
                        <div className="relative">
                          {/* Rund badge-ikon */}
                          <div className={`w-20 h-20 rounded-full overflow-hidden transition-all ${
                            earned ? 'shadow-md' : ''
                          }`}>
                            <img
                              src={badge.icon}
                              alt={badge.name}
                              className={`w-full h-full object-cover transition-all ${
                                earned ? '' : 'grayscale opacity-40'
                              }`}
                            />
                          </div>
                          {/* Grønn checkmark i nedre høyre hjørne */}
                          {earned && (!isActivity || count <= 1) && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success text-white rounded-full flex items-center justify-center border-2 border-bg shadow-sm">
                              <Check size={14} strokeWidth={3} />
                            </div>
                          )}
                          {/* Teller for aktivitetsmerker */}
                          {earned && isActivity && count > 1 && (
                            <div className="absolute -bottom-1 -right-1 min-w-[24px] h-6 px-1 bg-accent text-white rounded-full flex items-center justify-center border-2 border-bg shadow-sm">
                              <span className="text-[10px] font-bold">×{count}</span>
                            </div>
                          )}
                          {/* Ny-indikator */}
                          {isNew && (
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: 3, duration: 0.6 }}
                              className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-danger z-10"
                            />
                          )}
                        </div>
                        <span className={`text-[12px] font-bold text-center uppercase tracking-tight ${
                          earned ? 'text-text-secondary' : 'text-text-tertiary'
                        }`}>
                          {badge.name}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </section>
          )
        })}

      {/* Info-boks — hva er greia med merkene */}
      {!loading && (
        <section className="mt-4 mb-2">
          <div className="bg-warning/10 rounded-2xl p-5 flex gap-4 items-start">
            <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center shrink-0">
              <Sparkles size={22} className="text-warning" />
            </div>
            <div>
              <h4 className="font-bold text-text-primary font-[var(--font-display)] mb-1">
                Hva er greia med merkene?
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                Hvert merke er et bevis på din dugnadsinnsats — noe å være stolt av!
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-2">
                Men de er også lodd i trekningen under julekonserten. Jo flere merker, jo større sjanse for premie.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mt-2">
                Den med flest kåres til årets dugnadshelt.
              </p>
            </div>
          </div>
        </section>
      )}

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
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-surface-low flex items-center justify-center z-10"
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
                <h3 className="text-xl font-bold mb-1 font-[var(--font-display)]">{selectedBadge.name}</h3>

                {earnedBadgeIds.has(selectedBadge.id) ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/20 text-accent text-sm font-medium mb-3">
                    <Check size={14} strokeWidth={3} />
                    {(badgeCounts.get(selectedBadge.id) || 0) > 1
                      ? `Opptjent ×${badgeCounts.get(selectedBadge.id)}`
                      : 'Opptjent'}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-low text-text-tertiary text-sm font-medium mb-3">
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
                  className="text-white font-semibold px-8 py-3 rounded-full text-[15px] font-[var(--font-display)]"
                  style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
                >
                  Fantastisk!
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </main>
    </>
  )
}
