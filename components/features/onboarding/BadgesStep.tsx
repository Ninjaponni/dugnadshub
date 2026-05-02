'use client'

import { motion } from 'framer-motion'
import { badgeDefinitions } from '@/lib/badges/definitions'

// Steg 5: Vis 4 eksempelmerker fra forskjellige kategorier
const previewBadges = badgeDefinitions.filter(b =>
  ['Frøspire', 'Sonevelger', 'Tre på rad', 'Maskin'].includes(b.name)
)

const categoryLabels: Record<string, string> = {
  starter: 'Starter',
  vanlig: 'Vanlig',
  veteran: 'Veteran',
  elite: 'Elite',
  aktivitet: 'Aktivitet',
  '17mai': '17. mai',
}

export default function BadgesStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-2 font-[var(--font-display)]"
      >
        44 merker å jakte på
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-text-secondary text-[15px] mb-8 max-w-[280px]"
      >
        Du får merker automatisk etterhvert som du deltar. Noen er sjeldne!
      </motion.p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-[260px] mb-8">
        {previewBadges.map((badge, i) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 200, damping: 15 }}
            className="card p-3 text-center"
          >
            <img
              src={badge.icon}
              alt={badge.name}
              className="w-16 h-16 mx-auto rounded-[14px] ring-1 ring-warning/30 shadow-md mb-2"
            />
            <p className="text-xs font-semibold">{badge.name}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex flex-wrap justify-center gap-2"
      >
        {Object.values(categoryLabels).map(label => (
          <span
            key={label}
            className="text-[11px] font-medium text-text-tertiary bg-surface-low px-2.5 py-1 rounded-full"
          >
            {label}
          </span>
        ))}
      </motion.div>
    </div>
  )
}
