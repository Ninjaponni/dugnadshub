'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { User, LogOut, Shield, Bell, RotateCcw, ClipboardList, Trash2, Sun, Moon, Monitor, ArrowLeft, Pencil, PlusCircle, ChevronRight, ChevronDown, Music, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import BrandLink from '@/components/layout/BrandLink'
import type { Child, ChildGroup } from '@/lib/supabase/types'
import { isPushSubscribed, subscribeToPush, saveSubscription, unsubscribeFromPush } from '@/lib/push/client'
import { evaluateBadges } from '@/lib/badges/evaluator'
import type { Profile } from '@/lib/supabase/types'
import Link from 'next/link'
import { isMockMode } from '@/lib/mock/useMock'
import { mockProfile, mockHistory, mockDittBidrag } from '@/lib/mock/data'
import type { DittBidragData } from '@/lib/mock/data'
import DittBidrag from '@/components/features/DittBidrag'
import AvatarPicker, { getAvatarUrl, getRandomAvatarId } from '@/components/features/AvatarPicker'
import { useTheme } from '@/lib/hooks/useTheme'

// Profilside — brukerinfo + innstillinger
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [children, setChildren] = useState<Child[]>([])
  const [isMusician, setIsMusician] = useState(false)
  const [musicianGroup, setMusicianGroup] = useState<ChildGroup>('Aspirant')

  const [saving, setSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)

  // Mine dugnader — historikk over fullførte hendelser
  const [history, setHistory] = useState<Array<{ title: string; date: string; label: string }>>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  // Kollapsibel historikk-seksjon — lukket som default på desktop (lg+)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [dittBidrag, setDittBidrag] = useState<DittBidragData | null>(null)
  const [avatarId, setAvatarId] = useState<string>('')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (isMockMode()) {
      setProfile(mockProfile)
      setForm({ full_name: mockProfile.full_name || '', phone: mockProfile.phone || '' })
      setChildren(mockProfile.children || [{ name: '', group: 'Aspirant' as const }])
      setHistory(mockHistory)
      setDittBidrag(mockDittBidrag)
      const savedAvatar = localStorage.getItem('dugnadshub_avatar')
      setAvatarId(savedAvatar || mockProfile.avatar_url || getRandomAvatarId())
      setHistoryLoaded(true)
      return
    }
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
        })
        setChildren(p.children?.length ? p.children : [{ name: '', group: 'Aspirant' as const }])
        setIsMusician(!!p.is_musician)
        if (p.musician_group) setMusicianGroup(p.musician_group)
        setAvatarId(p.avatar_url || getRandomAvatarId())
        setDittBidrag(mockDittBidrag)

        // Hent deltakelse fra alle 6 kilder: soner, vakter, sjåfør/stripser/vert,
        // musikant, dugnadsansvarlig (matching contact_phone), og user_badges
        // med event_id satt (17. mai-merker og lignende koblet til konkrete events).
        const userPhone = (p.phone || '').replace(/\s+/g, '')
        const [zoneRes, shiftRes, driverRes, musRes, allEvents, badgesRes] = await Promise.all([
          supabaseRef.current
            .from('zone_claims')
            .select('zone_assignments!inner(event_id)')
            .eq('user_id', user.id) as unknown as Promise<{ data: Array<{ zone_assignments: { event_id: string } }> | null }>,
          supabaseRef.current
            .from('shift_claims')
            .select('event_shifts!inner(event_id)')
            .eq('user_id', user.id) as unknown as Promise<{ data: Array<{ event_shifts: { event_id: string } }> | null }>,
          supabaseRef.current
            .from('driver_assignments')
            .select('event_id, role')
            .eq('user_id', user.id) as unknown as Promise<{ data: Array<{ event_id: string; role: string }> | null }>,
          supabaseRef.current
            .from('event_musicians')
            .select('event_id')
            .eq('profile_id', user.id) as unknown as Promise<{ data: Array<{ event_id: string }> | null }>,
          // Alle completed events med contact_phone for matching mot brukers telefon
          supabaseRef.current
            .from('events')
            .select('id, contact_phone')
            .eq('status', 'completed') as unknown as Promise<{ data: Array<{ id: string; contact_phone: string | null }> | null }>,
          // Brukers merker med event_id (17. mai etc. koblet til konkrete events)
          supabaseRef.current
            .from('user_badges')
            .select('event_id')
            .eq('user_id', user.id)
            .not('event_id', 'is', null) as unknown as Promise<{ data: Array<{ event_id: string }> | null }>,
        ])

        const responsibleEvents = new Set<string>()
        if (userPhone) {
          for (const e of allEvents.data ?? []) {
            if (e.contact_phone && e.contact_phone.replace(/\s+/g, '') === userPhone) {
              responsibleEvents.add(e.id)
            }
          }
        }
        const badgeEvents = new Set<string>()
        for (const b of badgesRes.data ?? []) {
          if (b.event_id) badgeEvents.add(b.event_id)
        }

        const zonesPerEvent = new Map<string, number>()
        for (const r of zoneRes.data ?? []) {
          const eid = r.zone_assignments?.event_id
          if (eid) zonesPerEvent.set(eid, (zonesPerEvent.get(eid) || 0) + 1)
        }
        const shiftsPerEvent = new Map<string, number>()
        for (const r of shiftRes.data ?? []) {
          const eid = r.event_shifts?.event_id
          if (eid) shiftsPerEvent.set(eid, (shiftsPerEvent.get(eid) || 0) + 1)
        }
        const rolesPerEvent = new Map<string, Set<string>>()
        for (const r of driverRes.data ?? []) {
          if (!r.event_id) continue
          if (!rolesPerEvent.has(r.event_id)) rolesPerEvent.set(r.event_id, new Set())
          rolesPerEvent.get(r.event_id)!.add(r.role)
        }
        const musicianEvents = new Set<string>()
        for (const r of musRes.data ?? []) {
          if (r.event_id) musicianEvents.add(r.event_id)
        }

        const allEventIds = [...new Set([
          ...zonesPerEvent.keys(),
          ...shiftsPerEvent.keys(),
          ...rolesPerEvent.keys(),
          ...musicianEvents,
          ...responsibleEvents,
          ...badgeEvents,
        ])]

        if (allEventIds.length > 0) {
          const { data: events } = await supabaseRef.current
            .from('events')
            .select('id, title, date, status, type')
            .in('id', allEventIds)
            .eq('status', 'completed')
            .order('date', { ascending: false })

          if (events && events.length > 0) {
            const roleLabels: Record<string, string> = {
              driver: 'SJÅFØR',
              strapper: 'STRIPSER',
              host: 'VERT',
            }
            setHistory((events as unknown as Array<{ id: string; title: string; date: string; type: string }>).map(e => {
              const labels: string[] = []
              const zones = zonesPerEvent.get(e.id) || 0
              const shifts = shiftsPerEvent.get(e.id) || 0
              const roles = rolesPerEvent.get(e.id)
              const isMusician = musicianEvents.has(e.id)

              if (e.type === 'arrangement') {
                if (shifts > 0) labels.push(`${shifts} ${shifts === 1 ? 'VAKT' : 'VAKTER'}`)
              } else {
                if (zones > 0) labels.push(`${zones} ${zones === 1 ? 'SONE' : 'SONER'}`)
              }
              if (roles) {
                for (const r of roles) {
                  const lab = roleLabels[r]
                  if (lab) labels.push(lab)
                }
              }
              if (isMusician) labels.push('MUSIKANT')
              if (responsibleEvents.has(e.id)) labels.push('ANSVARLIG')

              return {
                title: e.title,
                date: e.date,
                label: labels.length > 0 ? labels.join(' · ') : 'DELTOK',
              }
            }))
          }
        }
        setHistoryLoaded(true)
      } else {
        // Ny bruker — vis redigeringsskjema
        setEditing(true)
        setForm({ full_name: '', phone: '' })
        setChildren([{ name: '', group: 'Aspirant' as const }])
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
    if (!user) { setSaving(false); return }

    // Behold children-array selv ved musikant — admin kan trykke feil, og data
    // skal ikke gå tapt hvis bruker bytter type
    const childrenToSave = isMusician
      ? (profile?.children || [])
      : children.filter(c => c.name.trim())

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseRef.current.from('profiles') as any)
      .upsert({
        id: user.id,
        email: user.email!,
        full_name: form.full_name || null,
        phone: form.phone || null,
        children: childrenToSave,
        is_musician: isMusician,
        musician_group: isMusician ? musicianGroup : null,
      })

    if (!error) {
      // Re-evaluer badges (tildeler Profil-proffen hvis kriteriene er møtt)
      try { await evaluateBadges(user.id) } catch { /* noop — admin kan tildele manuelt */ }
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

  const inputClass = `w-full px-4 py-3 rounded-[12px] bg-surface-low border-0 text-[17px]
    placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20`

  return (
    <div className={editing ? 'px-4 pt-14 safe-top' : ''}>
      {editing ? (
        <>
        {/* Tilbake-pil + "Profil" i terrakotta */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setEditing(false)} className="w-8 h-8 rounded-full flex items-center justify-center active:bg-surface-low">
            <ArrowLeft size={20} className="text-accent" />
          </button>
          <h1 className="text-xl font-bold text-accent font-[var(--font-display)]">Profil</h1>
        </div>
        <form onSubmit={handleSave}>
          <section className="bg-card rounded-2xl shadow-[0_8px_30px_rgb(57,56,43,0.08)] p-6 mb-8">
            {/* Avatar + tittel */}
            <div className="flex flex-col items-center mb-8">
              <h2 className="font-bold text-accent text-lg mb-5 font-[var(--font-display)]">
                {profile ? 'Rediger profil' : 'Fullfør profilen din'}
              </h2>
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                className="relative w-20 h-20"
              >
                <div className="w-full h-full rounded-full overflow-hidden">
                  {avatarId ? (
                    <img src={getAvatarUrl(avatarId)} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-surface-low flex items-center justify-center">
                      <User size={32} className="text-text-tertiary" />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 bg-accent text-white w-7 h-7 rounded-full shadow-lg flex items-center justify-center border-2 border-card">
                  <Pencil size={13} className="text-white" />
                </div>
              </button>
            </div>

            {/* Form */}
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">Navn</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Ola Nordmann"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">
                  Telefon
                  {isMusician && <span className="ml-1 normal-case font-normal text-text-tertiary tracking-normal">(valgfritt)</span>}
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="912 34 567"
                  className={inputClass}
                />
              </div>

              {/* Type-velger: forelder eller musikant */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">Du er</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMusician(false)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-bold transition-all ${
                      !isMusician
                        ? 'bg-accent text-white'
                        : 'bg-surface-low text-text-secondary active:bg-surface-medium'
                    }`}
                  >
                    <Users size={16} />
                    Forelder
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMusician(true)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-bold transition-all ${
                      isMusician
                        ? 'bg-accent text-white'
                        : 'bg-surface-low text-text-secondary active:bg-surface-medium'
                    }`}
                  >
                    <Music size={16} />
                    Musikant
                  </button>
                </div>
              </div>

              {isMusician ? (
                /* Musikant-gruppe */
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">Min gruppe</label>
                  <select
                    value={musicianGroup}
                    onChange={(e) => setMusicianGroup(e.target.value as ChildGroup)}
                    className={inputClass}
                  >
                    <option value="Aspirant">Aspirant</option>
                    <option value="Junior">Junior</option>
                    <option value="Hovedkorps">Hovedkorps</option>
                  </select>
                </div>
              ) : (
              /* Barn */
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">Barn</label>
                <div className="space-y-3">
                  {children.map((child, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={child.name}
                          onChange={(e) => {
                            const updated = [...children]
                            updated[i] = { ...updated[i], name: e.target.value }
                            setChildren(updated)
                          }}
                          placeholder="Barnets navn"
                          className={`${inputClass} flex-1`}
                        />
                        {children.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setChildren(children.filter((_, j) => j !== i))}
                            className="p-2 rounded-full active:bg-surface-low shrink-0"
                          >
                            <Trash2 size={14} className="text-text-tertiary" />
                          </button>
                        )}
                      </div>
                      <select
                        value={child.group}
                        onChange={(e) => {
                          const updated = [...children]
                          updated[i] = { ...updated[i], group: e.target.value as Child['group'] }
                          setChildren(updated)
                        }}
                        className={inputClass}
                      >
                        <option value="Aspirant">Aspirant</option>
                        <option value="Junior">Junior</option>
                        <option value="Hovedkorps">Hovedkorps</option>
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setChildren([...children, { name: '', group: 'Aspirant' as const }])}
                  className="flex items-center gap-2 text-sm text-accent font-bold mt-3 active:opacity-70 px-1"
                >
                  <PlusCircle size={18} />
                  Legg til barn
                </button>
              </div>
              )}
            </div>

            {/* Knapper — outline avbryt + solid lagre */}
            <div className="flex gap-4 mt-10">
              {profile && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 py-3.5 rounded-full border-2 border-accent bg-card text-text-primary font-bold text-sm tracking-wide active:scale-95 transition-all"
                >
                  Avbryt
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 rounded-full text-white font-bold text-sm tracking-wide active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
              >
                {saving ? 'Lagrer...' : 'Lagre'}
              </button>
            </div>
          </section>
        </form>
        </>
      ) : (
        <>
          {/* Dugnadshub header */}
          <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card safe-top">
            <div className="flex justify-between items-center px-5 h-14 max-w-[430px] mx-auto">
              <BrandLink />
              <div className="w-9" />
            </div>
          </header>

          <main className="pt-20 pb-28 px-5 lg:pt-8 lg:pb-12 lg:px-8 xl:px-12">
            {/* Sidetittel — kun synlig på mobil, topbaren viser tittelen på desktop */}
            <h2 className="lg:hidden text-3xl font-extrabold text-text-primary tracking-tight font-[var(--font-display)] mb-5">Profil</h2>

            {/* To-kolonne på lg+: 360px profil-spalte + flex-1 stat-spalte. Matcher prototypen. */}
            <div className="lg:grid lg:grid-cols-[360px_1fr] lg:gap-7 lg:items-start">

              {/* VENSTRE KOLONNE: Profilkort + innstillinger */}
              <div className="space-y-5">

                {/* Profilkort — sentrert layout, romslig padding (matcher prototype pad=32) */}
                <Card className="p-6 lg:p-8">
                  <div className="flex flex-col items-center">
                    {/* Avatar — 120px på desktop, 80px på mobil */}
                    <button
                      onClick={() => setShowAvatarPicker(true)}
                      className="relative group mb-4"
                      aria-label="Bytt avatar"
                    >
                      <div className="w-20 h-20 lg:w-[120px] lg:h-[120px] rounded-full overflow-hidden ring-2 ring-accent/20 group-active:ring-accent transition-all">
                        {avatarId ? (
                          <img src={getAvatarUrl(avatarId)} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-accent/10 flex items-center justify-center">
                            <User size={48} className="text-accent" />
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-7 h-7 lg:w-9 lg:h-9 bg-accent rounded-full flex items-center justify-center border-2 border-card shadow-lg">
                        <Pencil size={14} className="text-white" />
                      </div>
                    </button>

                    {/* Navn — stor display-font på desktop */}
                    <h3 className="text-lg lg:text-2xl font-bold lg:font-extrabold font-[var(--font-display)] text-text-primary tracking-tight">
                      {profile?.full_name}
                    </h3>
                    <p className="text-sm text-text-secondary mb-3 mt-1">{profile?.email}</p>

                    {/* Musikant-chip eller barn-liste */}
                    {profile?.is_musician ? (
                      <div className="flex items-center gap-2 mt-3 mb-5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
                        <Music size={14} />
                        <span>Musikant{profile.musician_group ? ` — ${profile.musician_group}` : ''}</span>
                      </div>
                    ) : profile?.children && profile.children.length > 0 ? (
                      <div className="flex flex-col items-center gap-1 mt-3 mb-5">
                        {profile.children.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-accent font-medium">
                            <span className="text-base">🎵</span>
                            <span>{c.name}{c.group ? ` — ${c.group}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Rediger-knapp — full bredde av kortets indre */}
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ full_name: profile?.full_name || '', phone: profile?.phone || '' })
                        setChildren(profile?.children?.length ? profile.children : [{ name: '', group: 'Aspirant' as const }])
                        setIsMusician(!!profile?.is_musician)
                        if (profile?.musician_group) setMusicianGroup(profile.musician_group)
                        setEditing(true)
                      }}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-text-primary/15 text-accent text-sm font-bold hover:bg-surface-low transition-colors"
                    >
                      <Pencil size={14} />
                      Rediger profil
                    </button>
                  </div>
                </Card>

                {/* Admin-lenke — kun på mobil (sidebar har admin-menyer på desktop) */}
                {profile?.role === 'admin' && (
                  <div className="lg:hidden">
                    <Link href="/admin/oversikt" className="block">
                      <Card animate={false} className="p-4 flex items-center gap-3 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center shrink-0">
                          <Shield size={20} className="text-accent" />
                        </div>
                        <span className="font-bold text-sm flex-1">Administrasjon</span>
                        <ChevronRight size={18} className="text-text-tertiary" />
                      </Card>
                    </Link>
                  </div>
                )}

                {/* Innstillinger — én samlet card med hairline-separerte rader */}
                <Card animate={false} className="rounded-3xl overflow-hidden p-0">
                  {/* Push-varsler-rad */}
                  {pushSupported && (
                    <>
                      <div className="flex items-center gap-4 px-5 py-4">
                        <Bell size={22} className="text-accent shrink-0" strokeWidth={1.8} />
                        <p className="font-semibold text-base flex-1 text-text-primary">Push-varsler</p>
                        <button
                          onClick={togglePush}
                          disabled={pushLoading}
                          aria-label="Slå av eller på push-varsler"
                          className={`w-12 h-7 rounded-full transition-colors relative ${
                            pushEnabled ? 'bg-accent' : 'bg-surface-low'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                            pushEnabled ? 'left-[22px]' : 'left-0.5'
                          }`} />
                        </button>
                      </div>
                      <div className="h-px bg-text-primary/[0.06] mx-5" />
                    </>
                  )}

                  {/* Utseende-rad — tittel + segment under */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-4 mb-3">
                      {theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
                        ? <Moon size={22} className="text-accent shrink-0" strokeWidth={1.8} />
                        : <Sun size={22} className="text-accent shrink-0" strokeWidth={1.8} />
                      }
                      <p className="font-semibold text-base text-text-primary">Utseende</p>
                    </div>
                    <div className="flex rounded-full bg-surface-low p-1 gap-1">
                      {([
                        { value: 'system' as const, label: 'System', icon: Monitor },
                        { value: 'light' as const, label: 'Lys', icon: Sun },
                        { value: 'dark' as const, label: 'Mørk', icon: Moon },
                      ]).map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setTheme(value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium transition-colors ${
                            theme === value
                              ? 'bg-card text-text-primary shadow-sm'
                              : 'text-text-secondary'
                          }`}
                        >
                          <Icon size={14} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-px bg-text-primary/[0.06] mx-5" />

                  {/* Vis velkomstguiden-rad */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <RotateCcw size={22} className="text-accent shrink-0" strokeWidth={1.8} />
                    <p className="font-semibold text-base flex-1 text-text-primary">Vis velkomstguiden</p>
                    <button
                      onClick={async () => {
                        if (!profile?.id) return
                        // Nullstill både DB og localStorage så onboarding trigges på nytt
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (supabaseRef.current.from('profiles') as any)
                          .update({ onboarding_completed_at: null })
                          .eq('id', profile.id)
                        localStorage.removeItem(`onboarding_complete_${profile.id}`)
                        router.push('/hjem')
                      }}
                      className="text-accent text-sm font-bold hover:underline"
                    >
                      Vis
                    </button>
                  </div>
                </Card>

                {/* Versjon + Logg ut — inni venstre kolonne på desktop */}
                <div className="hidden lg:block pt-2">
                  <p className="text-center text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary pb-3">
                    Tillerbyen Skolekorps Dugnadshub v 10.26.9
                  </p>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-white font-bold text-base tracking-wide hover:brightness-105 active:scale-[0.98] transition-all shadow-[0_6px_18px_rgba(162,74,51,0.25)]"
                    style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
                  >
                    <LogOut size={18} />
                    <span>Logg ut</span>
                  </button>
                </div>

              </div>

              {/* HØYRE KOLONNE: Bidrag + historikk */}
              <div className="space-y-5 mt-5 lg:mt-0">

                {/* Ditt bidrag — korps-total */}
                {dittBidrag && <DittBidrag data={dittBidrag} />}

                {/* Gjennomførte dugnader — alltid synlig på mobil, kollapsibel på desktop */}
                {historyLoaded && history.length > 0 && (
                  <Card className="overflow-hidden">
                    {/* Desktop-header: klikkbar med chevron + tellerboble */}
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(o => !o)}
                      className="hidden lg:flex w-full items-center justify-between p-5 cursor-pointer hover:bg-surface-low/40 transition-colors rounded-[inherit]"
                    >
                      <div className="flex items-center gap-2.5">
                        <ClipboardList size={20} className="text-accent" />
                        <h3 className="font-bold text-[15px] font-[var(--font-display)]">Gjennomførte dugnader</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-surface-low text-text-secondary text-xs font-bold px-2.5 py-1 rounded-full">
                          {history.length}
                        </span>
                        <motion.div
                          animate={{ rotate: historyOpen ? 180 : 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        >
                          <ChevronDown size={18} className="text-text-tertiary" />
                        </motion.div>
                      </div>
                    </button>

                    {/* Mobil-header: alltid synlig, ikke klikkbar */}
                    <div className="flex lg:hidden items-center gap-2.5 p-5 pb-3">
                      <ClipboardList size={20} className="text-accent" />
                      <h3 className="font-bold text-[15px] font-[var(--font-display)]">Gjennomførte dugnader</h3>
                    </div>

                    {/* Innhold: alltid synlig på mobil, animert på desktop */}
                    <div className="lg:hidden px-5 pb-5">
                      <div className="space-y-1">
                        {history.map((h, i) => (
                          <div key={i} className="flex items-center justify-between py-2.5 border-b border-surface-low last:border-0">
                            <div>
                              <p className="text-sm font-medium text-text-primary">{h.title}</p>
                              <p className="text-xs text-text-secondary mt-0.5">
                                {new Date(h.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider bg-surface-low text-accent px-3 py-1 rounded-full whitespace-nowrap">
                              {h.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {historyOpen && (
                        <motion.div
                          key="history-desktop"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          className="hidden lg:block overflow-hidden"
                        >
                          <div className="px-5 pb-5 space-y-1">
                            {history.map((h, i) => (
                              <div key={i} className="flex items-center justify-between py-2.5 border-b border-surface-low last:border-0">
                                <div>
                                  <p className="text-sm font-medium text-text-primary">{h.title}</p>
                                  <p className="text-xs text-text-secondary mt-0.5">
                                    {new Date(h.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-wider bg-surface-low text-accent px-3 py-1 rounded-full whitespace-nowrap">
                                  {h.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                )}

              </div>
            </div>

            {/* Versjon + logg ut — full bredde på mobil (desktop-versjonen er i venstre kolonne) */}
            <div className="lg:hidden">
              <p className="text-center text-[10px] uppercase tracking-widest text-text-tertiary/50 pt-8">
                Tillerbyen Skolekorps Dugnadshub v 10.26.9
              </p>
              <div className="flex justify-center pt-1 pb-4">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 px-8 py-3 rounded-full text-white font-bold text-sm tracking-wide active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
                >
                  <LogOut size={16} />
                  <span>Logg ut</span>
                </button>
              </div>
            </div>
          </main>
        </>
      )}

      {/* Avatar-velger */}
      {showAvatarPicker && (
        <AvatarPicker
          currentAvatarId={avatarId}
          onSelect={async (newId) => {
            setAvatarId(newId)
            setShowAvatarPicker(false)
            if (isMockMode()) {
              localStorage.setItem('dugnadshub_avatar', newId)
            } else {
              const { data: { user } } = await supabaseRef.current.auth.getUser()
              if (user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabaseRef.current.from('profiles') as any)
                  .update({ avatar_url: newId })
                  .eq('id', user.id)
                // Server-komponenten DesktopShell henter profilen ved hver request.
                // router.refresh() trigger en re-render slik at sidebar-avataren oppdateres.
                router.refresh()
              }
            }
          }}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  )
}
