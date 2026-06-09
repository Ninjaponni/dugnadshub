'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import BrandLink from '@/components/layout/BrandLink'
import { ArrowLeft, Send, AlertTriangle, Check, Users } from 'lucide-react'
import Link from 'next/link'
import { ROLE_LABELS } from '@/lib/roles'
import type { Role } from '@/lib/supabase/types'

type CompletedEvent = { id: string; title: string; date: string }
type ParticipantPreview = { count: number; users: Array<{ id: string; full_name: string | null }> }

const groupLabels = ['Aspirant', 'Junior', 'Hovedkorps']

// Admin-side for a sende push-varsler med filtrering
export default function AdminNotificationsPage() {
  const supabaseRef = useRef(createClient())
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [sendToAll, setSendToAll] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [completedEvents, setCompletedEvents] = useState<CompletedEvent[]>([])
  const [preview, setPreview] = useState<ParticipantPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [toastSuccess, setToastSuccess] = useState<{ sent: number } | null>(null)

  // Hent ferdige arrangementer ved første render
  useEffect(() => {
    const supabase = supabaseRef.current
    supabase
      .from('events')
      .select('id, title, date')
      .eq('status', 'completed')
      .order('date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setCompletedEvents(data as CompletedEvent[])
      })
  }, [])

  // Hent forhåndsvisning av deltakere når event velges
  useEffect(() => {
    if (!selectedEventId) {
      setPreview(null)
      return
    }
    let cancelled = false
    setLoadingPreview(true)
    setPreview(null) // tøm gammel preview før ny henting
    ;(async () => {
      const supabase = supabaseRef.current
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingPreview(false); return }
      try {
        const res = await fetch(`/api/admin/event-participants/${selectedEventId}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
        if (!cancelled) {
          if (res.ok) {
            setPreview(await res.json())
          } else {
            setPreview({ count: 0, users: [] })
          }
        }
      } catch {
        if (!cancelled) setPreview({ count: 0, users: [] })
      }
      if (!cancelled) setLoadingPreview(false)
    })()
    return () => { cancelled = true }
  }, [selectedEventId])

  const inputClass = 'w-full min-w-0 px-3 py-2 rounded-[12px] bg-card ring-1 ring-text-tertiary/20 text-[15px] outline-none focus:ring-2 focus:ring-accent/30 box-border'

  function toggleRole(role: string) {
    setSendToAll(false)
    setSelectedEventId('')
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  function toggleGroup(group: string) {
    setSendToAll(false)
    setSelectedEventId('')
    setSelectedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    )
  }

  function handleAllToggle() {
    setSendToAll(true)
    setSelectedRoles([])
    setSelectedGroups([])
    setSelectedEventId('')
  }

  function handleEventChange(eventId: string) {
    setSelectedEventId(eventId)
    if (eventId) {
      setSendToAll(false)
      setSelectedRoles([])
      setSelectedGroups([])
    }
  }

  async function handleSend() {
    setSending(true)
    setShowConfirm(false)

    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) { setSending(false); return }

    const filter: Record<string, unknown> = {}
    if (selectedEventId) {
      filter.eventId = selectedEventId
    } else if (sendToAll) {
      filter.all = true
    } else {
      if (selectedRoles.length > 0) filter.roles = selectedRoles
      if (selectedGroups.length > 0) filter.childGroups = selectedGroups
    }

    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, body, url: url || undefined, filter }),
      })
      const data = await res.json()
      if (res.ok && data.sent > 0) {
        // Vellykket — tøm felt og vis toast
        setTitle('')
        setBody('')
        setUrl('')
        setSelectedRoles([])
        setSelectedGroups([])
        setSendToAll(true)
        setToastSuccess({ sent: data.sent })
        setTimeout(() => setToastSuccess(null), 4000)
      } else {
        // Ingen ble nådd eller feil — vis info-card
        setResult(data)
      }
    } catch {
      setResult({ sent: 0, failed: 0 })
    }
    setSending(false)
  }

  // Hvis admin har valgt en aktivitet må preview være ferdig lastet før Send aktiveres,
  // så telleren i UI matcher faktisk antall mottakere.
  const eventReady = selectedEventId === '' || (!loadingPreview && preview !== null)
  const canSend = !!title.trim() && !!body.trim() && eventReady && (sendToAll || selectedRoles.length > 0 || selectedGroups.length > 0 || selectedEventId !== '')

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card safe-top">
        <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
          <BrandLink />
          <div className="w-9" />
        </div>
      </header>
      <div className="pt-16 lg:pt-0 pb-28">

      {/* Tilbake + tittel */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/oversikt" className="w-8 h-8 rounded-full flex items-center justify-center active:bg-surface-low shrink-0">
          <ArrowLeft size={20} className="text-accent" />
        </Link>
        <h2 className="text-xl font-bold text-accent font-[var(--font-display)] flex-1">Varsler</h2>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">

        {/* Venstre: meldingsinnhold */}
        <Card className="p-5 space-y-5 rounded-2xl">
          {/* Tittel */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Tittel</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="F.eks. Dugnad i morgen!"
              className={inputClass}
            />
          </div>

          {/* Melding */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Melding</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Skriv meldingen som skal vises i varselet..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* URL (valgfritt) */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">Lenke (valgfritt)</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="/kart eller /hjem"
              className={inputClass}
            />
          </div>
        </Card>

        {/* Høyre: mottakere + send */}
        <Card className="p-5 space-y-5 rounded-2xl mt-4 lg:mt-0 lg:sticky lg:top-24">
          {/* Mottakere */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-text-secondary block mb-3">Mottakere</label>

            {/* Ferdig aktivitet — overskriver rolle/gruppe-filter */}
            {completedEvents.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5">Ferdig aktivitet</p>
                <select
                  value={selectedEventId}
                  onChange={e => handleEventChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Velg arrangement…</option>
                  {completedEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title} — {ev.date}</option>
                  ))}
                </select>
                {selectedEventId && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
                    <Users size={14} />
                    {loadingPreview ? (
                      <span>Henter deltakere…</span>
                    ) : preview ? (
                      <span>Vil nå {preview.count} deltaker{preview.count === 1 ? '' : 'e'}</span>
                    ) : null}
                  </div>
                )}
                {preview && preview.users.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="text-xs text-accent cursor-pointer select-none">Vis liste</summary>
                    <ul className="mt-1.5 text-xs text-text-secondary space-y-0.5 max-h-40 overflow-y-auto pl-1">
                      {preview.users.map(u => (
                        <li key={u.id}>{u.full_name || '(uten navn)'}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* Alle-toggle */}
            <button
              onClick={handleAllToggle}
              className={`px-3 py-1.5 rounded-full text-xs font-medium mr-2 mb-2 transition-colors ${
                sendToAll ? 'bg-accent text-white' : 'bg-surface-low text-text-secondary'
              }`}
            >
              Alle
            </button>

            {/* Rolle-filter */}
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mt-3 mb-1.5">Roller</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedRoles.includes(role) ? 'bg-accent text-white' : 'bg-surface-low text-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Barnegruppe-filter */}
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5">Barnegruppe</p>
            <div className="flex flex-wrap gap-1.5">
              {groupLabels.map(group => (
                <button
                  key={group}
                  onClick={() => toggleGroup(group)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedGroups.includes(group) ? 'bg-accent text-white' : 'bg-surface-low text-text-secondary'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Send-knapp */}
          <Button
            className="w-full rounded-full"
            disabled={!canSend}
            onClick={() => setShowConfirm(true)}
          >
            <Send size={14} />
            Send varsel
          </Button>
        </Card>

      </div>

      {/* Bekreftelsesdialog */}
      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowConfirm(false)} />
          <div className="fixed left-6 right-6 top-1/3 z-50 bg-card rounded-2xl overflow-hidden shadow-xl max-w-sm mx-auto">
            <div className="p-5 text-center">
              <AlertTriangle size={32} className="text-warning mx-auto mb-2" />
              <p className="font-medium mb-1 font-[var(--font-display)]">Send varsel?</p>
              <p className="text-sm text-text-secondary">
                {selectedEventId ? (
                  preview
                    ? `Sendes til ${preview.count} deltaker${preview.count === 1 ? '' : 'e'} på ${completedEvents.find(e => e.id === selectedEventId)?.title ?? 'arrangement'}`
                    : 'Sendes til deltakere på valgt arrangement'
                ) : sendToAll ? 'Sendes til alle brukere' :
                  [
                    selectedRoles.length > 0 && `Roller: ${selectedRoles.map(r => ROLE_LABELS[r as Role]).join(', ')}`,
                    selectedGroups.length > 0 && `Grupper: ${selectedGroups.join(', ')}`,
                  ].filter(Boolean).join(' · ')
                }
              </p>
              <p className="text-sm font-medium mt-2">&quot;{title}&quot;</p>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 text-sm font-medium text-text-secondary rounded-full bg-surface-low active:bg-surface-low"
              >
                Avbryt
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 py-3 text-sm font-medium text-accent rounded-full bg-accent/10 active:bg-accent/20"
              >
                {sending ? 'Sender...' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Feil/ingen-mottakere-info — vellykkede sendinger viser toast i stedet */}
      {result && (
        <Card className="p-5 mt-4 text-center rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <p className="font-medium font-[var(--font-display)]">
            {result.sent === 0 ? 'Ingen mottok varselet' : 'Sending feilet'}
          </p>
          <p className="text-sm text-text-secondary mt-1">
            {result.sent} mottok · {result.failed} feilet
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3 rounded-full"
            onClick={() => setResult(null)}
          >
            Lukk
          </Button>
        </Card>
      )}
      </div>

      {/* Suksess-toast */}
      {toastSuccess && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Check size={16} />
          <span className="text-sm font-medium">Varsel sendt til {toastSuccess.sent}</span>
        </div>
      )}
    </>
  )
}
