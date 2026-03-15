'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Plus, Calendar, ChevronDown, ChevronUp, MapPin, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DugnadEvent, EventType, EventStatus, ZoneAssignment, Zone } from '@/lib/supabase/types'

// Sonestatus-teller per hendelse
interface ZoneStats {
  total: number
  available: number
  claimed: number
  completed: number
}

// Hendelse med sonestatus
interface EventWithZones extends DugnadEvent {
  zoneStats: ZoneStats
}

const statusLabels: Record<EventStatus, string> = {
  upcoming: 'Kommende',
  active: 'Aktiv',
  completed: 'Fullfort',
}

const statusColors: Record<EventStatus, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-500',
}

const typeLabels: Record<EventType, string> = {
  bottle_collection: 'Flaskesanking',
  lottery: 'Lotteri',
  baking: 'Bakesalg',
  other: 'Annet',
}

const nextStatus: Record<EventStatus, EventStatus | null> = {
  upcoming: 'active',
  active: 'completed',
  completed: null,
}

// Hendelsesadministrasjon — opprett og rediger dugnader
export default function EventsAdminPage() {
  const [events, setEvents] = useState<EventWithZones[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const supabase = createClient()

  // Skjema-state
  const [title, setTitle] = useState('')
  const [type, setType] = useState<EventType>('bottle_collection')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [description, setDescription] = useState('')

  async function loadEvents() {
    const [eventsRes, assignmentsRes] = await Promise.all([
      supabase.from('events').select('*').order('date', { ascending: false }) as unknown as Promise<{ data: DugnadEvent[] | null }>,
      supabase.from('zone_assignments').select('*') as unknown as Promise<{ data: ZoneAssignment[] | null }>,
    ])

    const allEvents = eventsRes.data || []
    const allAssignments = assignmentsRes.data || []

    const eventsWithZones: EventWithZones[] = allEvents.map(event => {
      const eventAssignments = allAssignments.filter(a => a.event_id === event.id)
      return {
        ...event,
        zoneStats: {
          total: eventAssignments.length,
          available: eventAssignments.filter(a => a.status === 'available').length,
          claimed: eventAssignments.filter(a => a.status === 'claimed' || a.status === 'in_progress').length,
          completed: eventAssignments.filter(a => a.status === 'completed' || a.status === 'picked_up').length,
        },
      }
    })

    setEvents(eventsWithZones)
    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [supabase])

  // Opprett ny hendelse + auto-tildel soner
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Opprett hendelsen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newEvent, error } = await (supabase.from('events') as any).insert({
      title,
      type,
      date,
      start_time: startTime || null,
      description: description || null,
      status: 'upcoming',
      created_by: user.id,
    }).select().single() as { data: DugnadEvent | null; error: unknown }

    if (error || !newEvent) {
      console.error('Feil ved opprettelse:', error)
      setSaving(false)
      return
    }

    // Hent soner og filtrer etter tittel
    const { data: zones } = await supabase.from('zones').select('id, area') as unknown as { data: Array<Pick<Zone, 'id' | 'area'>> | null }

    if (zones && zones.length > 0) {
      const titleLower = title.toLowerCase()
      let filteredZones = zones

      if (titleLower.includes('nord')) {
        filteredZones = zones.filter(z => z.area === 'NORD')
      } else if (titleLower.includes('sor') || titleLower.includes('sur')) {
        filteredZones = zones.filter(z => z.area === 'SOR')
      }
      // Ellers: alle soner

      // Opprett zone_assignments for hver sone
      const assignments = filteredZones.map(zone => ({
        event_id: newEvent.id,
        zone_id: zone.id,
        status: 'available' as const,
      }))

      if (assignments.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('zone_assignments') as any).insert(assignments)
      }
    }

    // Nullstill skjema og last på nytt
    setTitle('')
    setType('bottle_collection')
    setDate('')
    setStartTime('')
    setDescription('')
    setShowForm(false)
    setSaving(false)
    await loadEvents()
  }

  // Endre status på hendelse
  async function handleStatusChange(eventId: string, currentStatus: EventStatus) {
    const next = nextStatus[currentStatus]
    if (!next) return

    setUpdatingId(eventId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('events') as any).update({ status: next }).eq('id', eventId)
    await loadEvents()
    setUpdatingId(null)
  }

  // Formater dato
  function formatDate(dateStr: string, time: string | null): string {
    const d = new Date(dateStr)
    const formatted = d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
    if (time) return `${formatted} kl. ${time.slice(0, 5)}`
    return formatted
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Hendelser</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Avbryt' : 'Ny hendelse'}
        </Button>
      </div>

      {/* Opprettskjema */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <Card className="p-4">
              <form onSubmit={handleCreate} className="space-y-3">
                {/* Tittel */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Tittel</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="F.eks. Vårinnsamling Nord"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <p className="text-[11px] text-text-tertiary mt-1">
                    Tips: Bruk &laquo;Nord&raquo; eller &laquo;Sor&raquo; i tittelen for automatisk sonetildeling
                  </p>
                </div>

                {/* Type + Dato */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">Type</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value as EventType)}
                      className="w-full px-3 py-2 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {Object.entries(typeLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">Dato</label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                </div>

                {/* Tid */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Starttid (valgfritt)</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>

                {/* Beskrivelse */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Beskrivelse (valgfritt)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Ekstra info for deltakerne..."
                    className="w-full px-3 py-2 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                  />
                </div>

                <Button type="submit" loading={saving} className="w-full">
                  Opprett hendelse
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skeleton loading */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 space-y-2">
              <div className="h-5 w-48 bg-black/5 rounded" />
              <div className="h-4 w-32 bg-black/5 rounded" />
              <div className="h-1.5 bg-black/5 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Hendelsesliste */}
      {!loading && events.length === 0 && (
        <Card className="p-6 text-center">
          <Calendar size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">Ingen hendelser opprettet ennå</p>
          <p className="text-sm text-text-tertiary mt-1">
            Opprett en hendelse for a starte planlegging
          </p>
        </Card>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event, i) => {
            const isExpanded = expandedId === event.id
            const progress = event.zoneStats.total > 0
              ? ((event.zoneStats.claimed + event.zoneStats.completed) / event.zoneStats.total) * 100
              : 0

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card animate={false} className="p-4">
                  {/* Header — klikk for a ekspandere */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] truncate">{event.title}</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                          {formatDate(event.date, event.start_time)} · {typeLabels[event.type]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[event.status]}`}>
                          {statusLabels[event.status]}
                        </span>
                        {isExpanded ? <ChevronUp size={16} className="text-text-tertiary" /> : <ChevronDown size={16} className="text-text-tertiary" />}
                      </div>
                    </div>

                    {/* Soneprogresjon */}
                    {event.zoneStats.total > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                          <span>{event.zoneStats.claimed + event.zoneStats.completed}/{event.zoneStats.total} soner</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: event.zoneStats.completed === event.zoneStats.total && event.zoneStats.total > 0
                                ? 'var(--color-success, #34c759)'
                                : 'var(--color-accent)',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Ekspandert detaljer */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-black/5 mt-3 pt-3 space-y-3">
                          {/* Beskrivelse */}
                          {event.description && (
                            <p className="text-sm text-text-secondary">{event.description}</p>
                          )}

                          {/* Sonestatistikk */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-blue-50 rounded-xl p-2 text-center">
                              <p className="text-lg font-bold text-blue-600">{event.zoneStats.available}</p>
                              <p className="text-[11px] text-blue-500">Ledige</p>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-2 text-center">
                              <p className="text-lg font-bold text-amber-600">{event.zoneStats.claimed}</p>
                              <p className="text-[11px] text-amber-500">Tatt</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-2 text-center">
                              <p className="text-lg font-bold text-green-600">{event.zoneStats.completed}</p>
                              <p className="text-[11px] text-green-500">Ferdig</p>
                            </div>
                          </div>

                          {/* Statusendring */}
                          {nextStatus[event.status] && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              loading={updatingId === event.id}
                              onClick={() => handleStatusChange(event.id, event.status)}
                            >
                              <MapPin size={14} />
                              {event.status === 'upcoming' ? 'Aktiver hendelse' : 'Merk som fullfort'}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
