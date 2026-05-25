'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, MapPin, Clock as ClockIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeShifts } from '@/lib/hooks/useRealtimeShifts'
import { ShiftListItem } from '@/components/features/ShiftListItem'
import { ShiftClaimSheet } from '@/components/features/ShiftClaimSheet'
import { MyShiftsCard } from '@/components/features/MyShiftsCard'
import { RoleInfoCard } from '@/components/features/RoleInfoCard'
import { GeneralInfoCard } from '@/components/features/GeneralInfoCard'
import KorpsLogo from '@/components/ui/KorpsLogo'
import { formatShiftDate, formatShiftDateShort, groupShiftsByDate, sortShifts, isDeadlinePassed } from '@/lib/shifts/utils'
import type { ArrangementEvent, ShiftWithClaims } from '@/lib/types/shifts'

export default function ArrangementPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const [event, setEvent] = useState<ArrangementEvent | null>(null)
  const [userId, setUserId] = useState<string | undefined>()
  const [selectedShift, setSelectedShift] = useState<ShiftWithClaims | null>(null)

  const { shifts, loading, refetch } = useRealtimeShifts(id)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (user) setUserId(user.id)

      const { data: ev } = await supabaseRef.current
        .from('events')
        .select('*')
        .eq('id', id)
        .eq('type', 'arrangement')
        .maybeSingle()

      if (!ev) {
        router.push('/hjem')
        return
      }
      setEvent(ev as unknown as ArrangementEvent)
    }
    load()
  }, [id, router])

  const sorted = sortShifts(shifts) as ShiftWithClaims[]
  const grouped = groupShiftsByDate(sorted)
  const dateRange = sorted.length > 0
    ? `${formatShiftDateShort(sorted[0].shift_date)} – ${formatShiftDateShort(sorted[sorted.length - 1].shift_date)}`
    : event?.date
  const deadlinePassed = isDeadlinePassed(event?.signup_deadline ?? null)

  return (
    <>
      {/* Fast header med Dugnadshub-logo + Tilbake-knapp */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <button
            onClick={() => router.push('/hjem')}
            className="flex items-center gap-1 text-sm text-text-secondary active:bg-surface-low rounded-full p-1.5 -ml-1.5"
            aria-label="Tilbake"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <KorpsLogo size={28} />
            <span className="text-lg font-bold text-accent tracking-tight font-[var(--font-display)]">
              Dugnadshub
            </span>
          </div>
          <div className="w-9" />
        </div>
      </header>

      {!event || loading ? (
        <main className="pt-20 px-5 pb-28 space-y-4">
          <div className="h-10 w-3/4 bg-surface-low rounded animate-pulse" />
          <div className="h-32 bg-surface-low rounded-3xl animate-pulse" />
          <div className="h-64 bg-surface-low rounded-3xl animate-pulse" />
        </main>
      ) : (
        <main className="pt-20 px-5 pb-28 space-y-6">
          {/* Tittel + meta */}
          <section>
            <h1 className="text-3xl font-bold font-[var(--font-display)] tracking-tight text-balance text-text-primary">{event.title}</h1>
            <div className="mt-3 space-y-1.5 text-sm text-text-secondary">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0 text-accent" />{dateRange}</div>
              {event.meeting_point?.name && (
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0 text-accent" />{event.meeting_point.name}</div>
              )}
              {event.signup_deadline && (
                <div className={`flex items-center gap-2 ${deadlinePassed ? 'text-warning' : ''}`}>
                  <ClockIcon className="w-4 h-4 shrink-0 text-accent" />
                  {deadlinePassed ? 'Påmelding stengt' : `Påmelding stenger ${new Date(event.signup_deadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}`}
                </div>
              )}
            </div>
          </section>

          {/* Beskrivelse */}
          {event.description && (
            <p className="text-text-secondary text-balance leading-relaxed">{event.description}</p>
          )}

          {/* Mine vakter */}
          {userId && <MyShiftsCard shifts={sorted} currentUserId={userId} onShiftClick={setSelectedShift} />}

          {/* Ledige vakter */}
          <section>
            <h2 className="text-xs uppercase tracking-wide text-text-tertiary font-semibold mb-3">Ledige vakter</h2>
            {sorted.length === 0 ? (
              <div className="rounded-3xl bg-card shadow-sm p-5 text-center text-text-secondary">
                Ingen vakter opprettet enda
              </div>
            ) : (
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([date, dayShifts]) => (
                  <div key={date}>
                    <div className="text-xs uppercase tracking-wide text-text-tertiary mb-2">{formatShiftDate(date)}</div>
                    <div className="space-y-2">
                      {dayShifts.map(s => (
                        <ShiftListItem key={s.id} shift={s} onClick={() => setSelectedShift(s)} currentUserId={userId} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {event.role_info && event.role_info.length > 0 && <RoleInfoCard roleInfo={event.role_info} />}
          {event.general_info && event.general_info.length > 0 && <GeneralInfoCard entries={event.general_info} />}

          {event.contact_phone && (
            <div className="text-center text-sm text-text-secondary pt-2">
              Spørsmål? Kontakt admin på <a href={`tel:${event.contact_phone}`} className="text-accent underline font-medium">{event.contact_phone}</a>
            </div>
          )}
        </main>
      )}

      <ShiftClaimSheet
        shift={selectedShift}
        onClose={() => setSelectedShift(null)}
        onChange={refetch}
        currentUserId={userId}
        signupDeadline={event?.signup_deadline ?? null}
        adminPhone={event?.contact_phone ?? null}
        roleInfo={event?.role_info ?? null}
        matches={event?.matches ?? null}
      />
    </>
  )
}
