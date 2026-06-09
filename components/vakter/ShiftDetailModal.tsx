'use client'

import { Calendar, Users, FileText, Trophy, Check, Phone } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { ShiftWithClaims, RoleInfo, Match } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftRange, shiftDurationHours, isDeadlinePassed, matchesDuringShift } from '@/lib/shifts/utils'
import { useShiftClaim } from '@/lib/hooks/useShiftClaim'

interface Props {
  shift: ShiftWithClaims | null
  onClose: () => void
  onChange: () => void
  currentUserId?: string
  signupDeadline: string | null
  adminPhone: string | null
  roleInfo: RoleInfo[] | null
  matches?: Match[] | null
  arrangerName?: string | null
}

// Varighet som "3 t" / "2,5 t"
function durLabel(start: string, end: string): string {
  const h = shiftDurationHours(start, end)
  return (Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',')) + ' t'
}

// Liten label-rad (uppercase eyebrow med ikon)
function VMLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-tertiary">
      {icon}{children}
    </span>
  )
}

// Desktop-detalj for en vakt (lg+). Speiler prototypens 540px-modal,
// men bruker delt useShiftClaim-hook så påmelding funker som på mobil.
export default function ShiftDetailModal({
  shift, onClose, onChange, currentUserId, signupDeadline, adminPhone, roleInfo, matches, arrangerName,
}: Props) {
  const { submitting, error, showUnclaimConfirm, setShowUnclaimConfirm, handleClaim, handleUnclaim, reset } =
    useShiftClaim(shift, onChange, onClose)

  const meClaimed = !!(shift && currentUserId && shift.claims?.some(c => c.user_id === currentUserId))
  const claimed = shift?.claims?.length ?? 0
  const left = shift ? shift.capacity - claimed : 0
  const isFull = left <= 0
  const deadlinePassed = isDeadlinePassed(signupDeadline)
  const role = shift ? roleInfo?.find(r => r.role === shift.role) : undefined
  const taskList = role?.tasks ?? []
  const roleContact = role?.contact
  const shiftMatches = shift ? matchesDuringShift(matches, shift) : []

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal open={!!shift} onClose={handleClose} maxWidth={540}>
      {shift && (
        <div className="p-8">
          {/* header */}
          <div className="flex items-center gap-[11px] pr-8">
            <span className="w-[9px] h-[9px] rounded-full bg-accent shrink-0" />
            <h2 className="font-display text-[23px] font-extrabold -tracking-[0.01em] text-text-primary">{shift.role}</h2>
          </div>
          <p className="flex items-center gap-2 text-sm text-text-secondary mt-3.5">
            <Calendar size={15} className="text-text-tertiary" />
            {formatShiftDate(shift.shift_date)}
            <span className="text-text-primary/25">·</span>
            <span className="font-mono tabular-nums -tracking-[0.02em]">{formatShiftRange(shift.start_time, shift.end_time)}</span>
            <span className="text-text-tertiary">({durLabel(shift.start_time, shift.end_time)})</span>
          </p>

          {/* status */}
          <div className="flex gap-2 mt-4 mb-6 flex-wrap">
            <span
              className="inline-flex items-center gap-[7px] text-[12.5px] font-bold px-[13px] py-[5px] rounded-full bg-surface-low"
              style={{ color: isFull ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
            >
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: isFull ? 'var(--color-success)' : 'var(--color-text-tertiary)' }} />
              {isFull ? 'Fullt' : `${left} ledig${left === 1 ? '' : 'e'}`}
            </span>
            {meClaimed && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold px-[13px] py-[5px] rounded-full text-accent" style={{ background: 'rgba(162,74,51,0.09)' }}>
                <Check size={12} strokeWidth={3} />Du er påmeldt
              </span>
            )}
          </div>

          {/* påmeldte */}
          <VMLabel icon={<Users size={13} />}>Påmeldte ({claimed}/{shift.capacity})</VMLabel>
          <div className="bg-surface-low rounded-[14px] px-4 py-3 mt-[9px] text-sm text-text-secondary leading-relaxed">
            {claimed === 0
              ? 'Ingen påmeldt ennå'
              : (shift.claims ?? []).map((c, i, arr) => (
                  <span key={c.user_id}>
                    <span className={c.user_id === currentUserId ? 'text-accent font-bold' : ''}>
                      {c.user_id === currentUserId ? 'Deg' : c.profile?.full_name ?? 'Anonym'}
                    </span>
                    {i < arr.length - 1 && <span className="text-text-tertiary"> · </span>}
                  </span>
                ))}
          </div>

          {/* kamper under vakta */}
          {shiftMatches.length > 0 && (
            <div className="mt-[22px]">
              <VMLabel icon={<Trophy size={13} />}>Kamper under vakta</VMLabel>
              <div className="mt-2.5 flex flex-col gap-[9px]">
                {shiftMatches.map((m, i) => (
                  <div key={i} className="flex items-baseline gap-4 text-sm">
                    <span className="font-mono text-[12.5px] text-text-tertiary font-semibold min-w-[42px]">{m.time}</span>
                    <span>
                      <b className="font-bold">{m.home}</b>
                      {m.away && (<><span className="text-text-tertiary"> mot </span><b className="font-bold">{m.away}</b></>)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* oppgaver */}
          {taskList.length > 0 && (
            <div className="mt-[22px]">
              <div className="flex items-baseline justify-between gap-3">
                <VMLabel icon={<FileText size={13} />}>Oppgaver</VMLabel>
                {roleContact && (
                  <span className="text-xs text-text-tertiary">
                    {arrangerName ? `Ansvarlig hos ${arrangerName}` : 'Ansvarlig'}: <span className="text-text-secondary font-medium">{roleContact}</span>
                  </span>
                )}
              </div>
              <ul className="mt-[11px] flex flex-col gap-[7px]">
                {taskList.map((t, i) => (
                  <li key={i} className="relative pl-4 text-[13.5px] text-text-secondary leading-snug">
                    <span className="absolute left-0 top-[7px] w-[5px] h-[5px] rounded-full bg-accent" />{t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* merknad */}
          {shift.notes && (
            <div className="mt-[22px] rounded-[14px] bg-warning/10 border border-warning/30 p-3.5 text-sm">
              <div className="font-semibold text-text-primary mb-1">Merknad</div>
              <div className="text-text-secondary">{shift.notes}</div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-xl p-3">{error}</div>
          )}

          {/* footer */}
          {deadlinePassed ? (
            <div className="mt-6 rounded-[14px] bg-warning/10 border border-warning/30 px-[18px] py-3.5">
              <div className="font-display text-[14.5px] font-bold text-text-primary mb-0.5">Påmelding stengt</div>
              <div className="text-[13px] text-text-secondary">
                {meClaimed ? 'Hvis du må bytte vakt, kontakt admin' : 'Kontakt admin'}
                {adminPhone && (
                  <> på <a href={`tel:${adminPhone}`} className="text-accent font-bold inline-flex items-center gap-1"><Phone className="w-3 h-3" />{adminPhone}</a></>
                )}.
              </div>
            </div>
          ) : meClaimed ? (
            <div className="mt-6">
              {!showUnclaimConfirm ? (
                <button
                  onClick={() => setShowUnclaimConfirm(true)}
                  disabled={submitting}
                  className="w-full text-danger text-xs font-semibold py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  Meld meg av
                </button>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-warning/20">
                  <div className="bg-warning/5 p-4">
                    <p className="text-sm text-text-primary font-medium mb-1">Er du sikker på at du ikke kan ta vakten?</p>
                    <p className="text-sm text-text-secondary">Hvis du er forhindret fra å delta, setter vi stor pris på om du kan finne noen andre til å ta vakten din.</p>
                  </div>
                  <div className="flex border-t border-warning/20">
                    <button onClick={() => setShowUnclaimConfirm(false)} className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-warning/20 hover:bg-surface-low">Avbryt</button>
                    <button onClick={handleUnclaim} disabled={submitting} className="flex-1 py-3 text-sm font-medium text-danger hover:bg-danger/10">{submitting ? 'Melder av…' : 'Meld meg av'}</button>
                  </div>
                </div>
              )}
            </div>
          ) : isFull ? (
            <div className="mt-6"><Button variant="secondary" size="lg" disabled className="w-full">Vakten er full</Button></div>
          ) : (
            <div className="mt-6">
              <Button variant="primary" size="lg" onClick={handleClaim} loading={submitting} className="w-full">Meld meg på</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
