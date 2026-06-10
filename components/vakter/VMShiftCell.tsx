'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import SeatDots from './SeatDots'

// Flat vakt-celle som bor inni vaktplan-rutenettet (ikke et flytende kort).
// Viser tid, navn på påmeldte (sosialt bevis) og plass-status.
type Props = {
  time: string
  capacity: number
  people: string[] // visningsnavn; "Du" for innlogget bruker
  mine?: boolean
  onClick: () => void
}

export default function VMShiftCell({ time, capacity, people, mine, onClick }: Props) {
  const [hover, setHover] = useState(false)
  const claimed = people.length
  const left = capacity - claimed
  const full = left <= 0
  const muted = full && !mine

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full text-left rounded-xl px-[15px] py-2.5 flex items-center gap-3 transition-all"
      style={{
        background: mine ? 'rgba(162,74,51,0.06)' : hover ? 'var(--color-surface-low)' : 'transparent',
        boxShadow: mine ? 'inset 2.5px 0 0 var(--color-accent)' : 'none',
        opacity: muted && !hover ? 0.55 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-semibold tabular-nums text-text-primary -tracking-[0.02em]">{time}</div>
        <div className="text-xs mt-0.5 leading-snug">
          {people.length === 0 ? (
            <span className="text-text-tertiary">Ingen påmeldt ennå</span>
          ) : (
            people.map((p, i) => (
              <span key={i}>
                {i > 0 && <span className="text-text-primary/30"> · </span>}
                <span className={p === 'Du' ? 'text-accent font-bold' : 'text-text-secondary font-medium'}>{p}</span>
              </span>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <SeatDots cap={capacity} claimed={claimed} mine={mine} />
        <span className="text-[10.5px] font-bold" style={{ color: full ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
          {full ? 'Fullt' : `${left} ledig${left === 1 ? '' : 'e'}`}
        </span>
      </div>
      <ChevronRight size={15} className="text-text-tertiary shrink-0 transition-opacity" style={{ opacity: hover ? 0.7 : 0.3 }} />
    </button>
  )
}
