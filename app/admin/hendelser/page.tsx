'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Plus, Calendar, ChevronDown, ChevronUp, MapPin, X, Pencil, Trash2, AlertTriangle, ArrowLeft, Bell } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { DugnadEvent, EventType, EventStatus, EventArea, ZoneAssignment, Zone } from '@/lib/supabase/types'

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

// Feltene i opprett/rediger-skjemaet
interface EventFormData {
  title: string
  type: EventType
  date: string
  startTime: string
  endTime: string
  area: EventArea
  description: string
}

const emptyForm: EventFormData = {
  title: '',
  type: 'bottle_collection',
  date: '',
  startTime: '',
  endTime: '',
  area: 'begge',
  description: '',
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
  bottle_collection: 'Flaskeinnsamling',
  lapper: 'Lappeutdeling',
  lottery: 'Lotteri',
  baking: 'Bakesalg',
  other: 'Annet',
}

const areaLabels: Record<EventArea, string> = {
  nord: 'Nord',
  sor: 'Sør',
  begge: 'Begge',
}

// Inputfelt-klasse brukt gjennomgaende
const inputClass = 'w-full min-w-0 px-3 py-2 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30 box-border'
// Dato/tid-felt trenger ekstra styling for iOS Safari
const dateTimeClass = `${inputClass} appearance-none max-w-full`

