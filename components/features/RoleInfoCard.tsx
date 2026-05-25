'use client'

import { ClipboardList } from 'lucide-react'
import type { RoleInfo } from '@/lib/types/shifts'
import { roleIcon } from '@/lib/shifts/utils'

interface Props {
  roleInfo: RoleInfo[]
}

export function RoleInfoCard({ roleInfo }: Props) {
  if (!roleInfo || roleInfo.length === 0) return null

  return (
    <section className="rounded-3xl bg-card shadow-sm p-5">
      <header className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-display font-semibold tracking-tight">Oppgaver</h2>
      </header>

      <div className="space-y-5">
        {roleInfo.map((r) => (
          <div key={r.role}>
            <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
              <span>{roleIcon(r.role)}</span>
              {r.role}
            </h3>
            <ul className="space-y-1.5 ml-2">
              {r.tasks.map((t, i) => (
                <li key={i} className="text-sm text-text-secondary flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
