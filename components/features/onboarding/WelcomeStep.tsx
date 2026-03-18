'use client'

import { motion } from 'framer-motion'
import { Music } from 'lucide-react'

// Steg 1: Velkomstskjerm med korps-ikon
export default function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="w-24 h-24 rounded-[28px] bg-accent/10 flex items-center justify-center mb-8"
      >
        <Music size={48} className="text-accent" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-[28px] font-bold tracking-tight mb-3"
      >
        Velkommen til Dugnadshub!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-text-secondary text-[17px] leading-relaxed max-w-[280px]"
      >
        Her organiserer vi dugnader for Tillerbyen Skolekorps. Sveip gjennom for en kjapp innføring.
      </motion.p>
    </div>
  )
}
