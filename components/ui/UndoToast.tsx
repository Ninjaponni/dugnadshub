'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UndoToastProps {
  message: string | null
  actionLabel: string
  onAction: () => void
  // Kalles når toasten lukker seg (etter tid eller etter trykk på handlingen).
  // Må være stabil (useCallback), ellers starter timeren på nytt ved hver render.
  onDone: () => void
  durationMs?: number
}

// Flytende pille med én angre-handling, samme uttrykk som MemberToast.
// Ligger over bunnmenyen og har minst 44 px trykkflate på knappen.
export default function UndoToast({ message, actionLabel, onAction, onDone, durationMs = 5000 }: UndoToastProps) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, durationMs)
    return () => clearTimeout(t)
  }, [message, durationMs, onDone])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1.1] }}
          className="fixed left-4 right-4 bottom-24 z-[65] flex justify-center"
        >
          <div className="inline-flex items-center gap-1 bg-text-primary text-white pl-[18px] pr-1 rounded-full text-[13.5px] font-semibold shadow-[0_12px_30px_rgba(45,38,32,0.3)] max-w-full">
            <span className="py-3">{message}</span>
            <button
              type="button"
              onClick={() => { onAction(); onDone() }}
              className="min-h-[44px] px-4 rounded-full font-bold text-primary-container active:bg-white/10"
            >
              {actionLabel}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
