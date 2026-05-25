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

  if (!event || loading) {
    return (
      <div className="min-h-screen p-5 space-y-4 pb-20">
        <div className="h-8 w-24 bg-foreground/10 rounded animate-pulse" />
        <div className="h-32 bg-foreground/10 rounded-3xl animate-pulse" />
        <div className="h-64 bg-foreground/10 rounded-3xl animate-pulse" />
      </div>
    )
  }

  const sorted = sortShifts(shifts) as ShiftWithClaims[]
  const grouped = groupShiftsByDate(sorted)
  const dateRange = sorted.length > 0
    ? `${formatShiftDateShort(sorted[0].shift_date)} – ${formatShiftDateShort(sorted[sorted.length - 1].shift_date)}`
    : event.date
  const deadlinePassed = isDeadlinePassed(event.signup_deadline)

  return (
    <div className="min-h-screen pb-20">
      <header className="px-5 pt-5 pb-3">
        <button onClick={() => router.push('/hjem')} className="flex items-center gap-1 text-sm text-foreground/60 mb-3 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Tilbake
        </button>
        <h1 className="text-3xl font-display font-bold tracking-tight text-balance">{event.title}</h1>
        <div className="mt-2 space-y-1 text-sm text-foreground/70">
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0" />{dateRange}</div>
          {event.meeting_point?.name && (
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" />{event.meeting_point.name}</div>
          )}
          {event.signup_deadline && (
            <div className={`flex items-center gap-2 ${deadlinePassed ? 'text-amber-700' : ''}`}>
              <ClockIcon className="w-4 h-4 shrink-0" />
              {deadlinePassed ? 'Påmelding stengt' : `Påmelding stenger ${new Date(event.signup_deadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}`}
            </div>
          )}
        </div>
      </header>

      {event.description && (
        <p className="px-5 mt-2 text-foreground/80 text-balance">{event.description}</p>
      )}

      <main className="px-5 mt-6 space-y-5">
        {userId && <MyShiftsCard shifts={sorted} currentUserId={userId} onShiftClick={setSelectedShift} />}

        <section>
          <h2 className="text-xs uppercase tracking-wide text-foreground/50 font-semibold mb-3">Ledige vakter</h2>
          {sorted.length === 0 ? (
            <div className="rounded-3xl bg-surface shadow-soft p-5 text-center text-foreground/60">
              Ingen vakter opprettet enda
            </div>
          ) : (
            <div className="space-y-5">
              {Array.from(grouped.entries()).map(([date, dayShifts]) => (
                <div key={date}>
                  <div className="text-xs uppercase tracking-wide text-foreground/40 mb-2">{formatShiftDate(date)}</div>
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
          <div className="text-center text-sm text-foreground/60 pt-2">
            Spørsmål? Kontakt admin på <a href={`tel:${event.contact_phone}`} className="text-accent underline">{event.contact_phone}</a>
          </div>
        )}
      </main>

      <ShiftClaimSheet
        shift={selectedShift}
        onClose={() => setSelectedShift(null)}
        onChange={refetch}
        currentUserId={userId}
        signupDeadline={event.signup_deadline}
        adminPhone={event.contact_phone}
        roleInfo={event.role_info}
      />
    </div>
  )
}
