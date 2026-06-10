'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Ticket } from 'lucide-react'
import type { ArrangementEvent } from '@/lib/types/shifts'

interface Props {
  event: ArrangementEvent
  totalShifts: number
  freePlaces: number
  totalCapacity: number
}

// Norske ukedager / måneder
const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']

function formatLongDate(isoDate: string, startTime: string | null): string {
  const d = new Date(isoDate + 'T00:00:00')
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`
  if (startTime) return `${base} kl. ${startTime.slice(0, 5)}`
  return base
}

function daysUntilLabel(isoDate: string): string {
  const target = new Date(isoDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'tidligere'
  if (diff === 0) return 'i dag'
  if (diff === 1) return 'i morgen'
  return `om ${diff} dager`
}

export function ArrangementCard({ event, totalShifts, freePlaces, totalCapacity }: Props) {
  const filled = Math.max(0, totalCapacity - freePlaces)
  const progress = totalCapacity > 0 ? Math.round((filled / totalCapacity) * 100) : 0
  const deadlinePassed = event.signup_deadline ? new Date(event.signup_deadline) < new Date() : false

  return (
    <div className="card rounded-[2rem] p-7 relative overflow-hidden lg:hover:-translate-y-0.5 lg:transition-transform lg:duration-200">
      {/* Subtil glow-effekt */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-container/20 rounded-full blur-3xl" />

      <div className="flex justify-between items-start mb-5 relative">
        <div>
          <h2 className="text-2xl font-bold text-text-primary font-[var(--font-display)] mb-1 text-balance">
            {event.title}
          </h2>
          <p className="text-text-secondary font-medium text-sm">
            {formatLongDate(event.date, event.start_time)}
          </p>
        </div>
        <span className="bg-accent/10 text-accent px-3 py-1 rounded-full text-xs font-bold shrink-0">
          {daysUntilLabel(event.date)}
        </span>
      </div>

      {/* Fremdrift */}
      <div className="space-y-2 mb-6 relative">
        <div className="flex justify-between items-end">
          <span className="text-sm font-bold text-text-secondary">
            {filled}/{totalCapacity} vakter fylt
          </span>
          <span className="text-sm font-bold text-accent">{progress}% bemannet</span>
        </div>
        <div className="w-full h-3 bg-surface-low rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(to right, var(--color-accent), var(--color-primary-container))' }}
          />
        </div>
      </div>

      {/* Se vakter-knapp */}
      <Link href={`/arrangement/${event.id}`} className="block relative">
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="w-full py-4 px-6 rounded-full text-white font-bold flex items-center justify-center gap-2 shadow-lg font-[var(--font-display)]"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
        >
          <Ticket size={18} />
          Se vakter
        </motion.button>
      </Link>

      {/* Sub-info: antall plasser + signup deadline. Teller PLASSER (sum kapasitet),
          samme enhet som fremdriftslinja over — ikke vakt-rader. */}
      <p className="text-xs text-text-tertiary mt-3 text-center relative">
        {totalCapacity} {totalCapacity === 1 ? 'vakt' : 'vakter'}
        {event.signup_deadline && !deadlinePassed && (
          <> · Påmelding stenger {new Date(event.signup_deadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}</>
        )}
      </p>

      {deadlinePassed && (
        <div className="mt-3 flex justify-center relative">
          <span className="bg-warning/15 text-text-primary text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            Påmelding stengt, du beholder vaktene
          </span>
        </div>
      )}
    </div>
  )
}
