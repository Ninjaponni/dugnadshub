'use client'

import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { useCallback } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

// Bottom sheet med drag-håndtak — varm claymorphism
export default function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  const dragControls = useDragControls()

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.velocity.y > 300 || info.offset.y > 150) {
      onClose()
    }
  }, [onClose])

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
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Sheet */}
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
            className="fixed bottom-0 left-0 right-0 z-50 bg-bg rounded-t-[28px] max-h-[85dvh] flex flex-col shadow-[0_-12px_30px_rgba(61,53,48,0.08)]"
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
              <div className="px-5 pb-28 safe-bottom">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
