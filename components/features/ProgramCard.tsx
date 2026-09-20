'use client'

import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import type { ProgramDay } from '@/lib/types/shifts'

interface Props {
  program?: ProgramDay[] | null
}

// Selve programlista — delt mellom mobil-kortet og desktopens VMCollapse
export function ProgramList({ program, className = 'space-y-5' }: { program: ProgramDay[]; className?: string }) {
  return (
    <div className={className}>
      {program.map((day) => (
        <div key={day.date}>
          <h3 className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-2">{day.label}</h3>
          <ul className="space-y-2.5">
            {(day.items ?? []).map((item, i) => {
              const same = item.hk && item.jk && item.hk === item.jk
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="font-mono tabular-nums text-text-secondary shrink-0 w-11">{item.time}</span>
                  <div className="min-w-0">
                    {same ? (
                      <div className="text-text-primary">{item.hk}</div>
                    ) : (
                      <>
                        {item.hk && (
                          <div className="text-text-primary">
                            <span className="text-[10px] uppercase font-semibold text-accent mr-1.5">HK</span>{item.hk}
                          </div>
                        )}
                        {item.jk && (
                          <div className="text-text-primary">
                            <span className="text-[10px] uppercase font-semibold text-accent mr-1.5">JK</span>{item.jk}
                          </div>
                        )}
                      </>
                    )}
                    {item.note && <div className="text-xs text-text-tertiary mt-0.5">{item.note}</div>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

// Sammenleggbart kort for helgeprogrammet — lukket som default siden det
// er referansestoff man sjelden trenger ved første besøk på siden.
export function ProgramCard({ program }: Props) {
  const [open, setOpen] = useState(false)
  if (!program || program.length === 0) return null

  return (
    <section className="rounded-3xl bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 p-5 text-left"
      >
        <CalendarDays className="w-5 h-5 text-accent shrink-0" />
        <h2 className="flex-1 text-lg font-display font-semibold tracking-tight">Helgeprogram</h2>
        <ChevronDown className={`w-5 h-5 text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ProgramList program={program} className="px-5 pb-5 space-y-5" />
      )}
    </section>
  )
}
