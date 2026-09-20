'use client'

import { ClipboardList } from 'lucide-react'
import type { RoleInfo } from '@/lib/types/shifts'
import { roleIcon, splitRoleInfo } from '@/lib/shifts/utils'

interface Props {
  roleInfo: RoleInfo[]
  arrangerName?: string | null
  // Roller som faktisk har vakter — brukes til å skille ut felles lister
  shiftRoles?: string[]
}

export function RoleInfoCard({ roleInfo, arrangerName, shiftRoles = [] }: Props) {
  if (!roleInfo || roleInfo.length === 0) return null
  const { common, roles, commonTasks } = splitRoleInfo(roleInfo, shiftRoles)
  const contactLabel = arrangerName ? `Ansvarlig hos ${arrangerName}` : 'Ansvarlig'

  return (
    <section className="rounded-3xl bg-card shadow-sm p-5">
      <header className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-display font-semibold tracking-tight">Oppgaver</h2>
      </header>

      {/* Felles oppgaver én gang øverst — gjentas ikke under hver rolle */}
      {common.map((r) => (
        <div key={r.role} className="rounded-2xl bg-surface-low px-4 py-3.5 mb-5">
          <h3 className="font-medium text-text-primary mb-2">{r.role}</h3>
          <ul className="space-y-1.5">
            {r.tasks.map((t, i) => (
              <li key={i} className="text-sm text-text-secondary flex gap-2">
                <span className="text-accent">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="space-y-5">
        {roles.map((r) => (
          <div key={r.role}>
            <h3 className="font-medium text-text-primary mb-1 flex items-center gap-2">
              <span>{roleIcon(r.role)}</span>
              {r.role}
            </h3>
            {r.contact && (
              <p className="text-xs text-text-tertiary mb-2 ml-7">{contactLabel}: {r.contact}</p>
            )}
            <ul className="space-y-1.5 ml-2 mt-2">
              {r.tasks.filter(t => !commonTasks.has(t)).map((t, i) => (
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
