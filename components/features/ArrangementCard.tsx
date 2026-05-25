'use client'

import Link from 'next/link'
import { Calendar, Sparkles, Clock } from 'lucide-react'
import type { ArrangementEvent } from '@/lib/types/shifts'

interface Props {
  event: ArrangementEvent
  totalShifts: number
  freePlaces: number
}

export function ArrangementCard({ event, totalShifts, freePlaces }: Props) {
  const deadlineText = event.signup_deadline
    ? new Date(event.signup_deadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
    : null

  return (
    <Link
      href={`/arrangement/${event.id}`}
      className="block rounded-3xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/30 shadow-soft p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <h3 className="text-lg font-display font-semibold tracking-tight text-balance uppercase">{event.title}</h3>
      </div>

      <div className="space-y-1.5 text-sm text-foreground/70 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" />
          {event.date && new Date(event.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
        </div>
        {deadlineText && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            Påmelding stenger {deadlineText}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium text-foreground">{totalShifts}</span>
          <span className="text-foreground/60"> vakter · </span>
          <span className={`font-medium ${freePlaces > 0 ? 'text-accent' : 'text-emerald-700'}`}>
            {freePlaces > 0 ? `${freePlaces} plasser ledige` : 'Alle plasser fylt'}
          </span>
        </div>
        <div className="text-sm font-medium text-accent">Se vakter →</div>
      </div>
    </Link>
  )
}
