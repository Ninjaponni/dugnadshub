'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { User, LogOut, Shield, Bell } from 'lucide-react'
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
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
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
      } else {
        // Ny bruker — vis redigeringsskjema
        setEditing(true)
        setForm({ full_name: '', phone: '', child_name: '', child_group: '' })
      }
    }

    load()
  }, [supabase])

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
        const { data: { session } } = await supabase.auth.getSession()
        await unsubscribeFromPush(session?.access_token || '')
        setPushEnabled(false)
      } else {
        const registration = await navigator.serviceWorker?.ready
        if (registration) {
          const subscription = await subscribeToPush(registration)
          if (subscription) {
            const { data: { session } } = await supabase.auth.getSession()
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any)
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
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data as unknown as Profile)
    }
    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
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

          {/* Versjon */}
          <p className="text-center text-[11px] text-text-tertiary mt-8">
            Tillerbyen Skolekorps Dugnadshub v 3.3
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
