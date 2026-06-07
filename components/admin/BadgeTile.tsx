'use client'

// Rund merke-flis brukt i medlem-overlay. Viser et 66px sirkel-bilde med
// status-markør (grønn hake / accent x-N / stiplet pluss) og navnet under.
// `awarded`/`bumped` brukes til animasjon når et nytt merke deles ut.

import { motion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'

interface Props {
  name: string
  icon: string
  earned: boolean
  count: number
  onClick: () => void
  awarded?: boolean
  bumped?: boolean
}

export default function BadgeTile({ name, icon, earned, count, onClick, awarded, bumped }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-3 px-0.5 pb-2.5 rounded-2xl bg-transparent active:opacity-70"
    >
      <div className="relative w-[66px] h-[66px]">
        {/* Ring-pop ved tildeling */}
        {awarded && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute -inset-[5px] rounded-full border-[3px] border-accent pointer-events-none"
          />
        )}
        {/* Sirkel med selve merke-ikonet */}
        <motion.div
          initial={false}
          animate={awarded ? { scale: [0.5, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.55, ease: [0.3, 1.4, 0.5, 1] }}
          className="w-[66px] h-[66px] rounded-full overflow-hidden bg-card"
          style={{
            boxShadow: earned
              ? '0 2px 10px rgba(160,120,80,.18)'
              : 'inset 0 0 0 1.5px rgba(57,56,43,.08)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={icon}
            alt={name}
            loading="lazy"
            className="w-full h-full object-contain transition-[filter,opacity] duration-[450ms]"
            style={{
              // multiply slår ut den lyse bakgrunnen i PNG-ene
              transform: 'scale(0.82)',
              mixBlendMode: 'multiply',
              filter: earned ? 'none' : 'grayscale(1)',
              opacity: earned ? 1 : 0.4,
            }}
          />
        </motion.div>
        {/* Status-markør nederst til høyre */}
        {earned && count > 1 && (
          <motion.span
            initial={false}
            animate={bumped ? { scale: [1, 1.45, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, ease: [0.3, 1.4, 0.5, 1] }}
            className="absolute -bottom-0.5 -right-0.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent text-white text-[10.5px] font-bold flex items-center justify-center"
            style={{
              border: '2.5px solid var(--color-bg)',
              boxShadow: '0 2px 6px rgba(162,74,51,.3)',
            }}
          >
            ×{count}
          </motion.span>
        )}
        {earned && count === 1 && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-success text-white flex items-center justify-center"
            style={{ border: '2.5px solid var(--color-bg)' }}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {!earned && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-card text-accent flex items-center justify-center"
            style={{ border: '2px dashed var(--color-accent)' }}
          >
            <Plus size={12} strokeWidth={2.5} />
          </span>
        )}
      </div>
      <span
        className={`text-[11.5px] font-semibold text-center leading-tight ${
          earned ? 'text-text-secondary' : 'text-text-tertiary'
        }`}
      >
        {name}
      </span>
    </button>
  )
}
