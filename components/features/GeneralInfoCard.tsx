'use client'

import { Info } from 'lucide-react'
import type { GeneralInfoEntry } from '@/lib/types/shifts'

interface Props {
  entries: GeneralInfoEntry[]
}

export function GeneralInfoCard({ entries }: Props) {
  if (!entries || entries.length === 0) return null

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <header className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-display font-semibold tracking-tight">Generell informasjon</h2>
      </header>

      <dl className="space-y-3">
        {entries.map((e, i) => (
          <div key={i}>
            <dt className="text-xs uppercase tracking-wide text-foreground/50 mb-0.5">{e.label}</dt>
            <dd className="text-sm text-foreground">{e.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
