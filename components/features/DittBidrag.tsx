'use client'

import { useEffect, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ShoppingBag, FileText, Cake, Gift, Calendar, Coins, Ticket, Beef, IceCream2, CakeSlice, CupSoda, Recycle, Heart } from 'lucide-react'
import type { DittBidragData } from '@/lib/mock/data'

interface DittBidragProps {
  data: DittBidragData
}

type Motion = 'pop' | 'wiggle' | 'spin'

// Korps-total bidragsoversikt. Hvert stat-kort har en egen mikroanim på hover.
const stats: Array<{
  key: keyof DittBidragData
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  motion: Motion
}> = [
  { key: 'sekkerPant', label: 'SEKKER PANT', icon: ShoppingBag, motion: 'pop' },
  { key: 'lapperDeltUt', label: 'LAPPER DELT UT', icon: FileText, motion: 'pop' },
  { key: 'kakerBakt', label: 'KAKER BAKT', icon: Cake, motion: 'wiggle' },
  { key: 'premierSkaffet', label: 'PREMIER SKAFFET', icon: Gift, motion: 'pop' },
  { key: 'loddbokerSolgt', label: 'SOLGTE LODDBØKER', icon: Ticket, motion: 'pop' },
  { key: 'dugnader', label: 'DUGNADER', icon: Calendar, motion: 'pop' },
  { key: 'polserSolgt', label: 'PØLSER SOLGT', icon: Beef, motion: 'wiggle' },
  { key: 'isSolgt', label: 'IS SOLGT', icon: IceCream2, motion: 'wiggle' },
  { key: 'kakestykkerSolgt', label: 'KAKESTYKKER SOLGT', icon: CakeSlice, motion: 'wiggle' },
  { key: 'brusSolgt', label: 'BRUS SOLGT', icon: CupSoda, motion: 'pop' },
  { key: 'literSoppel', label: 'LITER SØPPEL PLUKKET', icon: Recycle, motion: 'spin' },
  { key: 'kronerOpptjent', label: 'KRONER OPPTJENT', icon: Coins, motion: 'spin' },
]

// Formater tall med mellomrom (norsk standard)
function formatNumber(n: number): string {
  return n.toLocaleString('nb-NO')
}

// Animert tall som teller opp fra 0 når kortet kommer inn i view
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
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target, duration])

  return <span ref={ref}>{formatNumber(current)}</span>
}

// Ett enkelt stat-kort med sheen-sweep, ikon-anim og tall-skala på hover
function StatTile({
  Icon, value, label, motion: motionType, delay,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  value: number
  label: string
  motion: Motion
  delay: number
}) {
  const [hover, setHover] = useState(false)

  const iconTransform = hover
    ? motionType === 'spin' ? 'rotate(360deg) scale(1.12)'
      : motionType === 'wiggle' ? 'rotate(-9deg) scale(1.16)'
      : 'translateY(-3px) scale(1.2)'
    : 'none'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        opacity: { delay, duration: 0.25 },
        scale: { delay, type: 'spring', stiffness: 300, damping: 25 },
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative overflow-hidden rounded-[18px] text-center cursor-default"
      style={{
        background: hover ? 'rgba(162,74,51,0.07)' : 'var(--color-surface-low)',
        padding: '22px 14px 18px',
        boxShadow: hover ? '0 12px 26px rgba(160,120,80,0.18)' : '0 0 0 rgba(0,0,0,0)',
        transform: hover ? 'translateY(-5px)' : 'none',
        transition: 'transform .3s cubic-bezier(.3,1.3,.5,1), box-shadow .3s, background .25s',
      }}
    >
      {/* Sheen-sweep over kortet ved hover */}
      <span
        aria-hidden
        className="absolute top-0 left-0 h-full pointer-events-none"
        style={{
          width: '60%',
          background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.5), transparent)',
          transform: hover ? 'translateX(320%)' : 'translateX(-120%)',
          transition: 'transform .7s ease',
        }}
      />

      {/* Ikon — egen anim per motion-type */}
      <span
        className="inline-flex text-accent"
        style={{ transform: iconTransform, transition: 'transform .45s cubic-bezier(.3,1.4,.5,1)' }}
      >
        <Icon size={26} strokeWidth={1.8} />
      </span>

      {/* Tall — vokser og skifter farge ved hover */}
      <div
        className="font-[var(--font-display)] font-extrabold whitespace-nowrap"
        style={{
          fontSize: 28,
          letterSpacing: '-0.02em',
          color: hover ? 'var(--color-accent-hover)' : 'var(--color-accent)',
          lineHeight: 1,
          marginTop: 8,
          transform: hover ? 'scale(1.08)' : 'none',
          transition: 'transform .3s cubic-bezier(.3,1.4,.5,1), color .2s',
        }}
      >
        <AnimatedNumber target={value} duration={1.1 + delay} />
      </div>

      {/* Etikett */}
      <div
        className="text-text-secondary"
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1.3,
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </motion.div>
  )
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
        <h3 className="font-semibold text-[15px] font-[var(--font-display)]">Sammen har vi i {new Date().getFullYear()}</h3>
      </div>

      {/* 2 kolonner på mobil, 4 kolonner på desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatTile
            key={s.key}
            Icon={s.icon}
            value={data[s.key]}
            label={s.label}
            motion={s.motion}
            delay={i * 0.08}
          />
        ))}
      </div>
    </motion.div>
  )
}
