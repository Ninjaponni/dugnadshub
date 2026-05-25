'use client'

import { ChevronRight } from 'lucide-react'
import type { ShiftWithClaims } from '@/lib/types/shifts'
import { formatShiftRange, formatCapacity, shiftFillStatus, roleIcon, formatClaimedByList } from '@/lib/shifts/utils'

interface Props {
  shift: ShiftWithClaims
  onClick: () => void
  currentUserId?: string
}

export function ShiftListItem({ shift, onClick, currentUserId }: Props) {
  const claimed = shift.claims?.length ?? 0
  const status = shiftFillStatus(claimed, shift.capacity)
  const meClaimed = currentUserId && shift.claims?.some(c => c.user_id === currentUserId)
  const claimedByText = formatClaimedByList(shift.claims, currentUserId)

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
          {formatShiftRange(shift.start_time, shift.end_time)}
        </div>
        {claimedByText && (
          <div className="text-xs text-amber-700 mt-1 truncate">
            {claimedByText}
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div className={`text-sm font-medium ${capacityClass}`}>
          {formatCapacity(claimed, shift.capacity)}
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-text-tertiary shrink-0" />
    </button>
  )
}
