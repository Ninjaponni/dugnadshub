'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// 56 avatarer tilgjengelig
const AVATAR_COUNT = 56
const avatarIds = Array.from({ length: AVATAR_COUNT }, (_, i) => {
  const num = String(i + 1).padStart(2, '0')
  return `avatar${num}`
})

// Gir en tilfeldig avatar-id
export function getRandomAvatarId(): string {
  return avatarIds[Math.floor(Math.random() * avatarIds.length)]
}

// Hent URL fra avatar-id
export function getAvatarUrl(avatarId: string): string {
  return `/avatars/${avatarId}.png`
}

interface AvatarPickerProps {
  currentAvatarId: string
  onSelect: (avatarId: string) => void
  onClose: () => void
}

// Fullskjerm avatar-velger med grid
export default function AvatarPicker({ currentAvatarId, onSelect, onClose }: AvatarPickerProps) {
  const [selected, setSelected] = useState(currentAvatarId)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-bg rounded-t-[28px] max-h-[85dvh] flex flex-col safe-bottom"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-xl font-bold font-[var(--font-display)]">Velg avatar</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center">
            <X size={16} className="text-text-secondary" />
          </button>
        </div>

        {/* Valgt avatar preview */}
        <div className="flex justify-center py-3 shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-accent shadow-lg">
            <img src={getAvatarUrl(selected)} alt="Valgt avatar" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-auto flex-1 overscroll-contain px-5 pb-24">
          <div className="grid grid-cols-4 gap-3 py-3">
            {avatarIds.map((id) => {
              const isSelected = id === selected
              return (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelected(id)}
                  className="relative"
                >
                  <div className={`w-full aspect-square rounded-full overflow-hidden transition-all ${
                    isSelected ? 'ring-3 ring-accent scale-105 shadow-md' : 'ring-1 ring-surface-low'
                  }`}>
                    <img
                      src={getAvatarUrl(id)}
                      alt={`Avatar ${id}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Bekreft-knapp */}
        <div className="px-5 py-4 shrink-0">
          <button
            onClick={() => onSelect(selected)}
            className="w-full py-4 rounded-full text-white font-bold text-base active:scale-[0.98] transition-all font-[var(--font-display)]"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
          >
            Bruk denne avataren
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
