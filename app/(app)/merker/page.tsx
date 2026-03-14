'use client'

import Card from '@/components/ui/Card'
import { motion } from 'framer-motion'
import { badgeDefinitions } from '@/lib/badges/definitions'

// Oversikt over alle badges
export default function BadgesPage() {
  return (
    <div className="px-4 pt-14 safe-top">
      <h1 className="text-[34px] font-bold tracking-tight mb-6">Merker</h1>

      {/* Kategorivisning */}
      {(['starter', 'vanlig', 'veteran', 'elite', 'rolle'] as const).map((category) => {
        const badges = badgeDefinitions.filter((b) => b.category === category)
        const categoryLabels = {
          starter: 'Startermerker',
          vanlig: 'Vanlige merker',
          veteran: 'Veteranmerker',
          elite: 'Elitemerker',
          rolle: 'Rollemerker',
        }

        return (
          <div key={category} className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-text-secondary">
              {categoryLabels[category]}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {badges.map((badge, i) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="p-3 text-center opacity-40">
                    <div className="text-2xl mb-1">{badge.icon}</div>
                    <p className="text-xs font-medium leading-tight">{badge.name}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
