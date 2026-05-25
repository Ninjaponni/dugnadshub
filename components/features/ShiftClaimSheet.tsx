'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Users, Phone } from 'lucide-react'
import type { ShiftWithClaims, RoleInfo } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftTime, roleIcon, isDeadlinePassed } from '@/lib/shifts/utils'

interface Props {
  shift: ShiftWithClaims | null
  onClose: () => void
  onChange: () => void
  currentUserId?: string
  signupDeadline: string | null
  adminPhone: string | null
  roleInfo: RoleInfo[] | null
}

export function ShiftClaimSheet({
  shift, onClose, onChange, currentUserId, signupDeadline, adminPhone, roleInfo,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!shift) return null

  const meClaimed = currentUserId && shift.claims?.some(c => c.user_id === currentUserId)
  const claimed = shift.claims?.length ?? 0
  const isFull = claimed >= shift.capacity
  const deadlinePassed = isDeadlinePassed(signupDeadline)
  const taskList = roleInfo?.find(r => r.role === shift.role)?.tasks ?? []

  async function handleClaim() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift!.id}/claim`, { method: 'POST' })
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
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift!.id}/claim`, { method: 'DELETE' })
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
    <AnimatePresence>
      {shift && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-20"
          >
            <header className="sticky top-0 bg-card px-5 pt-5 pb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{roleIcon(shift.role)}</span>
                  <h2 className="text-xl font-display font-semibold tracking-tight uppercase">{shift.role}</h2>
                </div>
                <div className="mt-1 text-text-secondary text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatShiftDate(shift.shift_date)} · {formatShiftTime(shift.start_time)}–{formatShiftTime(shift.end_time)}
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-card-low/60">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="px-5 space-y-5">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-text-tertiary mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Påmeldte ({claimed}/{shift.capacity})
                </h3>
                {claimed === 0 ? (
                  <p className="text-sm text-text-tertiary italic">Ingen påmeldt enda</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {shift.claims!.map((c) => (
                      <li key={c.user_id} className="flex items-center gap-2">
                        <span className="text-accent">•</span>
                        <span>{c.profile?.full_name ?? 'Anonym'}</span>
                        {c.user_id === currentUserId && (
                          <span className="text-xs text-accent">(deg)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {deadlinePassed ? (
                <div className="rounded-2xl bg-amber-100/60 border border-amber-300/60 p-4 text-sm">
                  <div className="font-medium text-amber-900 mb-1">Påmelding stengt</div>
                  <p className="text-amber-900/80">
                    Hvis du må bytte vakt, kontakt admin
                    {adminPhone && (
                      <> på <a href={`tel:${adminPhone}`} className="underline inline-flex items-center gap-1"><Phone className="w-3 h-3" />{adminPhone}</a></>
                    )}.
                  </p>
                </div>
              ) : meClaimed ? (
                <button
                  onClick={handleUnclaim}
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl bg-card-low/60 hover:bg-card-low font-medium disabled:opacity-50"
                >
                  {submitting ? 'Melder av…' : 'Meld meg av'}
                </button>
              ) : isFull ? (
                <button disabled className="w-full py-3 rounded-2xl bg-emerald-100 text-emerald-900 font-medium">
                  Fullt
                </button>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Melder på…' : 'Meld meg på'}
                </button>
              )}

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>
              )}

              {taskList.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-text-tertiary mb-2">Oppgaver</h3>
                  <ul className="space-y-1.5">
                    {taskList.map((t, i) => (
                      <li key={i} className="text-sm text-text-secondary flex gap-2">
                        <span className="text-accent">•</span><span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {shift.notes && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm">
                  <div className="font-medium text-amber-900 mb-1">Merknad</div>
                  <div className="text-amber-900/80">{shift.notes}</div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
