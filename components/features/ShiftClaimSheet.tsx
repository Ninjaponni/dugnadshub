'use client'

import { useState } from 'react'
import { Clock, Users, Phone, Trophy } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import type { ShiftWithClaims, RoleInfo, Match } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftTime, roleIcon, isDeadlinePassed, matchesDuringShift } from '@/lib/shifts/utils'

interface Props {
  shift: ShiftWithClaims | null
  onClose: () => void
  onChange: () => void
  currentUserId?: string
  signupDeadline: string | null
  adminPhone: string | null
  roleInfo: RoleInfo[] | null
  matches?: Match[] | null
}

export function ShiftClaimSheet({
  shift, onClose, onChange, currentUserId, signupDeadline, adminPhone, roleInfo, matches,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meClaimed = !!(shift && currentUserId && shift.claims?.some(c => c.user_id === currentUserId))
  const claimed = shift?.claims?.length ?? 0
  const isFull = shift ? claimed >= shift.capacity : false
  const deadlinePassed = isDeadlinePassed(signupDeadline)
  const taskList = (shift && roleInfo?.find(r => r.role === shift.role)?.tasks) ?? []
  const shiftMatches = shift ? matchesDuringShift(matches, shift) : []

  async function handleClaim() {
    if (!shift) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift.id}/claim`, { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Ukjent feil' }))
      setError(j.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onChange()
    onClose()
  }

  async function handleUnclaim() {
    if (!shift) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift.id}/claim`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Ukjent feil' }))
      setError(j.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onChange()
    onClose()
  }

  return (
    <BottomSheet open={!!shift} onClose={onClose}>
      {shift && (
        <div className="space-y-5">
          {/* Tittel + tid */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{roleIcon(shift.role)}</span>
              <h2 className="text-2xl font-bold font-[var(--font-display)] tracking-tight">{shift.role}</h2>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Clock className="w-4 h-4" />
              {formatShiftDate(shift.shift_date)} · {formatShiftTime(shift.start_time)}–{formatShiftTime(shift.end_time)}
            </div>
          </div>

          {/* Status-rad: kapasitet + meClaimed-badge */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${
              isFull ? 'bg-success/15 text-success' :
              claimed > 0 ? 'bg-warning/20 text-text-primary' :
              'bg-danger/10 text-danger'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isFull ? 'bg-success' : claimed > 0 ? 'bg-warning' : 'bg-danger'
              }`} />
              {isFull ? 'Fullt' : `${shift.capacity - claimed} av ${shift.capacity} ledig`}
            </span>
            {meClaimed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent font-medium">
                ✓ Du er påmeldt
              </span>
            )}
          </div>

          {/* Påmeldte */}
          {claimed > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Påmeldte
              </h3>
              <div className="bg-surface-low/60 rounded-2xl p-3 text-sm text-text-primary leading-relaxed">
                {shift.claims!.map((c, i) => (
                  <span key={c.user_id}>
                    {c.profile?.full_name ?? 'Anonym'}
                    {c.user_id === currentUserId && <span className="text-accent"> (deg)</span>}
                    {i < shift.claims!.length - 1 && <span className="text-text-tertiary"> · </span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Aksjon */}
          {deadlinePassed ? (
            <div className="rounded-2xl bg-warning/10 border border-warning/30 p-4 text-sm">
              <div className="font-semibold text-text-primary mb-1">Påmelding stengt</div>
              <p className="text-text-secondary">
                Hvis du må bytte vakt, kontakt admin
                {adminPhone && (
                  <> på <a href={`tel:${adminPhone}`} className="underline inline-flex items-center gap-1 text-accent font-medium"><Phone className="w-3 h-3" />{adminPhone}</a></>
                )}.
              </p>
            </div>
          ) : meClaimed ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleUnclaim}
              loading={submitting}
              className="w-full"
            >
              Meld meg av
            </Button>
          ) : isFull ? (
            <Button variant="confirm" size="lg" disabled className="w-full">
              Fullt
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={handleClaim}
              loading={submitting}
              className="w-full"
            >
              Meld meg på
            </Button>
          )}

          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl p-3">{error}</div>
          )}

          {/* Kamper under vakta */}
          {shiftMatches.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Kamper under vakta
              </h3>
              <ul className="space-y-1.5">
                {shiftMatches.map((m, i) => (
                  <li key={i} className="text-sm text-text-primary flex gap-3 items-baseline">
                    <span className="font-mono text-text-secondary shrink-0 w-12">{m.time}</span>
                    <span>{m.home} <span className="text-text-tertiary">vs</span> {m.away}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Oppgaver */}
          {taskList.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-2">Oppgaver</h3>
              <ul className="space-y-1.5">
                {taskList.map((t, i) => (
                  <li key={i} className="text-sm text-text-secondary flex gap-2">
                    <span className="text-accent shrink-0">•</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shift.notes && (
            <div className="rounded-2xl bg-warning/10 border border-warning/30 p-3 text-sm">
              <div className="font-semibold text-text-primary mb-1">Merknad</div>
              <div className="text-text-secondary">{shift.notes}</div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
