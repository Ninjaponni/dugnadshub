'use client'

import { useState } from 'react'
import { MapPin, Calendar, FileText, AlertCircle, ChevronRight, Check } from 'lucide-react'
import type { ArrangementEvent, ShiftWithClaims } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftDateShort, sortShifts, isDeadlinePassed } from '@/lib/shifts/utils'
import VaktplanGrid from './VaktplanGrid'

// Rolig uppercase seksjons-etikett
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-accent">{children}</span>
}

// Sammenleggbar referanse-seksjon (progressiv avsløring)
function VMCollapse({ icon, title, subtitle, children, defaultOpen }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="bg-card rounded-[22px] overflow-hidden border border-text-primary/[0.07]" style={{ boxShadow: '0 4px 16px rgba(160,120,80,0.10)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-[13px] px-6 py-[18px] text-left">
        <span className="text-accent inline-flex shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[17.5px] font-bold -tracking-[0.01em] text-text-primary">{title}</h3>
          {subtitle && <div className="text-[12.5px] text-text-tertiary mt-0.5">{subtitle}</div>}
        </div>
        <ChevronRight size={18} className="text-text-tertiary shrink-0 transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-6 pb-6 pt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

type Props = {
  event: ArrangementEvent
  shifts: ShiftWithClaims[]
  currentUserId?: string
  onShiftClick: (shift: ShiftWithClaims) => void
}

// Desktop-visning (lg+) av et arrangement: stat-strip, Dine vakter,
// vaktplan-rutenett (dag × rolle) og sammenleggbar referanse.
export default function ArrangementDesktop({ event, shifts, currentUserId, onShiftClick }: Props) {
  const sorted = sortShifts(shifts)
  const roles = Array.from(new Set(sorted.map(s => s.role)))
  const totalCount = sorted.length
  const openCount = sorted.filter(s => s.capacity - (s.claims?.length ?? 0) > 0).length
  const deadlinePassed = isDeadlinePassed(event.signup_deadline ?? null)

  const mineShifts = sorted.filter(s => (s.claims ?? []).some(c => c.user_id === currentUserId))

  const dateRange = sorted.length > 0
    ? `${formatShiftDateShort(sorted[0].shift_date)} – ${formatShiftDateShort(sorted[sorted.length - 1].shift_date)}`
    : event.date

  const stats: [string, string][] = [
    ['Periode', dateRange],
    ['Vakter', String(totalCount)],
    ['Ledige', String(openCount)],
  ]

  return (
    <div className="max-w-[1060px] flex flex-col gap-6">

      {/* ── header ── */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[32px] font-extrabold -tracking-[0.02em] leading-tight text-text-primary text-balance">{event.title}</h1>
            {deadlinePassed && (
              <span className="inline-flex items-center gap-[7px] text-[12.5px] font-bold mt-3.5 px-3 py-[5px] rounded-full whitespace-nowrap" style={{ color: '#a07a06', background: 'rgba(255,213,79,0.16)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d6a417' }} />Påmelding stengt
              </span>
            )}
          </div>
          {event.meeting_point?.name && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary bg-surface-low px-3.5 py-2 rounded-full shrink-0">
              <MapPin size={15} className="text-accent" />{event.meeting_point.name}
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-[14.5px] text-text-secondary leading-relaxed max-w-[620px] mt-3">{event.description}</p>
        )}

        {/* stat strip */}
        <div className="flex items-stretch flex-wrap gap-y-3.5 mt-[22px]">
          {stats.map(([l, v], i) => (
            <div key={l} className={i ? 'px-[26px] border-l border-text-primary/[0.12]' : 'pr-[26px]'}>
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary mb-1">{l}</div>
              <div className="font-display text-[19px] font-extrabold -tracking-[0.01em] whitespace-nowrap text-text-primary">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── dine vakter ── */}
      {mineShifts.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
            <Eyebrow>Dine vakter{mineShifts.length > 1 ? ` · ${mineShifts.length}` : ''}</Eyebrow>
            {deadlinePassed && <span className="text-[12.5px] text-text-tertiary">Du beholder disse — kontakt admin for å bytte.</span>}
          </div>
          <div className="flex flex-col gap-2.5">
            {mineShifts.map(s => (
              <button
                key={s.id}
                onClick={() => onShiftClick(s)}
                className="text-left w-full rounded-2xl px-5 py-4 flex items-center gap-3.5"
                style={{ background: 'rgba(162,74,51,0.04)', boxShadow: 'inset 0 0 0 1.5px var(--color-accent)' }}
              >
                <span className="w-[3px] self-stretch rounded-full bg-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base font-bold -tracking-[0.01em] text-text-primary">{formatShiftDate(s.shift_date)}</div>
                  <div className="text-[13px] text-text-secondary mt-0.5">
                    <span className="font-mono tabular-nums -tracking-[0.02em]">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span> · {s.role}
                  </div>
                </div>
                <span className="text-[12.5px] font-bold text-accent inline-flex items-center gap-1.5 shrink-0"><Check size={13} strokeWidth={3} />Påmeldt</span>
                <ChevronRight size={16} className="text-text-tertiary" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── vaktplan ── */}
      {sorted.length > 0 ? (
        <VaktplanGrid
          shifts={sorted}
          roles={roles}
          currentUserId={currentUserId}
          totalCount={totalCount}
          openCount={openCount}
          onShiftClick={onShiftClick}
        />
      ) : (
        <div className="bg-card rounded-[20px] p-10 text-center text-text-tertiary text-[15px] border border-text-primary/[0.08]">
          Ingen vakter opprettet enda
        </div>
      )}

      {/* ── referanse ── */}
      {event.role_info && event.role_info.length > 0 && (
        <VMCollapse icon={<FileText size={19} />} title="Oppgaver" subtitle="Hva hver rolle gjør på vakt">
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {event.role_info.map(t => (
              <div key={t.role}>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="font-display text-[15.5px] font-bold text-text-primary">{t.role}</span>
                </div>
                {t.contact && (
                  <div className="text-xs text-text-tertiary mb-[11px] ml-[18px]">
                    {event.arranger_name ? `Ansvarlig hos ${event.arranger_name}` : 'Ansvarlig'}: {t.contact}
                  </div>
                )}
                <ul className="ml-[18px] flex flex-col gap-2 list-none p-0 m-0">
                  {t.tasks.map((it, i) => (
                    <li key={i} className="relative pl-4 text-[13.5px] text-text-secondary leading-snug">
                      <span className="absolute left-0 top-[7px] w-1.5 h-1.5 rounded-full bg-accent" />{it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </VMCollapse>
      )}

      {event.general_info && event.general_info.length > 0 && (
        <VMCollapse icon={<AlertCircle size={19} />} title="Praktisk informasjon" subtitle="Oppmøte, kleskode, betaling og mer">
          <div className="grid gap-x-7 gap-y-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {event.general_info.map(row => (
              <div key={row.label}>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-tertiary mb-1">{row.label}</div>
                <div className="text-sm text-text-secondary leading-relaxed">{row.value}</div>
              </div>
            ))}
          </div>
        </VMCollapse>
      )}

      {event.contact_phone && (
        <div className="text-center text-[13.5px] text-text-tertiary">
          Spørsmål? Kontakt admin på <a href={`tel:${event.contact_phone}`} className="text-accent font-bold no-underline">{event.contact_phone}</a>
        </div>
      )}
    </div>
  )
}