// Hendelsesadministrasjon — opprett, rediger og slett dugnader
export default function EventsAdminPage() {
  const supabaseRef = useRef(createClient())

  const [events, setEvents] = useState<EventWithZones[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Opprett-skjema
  const [form, setForm] = useState<EventFormData>({ ...emptyForm })

  // Rediger-skjema — vises inline per hendelse
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EventFormData>({ ...emptyForm })
  const [editSaving, setEditSaving] = useState(false)

  // Slette-bekreftelse
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Last alle hendelser med sonestatus
  const loadEvents = useCallback(async () => {
    const [eventsRes, assignmentsRes, claimsRes] = await Promise.all([
      supabaseRef.current.from('events').select('*').order('date', { ascending: true }) as unknown as Promise<{ data: DugnadEvent[] | null }>,
      supabaseRef.current.from('zone_assignments').select('*') as unknown as Promise<{ data: ZoneAssignment[] | null }>,
      supabaseRef.current.from('zone_claims').select('assignment_id') as unknown as Promise<{ data: Array<{ assignment_id: string }> | null }>,
    ])

    const allEvents = eventsRes.data || []
    const allAssignments = assignmentsRes.data || []
    const allClaims = claimsRes.data || []

    const eventsWithZones: EventWithZones[] = allEvents.map(event => {
      const eventAssignments = allAssignments.filter(a => a.event_id === event.id)
      // Tell basert på claims, ikke assignment-status
      const zonesWithClaims = eventAssignments.filter(a =>
        allClaims.some(c => c.assignment_id === a.id)
      )
      const completed = eventAssignments.filter(a => a.status === 'completed' || a.status === 'picked_up')
      const available = eventAssignments.length - zonesWithClaims.length

      return {
        ...event,
        zoneStats: {
          total: eventAssignments.length,
          available,
          claimed: zonesWithClaims.length - completed.length,
          completed: completed.length,
        },
      }
    })

    setEvents(eventsWithZones)
    setLoading(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Hjelpefunksjon — tildel soner basert pa omrade og hendelsestype
  async function assignZonesForEvent(eventId: string, area: EventArea, eventType: EventType) {
    // Velg riktig sonetype basert pa hendelsestype
    const zoneType = eventType === 'lapper' ? 'lapper' : 'bottle'
    const { data: zones } = await supabaseRef.current.from('zones').select('id, area, zone_type').eq('zone_type', zoneType) as unknown as { data: Array<Pick<Zone, 'id' | 'area' | 'zone_type'>> | null }

    if (!zones || zones.length === 0) return

    let filteredZones = zones
    if (area === 'nord') {
      filteredZones = zones.filter(z => z.area === 'NORD')
    } else if (area === 'sor') {
      filteredZones = zones.filter(z => z.area === 'SOR')
    }

    const assignments = filteredZones.map(zone => ({
      event_id: eventId,
      zone_id: zone.id,
      status: 'available' as const,
    }))

    if (assignments.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseRef.current.from('zone_assignments') as any).insert(assignments)
    }
  }

  // Opprett ny hendelse + auto-tildel soner
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabaseRef.current.auth.getUser()
    if (!user) { setSaving(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newEvent, error } = await (supabaseRef.current.from('events') as any).insert({
      title: form.title,
      type: form.type,
      date: form.date,
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      area: form.area,
      description: form.description || null,
      status: 'upcoming',
      created_by: user.id,
    }).select().single() as { data: DugnadEvent | null; error: unknown }

    if (error || !newEvent) {
      console.error('Feil ved opprettelse:', error)
      setSaving(false)
      return
    }

    await assignZonesForEvent(newEvent.id, form.area, form.type)

    setForm({ ...emptyForm })
    setShowForm(false)
    setSaving(false)
    await loadEvents()
  }

  // Lagre redigert hendelse
  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditSaving(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseRef.current.from('events') as any).update({
      title: editForm.title,
      type: editForm.type,
      date: editForm.date,
      start_time: editForm.startTime || null,
      end_time: editForm.endTime || null,
      area: editForm.area,
      description: editForm.description || null,
    }).eq('id', editingId) as { error: unknown }

    if (error) {
      console.error('Feil ved oppdatering:', error)
    }

    setEditingId(null)
    setEditSaving(false)
    await loadEvents()
  }

  // Start redigering — fyll inn eksisterende verdier
  function startEditing(event: EventWithZones) {
    setEditingId(event.id)
    setDeleteConfirmId(null)
    setEditForm({
      title: event.title,
      type: event.type,
      date: event.date,
      startTime: event.start_time || '',
      endTime: event.end_time || '',
      area: event.area || 'begge',
      description: event.description || '',
    })
  }

  // Slett hendelse (og tilhorende zone_assignments)
  async function handleDelete(eventId: string) {
    setDeleting(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('zone_assignments') as any).delete().eq('event_id', eventId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('events') as any).delete().eq('id', eventId)
    setDeleteConfirmId(null)
    setDeleting(false)
    setExpandedId(null)
    await loadEvents()
  }

  // Endre status pa hendelse — egne knapper per status
  async function handleStatusChange(eventId: string, newStatus: EventStatus) {
    setUpdatingId(eventId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseRef.current.from('events') as any).update({ status: newStatus }).eq('id', eventId)

    // Send push ved aktivering
    if (newStatus === 'active') {
      const event = events.find(e => e.id === eventId)
      if (event) {
        const { data: { session } } = await supabaseRef.current.auth.getSession()
        if (session) {
          await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({
              title: 'Dugnad er i gang!',
              body: `${event.title} er nå aktiv — ta en sone!`,
              url: '/kart',
              filter: { all: true },
            }),
          }).catch(() => {})
        }
      }
    }

    await loadEvents()
    setUpdatingId(null)
  }

  // Send hjelp-varsel for aktiv hendelse
  async function handleSendHelp(event: EventWithZones) {
    const available = event.zoneStats.available
    if (available === 0) return

    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) return

    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({
        title: `${event.title} trenger hjelp!`,
        body: `${available} soner mangler folk — kan du ta en?`,
        url: '/kart',
        filter: { all: true },
      }),
    }).catch(() => {})
  }

  // Formater dato
  function formatDate(dateStr: string, startTime: string | null, endTime: string | null): string {
    const d = new Date(dateStr)
    const formatted = d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
    if (startTime && endTime) return `${formatted} kl. ${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`
    if (startTime) return `${formatted} kl. ${startTime.slice(0, 5)}`
    return formatted
  }

  // Gjenbrukbart skjema for opprett og rediger
  function renderForm(
    data: EventFormData,
    setData: (fn: (prev: EventFormData) => EventFormData) => void,
    onSubmit: (e: React.FormEvent) => void,
    submitLabel: string,
    isLoading: boolean,
  ) {
    return (
      <form onSubmit={onSubmit} className="space-y-3">
        {/* Tittel */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Tittel</label>
          <input
            type="text"
            value={data.title}
            onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="F.eks. Flaskeinnsamling Nord"
            required
            className={inputClass}
          />
        </div>

        {/* Type + Område */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Type</label>
            <select
              value={data.type}
              onChange={e => setData(prev => ({ ...prev, type: e.target.value as EventType }))}
              className={inputClass}
            >
              {Object.entries(typeLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Område</label>
            <select
              value={data.area}
              onChange={e => setData(prev => ({ ...prev, area: e.target.value as EventArea }))}
              className={inputClass}
            >
              {Object.entries(areaLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dato */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Dato</label>
          <input
            type="date"
            value={data.date}
            onChange={e => setData(prev => ({ ...prev, date: e.target.value }))}
            required
            className={dateTimeClass}
          />
        </div>

        {/* Starttid + Sluttid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 overflow-hidden">
            <label className="text-xs font-medium text-text-secondary block mb-1">Start (valgfritt)</label>
            <input
              type="time"
              value={data.startTime}
              onChange={e => setData(prev => ({ ...prev, startTime: e.target.value }))}
              className={dateTimeClass}
            />
          </div>
          <div className="min-w-0 overflow-hidden">
            <label className="text-xs font-medium text-text-secondary block mb-1">Slutt (valgfritt)</label>
            <input
              type="time"
              value={data.endTime}
              onChange={e => setData(prev => ({ ...prev, endTime: e.target.value }))}
              className={dateTimeClass}
            />
          </div>
        </div>

        {/* Beskrivelse */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Beskrivelse (valgfritt)</label>
          <textarea
            value={data.description}
            onChange={e => setData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            placeholder="Ekstra info for deltakerne..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <Button type="submit" loading={isLoading} className="w-full">
          {submitLabel}
        </Button>
      </form>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/oversikt" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={18} className="text-text-secondary" />
        </Link>
        <h2 className="text-xl font-semibold flex-1">Hendelser</h2>
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
              {renderForm(
                form,
                (fn) => setForm(fn),
                handleCreate,
                'Opprett hendelse',
                saving,
              )}
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

      {/* Ingen hendelser */}
      {!loading && events.length === 0 && (
        <Card className="p-6 text-center">
          <Calendar size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary">Ingen hendelser opprettet ennå</p>
          <p className="text-sm text-text-tertiary mt-1">
            Opprett en hendelse for å starte planlegging
          </p>
        </Card>
      )}

      {/* Hendelsesliste */}
      {!loading && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event, i) => {
            const isExpanded = expandedId === event.id
            const isEditing = editingId === event.id
            const isDeleteConfirm = deleteConfirmId === event.id
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
                    onClick={() => {
                      setExpandedId(isExpanded ? null : event.id)
                      setEditingId(null)
                      setDeleteConfirmId(null)
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] truncate">{event.title}</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                          {formatDate(event.date, event.start_time, event.end_time)} · {typeLabels[event.type]}
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
                          {event.description && !isEditing && (
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

                          {/* Inline redigeringsskjema */}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-black/[0.02] rounded-xl p-3">
                                  {renderForm(
                                    editForm,
                                    (fn) => setEditForm(fn),
                                    handleEditSave,
                                    'Lagre endringer',
                                    editSaving,
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="w-full mt-2 py-2 text-sm font-medium text-text-secondary active:bg-black/5 rounded-xl"
                                  >
                                    Avbryt
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Slettebekreftelse — iOS-stil */}
                          <AnimatePresence>
                            {isDeleteConfirm && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-2xl overflow-hidden border border-danger/20">
                                  <div className="bg-danger/5 p-4 text-center">
                                    <AlertTriangle size={32} className="text-danger mx-auto mb-2" />
                                    <p className="text-[15px] font-medium mb-1">Slette hendelsen?</p>
                                    <p className="text-sm text-text-secondary">
                                      Hendelsen og alle sonetildelinger blir permanent slettet.
                                    </p>
                                  </div>
                                  <div className="flex border-t border-danger/20">
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-danger/20 active:bg-black/5"
                                    >
                                      Avbryt
                                    </button>
                                    <button
                                      onClick={() => handleDelete(event.id)}
                                      disabled={deleting}
                                      className="flex-1 py-3 text-sm font-medium text-danger active:bg-danger/10"
                                    >
                                      {deleting ? 'Sletter...' : 'Slett'}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Handlingsknapper — rediger, slett, statusendring */}
                          {!isEditing && !isDeleteConfirm && (
                            <div className="space-y-2">
                              {/* Statusknapper tilpasset gjeldende status */}
                              {event.status === 'upcoming' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="w-full"
                                  loading={updatingId === event.id}
                                  onClick={() => handleStatusChange(event.id, 'active')}
                                >
                                  <MapPin size={14} />
                                  Aktiver hendelse
                                </Button>
                              )}

                              {event.status === 'active' && (
                                <div className="space-y-2">
                                  {event.zoneStats.available > 0 && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="w-full bg-warning/10 text-warning"
                                      onClick={() => handleSendHelp(event)}
                                    >
                                      <Bell size={14} />
                                      Send hjelp-varsel ({event.zoneStats.available} ledige)
                                    </Button>
                                  )}
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      loading={updatingId === event.id}
                                      onClick={() => handleStatusChange(event.id, 'upcoming')}
                                    >
                                      Deaktiver
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="bg-success/10 text-success hover:bg-success/20"
                                      loading={updatingId === event.id}
                                      onClick={() => handleStatusChange(event.id, 'completed')}
                                    >
                                      Merk som fullført
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Rediger + Slett */}
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditing(event)}
                                >
                                  <Pencil size={14} />
                                  Rediger
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setDeleteConfirmId(event.id)
                                    setEditingId(null)
                                  }}
                                >
                                  <Trash2 size={14} />
                                  Slett
                                </Button>
                              </div>
                            </div>
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
