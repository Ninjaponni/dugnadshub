'use client'

import { ChevronRight } from 'lucide-react'
import type { ShiftWithClaims } from '@/lib/types/shifts'
import { formatShiftTime, formatCapacity, shiftFillStatus, roleIcon } from '@/lib/shifts/utils'

interface Props {
  shift: ShiftWithClaims
  onClick: () => void
  currentUserId?: string
}

export function ShiftListItem({ shift, onClick, currentUserId }: Props) {
  const claimed = shift.claims?.length ?? 0
  const status = shiftFillStatus(claimed, shift.capacity)
  const meClaimed = currentUserId && shift.claims?.some(c => c.user_id === currentUserId)

  const ringClass =
    meClaimed ? 'ring-2 ring-accent' :
    status === 'partial' ? 'ring-2 ring-amber-300/60' :
    status === 'full' ? 'opacity-60' : ''

  const capacityClass =
    status === 'full' ? 'text-emerald-700' :
    status === 'partial' ? 'text-amber-700' :
    'text-text-secondary'

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform ${ringClass}`}
    >
      <span className="text-2xl shrink-0">{roleIcon(shift.role)}</span>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-text-primary truncate">{shift.role}</div>
        <div className="text-sm text-text-secondary">
          {formatShiftTime(shift.start_time)}–{formatShiftTime(shift.end_time)}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className={`text-sm font-medium ${capacityClass}`}>
          {formatCapacity(claimed, shift.capacity)}
        </div>
        {meClaimed && (
          <div className="text-xs text-accent font-medium mt-0.5">✓ Du er på</div>
        )}
      </div>

      <ChevronRight className="w-5 h-5 text-text-tertiary shrink-0" />
    </button>
  )
}
