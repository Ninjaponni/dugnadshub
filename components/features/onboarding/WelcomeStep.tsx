'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import KorpsLogo from '@/components/ui/KorpsLogo'

// Steg 1: Velkomstskjerm med korpslogo og illustrasjon
export default function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="mb-4"
      >
        <KorpsLogo size={80} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <Image src="/korps.svg" alt="Korps-illustrasjon" width={200} height={100} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-[28px] font-bold tracking-tight mb-3 font-[var(--font-display)]"
      >
        Velkommen til Dugnadshub!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="text-text-secondary text-[17px] leading-relaxed max-w-[280px]"
      >
        Her organiserer vi dugnader for Tillerbyen Skolekorps. Sveip gjennom for en kjapp innføring.
      </motion.p>
    </div>
  )
}
