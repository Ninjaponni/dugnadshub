'use client'

import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import type { Role, ChildGroup } from '@/lib/supabase/types'
import { ROLE_LABELS } from '@/lib/roles'

// Roller (single-rolle-modell — chips fungerer som radio)
const ROLES: Role[] = ['collector', 'driver', 'strapper', 'host', 'admin']

const TYPES = ['Forelder', 'Musikant'] as const
const GROUPS: ChildGroup[] = ['Aspirant', 'Junior', 'Hovedkorps']

interface Props {
  open: boolean
  name: string
  role: Role
  isMusician: boolean
  musicianGroup: ChildGroup | null
  onClose: () => void
  onRoleChange: (role: Role) => void
  onTypeChange: (isMusician: boolean, group: ChildGroup | null) => void
}

// Bottom sheet for å endre rolle og type for et medlem
export default function RoleEditorSheet(props: Props) {
  const { open, name, role, isMusician, musicianGroup, onClose, onRoleChange, onTypeChange } = props
  const typeValue = isMusician ? 'Musikant' : 'Forelder'

  return (
    <BottomSheet open={open} onClose={onClose} title="Roller og type">
      <p className="text-sm text-text-secondary mb-5 leading-[1.5]">
        Velg rolle og type for {name}. Endringer lagres med en gang.
      </p>

      <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2.5">
        Rolle
      </span>
      <div className="flex flex-wrap gap-2 mb-6">
        {ROLES.map(r => {
          const on = role === r
          return (
            <button
              key={r}
              type="button"
              onClick={() => onRoleChange(r)}
              className={`border-0 text-sm font-semibold py-2.5 px-4 rounded-full transition-all ${
                on
                  ? 'text-white shadow-[0_6px_18px_rgba(162,74,51,0.25)]'
                  : 'bg-surface-low text-text-secondary'
              }`}
              style={on ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' } : {}}
            >
              {ROLE_LABELS[r]}
            </button>
          )
        })}
      </div>

      <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2.5">
        Type
      </span>
      <div className="flex gap-1.5 bg-surface-low rounded-full p-1 mb-3">
        {TYPES.map(t => {
          const on = typeValue === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(t === 'Musikant', t === 'Musikant' ? (musicianGroup ?? 'Aspirant') : null)}
              className={`flex-1 border-0 text-sm font-semibold py-2.5 rounded-full transition-all ${
                on
                  ? 'text-white shadow-[0_6px_18px_rgba(162,74,51,0.25)]'
                  : 'bg-transparent text-text-secondary'
              }`}
              style={on ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' } : {}}
            >
              {t}
            </button>
          )
        })}
      </div>

      {isMusician && (
        <div className="grid grid-cols-3 gap-1.5 mb-5">
          {GROUPS.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => onTypeChange(true, g)}
              className={`text-xs font-semibold py-2 rounded-full ${
                musicianGroup === g
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-surface-low text-text-secondary'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <Button variant="primary" size="lg" className="w-full rounded-full mt-2" onClick={onClose}>
        Ferdig
      </Button>
    </BottomSheet>
  )
}
