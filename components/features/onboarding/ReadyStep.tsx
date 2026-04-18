'use client'

import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

// Konfetti — gjenbrukt mønster fra merker-siden
function Confetti() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    y: (Math.random() - 0.5) * 300 - 80,
    rotate: Math.random() * 360,
    scale: 0.4 + Math.random() * 0.6,
    color: ['var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-purple)', 'var(--color-danger)', 'var(--color-teal)'][Math.floor(Math.random() * 6)],
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: p.scale, rotate: p.rotate }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/3 w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  )
}

interface ReadyStepProps {
  onStart: () => void
}

// Steg 6: Ferdig-skjerm med konfetti og start-knapp
export default function ReadyStep({ onStart }: ReadyStepProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center relative">
      <Confetti />

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
        className="text-6xl mb-6"
      >
        🎉
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-[28px] font-bold mb-3 font-[var(--font-display)]"
      >
        Du er klar!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-text-secondary text-[17px] mb-10 max-w-[280px]"
      >
        Gå til kartet og velg din første sone. Lykke til!
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Button size="lg" onClick={onStart} className="px-12">
          Start
        </Button>
      </motion.div>
    </div>
  )
}
