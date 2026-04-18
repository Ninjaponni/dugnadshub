'use client'

import { useEffect, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ShoppingBag, FileText, Cake, Gift, Calendar, Coins } from 'lucide-react'
import { Heart } from 'lucide-react'
import type { DittBidragData } from '@/lib/mock/data'

interface DittBidragProps {
  data: DittBidragData
}

// Korps-total bidragsoversikt — 2x3 grid med årets dugnadsinnsats
const stats = [
  { key: 'sekkerPant' as const, label: 'SEKKER PANT', icon: ShoppingBag },
  { key: 'lapperDeltUt' as const, label: 'LAPPER DELT UT', icon: FileText },
  { key: 'kakerBakt' as const, label: 'KAKER BAKT', icon: Cake },
  { key: 'premierSkaffet' as const, label: 'PREMIER SKAFFET', icon: Gift },
  { key: 'dugnader' as const, label: 'DUGNADER', icon: Calendar },
  { key: 'kronerOpptjent' as const, label: 'KRONER OPPTJENT', icon: Coins },
]

// Formater tall med mellomrom (norsk standard)
function formatNumber(n: number): string {
  return n.toLocaleString('nb-NO')
}

// Animert tall som teller opp fra 0
function AnimatedNumber({ target, duration = 1.2 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!inView) return
    const start = Date.now()
    const step = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / (duration * 1000), 1)
      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target, duration])

  return <span ref={ref}>{formatNumber(current)}</span>
}

export default function DittBidrag({ data }: DittBidragProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="card p-5 mb-4"
    >
      {/* Overskrift */}
      <div className="flex items-center gap-2 mb-4">
        <Heart size={18} className="text-accent" fill="currentColor" />
        <h3 className="font-semibold text-[15px] font-[var(--font-display)]">Sammen har vi</h3>
      </div>

      {/* 2x3 grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ key, label, icon: Icon }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className="bg-surface-low rounded-[20px] p-4 text-center"
          >
            <Icon size={20} className="text-accent mx-auto mb-2" strokeWidth={1.8} />
            <p className="text-2xl font-bold text-accent font-[var(--font-display)]">
              <AnimatedNumber target={data[key]} duration={1.2 + i * 0.15} />
            </p>
            <p className="text-[10px] font-semibold text-text-secondary tracking-wide mt-1">
              {label}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
