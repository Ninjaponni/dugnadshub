'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'

interface Props {
  message: string | null
}

// Liten flytende toast som bekrefter handlinger i medlem-overlayet.
// Mørk pille med grønn hake, dukker opp nederst i 2.4 sekunder.
export default function MemberToast({ message }: Props) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1.1] }}
          className="fixed left-4 right-4 bottom-6 z-[60] flex justify-center pointer-events-none"
        >
          <div
            className="inline-flex items-center gap-2.5 bg-text-primary text-white py-3 px-[18px] rounded-full text-[13.5px] font-semibold shadow-[0_12px_30px_rgba(45,38,32,0.3)] max-w-full"
          >
            <span className="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0">
              <Check size={14} strokeWidth={3} />
            </span>
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
