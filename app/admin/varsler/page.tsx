'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { ArrowLeft, Send, AlertTriangle, Check } from 'lucide-react'
import Link from 'next/link'

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  collector: 'Samler',
  driver: 'Sjåfør',
  strapper: 'Strapper',
}

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
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  const inputClass = 'w-full min-w-0 px-3 py-2 rounded-xl bg-black/5 text-[15px] outline-none focus:ring-2 focus:ring-accent/30 box-border'

  function toggleRole(role: string) {
    setSendToAll(false)
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  function toggleGroup(group: string) {
    setSendToAll(false)
    setSelectedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    )
  }

  function handleAllToggle() {
    setSendToAll(true)
    setSelectedRoles([])
    setSelectedGroups([])
  }

  async function handleSend() {
    setSending(true)
    setShowConfirm(false)

    const { data: { session } } = await supabaseRef.current.auth.getSession()
    if (!session) { setSending(false); return }

    const filter: Record<string, unknown> = {}
    if (sendToAll) {
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
      setResult(data)
    } catch {
      setResult({ sent: 0, failed: 0 })
    }
    setSending(false)
  }

  const canSend = title.trim() && body.trim() && (sendToAll || selectedRoles.length > 0 || selectedGroups.length > 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/oversikt" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={18} className="text-text-secondary" />
        </Link>
        <h2 className="text-xl font-semibold flex-1">Send varsel</h2>
      </div>

      <Card className="p-4 space-y-4">
        {/* Tittel */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Tittel</label>
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
          <label className="text-xs font-medium text-text-secondary block mb-1">Melding</label>
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
          <label className="text-xs font-medium text-text-secondary block mb-1">Lenke (valgfritt)</label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="/kart eller /hjem"
            className={inputClass}
          />
        </div>

        {/* Mottakere */}
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-2">Mottakere</label>

          {/* Alle-toggle */}
          <button
            onClick={handleAllToggle}
            className={`px-3 py-1.5 rounded-full text-xs font-medium mr-2 mb-2 transition-colors ${
              sendToAll ? 'bg-accent text-white' : 'bg-black/5 text-text-secondary'
            }`}
          >
            Alle
          </button>

          {/* Rolle-filter */}
          <p className="text-[11px] text-text-tertiary mt-2 mb-1">Roller</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Object.entries(roleLabels).map(([role, label]) => (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedRoles.includes(role) ? 'bg-accent text-white' : 'bg-black/5 text-text-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Barnegruppe-filter */}
          <p className="text-[11px] text-text-tertiary mb-1">Barnegruppe</p>
          <div className="flex flex-wrap gap-1.5">
            {groupLabels.map(group => (
              <button
                key={group}
                onClick={() => toggleGroup(group)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedGroups.includes(group) ? 'bg-accent text-white' : 'bg-black/5 text-text-secondary'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Send-knapp */}
        <Button
          className="w-full"
          disabled={!canSend}
          onClick={() => setShowConfirm(true)}
        >
          <Send size={14} />
          Send varsel
        </Button>
      </Card>

      {/* Bekreftelsesdialog */}
      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowConfirm(false)} />
          <div className="fixed left-6 right-6 top-1/3 z-50 bg-card rounded-2xl overflow-hidden shadow-xl max-w-sm mx-auto">
            <div className="p-5 text-center">
              <AlertTriangle size={32} className="text-warning mx-auto mb-2" />
              <p className="font-medium mb-1">Send varsel?</p>
              <p className="text-sm text-text-secondary">
                {sendToAll ? 'Sendes til alle brukere' :
                  [
                    selectedRoles.length > 0 && `Roller: ${selectedRoles.map(r => roleLabels[r]).join(', ')}`,
                    selectedGroups.length > 0 && `Grupper: ${selectedGroups.join(', ')}`,
                  ].filter(Boolean).join(' · ')
                }
              </p>
              <p className="text-sm font-medium mt-2">&quot;{title}&quot;</p>
            </div>
            <div className="flex border-t border-black/5">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 text-sm font-medium text-text-secondary border-r border-black/5 active:bg-black/5"
              >
                Avbryt
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 py-3 text-sm font-medium text-accent active:bg-accent/10"
              >
                {sending ? 'Sender...' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Resultat */}
      {result && (
        <Card className="p-4 mt-4 text-center">
          <Check size={24} className="text-success mx-auto mb-2" />
          <p className="font-medium">Varsel sendt!</p>
          <p className="text-sm text-text-secondary">
            {result.sent} mottok · {result.failed} feilet
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => { setResult(null); setTitle(''); setBody(''); setUrl('') }}
          >
            Send nytt varsel
          </Button>
        </Card>
      )}
    </div>
  )
}
