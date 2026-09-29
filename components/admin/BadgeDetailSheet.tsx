'use client'

import { useEffect, useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { Award, Check, Lock, Plus } from 'lucide-react'
import { STACKABLE_BADGE_CATEGORIES, PARTICIPATION_CATEGORIES, type BadgeCategory } from '@/lib/badges/definitions'
import type { AwardEventOption } from './useMemberDetail'

interface Props {
  open: boolean
  badge: {
    id: number
    name: string
    icon: string
    description: string
    category: BadgeCategory
    auto_criteria: string | null
  } | null
  count: number
  onClose: () => void
  // eventId er null for merker utenfor deltakelseskategoriene, eller ved "Ingen hendelse"
  onAward: (eventId: string | null) => void
  events: AwardEventOption[]
  defaultEventId: string | null
  onRemove: () => void
  // Sender videre til BottomSheet — true når sheeten åpnes i admin-overlay uten BottomNav
  pinToBottom?: boolean
}

// Bottom sheet som viser merke-detaljer og lar admin gi eller fjerne merket.
// Auto-merker er readonly siden de tildeles av systemet.
export default function BadgeDetailSheet({ open, badge, count, onClose, onAward, onRemove, events, defaultEventId, pinToBottom = false }: Props) {
  // Valgt hendelse for deltakelsesmerker. Nullstilles til standardvalget hver gang arket åpnes.
  const [eventId, setEventId] = useState<string | null>(defaultEventId)
  useEffect(() => {
    if (open) setEventId(defaultEventId)
  }, [open, badge?.id, defaultEventId])

  // Hvis ingen merke er valgt, render tom sheet så AnimatePresence kan animere ut
  if (!badge) return <BottomSheet open={open} onClose={onClose} pinToBottom={pinToBottom}><div /></BottomSheet>

  const earned = count > 0
  const stackable = STACKABLE_BADGE_CATEGORIES.has(badge.category)
  const isAuto = badge.auto_criteria !== null
  // Kake, kaffe o.l. til en dugnad teller som deltakelse på den dugnaden
  const pickEvent = PARTICIPATION_CATEGORIES.has(badge.category)

  return (
    <BottomSheet open={open} onClose={onClose} pinToBottom={pinToBottom}>
      <div className="text-center pt-1">
        {/* Stor merke-ikon (112px) med løft hvis opptjent */}
        <div
          className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-2 bg-card"
          style={{
            boxShadow: earned
              ? '0 4px 16px rgba(160,120,80,.22)'
              : 'inset 0 0 0 1.5px rgba(57,56,43,.08)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badge.icon}
            alt={badge.name}
            className="w-full h-full object-contain"
            style={{
              transform: 'scale(0.82)',
              mixBlendMode: 'multiply',
              filter: earned ? 'none' : 'grayscale(1)',
              opacity: earned ? 1 : 0.4,
            }}
          />
        </div>

        <h2 className="font-[var(--font-display)] text-[22px] font-extrabold tracking-tight mt-1.5 mb-2.5">
          {badge.name}
        </h2>

        {/* Status-pille: grønn hake hvis opptjent, lås hvis ikke */}
        {earned ? (
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(107,143,113,.16)', color: '#3d6648' }}
          >
            <Check size={12} strokeWidth={3} /> Opptjent{count > 1 ? ` ×${count}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-surface-low text-text-tertiary">
            <Lock size={12} /> Ikke opptjent ennå
          </span>
        )}

        <p className="text-[14.5px] text-text-secondary leading-[1.55] mt-4 mb-5 mx-1">
          {badge.description}
        </p>

        {isAuto ? (
          // Auto-merker er readonly
          <p className="text-xs text-text-tertiary italic mt-2 mb-2">
            Tildeles automatisk når kriteriet er oppfylt.
          </p>
        ) : (
          <>
            {pickEvent && (
              <div className="text-left mb-3">
                <label htmlFor="award-event" className="block text-xs font-medium text-text-secondary mb-1.5 ml-1">
                  Dugnad
                </label>
                <select
                  id="award-event"
                  value={eventId ?? ''}
                  onChange={e => setEventId(e.target.value || null)}
                  className="w-full appearance-none box-border min-h-[42px] px-3 rounded-[12px] bg-surface-low text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} · {new Date(`${ev.date}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                    </option>
                  ))}
                  <option value="">Ingen hendelse</option>
                </select>
              </div>
            )}
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full rounded-full"
              onClick={() => onAward(pickEvent ? eventId : null)}
              disabled={earned && !stackable}
            >
              {earned ? (
                <><Plus size={16} strokeWidth={2.5} /> Gi merket igjen</>
              ) : (
                <><Award size={16} /> Gi merket</>
              )}
            </Button>

            {earned && (
              <button
                type="button"
                onClick={onRemove}
                className="w-full mt-1.5 py-3 text-sm font-semibold text-danger rounded-full bg-transparent active:bg-danger/5"
              >
                {count > 1 ? 'Fjern ett (−1)' : 'Ta tilbake merket'}
              </button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
