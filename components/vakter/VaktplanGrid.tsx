'use client'

import { useMemo, useState } from 'react'
import type { ShiftWithClaims } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftRange, groupShiftsByDate } from '@/lib/shifts/utils'
import VMShiftCell from './VMShiftCell'

// Visningsnavn på påmeldte — innlogget bruker først som "Du".
function displayNames(shift: ShiftWithClaims, currentUserId?: string): string[] {
  const claims = shift.claims ?? []
  return [...claims]
    .sort((a, b) => (a.user_id === currentUserId ? -1 : b.user_id === currentUserId ? 1 : 0))
    .map(c => (c.user_id === currentUserId ? 'Du' : c.profile?.full_name?.split(' ')[0] ?? 'Anonym'))
}

type Props = {
  shifts: ShiftWithClaims[]
  roles: string[]
  currentUserId?: string
  totalCount: number
  openCount: number
  onShiftClick: (shift: ShiftWithClaims) => void
}

// Samlet vaktplan-rutenett: DAG-kolonne + én kolonne per rolle.
// Hver celle kan ha flere vakter (samme rolle, ulik tid) — de stables.
export default function VaktplanGrid({ shifts, roles, currentUserId, totalCount, openCount, onShiftClick }: Props) {
  const [filter, setFilter] = useState<'alle' | 'ledige'>('alle')

  const days = useMemo(() => {
    const filtered = filter === 'ledige'
      ? shifts.filter(s => s.capacity - (s.claims?.length ?? 0) > 0)
      : shifts
    const grouped = groupShiftsByDate(filtered)
    return Array.from(grouped.entries())
      .map(([date, dayShifts]) => ({ date, dayShifts }))
      .filter(d => d.dayShifts.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [shifts, filter])

  const colTemplate = `148px ${roles.map(() => 'minmax(0,1fr)').join(' ')}`

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-[18px] flex-wrap">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-accent">Vaktplan</div>
        <div className="inline-flex bg-surface-low rounded-full p-1 gap-0.5">
          {([['alle', `Alle (${totalCount})`], ['ledige', `Ledige (${openCount})`]] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`font-display text-[13px] font-bold px-4 py-1.5 rounded-full transition-all ${
                filter === k ? 'bg-card text-accent shadow-[0_2px_8px_rgba(160,120,80,0.16)]' : 'text-text-secondary'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div
        className="bg-card rounded-[20px] overflow-hidden border border-text-primary/[0.08]"
        style={{ boxShadow: '0 10px 34px rgba(160,120,80,0.16)' }}
      >
        {/* kolonne-header */}
        <div
          className="grid items-center px-[22px] py-[13px] bg-surface-low border-b border-text-primary/[0.08]"
          style={{ gridTemplateColumns: colTemplate }}
        >
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary">Dag</span>
          {roles.map(r => (
            <span key={r} className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary pl-[15px] truncate">
              {r}
            </span>
          ))}
        </div>

        {days.length === 0 ? (
          <div className="px-[22px] py-9 text-center text-text-tertiary text-sm">
            {filter === 'ledige' ? 'Ingen ledige vakter igjen — alt er fylt opp!' : 'Ingen vakter opprettet enda'}
          </div>
        ) : (
          days.map((day, di) => {
            const full = formatShiftDate(day.date) // "Mandag 15. juni"
            const [weekday, ...rest] = full.split(' ')
            const hasMine = day.dayShifts.some(s => (s.claims ?? []).some(c => c.user_id === currentUserId))
            return (
              <div
                key={day.date}
                className="grid items-stretch"
                style={{
                  gridTemplateColumns: colTemplate,
                  borderTop: di ? '1px solid rgba(57,56,43,0.08)' : 'none',
                  background: hasMine ? 'rgba(162,74,51,0.03)' : 'transparent',
                }}
              >
                <div className="py-[14px] pl-[22px] flex flex-col justify-center">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-tertiary">{weekday}</span>
                  <span className="font-display text-[16.5px] font-bold -tracking-[0.01em] mt-px text-text-primary">{rest.join(' ')}</span>
                </div>
                {roles.map(r => {
                  const cells = day.dayShifts.filter(s => s.role === r)
                  return (
                    <div key={r} className="px-2.5 py-[7px] flex flex-col gap-1 justify-center">
                      {cells.length === 0 ? (
                        <span className="w-full text-center text-[15px]" style={{ color: 'rgba(57,56,43,0.16)' }}>–</span>
                      ) : (
                        cells.map(s => {
                          const mine = (s.claims ?? []).some(c => c.user_id === currentUserId)
                          return (
                            <VMShiftCell
                              key={s.id}
                              time={formatShiftRange(s.start_time, s.end_time)}
                              capacity={s.capacity}
                              people={displayNames(s, currentUserId)}
                              mine={mine}
                              onClick={() => onShiftClick(s)}
                            />
                          )
                        })
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
