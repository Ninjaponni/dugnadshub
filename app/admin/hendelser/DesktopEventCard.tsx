'use client'

// Desktop-kortfamilien for hendelses-admin (kun synlig på lg+).
// Matcher prototypens views-admin-hendelser.jsx 1:1 — flyttet ut av
// page.tsx (som var 3000+ linjer) uten atferdsendring.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Recycle, FileText, Trash2, Music, Ticket, Cake, Calendar, ChevronDown, MapPin, Zap, Pencil, Bell, Power, Check, Download, Map as MapIcon } from 'lucide-react'
import type { EventStatus, EventType } from '@/lib/supabase/types'
import { typeLabels, areaLabels, type EventWithZones } from './shared'

// Fargedot brukt i SegmentBar-legend
export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────
// Desktop-komponenter (kun synlig på lg+). Matcher prototypens
// views-admin-hendelser.jsx 1:1. Mobile-flyten under er urørt.
// ──────────────────────────────────────────────────────────────

// Per-type ikon, dempet behandling
const TYPE_ICON: Record<EventType, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  bottle_collection: Recycle,
  lapper: FileText,
  plast: Trash2,
  arrangement: Music,
  lottery: Ticket,
  baking: Cake,
  other: Calendar,
}

// Medallion — 46px rounded square med per-type ikon
function DesktopMedallion({ type, size = 46, hovered }: { type: EventType; size?: number; hovered: boolean }) {
  const Icon = TYPE_ICON[type] || Calendar
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        flexShrink: 0,
        background: hovered ? 'rgba(162,74,51,0.10)' : 'var(--color-surface-low)',
        color: hovered ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        transform: hovered ? 'scale(1.08) rotate(-4deg)' : 'none',
        transition: 'background .22s, color .22s, transform .28s cubic-bezier(.34,1.56,.64,1)',
      }}
      className="flex items-center justify-center"
    >
      <Icon size={Math.round(size * 0.44)} strokeWidth={1.8} />
    </div>
  )
}

// Progress-bar med grow-in animasjon. mode='segmented' for aktive
// sone-baserte (accent for ferdig, accent@38% for pågår). Ellers
// solid fill.
function DesktopProgressBar({
  pct,
  completed,
  claimed,
  mode,
  color,
  height = 8,
}: {
  pct: number
  completed: number
  claimed: number
  mode: 'segmented' | 'fill'
  color: string
  height?: number
}) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const filled = grown ? pct : 0
  return (
    <div style={{ height, background: 'var(--color-surface-low)', borderRadius: 9999, overflow: 'hidden' }}>
      <div
        style={{
          width: `${filled}%`,
          height: '100%',
          display: 'flex',
          borderRadius: 9999,
          overflow: 'hidden',
          transition: 'width 1s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {mode === 'segmented' && claimed > 0 ? (
          <>
            <div style={{ width: `${(completed / claimed) * 100}%`, background: 'var(--color-accent)' }} />
            <div style={{ flex: 1, background: 'rgba(162,74,51,0.38)' }} />
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: color }} />
        )}
      </div>
    </div>
  )
}

// Knapp-stiler matcher prototypens Btn(variant). Vi reimplementerer
// dem her i Tailwind for ikke å rote til eksisterende Button-komp.
type ActionVariant = 'primaryGhost' | 'ghost' | 'confirmGhost' | 'secondary'
function EventActionButton({
  variant,
  icon,
  onClick,
  disabled,
  children,
  tone = 'secondary',
}: {
  variant: ActionVariant
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  tone?: 'secondary' | 'tertiary'
}) {
  const base = 'inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed'
  let cls = ''
  if (variant === 'primaryGhost') {
    cls = 'bg-transparent text-accent ring-1 ring-inset ring-accent hover:bg-accent hover:text-white'
  } else if (variant === 'confirmGhost') {
    cls = 'bg-transparent text-success ring-1 ring-inset ring-success hover:bg-success hover:text-white'
  } else if (variant === 'secondary') {
    cls = 'bg-surface-low text-text-secondary hover:bg-surface-low/70'
  } else {
    // ghost
    const toneCls = tone === 'tertiary' ? 'text-text-tertiary' : 'text-text-secondary'
    cls = `bg-transparent ${toneCls} hover:bg-surface-low`
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${cls}`}>
      {icon}
      {children}
    </button>
  )
}

// Desktop-status-pill med valgfri live-dot
function DesktopStatusPill({ status }: { status: EventStatus }) {
  const label = status === 'active' ? 'Aktiv' : status === 'upcoming' ? 'Kommende' : 'Fullført'
  const bg = status === 'active' ? 'bg-success/10 text-success' : 'bg-text-primary/[0.08] text-text-secondary'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] ${bg}`}>
      {status === 'active' && (
        <span
          className="w-[7px] h-[7px] rounded-full bg-success"
          style={{ animation: 'pulse 1.6s ease-in-out infinite' }}
        />
      )}
      {label}
    </span>
  )
}

