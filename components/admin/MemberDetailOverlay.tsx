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

  // Lås body-scroll mens overlayet er åpent, så bakgrunnssiden ikke skroller
  // under finger-drag på mobil.
  useEffect(() => {
    if (!profile) return
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
