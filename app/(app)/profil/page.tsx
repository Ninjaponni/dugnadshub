'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { User, LogOut, Shield, Bell, RotateCcw, ClipboardList } from 'lucide-react'
import { isPushSubscribed, subscribeToPush, saveSubscription, unsubscribeFromPush } from '@/lib/push/client'
import type { Profile } from '@/lib/supabase/types'
import Link from 'next/link'

// Profilside — brukerinfo + innstillinger
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '', child_name: '', child_group: '' })
  const [saving, setSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)

  // Mine dugnader — historikk over fullførte hendelser
  const [history, setHistory] = useState<Array<{ title: string; date: string; zones: number }>>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) return

      const { data } = await supabaseRef.current
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        const p = data as unknown as Profile
        setProfile(p)
        setForm({
          full_name: p.full_name || '',
          phone: p.phone || '',
          child_name: p.child_name || '',
          child_group: p.child_group || '',
        })

        // Hent dugnad-historikk: claims → assignments → events (completed)
        const { data: claims } = await supabaseRef.current
          .from('zone_claims')
          .select('assignment_id')
          .eq('user_id', user.id)

        if (claims && claims.length > 0) {
          const assignmentIds = claims.map(c => (c as unknown as { assignment_id: string }).assignment_id)
          const { data: assignments } = await supabaseRef.current
            .from('zone_assignments')
            .select('event_id')
            .in('id', assignmentIds)

          if (assignments && assignments.length > 0) {
            const eventIds = [...new Set(assignments.map(a => (a as unknown as { event_id: string }).event_id))]
            const { data: events } = await supabaseRef.current
              .from('events')
              .select('id, title, date, status')
              .in('id', eventIds)
              .eq('status', 'completed')
              .order('date', { ascending: false })

            if (events && events.length > 0) {
              // Tell soner per hendelse
              const eventAssignmentIds = new Map<string, string[]>()
              for (const a of assignments) {
                const ea = a as unknown as { event_id: string; id?: string }
                // Vi trenger assignment_id → event_id mapping
                // men vi har bare event_id fra assignments. Trenger å koble tilbake.
              }
              // Enklere: grupper claims via assignments per event
              const { data: fullAssignments } = await supabaseRef.current
                .from('zone_assignments')
                .select('id, event_id')
                .in('id', assignmentIds)

              const countPerEvent = new Map<string, number>()
              for (const fa of (fullAssignments || [])) {
                const a = fa as unknown as { id: string; event_id: string }
                const ev = (events as unknown as Array<{ id: string }>).find(e => e.id === a.event_id)
                if (ev) {
                  countPerEvent.set(a.event_id, (countPerEvent.get(a.event_id) || 0) + 1)
                }
              }

              setHistory((events as unknown as Array<{ id: string; title: string; date: string }>).map(e => ({
                title: e.title,
                date: e.date,
                zones: countPerEvent.get(e.id) || 0,
              })))
            }
          }
        }
        setHistoryLoaded(true)
      } else {
        // Ny bruker — vis redigeringsskjema
        setEditing(true)
        setForm({ full_name: '', phone: '', child_name: '', child_group: '' })
        setHistoryLoaded(true)
      }
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sjekk push-status
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true)
      isPushSubscribed().then(setPushEnabled)
    }
  }, [])

  async function togglePush() {
    setPushLoading(true)
    try {
      if (pushEnabled) {
        const { data: { session } } = await supabaseRef.current.auth.getSession()
        await unsubscribeFromPush(session?.access_token || '')
        setPushEnabled(false)
      } else {
        const registration = await navigator.serviceWorker?.ready
        if (registration) {
          const subscription = await subscribeToPush(registration)
          if (subscription) {
            const { data: { session } } = await supabaseRef.current.auth.getSession()
            if (session) {
              const ok = await saveSubscription(subscription, session.access_token)
              if (ok) setPushEnabled(true)
            }
          }
        }
      }
    } catch {
      // Push-toggle feilet stille
    }
    setPushLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabaseRef.current.auth.getUser()
    if (!user) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseRef.current.from('profiles') as any)
      .upsert({
        id: user.id,
        email: user.email!,
        full_name: form.full_name || null,
        phone: form.phone || null,
        child_name: form.child_name || null,
        child_group: form.child_group || null,
      })

    if (!error) {
      setEditing(false)
      // Reload profil
      const { data } = await supabaseRef.current.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data as unknown as Profile)
    }
    setSaving(false)
  }

  async function handleLogout() {
    await supabaseRef.current.auth.signOut()
    router.replace('/logg-inn')
  }

  const inputClass = `w-full px-4 py-3 rounded-xl bg-bg border-0 text-[17px]
    placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30`

  return (
    <div className="px-4 pt-14 safe-top">
      <h1 className="text-[34px] font-bold tracking-tight mb-6">Profil</h1>

      {editing ? (
        <form onSubmit={handleSave}>
          <Card className="p-5 space-y-4">
            <h2 className="text-lg font-semibold">
              {profile ? 'Rediger profil' : 'Fullfør profilen din'}
            </h2>

            <label className="block">
              <span className="text-sm font-medium text-text-secondary mb-1 block">Navn</span>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Ola Nordmann"
                required
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-text-secondary mb-1 block">Telefon</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="912 34 567"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-text-secondary mb-1 block">Barnets navn</span>
              <input
                type="text"
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                placeholder="Lille Nordmann"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-text-secondary mb-1 block">Gruppe</span>
              <select
                value={form.child_group}
                onChange={(e) => setForm({ ...form, child_group: e.target.value })}
                className={inputClass}
              >
                <option value="">Velg gruppe</option>
                <option value="Aspirant">Aspirant</option>
                <option value="Junior">Junior</option>
                <option value="Hovedkorps">Hovedkorps</option>
              </select>
            </label>

            <div className="flex gap-3 pt-2">
              {profile && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setEditing(false)}
                >
                  Avbryt
                </Button>
              )}
              <Button type="submit" size="md" loading={saving} className="flex-1">
                Lagre
              </Button>
            </div>
          </Card>
        </form>
      ) : (
        <>
          {/* Profilkort */}
          <Card className="p-5 mb-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <User size={28} className="text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{profile?.full_name}</h2>
                <p className="text-sm text-text-secondary">{profile?.email}</p>
              </div>
            </div>

            {profile?.child_name && (
              <div className="text-sm text-text-secondary">
                <p>Barn: {profile.child_name}</p>
                {profile.child_group && <p>Gruppe: {profile.child_group}</p>}
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setEditing(true)}
            >
              Rediger profil
            </Button>
          </Card>

          {/* Mine dugnader — historikk */}
          {historyLoaded && history.length > 0 && (
            <Card className="p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList size={18} className="text-accent" />
                <h3 className="font-semibold text-[15px]">Gjennomførte dugnader</h3>
              </div>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{h.title}</p>
                      <p className="text-xs text-text-secondary">
                        {new Date(h.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {h.zones} {h.zones === 1 ? 'sone' : 'soner'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Admin-lenke (kun for admins) */}
          {profile?.role === 'admin' && (
            <Link href="/admin/oversikt">
              <Card className="p-4 mb-4 flex items-center gap-3">
                <Shield size={20} className="text-accent" />
                <span className="font-medium">Administrasjon</span>
              </Card>
            </Link>
          )}

          {/* Push-varsel toggle */}
          {pushSupported && (
            <Card className="p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-accent" />
                <div>
                  <p className="font-medium text-sm">Push-varsler</p>
                  <p className="text-xs text-text-secondary">
                    {pushEnabled ? 'Aktivert' : 'Deaktivert'}
                  </p>
                </div>
              </div>
              <button
                onClick={togglePush}
                disabled={pushLoading}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  pushEnabled ? 'bg-accent' : 'bg-black/10'
                }`}
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  pushEnabled ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
            </Card>
          )}

          {/* Vis onboarding på nytt */}
          <Card className="p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw size={20} className="text-accent" />
              <p className="font-medium text-sm">Vis velkomstguiden på nytt</p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('onboarding_complete')
                router.push('/hjem')
              }}
              className="text-accent text-sm font-medium"
            >
              Vis
            </button>
          </Card>

          {/* Versjon */}
          <p className="text-center text-[11px] text-text-tertiary mt-8">
            Tillerbyen Skolekorps Dugnadshub v 5.6
          </p>

          {/* Logg ut */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-danger py-3 mt-1"
          >
            <LogOut size={18} />
            <span>Logg ut</span>
          </button>
        </>
      )}
    </div>
  )
}