// Hovedkortet for desktop. Matcher prototypens EventCard.
export function DesktopEventCard({
  event,
  zoneBased,
  total,
  claimed,
  completed,
  available,
  pct,
  unit,
  onActivate,
  onDeactivate,
  onComplete,
  onDelete,
  onEdit,
  onSendHelp,
  onExportCSV,
  onShowDetails,
  exporting,
  updatingId,
}: {
  event: EventWithZones
  zoneBased: boolean
  total: number
  claimed: number
  completed: number
  available: number
  pct: number
  unit: 'soner' | 'vakter'
  onActivate: () => void
  onDeactivate: () => void
  onComplete: () => void
  onDelete: () => void
  onEdit: () => void
  onSendHelp: () => void
  onExportCSV: () => void
  onShowDetails: () => void
  exporting: boolean
  updatingId: string | null
}) {
  const [hov, setHov] = useState(false)
  // Aktive kort er alltid ekspandert (man bør se hva som må gjøres). Andre starter
  // kollapset med kun overskrift + progress, action-footer vises kun ved klikk.
  const featured = event.status === 'active'
  const [expanded, setExpanded] = useState(featured)
  const isDone = event.status === 'completed'
  const updating = updatingId === event.id

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="bg-card border border-text-primary/[0.09] overflow-hidden flex flex-col h-full"
      style={{
        borderRadius: featured ? 26 : 22,
        transition: 'box-shadow .22s, transform .22s cubic-bezier(.34,1.56,.64,1)',
        transform: hov && !featured ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? '0 16px 38px rgba(160,120,80,.2)' : '0 10px 34px rgba(160,120,80,0.16)',
      }}
    >
      <div style={{ padding: featured ? '26px 28px 24px' : '20px 22px 18px', flex: 1 }}>
        {/* Header — klikkbar toggler action-footer (kun for ikke-aktive kort) */}
        <div
          className={`flex items-start gap-[15px] ${!featured ? 'cursor-pointer select-none' : ''}`}
          onClick={!featured ? () => setExpanded(e => !e) : undefined}
        >
          <DesktopMedallion type={event.type} size={featured ? 54 : 46} hovered={hov} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2.5">
              <span
                className="text-[11px] font-bold uppercase whitespace-nowrap text-text-tertiary"
                style={{ letterSpacing: '0.11em' }}
              >
                {typeLabels[event.type]}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <DesktopStatusPill status={event.status} />
                {!featured && (
                  <ChevronDown
                    size={16}
                    className="text-text-tertiary transition-transform"
                    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                )}
              </div>
            </div>
            <div
              className="font-[var(--font-display)] font-extrabold mt-1"
              style={{
                fontSize: featured ? 22 : 18,
                letterSpacing: '-0.015em',
                lineHeight: 1.15,
              }}
            >
              {event.title}
            </div>
            <div className="flex items-center gap-3 text-[13px] text-text-secondary mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Calendar size={13} className="text-text-tertiary" />
                {event.date}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-text-tertiary">
                <MapPin size={12} />
                {areaLabels[event.area]}
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        {total > 0 && (
          <div style={{ marginTop: featured ? 22 : 16 }}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] font-bold text-text-secondary whitespace-nowrap">
                {claimed + completed}/{total} {unit} {zoneBased ? 'tatt' : 'fylt'}
              </span>
              <span
                className="font-[var(--font-display)] font-extrabold"
                style={{
                  fontSize: featured ? 17 : 15,
                  color: isDone ? 'var(--color-success)' : 'var(--color-accent)',
                }}
              >
                {pct}%
              </span>
            </div>
            <DesktopProgressBar
              pct={pct}
              completed={completed}
              claimed={claimed + completed}
              mode={featured && zoneBased ? 'segmented' : 'fill'}
              color={isDone ? 'var(--color-success)' : 'var(--color-accent)'}
              height={featured ? 12 : 8}
            />
            {featured && zoneBased && (
              <div className="flex gap-[18px] flex-wrap mt-3">
                {completed > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
                    {completed} ferdig
                  </span>
                )}
                {claimed > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
                    <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(162,74,51,0.38)' }} />
                    {claimed} pågår
                  </span>
                )}
                {available > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
                    <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(57,56,43,0.18)' }} />
                    {available} ledige
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resultat for fullført */}
        {isDone && (
          <div className="mt-4 text-[13.5px] text-text-secondary">
            {zoneBased && event.bags_collected ? (
              <>
                <b className="font-[var(--font-display)] text-base text-text-primary">{event.bags_collected}</b>{' '}
                sekker samlet inn
              </>
            ) : zoneBased && total > 0 ? (
              // Sone-basert: alle soner er som regel ferdige når dugnaden lukkes
              <>
                <b className="font-[var(--font-display)] text-base text-text-primary">Alle {total}</b> {unit} fullført
              </>
            ) : !zoneBased && total > 0 ? (
              // Arrangement: vis faktisk fylt antall, ikke en hardkodet «alle»
              <>
                <b className="font-[var(--font-display)] text-base text-text-primary">{claimed + completed}</b> av {total} {unit} fylt
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Actions — kun synlig når kortet er ekspandert. Aktive er alltid ekspandert. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="flex flex-wrap items-center gap-[9px]"
              style={{
                padding: '14px 22px',
                background: 'var(--color-surface-low)',
                borderTop: '1px solid rgba(57,56,43,0.05)',
              }}
            >
        {event.status === 'upcoming' && (
          <>
            <EventActionButton variant="primaryGhost" icon={<Zap size={15} />} onClick={onActivate} disabled={updating}>
              Aktiver
            </EventActionButton>
            <EventActionButton variant="ghost" icon={<Pencil size={14} />} onClick={onEdit}>
              Rediger
            </EventActionButton>
            <EventActionButton variant="ghost" icon={<ChevronDown size={14} />} onClick={onShowDetails}>
              Detaljer
            </EventActionButton>
            <span className="flex-1" />
            <EventActionButton variant="ghost" tone="tertiary" icon={<Trash2 size={14} />} onClick={onDelete}>
              Slett
            </EventActionButton>
          </>
        )}
        {event.status === 'active' && (
          <>
            {/* Skjul "Se kart" for arrangement-events */}
            {event.type !== 'arrangement' && (
              <Link
                href={`/kart?event=${event.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full text-text-secondary hover:bg-card transition-colors whitespace-nowrap"
              >
                <MapIcon size={14} />
                Se kart
              </Link>
            )}
            {available > 0 && (
              <EventActionButton variant="ghost" icon={<Bell size={14} />} onClick={onSendHelp}>
                Send hjelp-varsel ({available})
              </EventActionButton>
            )}
            <EventActionButton variant="ghost" icon={<Pencil size={14} />} onClick={onEdit}>
              Rediger
            </EventActionButton>
            <EventActionButton variant="ghost" icon={<ChevronDown size={14} />} onClick={onShowDetails}>
              Detaljer
            </EventActionButton>
            <EventActionButton variant="ghost" icon={<Power size={14} />} onClick={onDeactivate} disabled={updating}>
              Deaktiver
            </EventActionButton>
            <span className="flex-1" />
            <EventActionButton variant="confirmGhost" icon={<Check size={15} strokeWidth={3} />} onClick={onComplete} disabled={updating}>
              Marker fullført
            </EventActionButton>
          </>
        )}
        {event.status === 'completed' && (
          <>
            <EventActionButton variant="secondary" icon={<Download size={14} />} onClick={onExportCSV} disabled={exporting}>
              {exporting ? 'Eksporterer...' : 'Eksporter CSV'}
            </EventActionButton>
            <EventActionButton variant="ghost" icon={<Pencil size={14} />} onClick={onEdit}>
              Rediger
            </EventActionButton>
            <EventActionButton variant="ghost" icon={<ChevronDown size={14} />} onClick={onShowDetails}>
              Detaljer
            </EventActionButton>
            <span className="flex-1" />
            <EventActionButton variant="ghost" tone="tertiary" icon={<Trash2 size={14} />} onClick={onDelete}>
              Slett
            </EventActionButton>
          </>
        )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
