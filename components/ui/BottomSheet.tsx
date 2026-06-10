'use client'

import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  // Lim sheeten helt nederst (bottom-0). Standard er bottom-20 for å sitte over BottomNav.
  // Bruk pinToBottom når sheeten åpnes i et overlay uten BottomNav (f.eks. admin-overlay).
  pinToBottom?: boolean
}

// Lytter på lg-breakpunktet. Trygt mot hydrering fordi sheeten kun rendres
// ved open (klient-interaksjon), aldri i første server-render.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isDesktop
}

// Bottom sheet på mobil, sentrert modal på desktop (lg+) — samme innhold.
export default function BottomSheet({ open, onClose, children, title, pinToBottom = false }: BottomSheetProps) {
  const dragControls = useDragControls()
  const isDesktop = useIsDesktop()

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.velocity.y > 300 || info.offset.y > 150) {
      onClose()
    }
  }, [onClose])

  // Desktop: lås body-scroll + lukk på ESC
  useEffect(() => {
    if (!open || !isDesktop) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isDesktop, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Mørk overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 lg:bg-black/40 z-[50]"
            onClick={onClose}
          />

          {isDesktop ? (
            /* Desktop — sentrert modal */
            <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto bg-bg rounded-[28px] w-full max-w-[440px] max-h-[85vh] flex flex-col shadow-[0_24px_60px_rgba(45,38,32,0.28)]"
              >
                {title && (
                  <h2 className="text-xl font-semibold font-[var(--font-display)] px-5 pt-5 pb-3 shrink-0">{title}</h2>
                )}
                <div className="overflow-auto flex-1 overscroll-contain">
                  <div className={`px-5 pb-6 ${title ? '' : 'pt-5'}`}>{children}</div>
                </div>
              </motion.div>
            </div>
          ) : (
            /* Mobil — bottom sheet med drag-håndtak */
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className={`fixed ${pinToBottom ? 'bottom-0' : 'bottom-20'} left-0 right-0 z-[55] bg-bg rounded-t-[28px] max-h-[75dvh] flex flex-col shadow-[0_-12px_30px_rgba(61,53,48,0.08)] safe-bottom`}
            >
              {/* Drag-håndtak — kun dette området trigger drag-to-close */}
              <div
                className="flex justify-center py-3 cursor-grab active:cursor-grabbing shrink-0"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-9 h-1 rounded-full bg-text-tertiary/40" />
              </div>

              {title && (
                <h2 className="text-xl font-semibold font-[var(--font-display)] px-5 pb-3 shrink-0">{title}</h2>
              )}

              <div className="overflow-auto flex-1 overscroll-contain">
                <div className="px-5 pb-6">
                  {children}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
