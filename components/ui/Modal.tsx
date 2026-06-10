'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

// Sentrert desktop-modal med bakdrop, blur og springy entrance.
// Mobil bruker fortsatt BottomSheet — denne er for lg+.
type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}

export default function Modal({ open, onClose, children, maxWidth = 540 }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Dialog-semantikk: flytt fokus inn ved åpning (kun når synlig, dvs. lg+)
  useEffect(() => {
    if (open && window.matchMedia('(min-width: 1024px)').matches) dialogRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    // Modalen brukes bak `hidden lg:block`-wrappers — på mobil er den usynlig,
    // men effekten kjører likevel. Gate på lg så vi ikke låser scroll på mobil.
    if (!window.matchMedia('(min-width: 1024px)').matches) return
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
          <div className="absolute inset-0" style={{ background: 'rgba(45,38,32,.42)', backdropFilter: 'blur(3px)' }} />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="relative bg-card rounded-[28px] border border-text-primary/[0.09] w-full max-h-[88vh] overflow-y-auto outline-none"
            style={{ maxWidth, boxShadow: '0 24px 60px rgba(45,38,32,.32)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Lukk"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-surface-low hover:bg-text-primary/10 flex items-center justify-center text-text-secondary"
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
