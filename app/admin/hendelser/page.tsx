'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import BrandLink from '@/components/layout/BrandLink'
import { Plus, Calendar, ChevronDown, ChevronUp, MapPin, X, Pencil, Trash2, AlertTriangle, ArrowLeft, Bell, Download, CheckCircle, Upload, Users, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { DugnadEvent, EventType, EventStatus, EventArea, ZoneAssignment, Zone, MeetingPoint } from '@/lib/supabase/types'
import { evaluateBadges } from '@/lib/badges/evaluator'
import { parseKmz } from '@/lib/plast/kmz-parser'
import { importPlastZones, importMusicians, type TuttiCsvRow } from '@/lib/plast/admin-actions'
import Papa from 'papaparse'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

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
  sendPushOnActivate: boolean
  signupDeadline: string          // ISO datetime-local
  arrangerName: string
  roleInfo: Array<{ role: string; tasks: string; contact: string }>  // tasks som tekst med én linje per punkt
  generalInfo: Array<{ label: string; value: string }>
  shifts: Array<{ clientId: string; shift_date: string; start_time: string; end_time: string; role: string; capacity: number; notes: string }>  // kun brukt ved opprettelse
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
  sendPushOnActivate: true,
  signupDeadline: '',
  arrangerName: '',
  roleInfo: [],
  generalInfo: [],
  shifts: [],
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
  plast: 'Plastdugnad',
  arrangement: 'Arrangement (vakter)',
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

  // Lås påmelding (setter signup_deadline = now()) / Åpne påmelding igjen (setter null)
  const [lockingId, setLockingId] = useState<string | null>(null)

  // Tab-navigasjon
  type Tab = 'active' | 'upcoming' | 'completed'
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [exporting, setExporting] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Plastdugnad-import (per event)
  const [plastImporting, setPlastImporting] = useState<string | null>(null)
  const [plastImportResult, setPlastImportResult] = useState<{ eventId: string; message: string; isError: boolean } | null>(null)
  // Pending KMZ/CSV-fil som venter på bekreftelse fra ConfirmDialog
  const [pendingKmz, setPendingKmz] = useState<{ eventId: string; file: File; title: string; message: string } | null>(null)
  const [pendingCsv, setPendingCsv] = useState<{ eventId: string; file: File; title: string; message: string } | null>(null)

  // Vakt-administrasjon for arrangement-events
  type ShiftRow = { id?: string; clientId: string; shift_date: string; start_time: string; end_time: string; role: string; capacity: number; notes: string }
  // Hjelpefunksjon — generér stabil client-side ID for nye rader
  const newClientId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [shiftsByEvent, setShiftsByEvent] = useState<Map<string, ShiftRow[]>>(new Map())
  const [savingShifts, setSavingShifts] = useState<Set<string>>(new Set())
  const [deleteShiftConfirm, setDeleteShiftConfirm] = useState<{ eventId: string; shiftId: string } | null>(null)

  // Trigger shift-reminders
  const [triggerReminders, setTriggerReminders] = useState<string | null>(null)
  const [triggerReminderResult, setTriggerReminderResult] = useState<{ eventId: string; message: string; isError: boolean } | null>(null)

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

  // Last vakter når et arrangement-event ekspanderes
  useEffect(() => {
    if (!expandedId) return
    const ev = events.find(e => e.id === expandedId)
    if (!ev || ev.type !== 'arrangement') return
    // Ikke re-last om vi allerede har data
    if (shiftsByEvent.has(expandedId)) return

    ;(async () => {
      const { data } = await supabaseRef.current
        .from('event_shifts')
        .select('*')
        .eq('event_id', expandedId)
        .order('shift_date')
        .order('start_time') as unknown as { data: Array<{ id: string; event_id: string; role: string; shift_date: string; start_time: string; end_time: string; capacity: number; notes: string | null }> | null }

      const rows: ShiftRow[] = (data ?? []).map(s => ({
        id: s.id,
        clientId: s.id,  // bruk DB-id som stabil React-key for eksisterende rader
        shift_date: s.shift_date,
        start_time: s.start_time.slice(0, 5),   // 'HH:MM:SS' → 'HH:MM'
        end_time: s.end_time.slice(0, 5),
        role: s.role,
        capacity: s.capacity,
        notes: s.notes ?? '',
      }))
      setShiftsByEvent(prev => new Map(prev).set(expandedId, rows))
    })()
  }, [expandedId, events, shiftsByEvent])

  // Hjelpefunksjon — last vakter på nytt for et event
  async function reloadShifts(eventId: string) {
    const { data } = await supabaseRef.current
      .from('event_shifts')
      .select('*')
      .eq('event_id', eventId)
      .order('shift_date')
      .order('start_time') as unknown as { data: Array<{ id: string; event_id: string; role: string; shift_date: string; start_time: string; end_time: string; capacity: number; notes: string | null }> | null }

    const rows: ShiftRow[] = (data ?? []).map(s => ({
      id: s.id,
      clientId: s.id,
      shift_date: s.shift_date,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      role: s.role,
      capacity: s.capacity,
      notes: s.notes ?? '',
    }))
    setShiftsByEvent(prev => new Map(prev).set(eventId, rows))
  }

  // Hjelpefunksjon — tildel soner basert pa omrade og hendelsestype
  async function assignZonesForEvent(eventId: string, area: EventArea, eventType: EventType) {
    // Plastdugnad har ad-hoc soner via KMZ-import. Arrangement bruker vakter, ikke soner.
    // Andre typer (lotteri/bakesalg/annet) faller ikke inn under sonemodellen heller.
    if (eventType !== 'bottle_collection' && eventType !== 'lapper') return

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
      send_push_on_activate: form.sendPushOnActivate,
      ...(form.type === 'arrangement' && {
        signup_deadline: form.signupDeadline || null,
        arranger_name: form.arrangerName || null,
        role_info: form.roleInfo
          .filter(r => r.role.trim())
          .map(r => ({
            role: r.role.trim(),
            contact: r.contact.trim() || undefined,
            tasks: r.tasks.split('\n').map(t => t.trim()).filter(Boolean),
          })),
        general_info: form.generalInfo
          .filter(g => g.label.trim())
          .map(g => ({ label: g.label.trim(), value: g.value.trim() })),
      }),
    }).select().single() as { data: DugnadEvent | null; error: unknown }

    if (error || !newEvent) {
      console.error('Feil ved opprettelse:', error)
      setErrorMsg('Kunne ikke opprette hendelsen. Prøv igjen.')
      setSaving(false)
      return
    }

    await assignZonesForEvent(newEvent.id, form.area, form.type)

    // Bulk-insert vakter ved arrangement (kun rader som har dato, rolle og kapasitet)
    if (form.type === 'arrangement' && form.shifts.length > 0) {
      const validShifts = form.shifts
        .filter(s => s.shift_date && s.role && s.capacity > 0)
        .map(s => ({
          event_id: newEvent.id,
          shift_date: s.shift_date,
          start_time: s.start_time || '00:00',  // NOT NULL i DB — fallback matcher inline-editor
          end_time: s.end_time || '00:00',
          role: s.role,
          capacity: s.capacity,
          notes: s.notes || null,
        }))
      if (validShifts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: shiftError } = await (supabaseRef.current.from('event_shifts') as any).insert(validShifts)
        if (shiftError) {
          console.error('Feil ved lagring av vakter:', shiftError)
          setErrorMsg(`Hendelsen ble opprettet, men vaktene kunne ikke lagres: ${shiftError.message ?? 'ukjent feil'}. Åpne hendelsen og legg dem til manuelt.`)
          // Lukk likevel skjemaet — hendelsen er opprettet, brukeren må selv legge til vakter
          setForm({ ...emptyForm })
          setShowForm(false)
          setSaving(false)
          await loadEvents()
          return
        }
      }
    }

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
      send_push_on_activate: editForm.sendPushOnActivate,
      ...(editForm.type === 'arrangement' && {
        signup_deadline: editForm.signupDeadline || null,
        arranger_name: editForm.arrangerName || null,
        role_info: editForm.roleInfo
          .filter(r => r.role.trim())
          .map(r => ({
            role: r.role.trim(),
            contact: r.contact.trim() || undefined,
            tasks: r.tasks.split('\n').map(t => t.trim()).filter(Boolean),
          })),
        general_info: editForm.generalInfo
          .filter(g => g.label.trim())
          .map(g => ({ label: g.label.trim(), value: g.value.trim() })),
      }),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyEvent = event as any
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
      sendPushOnActivate: event.send_push_on_activate ?? true,
      signupDeadline: anyEvent.signup_deadline ?? '',
      arrangerName: anyEvent.arranger_name ?? '',
      roleInfo: (anyEvent.role_info ?? []).map((r: { role: string; contact?: string; tasks?: string[] }) => ({
        role: r.role,
        contact: r.contact ?? '',
        tasks: (r.tasks ?? []).join('\n'),
      })),
      generalInfo: anyEvent.general_info ?? [],
      shifts: [],  // Redigeres inline under arrangement-kortet, ikke i edit-skjemaet
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

    // Fullfør via RPC — status, sjåfør/stripser-merker, rolle-synk og
    // Førstemann-recompute skjer atomisk i databasen
    if (newStatus === 'completed') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcError } = await (supabaseRef.current.rpc as any)('mark_event_completed', { p_event_id: eventId })
      if (rpcError) {
        setErrorMsg(`Kunne ikke fullføre hendelsen: ${rpcError.message || 'ukjent feil'} (${rpcError.code || ''})`)
        setUpdatingId(null)
        return
      }
      // Personlig badge-evaluering for alle deltakere (Frøspire, Tre på rad osv.)
      const { data: claims } = await supabaseRef.current
        .from('zone_claims')
        .select('user_id, zone_assignments!inner(event_id)')
        .eq('zone_assignments.event_id', eventId) as unknown as { data: Array<{ user_id: string }> | null }
      const userIds = [...new Set((claims || []).map(c => c.user_id))]
      const failed: string[] = []
      await Promise.all(userIds.map(async uid => {
        try { await evaluateBadges(uid) } catch { failed.push(uid) }
      }))
      if (failed.length > 0) {
        setErrorMsg(`Hendelsen er fullført, men ${failed.length} bruker(e) fikk ikke evaluert merkene sine. Sjekk admin/medlemmer.`)
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseRef.current.from('events') as any).update({ status: newStatus }).eq('id', eventId)
      if (error) {
        setErrorMsg('Kunne ikke endre status')
        setUpdatingId(null)
        return
      }
    }

    // Send push ved aktivering — respekter send_push_on_activate-toggle
    if (newStatus === 'active') {
      const event = events.find(e => e.id === eventId)
      if (event && event.send_push_on_activate !== false) {
        const { data: { user } } = await supabaseRef.current.auth.getUser()
        if (user) {
          const { data: { session } } = await supabaseRef.current.auth.getSession()
          if (session) {
            await fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({
                title: 'Dugnad er i gang!',
                body: event.type === 'arrangement'
                  ? `${event.title} er nå aktiv — meld deg på en vakt!`
                  : `${event.title} er nå aktiv — ta en sone!`,
                url: event.type === 'arrangement' ? `/arrangement/${eventId}` : `/kart?event=${eventId}`,
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

  // Lås påmelding ved å sette signup_deadline til nå. Brukere som allerede har vakter
  // beholder dem og kan se dem, men kan ikke melde seg på eller av. Event-status forblir 'active'
  // så vakter er synlige helt frem til selve hendelsen.
  async function handleToggleSignupLock(eventId: string, lock: boolean) {
    setLockingId(eventId)
    setErrorMsg(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseRef.current.from('events') as any)
      .update({ signup_deadline: lock ? new Date().toISOString() : null })
      .eq('id', eventId)
    if (error) {
      setErrorMsg(lock ? 'Kunne ikke låse påmelding' : 'Kunne ikke åpne påmelding')
      setLockingId(null)
      return
    }
    await loadEvents()
    setLockingId(null)
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
    // Recompute Førstemann (sletter merket siden alle claims er borte)
    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (session) {
      fetch('/api/events/recompute-first-user', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      }).catch(() => {})
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

  // Plastdugnad: last opp KMZ med soner + møteplass — viser confirm hvis re-import
  function requestKmzUpload(eventId: string, file: File) {
    const event = events.find(e => e.id === eventId)
    if (event && event.zoneStats.total > 0) {
      const claimsCount = event.zoneStats.claimed + event.zoneStats.completed
      const message = claimsCount > 0
        ? `Dette sletter alle ${event.zoneStats.total} eksisterende soner og ${claimsCount} claims fra foreldre.\n\nClaims kan ikke gjenopprettes etter sletting.`
        : `Dette sletter ${event.zoneStats.total} eksisterende soner og oppretter nye fra KMZ-filen.`
      setPendingKmz({ eventId, file, title: 'Erstatte eksisterende soner?', message })
      return
    }
    handleKmzUpload(eventId, file)
  }

  async function handleKmzUpload(eventId: string, file: File) {
    setPlastImporting(eventId)
    setPlastImportResult(null)
    try {
      const parsed = await parseKmz(file)
      if (parsed.zones.length === 0) {
        setPlastImportResult({ eventId, message: 'Fant ingen soner i KMZ-en', isError: true })
        setPlastImporting(null)
        return
      }
      const result = await importPlastZones(supabaseRef.current, eventId, parsed)
      const errorSuffix = result.errors.length > 0 ? ` Feil: ${result.errors.join('; ')}` : ''
      setPlastImportResult({
        eventId,
        message: `Opprettet ${result.zonesCreated} soner${result.meetingPointSet ? ' + møteplass' : ''}.${errorSuffix}`,
        isError: result.errors.length > 0,
      })
      await loadEvents()
    } catch (err) {
      setPlastImportResult({
        eventId,
        message: `Feil ved KMZ-parsing: ${(err as Error).message}`,
        isError: true,
      })
    }
    setPlastImporting(null)
  }

  // Plastdugnad: last opp Tutti-CSV — viser confirm hvis re-import
  async function requestCsvUpload(eventId: string, file: File) {
    const { count: existingCount } = await supabaseRef.current
      .from('event_musicians')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId) as unknown as { count: number | null }

    if (existingCount && existingCount > 0) {
      const message = `Re-import oppdaterer listen med ${existingCount} eksisterende musikanter.\n\n• Musikanter som ikke er i ny CSV slettes\n• Manuell HK-fordeling bevares for navn som finnes i begge listene\n• Nye musikanter auto-fordeles`
      setPendingCsv({ eventId, file, title: 'Oppdater musikantlisten?', message })
      return
    }
    handleCsvUpload(eventId, file)
  }

  async function handleCsvUpload(eventId: string, file: File) {
    setPlastImporting(eventId)
    setPlastImportResult(null)
    try {
      const text = await file.text()
      const parseResult = Papa.parse<TuttiCsvRow>(text, { header: true, skipEmptyLines: true })
      const rows = parseResult.data
      const result = await importMusicians(supabaseRef.current, eventId, rows)

      const parts: string[] = []
      parts.push(`Importerte ${result.inserted} musikanter`)
      if (result.hkUnassigned.length > 0) parts.push(`${result.hkUnassigned.length} HK-musikanter venter på manuell sone-tildeling`)
      if (result.others.length > 0) parts.push(`${result.others.length} voksne (uten avdeling): ${result.others.join(', ')}`)
      if (result.errors.length > 0) parts.push(`Feil: ${result.errors.join('; ')}`)

      setPlastImportResult({
        eventId,
        message: parts.join('. '),
        isError: result.errors.length > 0,
      })
    } catch (err) {
      setPlastImportResult({
        eventId,
        message: `Feil ved CSV-parsing: ${(err as Error).message}`,
        isError: true,
      })
    }
    setPlastImporting(null)
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

  // Trigger shift-reminders for arrangement
  async function triggerShiftReminders(eventId: string) {
    setTriggerReminders(eventId)
    setTriggerReminderResult(null)
    try {
      const res = await fetch('/api/admin/trigger-shift-reminders', { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) {
        setTriggerReminderResult({ eventId, message: `Sendt: ${j.sent} (${j.failed} feilet)`, isError: false })
      } else {
        setTriggerReminderResult({ eventId, message: j.error ?? `Feil (${res.status})`, isError: true })
      }
    } catch (e) {
      setTriggerReminderResult({ eventId, message: (e as Error).message, isError: true })
    } finally {
      setTriggerReminders(null)
    }
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
    mode: 'create' | 'edit' = 'create',
  ) {
    // Hjelpere for arrangement-felter — rolle-repeater
    function addRole() {
      setData(prev => ({ ...prev, roleInfo: [...prev.roleInfo, { role: '', tasks: '', contact: '' }] }))
    }
    function updateRole(i: number, patch: Partial<{ role: string; tasks: string; contact: string }>) {
      setData(prev => ({ ...prev, roleInfo: prev.roleInfo.map((r, idx) => idx === i ? { ...r, ...patch } : r) }))
    }
    function removeRole(i: number) {
      setData(prev => {
        const removedRoleName = prev.roleInfo[i]?.role.trim()
        const nextRoleInfo = prev.roleInfo.filter((_, idx) => idx !== i)
        // Tøm role-feltet på alle nye vakter som peker til den slettede rollen
        const nextShifts = removedRoleName
          ? prev.shifts.map(s => s.role === removedRoleName ? { ...s, role: '' } : s)
          : prev.shifts
        return { ...prev, roleInfo: nextRoleInfo, shifts: nextShifts }
      })
    }
    // Hjelpere for generell informasjon-repeater
    function addInfo() {
      setData(prev => ({ ...prev, generalInfo: [...prev.generalInfo, { label: '', value: '' }] }))
    }
    function updateInfo(i: number, patch: Partial<{ label: string; value: string }>) {
      setData(prev => ({ ...prev, generalInfo: prev.generalInfo.map((g, idx) => idx === i ? { ...g, ...patch } : g) }))
    }
    function removeInfo(i: number) {
      setData(prev => ({ ...prev, generalInfo: prev.generalInfo.filter((_, idx) => idx !== i) }))
    }
    // Hjelpere for vakter (kun ved opprettelse — redigering skjer inline under arrangement-kortet)
    const availableRolesForShifts = data.roleInfo.map(r => r.role.trim()).filter(Boolean)
    function addNewShift() {
      setData(prev => ({
        ...prev,
        shifts: [...prev.shifts, {
          clientId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          shift_date: prev.date || '',
          start_time: prev.startTime || '',
          end_time: prev.endTime || '',
          role: availableRolesForShifts[0] ?? '',
          capacity: 1,
          notes: '',
        }],
      }))
    }
    function updateNewShift(i: number, patch: Partial<{ shift_date: string; start_time: string; end_time: string; role: string; capacity: number; notes: string }>) {
      setData(prev => ({ ...prev, shifts: prev.shifts.map((s, idx) => idx === i ? { ...s, ...patch } : s) }))
    }
    function removeNewShift(i: number) {
      setData(prev => ({ ...prev, shifts: prev.shifts.filter((_, idx) => idx !== i) }))
    }

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

        {/* Type + Område — stables på mobil så "Arrangement (vakter)" får plass */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
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
          <div className="min-w-0">
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
          <div className="min-w-0">
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Start (valgfritt)</label>
            <input
              type="time"
              value={data.startTime}
              onChange={e => setData(prev => ({ ...prev, startTime: e.target.value }))}
              className={dateTimeClass}
            />
          </div>
          <div className="min-w-0">
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Slutt (valgfritt)</label>
            <input
              type="time"
              value={data.endTime}
              onChange={e => setData(prev => ({ ...prev, endTime: e.target.value }))}
              className={dateTimeClass}
            />
          </div>
        </div>

        {/* Arrangement-felter — kun synlig ved type=arrangement */}
        {data.type === 'arrangement' && (
          <div className="space-y-4 p-4 rounded-2xl bg-surface-low">
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Arrangement-innstillinger</p>

            {/* Påmeldingsfrist */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Påmeldingsfrist (valgfritt)</label>
              <input
                type="datetime-local"
                value={data.signupDeadline}
                onChange={e => setData(prev => ({ ...prev, signupDeadline: e.target.value }))}
                className={dateTimeClass}
              />
            </div>

            {/* Arrangørnavn */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Arrangør (valgfritt)</label>
              <input
                type="text"
                value={data.arrangerName}
                onChange={e => setData(prev => ({ ...prev, arrangerName: e.target.value }))}
                placeholder="f.eks. Clarion, Neon, Olavsfest"
                className={inputClass}
              />
            </div>

            {/* Roller og oppgaver-repeater */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-2">Roller og oppgaver</label>
              <div className="space-y-3">
                {data.roleInfo.map((r, i) => (
                  <div key={i} className="p-3 pr-10 rounded-xl bg-card space-y-2.5 relative">
                    <button
                      type="button"
                      onClick={() => removeRole(i)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full text-danger/70 flex items-center justify-center active:bg-danger/10 active:text-danger transition-colors"
                      aria-label="Slett rolle"
                    >
                      <X size={14} />
                    </button>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Rolle</label>
                      <input
                        type="text"
                        value={r.role}
                        onChange={e => updateRole(i, { role: e.target.value })}
                        placeholder="F.eks. Renhold, Host/servering"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Kontaktperson hos arrangør <span className="text-text-tertiary/70 font-normal normal-case">(valgfritt)</span></label>
                      <input
                        type="text"
                        value={r.contact}
                        onChange={e => updateRole(i, { contact: e.target.value })}
                        placeholder="F.eks. Inger/Gita"
                        className={inputClass}
                      />
                      <p className="text-[11px] text-text-tertiary mt-1">Vises som "Ansvarlig hos [arrangør]: [navn]" på vaktsiden.</p>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Oppgaver</label>
                      <textarea
                        value={r.tasks}
                        onChange={e => updateRole(i, { tasks: e.target.value })}
                        placeholder="Én oppgave per linje&#10;F.eks.&#10;Sjekk billett&#10;Vis vei til plass&#10;Hold orden ved inngang"
                        rows={4}
                        className={`${inputClass} resize-none`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addRole}
                className="mt-2 text-[13px] font-medium text-accent hover:underline"
              >
                + Legg til rolle
              </button>
            </div>

            {/* Generell informasjon-repeater */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-2">Generell informasjon</label>
              <div className="space-y-2">
                {data.generalInfo.map((g, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] gap-2 items-center">
                    <input
                      type="text"
                      value={g.label}
                      onChange={e => updateInfo(i, { label: e.target.value })}
                      placeholder="Kleskode"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={g.value}
                      onChange={e => updateInfo(i, { value: e.target.value })}
                      placeholder="Helsvart klær"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeInfo(i)}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-text-tertiary hover:text-error active:bg-danger/10 transition-colors"
                      aria-label="Slett info-punkt"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addInfo}
                className="mt-2 text-[13px] font-medium text-accent hover:underline"
              >
                + Legg til info-punkt
              </button>
            </div>

            {/* Vakter — kun ved opprettelse. Redigering etterpå skjer under arrangement-kortet. */}
            {mode === 'create' ? (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-2">Vakter</label>

                {data.shifts.length === 0 && (
                  <p className="text-xs text-text-secondary mb-2">Ingen vakter lagt til ennå. Legg til én rad per vakt — én rad gir én tilgjengelig plass per "antall".</p>
                )}

                <div className="space-y-2">
                  {data.shifts.map((s, idx) => (
                    <div key={s.clientId} className="relative p-3 pr-10 bg-card rounded-xl ring-1 ring-text-tertiary/10 space-y-2.5">
                      {/* Slett-knapp øverst til høyre */}
                      <button
                        type="button"
                        onClick={() => removeNewShift(idx)}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full text-danger/70 text-xl leading-none flex items-center justify-center active:bg-danger/10 active:text-danger transition-colors"
                        aria-label="Fjern vakt"
                      >
                        ×
                      </button>

                      {/* Dato — egen rad */}
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Dato</label>
                        <input
                          type="date"
                          value={s.shift_date}
                          onChange={e => updateNewShift(idx, { shift_date: e.target.value })}
                          className={`${dateTimeClass} text-sm`}
                        />
                      </div>

                      {/* Fra–til på samme rad */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Fra</label>
                          <input
                            type="time"
                            value={s.start_time}
                            onChange={e => updateNewShift(idx, { start_time: e.target.value })}
                            className={`${dateTimeClass} text-sm`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Til</label>
                          <input
                            type="time"
                            value={s.end_time}
                            onChange={e => updateNewShift(idx, { end_time: e.target.value })}
                            className={`${dateTimeClass} text-sm`}
                          />
                        </div>
                      </div>

                      {/* Rolle + antall */}
                      <div className="grid grid-cols-[1fr_5rem] gap-2 items-end">
                        <div className="min-w-0">
                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Rolle</label>
                          <select
                            value={s.role}
                            onChange={e => updateNewShift(idx, { role: e.target.value })}
                            className={`${inputClass} text-sm`}
                          >
                            <option value="">Velg rolle</option>
                            {availableRolesForShifts.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Antall</label>
                          <input
                            type="number"
                            min={1}
                            value={s.capacity}
                            onChange={e => updateNewShift(idx, { capacity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            className={`${inputClass} text-sm text-center`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addNewShift}
                  disabled={availableRolesForShifts.length === 0}
                  className="mt-2 text-[13px] font-medium text-accent hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                  title={availableRolesForShifts.length === 0 ? 'Legg til minst én rolle først' : undefined}
                >
                  + Legg til vakt
                </button>
                {availableRolesForShifts.length === 0 && (
                  <p className="text-[11px] text-text-tertiary mt-1">Legg til minst én rolle over før du kan opprette vakter.</p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-card ring-1 ring-text-tertiary/10 text-xs text-text-secondary">
                Vakter redigeres ved å lukke redigering og ekspandere arrangement-kortet.
              </div>
            )}
          </div>
        )}

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

        {/* Push-toggle — kontrollerer om varsel sendes ved aktivering */}
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-low">
          <input
            type="checkbox"
            id="sendPushOnActivate"
            checked={data.sendPushOnActivate}
            onChange={e => setData(prev => ({ ...prev, sendPushOnActivate: e.target.checked }))}
            className="mt-0.5 w-4 h-4 accent-accent"
          />
          <label htmlFor="sendPushOnActivate" className="text-sm text-text-secondary cursor-pointer leading-snug">
            <span className="font-medium text-text-primary block">Send push-varsel når dugnaden aktiveres</span>
            <span className="text-xs">Skru av ved testing for å unngå at alle 130 foreldre får beskjed.</span>
          </label>
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <BrandLink />
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
        <Button size="sm" className="rounded-full" onClick={() => {
          if (showForm) {
            // Avbryt — nullstill skjema slik at neste opprettelse starter friskt
            setForm({ ...emptyForm })
            setErrorMsg(null)
          }
          setShowForm(!showForm)
        }}>
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

                    {/* Soneprogresjon — ikke for arrangement (har egen vakt-oversikt) */}
                    {event.zoneStats.total > 0 && event.type !== 'arrangement' && (
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

                          {/* Plastdugnad-import: KMZ-soner + Tutti-musikanter */}
                          {event.type === 'plast' && !isEditing && (
                            <div className="space-y-3 p-3 rounded-2xl bg-accent/5">
                              <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-accent" />
                                <p className="text-sm font-semibold font-[var(--font-display)]">Plastdugnad-import</p>
                              </div>

                              {/* Status */}
                              {event.zoneStats.total === 0 && (
                                <p className="text-xs text-text-secondary">
                                  Ingen soner opprettet enda. Last opp KMZ fra Google Maps for å lage 6 ryddesoner og møteplass.
                                </p>
                              )}
                              {event.zoneStats.total > 0 && (
                                <p className="text-xs text-text-secondary">
                                  {event.zoneStats.total} soner opprettet. Last opp Tutti-CSV for å fordele musikanter.
                                </p>
                              )}

                              {/* KMZ-upload */}
                              <label className="block">
                                <input
                                  type="file"
                                  accept=".kmz,application/vnd.google-earth.kmz"
                                  className="hidden"
                                  disabled={plastImporting === event.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) requestKmzUpload(event.id, f)
                                    e.target.value = ''
                                  }}
                                />
                                <span className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-full bg-accent/10 text-accent text-sm font-medium cursor-pointer active:bg-accent/20 transition-colors">
                                  <Upload size={14} />
                                  {plastImporting === event.id ? 'Importerer…' : (event.zoneStats.total > 0 ? 'Last opp KMZ på nytt' : 'Last opp KMZ med soner')}
                                </span>
                              </label>

                              {/* CSV-upload (kun når soner finnes) */}
                              {event.zoneStats.total > 0 && (
                                <label className="block">
                                  <input
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    disabled={plastImporting === event.id}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0]
                                      if (f) requestCsvUpload(event.id, f)
                                      e.target.value = ''
                                    }}
                                  />
                                  <span className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-full bg-success/10 text-success text-sm font-medium cursor-pointer active:bg-success/20 transition-colors">
                                    <Users size={14} />
                                    {plastImporting === event.id ? 'Importerer…' : 'Last opp Tutti-CSV med musikanter'}
                                  </span>
                                </label>
                              )}

                              {/* Resultat-melding */}
                              {plastImportResult?.eventId === event.id && (
                                <div className={`p-2 rounded-2xl text-xs ${plastImportResult.isError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                                  {plastImportResult.message}
                                </div>
                              )}

                              {/* Møteplass-info */}
                              {event.meeting_point && (
                                <div className="p-2 rounded-2xl bg-card text-xs">
                                  <div className="flex items-center gap-1.5 font-medium text-text-primary">
                                    <MapPin size={12} className="text-accent" />
                                    {event.meeting_point.name}
                                  </div>
                                  <div className="text-text-tertiary mt-0.5">
                                    {event.meeting_point.lat.toFixed(5)}, {event.meeting_point.lng.toFixed(5)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Vakt-administrasjon for arrangement-events */}
                          {event.type === 'arrangement' && !isEditing && (() => {
                            const shifts = shiftsByEvent.get(event.id) ?? []
                            const isSaving = savingShifts.has(event.id)
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const roles = ((event as any).role_info as Array<{ role: string }> | null | undefined)?.map(r => r.role) ?? []

                            // Oppdater én rad i state
                            function updateShift(idx: number, patch: Partial<ShiftRow>) {
                              setShiftsByEvent(prev => {
                                const next = new Map(prev)
                                const rows = [...(next.get(event.id) ?? [])]
                                rows[idx] = { ...rows[idx], ...patch }
                                next.set(event.id, rows)
                                return next
                              })
                            }

                            // Fjern én rad fra state — DB-sletting håndteres ved lagring
                            function removeShift(idx: number) {
                              setShiftsByEvent(prev => {
                                const next = new Map(prev)
                                const rows = [...(next.get(event.id) ?? [])]
                                rows.splice(idx, 1)
                                next.set(event.id, rows)
                                return next
                              })
                            }

                            // Legg til tom rad
                            function addShift() {
                              setShiftsByEvent(prev => {
                                const next = new Map(prev)
                                const rows = [...(next.get(event.id) ?? [])]
                                rows.push({ clientId: newClientId(), shift_date: '', start_time: '', end_time: '', role: roles[0] ?? '', capacity: 1, notes: '' })
                                next.set(event.id, rows)
                                return next
                              })
                            }

                            // Lagre — diff mot DB: INSERT nye, UPDATE eksisterende, DELETE fjernede
                            async function saveShifts() {
                              setSavingShifts(prev => new Set(prev).add(event.id))
                              setErrorMsg(null)
                              try {
                                // Les ferskeste state — closure-versjonen kan være utdatert hvis Realtime har skutt inn rader
                                const liveShifts = shiftsByEvent.get(event.id) ?? shifts

                                // Hent gjeldende DB-IDer for å finne slettede
                                const { data: dbRows, error: selectErr } = await supabaseRef.current
                                  .from('event_shifts')
                                  .select('id')
                                  .eq('event_id', event.id) as unknown as { data: Array<{ id: string }> | null; error: { message?: string } | null }
                                if (selectErr) {
                                  setErrorMsg(`Kunne ikke hente eksisterende vakter: ${selectErr.message ?? 'ukjent feil'}`)
                                  return
                                }
                                const dbIds = new Set((dbRows ?? []).map(r => r.id))
                                const currentIds = new Set(liveShifts.filter(s => s.id).map(s => s.id as string))

                                // Slett rader som er fjernet fra state
                                const toDelete = [...dbIds].filter(id => !currentIds.has(id))
                                if (toDelete.length > 0) {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  const { error: delErr } = await (supabaseRef.current.from('event_shifts') as any).delete().in('id', toDelete)
                                  if (delErr) {
                                    setErrorMsg(`Kunne ikke slette gamle vakter: ${delErr.message ?? 'ukjent feil'}`)
                                    return
                                  }
                                }

                                // Filtrer ut rader uten påkrevde felt
                                const valid = liveShifts.filter(s => s.shift_date && s.role && s.capacity > 0)
                                const toInsert = valid.filter(s => !s.id)
                                const toUpdate = valid.filter(s => !!s.id)

                                if (toInsert.length > 0) {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  const { error: insErr } = await (supabaseRef.current.from('event_shifts') as any).insert(
                                    toInsert.map(s => ({
                                      event_id: event.id,
                                      role: s.role,
                                      shift_date: s.shift_date,
                                      start_time: s.start_time || '00:00',
                                      end_time: s.end_time || '00:00',
                                      capacity: s.capacity,
                                      notes: s.notes || null,
                                    }))
                                  )
                                  if (insErr) {
                                    setErrorMsg(`Kunne ikke lagre nye vakter: ${insErr.message ?? 'ukjent feil'}`)
                                    return
                                  }
                                }

                                // Kjør alle UPDATE-er parallelt og fang første feil
                                const updateResults = await Promise.all(toUpdate.map(s =>
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  (supabaseRef.current.from('event_shifts') as any).update({
                                    role: s.role,
                                    shift_date: s.shift_date,
                                    start_time: s.start_time || '00:00',
                                    end_time: s.end_time || '00:00',
                                    capacity: s.capacity,
                                    notes: s.notes || null,
                                  }).eq('id', s.id)
                                ))
                                const updErr = updateResults.find((r: { error: unknown }) => r.error)
                                if (updErr) {
                                  const e = (updErr as { error: { message?: string } }).error
                                  setErrorMsg(`Kunne ikke oppdatere vakter: ${e.message ?? 'ukjent feil'}`)
                                  return
                                }

                                await reloadShifts(event.id)
                              } finally {
                                setSavingShifts(prev => { const next = new Set(prev); next.delete(event.id); return next })
                              }
                            }

                            return (
                              <div className="space-y-3 p-3 rounded-2xl bg-accent/5">
                                <div className="flex items-center gap-2">
                                  <Users size={16} className="text-accent" />
                                  <p className="text-sm font-semibold font-[var(--font-display)]">Vakter</p>
                                </div>

                                {shifts.length === 0 && (
                                  <p className="text-xs text-text-secondary">Ingen vakter lagt til ennå.</p>
                                )}

                                {/* Vaktliste */}
                                <div className="space-y-2">
                                  {shifts.map((s, idx) => (
                                    <div key={s.clientId} className="relative p-3 pr-10 bg-card rounded-xl ring-1 ring-text-tertiary/10 space-y-2.5">
                                      {/* Slett-knapp øverst til høyre */}
                                      <button
                                        type="button"
                                        onClick={() => removeShift(idx)}
                                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full text-danger/70 text-xl leading-none flex items-center justify-center active:bg-danger/10 active:text-danger transition-colors"
                                        aria-label="Fjern vakt"
                                      >
                                        ×
                                      </button>

                                      {/* Dato — egen rad */}
                                      <div>
                                        <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Dato</label>
                                        <input
                                          type="date"
                                          value={s.shift_date}
                                          onChange={e => updateShift(idx, { shift_date: e.target.value })}
                                          className={`${dateTimeClass} text-sm`}
                                        />
                                      </div>

                                      {/* Fra–til på samme rad */}
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Fra</label>
                                          <input
                                            type="time"
                                            value={s.start_time}
                                            onChange={e => updateShift(idx, { start_time: e.target.value })}
                                            className={`${dateTimeClass} text-sm`}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Til</label>
                                          <input
                                            type="time"
                                            value={s.end_time}
                                            onChange={e => updateShift(idx, { end_time: e.target.value })}
                                            className={`${dateTimeClass} text-sm`}
                                          />
                                        </div>
                                      </div>

                                      {/* Rolle + antall */}
                                      <div className="grid grid-cols-[1fr_5rem] gap-2 items-end">
                                        <div className="min-w-0">
                                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Rolle</label>
                                          <select
                                            value={s.role}
                                            onChange={e => updateShift(idx, { role: e.target.value })}
                                            className={`${inputClass} text-sm`}
                                          >
                                            <option value="">Velg rolle</option>
                                            {roles.map(r => (
                                              <option key={r} value={r}>{r}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] uppercase tracking-wide text-text-tertiary font-semibold mb-1">Antall</label>
                                          <input
                                            type="number"
                                            min={1}
                                            value={s.capacity}
                                            onChange={e => updateShift(idx, { capacity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                            className={`${inputClass} text-sm text-center`}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Legg til + lagre */}
                                <button
                                  type="button"
                                  onClick={addShift}
                                  className="flex items-center gap-1.5 text-xs text-accent font-medium px-3 py-2 rounded-full bg-accent/10 active:bg-accent/20 transition-colors"
                                >
                                  <Plus size={13} />
                                  Legg til vakt
                                </button>

                                <button
                                  type="button"
                                  onClick={saveShifts}
                                  disabled={isSaving}
                                  className="w-full py-2.5 rounded-full bg-accent text-white text-sm font-medium active:bg-accent/80 disabled:opacity-50 transition-colors"
                                >
                                  {isSaving ? 'Lagrer…' : 'Lagre vakter'}
                                </button>

                                <a
                                  href={`/api/admin/arrangement/${event.id}/export`}
                                  download
                                  className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-full bg-accent/10 text-accent text-sm font-medium active:bg-accent/20 transition-colors"
                                >
                                  <Download size={14} />
                                  Last ned vaktliste (.csv)
                                </a>

                                <button
                                  onClick={() => triggerShiftReminders(event.id)}
                                  disabled={triggerReminders === event.id}
                                  className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-full bg-accent/10 text-accent text-sm font-medium active:bg-accent/20 transition-colors disabled:opacity-50"
                                >
                                  <Bell size={14} />
                                  {triggerReminders === event.id ? 'Sender…' : 'Send 24t-påminnelser nå'}
                                </button>
                                {triggerReminderResult?.eventId === event.id && (
                                  <div className={`p-2 rounded-2xl text-xs text-center ${triggerReminderResult.isError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                                    {triggerReminderResult.message}
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Sonestatistikk — kun for sonebaserte dugnader, ikke arrangement (som bruker vakter) */}
                          {event.type !== 'arrangement' && (
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
                          )}

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
                                    'edit',
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Avbryt — nullstill redigerings-state
                                      setEditForm({ ...emptyForm })
                                      setEditingId(null)
                                      setErrorMsg(null)
                                    }}
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
                                      {event.type === 'arrangement'
                                        ? 'Hendelsen, alle vakter og påmeldinger blir permanent slettet.'
                                        : 'Hendelsen og alle sonetildelinger blir permanent slettet.'}
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
                                      {event.type === 'arrangement'
                                        ? `${event.zoneStats.claimed + event.zoneStats.completed} påmeldinger er registrert. De beholdes men skjules for brukerne.`
                                        : `${event.zoneStats.claimed + event.zoneStats.completed} soner er tatt av deltakere. Claims beholdes men skjules for brukerne.`}
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
                                      {event.type === 'arrangement'
                                        ? `Alle ${event.zoneStats.claimed + event.zoneStats.completed} påmeldinger slettes permanent. Deltakerne mister vaktene sine.`
                                        : `Alle ${event.zoneStats.claimed + event.zoneStats.completed} tatte soner slettes permanent. Deltakerne mister sine valgte soner.`}
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

                          {/* Fullførings-dialog — innhold tilpasses event.type */}
                          <AnimatePresence>
                            {completeConfirmId === event.id && (() => {
                              // Antall-felt vises kun for sone-baserte dugnader. Arrangement og diverse
                              // har bare notatfelt siden tallet ikke gir mening der.
                              const showCountField = event.type === 'plast' || event.type === 'bottle_collection' || event.type === 'lapper'
                              const countLabel =
                                event.type === 'plast' ? 'Hvor mange sekker ble levert?' :
                                event.type === 'bottle_collection' ? 'Hvor mange flasker/panteenheter?' :
                                event.type === 'lapper' ? 'Hvor mange lapper ble levert?' :
                                ''
                              const countPlaceholder =
                                event.type === 'plast' ? 'F.eks. 45' :
                                event.type === 'bottle_collection' ? 'F.eks. 1200' :
                                event.type === 'lapper' ? 'F.eks. 350' :
                                ''
                              const heading =
                                event.type === 'plast' ? 'Fullfør plastdugnad' :
                                event.type === 'bottle_collection' ? 'Fullfør flaskeinnsamling' :
                                event.type === 'lapper' ? 'Fullfør lappeutdeling' :
                                event.type === 'arrangement' ? 'Fullfør arrangement' :
                                'Fullfør hendelsen'
                              return (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-2xl overflow-hidden bg-success/5">
                                  <div className="p-4">
                                    <CheckCircle size={32} className="text-success mx-auto mb-2" />
                                    <p className="text-[15px] font-medium mb-3 text-center font-[var(--font-display)]">{heading}</p>
                                    <div className="space-y-3">
                                      {showCountField && (
                                        <div>
                                          <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">{countLabel}</label>
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            value={completeBags}
                                            onChange={e => setCompleteBags(e.target.value)}
                                            placeholder={countPlaceholder}
                                            className={inputClass}
                                          />
                                        </div>
                                      )}
                                      <div>
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">
                                          {event.type === 'arrangement' ? 'Hvordan gikk det? (valgfritt)' : 'Annet å notere? (valgfritt)'}
                                        </label>
                                        <textarea
                                          value={completeNotes}
                                          onChange={e => setCompleteNotes(e.target.value)}
                                          rows={2}
                                          placeholder={event.type === 'arrangement' ? 'F.eks. Bra oppmøte, alle vakter dekket' : 'F.eks. Fantastisk oppmøte, ferdig på 1,5 time'}
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
                              )
                            })()}
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

                              {event.status === 'active' && (() => {
                                const signupLocked = !!event.signup_deadline && new Date(event.signup_deadline) < new Date()
                                return (
                                  <div className="space-y-3">
                                    {event.zoneStats.available > 0 && event.type !== 'arrangement' && (
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

                                    {/* Lås / åpne påmelding — kun for arrangement-events */}
                                    {event.type === 'arrangement' && !signupLocked && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        className="w-full rounded-full"
                                        loading={lockingId === event.id}
                                        onClick={() => handleToggleSignupLock(event.id, true)}
                                      >
                                        Lås påmelding nå
                                      </Button>
                                    )}
                                    {event.type === 'arrangement' && signupLocked && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        className="w-full rounded-full"
                                        loading={lockingId === event.id}
                                        onClick={() => handleToggleSignupLock(event.id, false)}
                                      >
                                        Åpne påmelding igjen
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
                                )
                              })()}

                              {/* Nullstill claims — kun for sonebaserte dugnader */}
                              {(event.zoneStats.claimed + event.zoneStats.completed) > 0 && event.type !== 'arrangement' && (
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

    <ConfirmDialog
      open={!!pendingKmz}
      title={pendingKmz?.title || ''}
      message={pendingKmz?.message || ''}
      confirmLabel="Erstatt"
      variant="danger"
      loading={plastImporting === pendingKmz?.eventId}
      onCancel={() => setPendingKmz(null)}
      onConfirm={() => {
        if (pendingKmz) {
          handleKmzUpload(pendingKmz.eventId, pendingKmz.file)
          setPendingKmz(null)
        }
      }}
    />

    <ConfirmDialog
      open={!!pendingCsv}
      title={pendingCsv?.title || ''}
      message={pendingCsv?.message || ''}
      confirmLabel="Oppdater"
      variant="warning"
      loading={plastImporting === pendingCsv?.eventId}
      onCancel={() => setPendingCsv(null)}
      onConfirm={() => {
        if (pendingCsv) {
          handleCsvUpload(pendingCsv.eventId, pendingCsv.file)
          setPendingCsv(null)
        }
      }}
    />
    </>
  )
}
