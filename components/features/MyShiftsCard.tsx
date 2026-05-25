'use client'

import { Check } from 'lucide-react'
import type { ShiftWithClaims } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftTime, roleIcon } from '@/lib/shifts/utils'

interface Props {
  shifts: ShiftWithClaims[]
  currentUserId: string
  onShiftClick: (shift: ShiftWithClaims) => void
}

export function MyShiftsCard({ shifts, currentUserId, onShiftClick }: Props) {
  const mine = shifts.filter(s => s.claims?.some(c => c.user_id === currentUserId))
  if (mine.length === 0) return null

  return (
    <section className="rounded-3xl bg-accent/5 border border-accent/20 p-5">
      <h2 className="text-xs uppercase tracking-wide text-accent font-semibold mb-3">Dine vakter</h2>

      <div className="space-y-2">
        {mine.map(s => (
          <button
            key={s.id}
            onClick={() => onShiftClick(s)}
            className="w-full rounded-2xl bg-surface shadow-soft p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
          >
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xl shrink-0">{roleIcon(s.role)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{formatShiftDate(s.shift_date)}</div>
              <div className="text-xs text-foreground/60">
                {formatShiftTime(s.start_time)}–{formatShiftTime(s.end_time)} · {s.role}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
