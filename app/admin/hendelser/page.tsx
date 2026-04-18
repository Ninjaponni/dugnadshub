'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import KorpsLogo from '@/components/ui/KorpsLogo'
import { Plus, Calendar, ChevronDown, ChevronUp, MapPin, X, Pencil, Trash2, AlertTriangle, ArrowLeft, Bell, Download, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { DugnadEvent, EventType, EventStatus, EventArea, ZoneAssignment, Zone } from '@/lib/supabase/types'
import { evaluateBadges } from '@/lib/badges/evaluator'

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
  driverNotes: string
  contactPhone: string
  bagsCollected: string
  completionNotes: string
}

const emptyForm: EventFormData = {
  title: '',
  type: 'bottle_collection',
  date: '',
  startTime: '',
  endTime: '',
  area: 'begge',
  description: '',
  driverNotes: '',
  contactPhone: '',
  bagsCollected: '',
  completionNotes: '',
}

const statusLabels: Record<EventStatus, string> = {
  upcoming: 'Kommende',
  active: 'Aktiv',
  completed: 'Fullfort',
}

const statusColors: Record<EventStatus, string> = {
  upcoming: 'bg-teal/10 text-teal',
  active: 'bg-success/10 text-success',
  completed: 'bg-surface-low text-text-secondary',
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
const inputClass = 'w-full min-w-0 px-3 py-2 rounded-[12px] bg-card ring-1 ring-text-tertiary/20 text-[15px] outline-none focus:ring-2 focus:ring-accent/30 box-border'
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

  // Deaktiverings-bekreftelse (kun når det finnes claims)
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null)

  // Nullstill claims
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  // Fullførings-dialog
  const [completeConfirmId, setCompleteConfirmId] = useState<string | null>(null)
  const [completeBags, setCompleteBags] = useState('')
  const [completeNotes, setCompleteNotes] = useState('')

  // Tab-navigasjon
  type Tab = 'active' | 'upcoming' | 'completed'
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [exporting, setExporting] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
      driver_notes: form.driverNotes || null,
      contact_phone: form.contactPhone || null,
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
      driver_notes: editForm.driverNotes || null,
      contact_phone: editForm.contactPhone || null,
      bags_collected: editForm.bagsCollected ? parseInt(editForm.bagsCollected, 10) : null,
      completion_notes: editForm.completionNotes || null,
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
      driverNotes: event.driver_notes || '',
      contactPhone: event.contact_phone || '',
      bagsCollected: event.bags_collected ? String(event.bags_collected) : '',
      completionNotes: event.completion_notes || '',
    })
  }

  // Slett hendelse (og tilhorende zone_assignments)
  async function handleDelete(eventId: string) {
    setDeleting(true)
    setErrorMsg(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: assignErr } = await (supabaseRef.current.from('zone_assignments') as any).delete().eq('event_id', eventId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: eventErr } = await (supabaseRef.current.from('events') as any).delete().eq('id', eventId)
    if (assignErr || eventErr) {
      setErrorMsg('Kunne ikke slette hendelsen')
      setDeleting(false)
      return
    }
    setDeleteConfirmId(null)
    setDeleting(false)
    setExpandedId(null)
    await loadEvents()
  }

  // Endre status pa hendelse — egne knapper per status
  async function handleStatusChange(eventId: string, newStatus: EventStatus) {
    setUpdatingId(eventId)
    setErrorMsg(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseRef.current.from('events') as any).update({ status: newStatus }).eq('id', eventId)
    if (error) {
      setErrorMsg('Kunne ikke endre status')
      setUpdatingId(null)
      return
    }

    // Evaluer badges for alle deltagere ved fullføring
    if (newStatus === 'completed') {
      const { data: claims } = await supabaseRef.current
        .from('zone_claims')
        .select('user_id, zone_assignments!inner(event_id)')
        .eq('zone_assignments.event_id', eventId) as unknown as { data: Array<{ user_id: string }> | null }
      const userIds = [...new Set((claims || []).map(c => c.user_id))]
      for (const uid of userIds) {
        evaluateBadges(uid).catch(() => {})
      }
    }

    // Send push ved aktivering
    if (newStatus === 'active') {
      const event = events.find(e => e.id === eventId)
      if (event) {
        const { data: { user } } = await supabaseRef.current.auth.getUser()
        if (user) {
          const { data: { session } } = await supabaseRef.current.auth.getSession()
          if (session) {
            await fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({
                title: 'Dugnad er i gang!',
                body: `${event.title} er nå aktiv — ta en sone!`,
                url: `/kart?event=${eventId}`,
                filter: { all: true },
              }),
            }).catch(() => {})
          }
        }
      }
    }

    await loadEvents()
    setUpdatingId(null)
  }

  // Nullstill alle claims og reset assignments for en hendelse
  async function handleResetClaims(eventId: string) {
    setResetting(true)
    setErrorMsg(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('admin_reset_claims', { p_event_id: eventId })
    if (rpcError) {
      setErrorMsg('Kunne ikke nullstille claims')
      setResetting(false)
      return
    }
    setResetConfirmId(null)
    setResetting(false)
    await loadEvents()
  }

  // Deaktiver hendelse (med eller uten bekreftelse)
  function handleDeactivateClick(event: EventWithZones) {
    const hasClaims = event.zoneStats.claimed + event.zoneStats.completed > 0
    if (hasClaims) {
      setDeactivateConfirmId(event.id)
    } else {
      handleStatusChange(event.id, 'upcoming')
    }
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
        url: `/kart?event=${event.id}`,
        filter: { all: true },
      }),
    }).catch(() => {})
  }

  // Eksporter hendelse som CSV
  async function handleExportCSV(eventId: string) {
    setExporting(eventId)
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) { setExporting(null); return }

    const res = await fetch(`/api/export/event?id=${eventId}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })

    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'eksport.csv'
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(null)
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
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Tittel */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Tittel</label>
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
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Type</label>
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
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Område</label>
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
          <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Dato</label>
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
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Start (valgfritt)</label>
            <input
              type="time"
              value={data.startTime}
              onChange={e => setData(prev => ({ ...prev, startTime: e.target.value }))}
              className={dateTimeClass}
            />
          </div>
          <div className="min-w-0 overflow-hidden">
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Slutt (valgfritt)</label>
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
          <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Beskrivelse (valgfritt)</label>
          <textarea
            value={data.description}
            onChange={e => setData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            placeholder="Ekstra info for deltakerne..."
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Sjåførnotat */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Sjåførnotat (valgfritt)</label>
          <textarea
            value={data.driverNotes}
            onChange={e => setData(prev => ({ ...prev, driverNotes: e.target.value }))}
            rows={2}
            placeholder="F.eks. Lever flasker til Infinitum Torgardstrøa 5"
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Telefon dugnadsansvarlig */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Telefon dugnadsansvarlig (valgfritt)</label>
          <input
            type="tel"
            value={data.contactPhone}
            onChange={e => setData(prev => ({ ...prev, contactPhone: e.target.value }))}
            placeholder="F.eks. 99988877"
            className={inputClass}
          />
        </div>

        {/* Sekker og fullføringsnotat — kun i redigering */}
        {submitLabel === 'Lagre endringer' && (
          <>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Sekker levert (valgfritt)</label>
              <input
                type="number"
                inputMode="numeric"
                value={data.bagsCollected}
                onChange={e => setData(prev => ({ ...prev, bagsCollected: e.target.value }))}
                placeholder="F.eks. 45"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Fullføringsnotat (valgfritt)</label>
              <textarea
                value={data.completionNotes}
                onChange={e => setData(prev => ({ ...prev, completionNotes: e.target.value }))}
                rows={2}
                placeholder="F.eks. Fantastisk oppmøte, ferdig på 1,5 time"
                className={`${inputClass} resize-none`}
              />
            </div>
          </>
        )}

        <Button type="submit" loading={isLoading} className="w-full rounded-full">
          {submitLabel}
        </Button>
      </form>
    )
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <div className="flex items-center gap-3">
            <KorpsLogo size={32} />
            <span className="text-xl font-bold text-accent tracking-tight font-[var(--font-display)]">
              Dugnadshub
            </span>
          </div>
          <div className="w-9" />
        </div>
      </header>
      <div className="pt-16 pb-28">

      {/* Tilbake + tittel + ny-knapp */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/oversikt" className="w-8 h-8 rounded-full flex items-center justify-center active:bg-surface-low shrink-0">
          <ArrowLeft size={20} className="text-accent" />
        </Link>
        <h2 className="text-xl font-bold text-accent font-[var(--font-display)] flex-1">Hendelser</h2>
        <Button size="sm" className="rounded-full" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Avbryt' : 'Ny hendelse'}
        </Button>
      </div>

      {/* Feilmelding */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-2xl bg-danger/10 text-danger text-sm font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-danger/60 ml-2">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Opprettskjema */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <Card className="p-5 rounded-2xl">
              <h3 className="text-sm font-bold text-accent font-[var(--font-display)] mb-4">Ny hendelse</h3>
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

      {/* Tab-navigasjon */}
      {!loading && events.length > 0 && (
        <div className="flex gap-1 bg-surface-low rounded-full p-1 mb-4">
          {([
            ['active', 'Aktive', events.filter(e => e.status === 'active').length],
            ['upcoming', 'Kommende', events.filter(e => e.status === 'upcoming').length],
            ['completed', 'Fullførte', events.filter(e => e.status === 'completed').length],
          ] as const).map(([tab, label, count]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as Tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === tab
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary'
              }`}
            >
              {label} {count > 0 && <span className="text-xs opacity-60">({count})</span>}
            </button>
          ))}
        </div>
      )}

      {/* Skeleton loading */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-2xl shadow-[0_8px_30px_rgb(57,56,43,0.08)] p-4 space-y-2">
              <div className="h-5 w-48 bg-surface-low rounded" />
              <div className="h-4 w-32 bg-surface-low rounded" />
              <div className="h-1.5 bg-surface-low rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Ingen hendelser */}
      {!loading && events.length === 0 && (
        <Card className="p-6 text-center rounded-2xl">
          <Calendar size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-text-secondary font-[var(--font-display)]">Ingen hendelser opprettet ennå</p>
          <p className="text-sm text-text-tertiary mt-1">
            Opprett en hendelse for å starte planlegging
          </p>
        </Card>
      )}

      {/* Filtrert hendelsesliste */}
      {!loading && events.length > 0 && (() => {
        const filtered = events.filter(e => {
          if (activeTab === 'active') return e.status === 'active'
          if (activeTab === 'upcoming') return e.status === 'upcoming'
          return e.status === 'completed'
        })

        if (filtered.length === 0) {
          const emptyMessages: Record<Tab, string> = {
            active: 'Ingen aktive hendelser',
            upcoming: 'Ingen kommende hendelser',
            completed: 'Ingen fullførte hendelser ennå',
          }
          return (
            <Card className="p-6 text-center rounded-2xl">
              {activeTab === 'completed'
                ? <CheckCircle size={32} className="text-text-tertiary mx-auto mb-3" />
                : <Calendar size={32} className="text-text-tertiary mx-auto mb-3" />
              }
              <p className="text-text-secondary">{emptyMessages[activeTab]}</p>
            </Card>
          )
        }

        return (
        <div className="space-y-3">
          {filtered.map((event, i) => {
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
                <Card animate={false} className="p-4 rounded-2xl">
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
                        <p className="font-semibold text-[15px] truncate font-[var(--font-display)]">{event.title}</p>
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
                        <div className="h-1.5 bg-surface-low rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: event.zoneStats.completed === event.zoneStats.total && event.zoneStats.total > 0
                                ? 'var(--color-success, #34c759)'
                                : 'linear-gradient(to right, var(--color-accent), var(--color-primary-container, var(--color-accent)))',
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
                        <div className="mt-4 pt-4 space-y-3">
                          {/* Beskrivelse */}
                          {event.description && !isEditing && (
                            <p className="text-sm text-text-secondary">{event.description}</p>
                          )}

                          {/* Fullføringsinfo */}
                          {event.status === 'completed' && (event.bags_collected || event.completion_notes) && !isEditing && (
                            <div className="p-3 bg-success/5 rounded-2xl text-sm space-y-1">
                              {event.bags_collected && (
                                <p><span className="font-medium">Sekker levert:</span> {event.bags_collected}</p>
                              )}
                              {event.completion_notes && (
                                <p><span className="font-medium">Notat:</span> {event.completion_notes}</p>
                              )}
                            </div>
                          )}

                          {/* Sonestatistikk */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-teal/10 rounded-2xl p-2 text-center">
                              <p className="text-lg font-bold text-teal font-[var(--font-display)]">{event.zoneStats.available}</p>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-teal">Ledige</p>
                            </div>
                            <div className="bg-warning/10 rounded-2xl p-2 text-center">
                              <p className="text-lg font-bold text-warning font-[var(--font-display)]">{event.zoneStats.claimed}</p>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-warning">Tatt</p>
                            </div>
                            <div className="bg-success/10 rounded-2xl p-2 text-center">
                              <p className="text-lg font-bold text-success font-[var(--font-display)]">{event.zoneStats.completed}</p>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-success">Ferdig</p>
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
                                <div className="bg-surface-low rounded-2xl p-4">
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
                                    className="w-full mt-2 py-2 text-sm font-medium text-text-secondary active:bg-surface-low rounded-full"
                                  >
                                    Avbryt
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Slettebekreftelse */}
                          <AnimatePresence>
                            {isDeleteConfirm && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-2xl overflow-hidden bg-danger/5">
                                  <div className="p-4 text-center">
                                    <AlertTriangle size={32} className="text-danger mx-auto mb-2" />
                                    <p className="text-[15px] font-medium mb-1 font-[var(--font-display)]">Slette hendelsen?</p>
                                    <p className="text-sm text-text-secondary">
                                      Hendelsen og alle sonetildelinger blir permanent slettet.
                                    </p>
                                  </div>
                                  <div className="flex gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="flex-1 py-3 text-sm font-medium text-text-secondary rounded-full bg-surface-low active:bg-surface-low"
                                    >
                                      Avbryt
                                    </button>
                                    <button
                                      onClick={() => handleDelete(event.id)}
                                      disabled={deleting}
                                      className="flex-1 py-3 text-sm font-medium text-danger rounded-full bg-danger/10 active:bg-danger/20"
                                    >
                                      {deleting ? 'Sletter...' : 'Slett'}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Deaktiverings-bekreftelse */}
                          <AnimatePresence>
                            {deactivateConfirmId === event.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-2xl overflow-hidden bg-warning/5">
                                  <div className="p-4 text-center">
                                    <AlertTriangle size={32} className="text-warning mx-auto mb-2" />
                                    <p className="text-[15px] font-medium mb-1 font-[var(--font-display)]">Deaktivere hendelsen?</p>
                                    <p className="text-sm text-text-secondary">
                                      {event.zoneStats.claimed + event.zoneStats.completed} soner er tatt av deltakere. Claims beholdes men skjules for brukerne.
                                    </p>
                                  </div>
                                  <div className="flex gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => setDeactivateConfirmId(null)}
                                      className="flex-1 py-3 text-sm font-medium text-text-secondary rounded-full bg-surface-low active:bg-surface-low"
                                    >
                                      Avbryt
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeactivateConfirmId(null)
                                        handleStatusChange(event.id, 'upcoming')
                                      }}
                                      className="flex-1 py-3 text-sm font-medium text-warning rounded-full bg-warning/10 active:bg-warning/20"
                                    >
                                      Deaktiver
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Nullstill claims-bekreftelse */}
                          <AnimatePresence>
                            {resetConfirmId === event.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-2xl overflow-hidden bg-danger/5">
                                  <div className="p-4 text-center">
                                    <AlertTriangle size={32} className="text-danger mx-auto mb-2" />
                                    <p className="text-[15px] font-medium mb-1 font-[var(--font-display)]">Nullstille alle claims?</p>
                                    <p className="text-sm text-text-secondary">
                                      Alle {event.zoneStats.claimed + event.zoneStats.completed} tatte soner slettes permanent. Deltakerne mister sine valgte soner.
                                    </p>
                                  </div>
                                  <div className="flex gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => setResetConfirmId(null)}
                                      className="flex-1 py-3 text-sm font-medium text-text-secondary rounded-full bg-surface-low active:bg-surface-low"
                                    >
                                      Avbryt
                                    </button>
                                    <button
                                      onClick={() => handleResetClaims(event.id)}
                                      disabled={resetting}
                                      className="flex-1 py-3 text-sm font-medium text-danger rounded-full bg-danger/10 active:bg-danger/20"
                                    >
                                      {resetting ? 'Nullstiller...' : 'Nullstill'}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Fullførings-dialog med sekker og notater */}
                          <AnimatePresence>
                            {completeConfirmId === event.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-2xl overflow-hidden bg-success/5">
                                  <div className="p-4">
                                    <CheckCircle size={32} className="text-success mx-auto mb-2" />
                                    <p className="text-[15px] font-medium mb-3 text-center font-[var(--font-display)]">Fullfør hendelsen</p>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Hvor mange sekker ble levert?</label>
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          value={completeBags}
                                          onChange={e => setCompleteBags(e.target.value)}
                                          placeholder="F.eks. 45"
                                          className={inputClass}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Annet å notere? (valgfritt)</label>
                                        <textarea
                                          value={completeNotes}
                                          onChange={e => setCompleteNotes(e.target.value)}
                                          rows={2}
                                          placeholder="F.eks. Fantastisk oppmøte, ferdig på 1,5 time"
                                          className={`${inputClass} resize-none`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 px-4 pb-4">
                                    <button
                                      onClick={() => setCompleteConfirmId(null)}
                                      className="flex-1 py-3 text-sm font-medium text-text-secondary rounded-full bg-surface-low active:bg-surface-low"
                                    >
                                      Avbryt
                                    </button>
                                    <button
                                      onClick={async () => {
                                        // Lagre sekker og notater før statusendring
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        await (supabaseRef.current.from('events') as any).update({
                                          bags_collected: completeBags ? parseInt(completeBags, 10) : null,
                                          completion_notes: completeNotes || null,
                                        }).eq('id', event.id)
                                        setCompleteConfirmId(null)
                                        handleStatusChange(event.id, 'completed')
                                      }}
                                      disabled={updatingId === event.id}
                                      className="flex-1 py-3 text-sm font-medium text-success rounded-full bg-success/10 active:bg-success/20"
                                    >
                                      {updatingId === event.id ? 'Fullføres...' : 'Fullfør'}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Handlingsknapper — rediger, slett, statusendring */}
                          {!isEditing && !isDeleteConfirm && deactivateConfirmId !== event.id && resetConfirmId !== event.id && completeConfirmId !== event.id && (
                            <div className="space-y-3">
                              {/* Statusknapper tilpasset gjeldende status */}
                              {event.status === 'upcoming' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="w-full rounded-full"
                                  loading={updatingId === event.id}
                                  onClick={() => handleStatusChange(event.id, 'active')}
                                >
                                  <MapPin size={14} />
                                  Aktiver hendelse
                                </Button>
                              )}

                              {event.status === 'active' && (
                                <div className="space-y-3">
                                  {event.zoneStats.available > 0 && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="w-full bg-warning/10 text-warning rounded-full"
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
                                      className="rounded-full"
                                      loading={updatingId === event.id}
                                      onClick={() => handleDeactivateClick(event)}
                                    >
                                      Deaktiver
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="bg-success/10 text-success hover:bg-success/20 rounded-full"
                                      loading={updatingId === event.id}
                                      onClick={() => {
                                        setCompleteConfirmId(event.id)
                                        setCompleteBags('')
                                        setCompleteNotes('')
                                      }}
                                    >
                                      Merk som fullført
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Nullstill claims */}
                              {(event.zoneStats.claimed + event.zoneStats.completed) > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="w-full text-text-secondary rounded-full"
                                  onClick={() => {
                                    setResetConfirmId(event.id)
                                    setEditingId(null)
                                    setDeleteConfirmId(null)
                                  }}
                                >
                                  Nullstill alle claims ({event.zoneStats.claimed + event.zoneStats.completed})
                                </Button>
                              )}

                              {/* Eksporter CSV — kun for fullførte */}
                              {event.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="w-full rounded-full"
                                  loading={exporting === event.id}
                                  onClick={() => handleExportCSV(event.id)}
                                >
                                  <Download size={14} />
                                  Eksporter CSV
                                </Button>
                              )}

                              {/* Rediger + Slett */}
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-full"
                                  onClick={() => startEditing(event)}
                                >
                                  <Pencil size={14} />
                                  Rediger
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="rounded-full"
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
        )
      })()}
    </div>
    </>
  )
}
