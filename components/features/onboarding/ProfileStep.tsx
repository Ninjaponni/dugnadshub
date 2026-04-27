'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trash2, PlusCircle, Pencil, Users, Music, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { evaluateBadges } from '@/lib/badges/evaluator'
import Button from '@/components/ui/Button'
import AvatarPicker, { getAvatarUrl, getRandomAvatarId } from '@/components/features/AvatarPicker'
import type { Child, ChildGroup } from '@/lib/supabase/types'

interface ProfileStepProps {
  onProfileSaved: () => void
}

type UserType = 'parent' | 'musician'

// Steg 2: Profil-utfylling — velger først om man er forelder eller musikant
export default function ProfileStep({ onProfileSaved }: ProfileStepProps) {
  const [userType, setUserType] = useState<UserType | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [children, setChildren] = useState<Child[]>([{ name: '', group: 'Aspirant' }])
  const [musicianGroup, setMusicianGroup] = useState<ChildGroup>('Aspirant')
  const [avatarId, setAvatarId] = useState(() => getRandomAvatarId())
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Hent eksisterende profildata
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoaded(true); return }
      const { data } = await supabase.from('profiles').select('full_name, phone, children, avatar_url, is_musician, musician_group').eq('id', user.id).single() as unknown as { data: { full_name: string | null; phone: string | null; children: Child[] | null; avatar_url: string | null; is_musician: boolean | null; musician_group: ChildGroup | null } | null }
      if (data) {
        setForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
        })
        if (data.children?.length) setChildren(data.children)
        if (data.avatar_url) setAvatarId(data.avatar_url)
        if (data.is_musician) {
          setUserType('musician')
          if (data.musician_group) setMusicianGroup(data.musician_group)
        } else if (data.full_name || data.children?.length) {
          // Eksisterende forelder — hopp over type-velger
          setUserType('parent')
        }
      }
      setLoaded(true)
    }
    load()
  }, [])

  const inputClass = `w-full px-4 py-3 rounded-[12px] bg-surface-low border-0 text-[17px]
    placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30`

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const isMusician = userType === 'musician'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any).upsert({
      id: user.id,
      email: user.email!,
      full_name: form.full_name || null,
      phone: form.phone || null,
      children: isMusician ? [] : children.filter(c => c.name.trim()),
      avatar_url: avatarId,
      is_musician: isMusician,
      musician_group: isMusician ? musicianGroup : null,
    })

    if (!error) {
      await evaluateBadges(user.id)
      setSaved(true)
      onProfileSaved()
    }
    setSaving(false)
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full overflow-hidden mb-6 ring-4 ring-success/20"
        >
          <img src={getAvatarUrl(avatarId)} alt="Din avatar" className="w-full h-full object-cover" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2 font-[var(--font-display)]">Profil lagret!</h2>
        <p className="text-text-secondary">Du fikk merket «Profil-proffen»</p>
      </div>
    )
  }

  if (!loaded) return null

  // Steg 1: Velg brukertype
  if (userType === null) {
    return (
      <div className="flex flex-col h-full px-6 pt-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2 font-[var(--font-display)]">Hvem er du?</h2>
          <p className="text-text-secondary">Velg det som passer best</p>
        </div>

        <div className="space-y-3 flex-1">
          <button
            onClick={() => setUserType('parent')}
            className="w-full p-5 rounded-[20px] bg-surface-low active:bg-surface-medium flex items-center gap-4 text-left transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Users size={22} className="text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-[17px]">Forelder</div>
              <div className="text-sm text-text-secondary">Jeg har barn i korpset</div>
            </div>
          </button>

          <button
            onClick={() => setUserType('musician')}
            className="w-full p-5 rounded-[20px] bg-surface-low active:bg-surface-medium flex items-center gap-4 text-left transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Music size={22} className="text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-[17px]">Musikant</div>
              <div className="text-sm text-text-secondary">Jeg spiller selv i korpset</div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // Steg 2: Fyll ut profil
  return (
    <div className="flex flex-col h-full px-6 pt-6">
      {/* Tilbake-knapp til type-valg */}
      <button
        onClick={() => setUserType(null)}
        className="self-start flex items-center gap-1 text-sm text-text-secondary mb-2 active:opacity-70"
      >
        <ArrowLeft size={16} />
        Bytt
      </button>

      {/* Avatar-velger */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold mb-4 font-[var(--font-display)]">
          {userType === 'musician' ? 'Hvem er du?' : 'Hvem er du?'}
        </h2>
        <button
          onClick={() => setShowAvatarPicker(true)}
          className="relative mx-auto block"
        >
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-accent/20 mx-auto">
            <img src={getAvatarUrl(avatarId)} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 left-1/2 ml-5 w-7 h-7 bg-accent text-white rounded-full flex items-center justify-center border-2 border-bg shadow-sm">
            <Pencil size={13} />
          </div>
        </button>
        <p className="text-text-secondary text-sm mt-3">Trykk for å velge avatar</p>
      </div>

      {/* Form */}
      <div className="space-y-3 flex-1 overflow-auto">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">Navn</label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder={userType === 'musician' ? 'Ditt navn' : 'Ditt navn'}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">
            Telefon{userType === 'musician' && <span className="ml-1 normal-case font-normal text-text-tertiary tracking-normal">(valgfritt)</span>}
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="912 34 567"
            className={inputClass}
          />
        </div>

        {userType === 'musician' ? (
          /* Musikant-gruppe */
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1.5 px-1">Din gruppe</label>
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
                  <div className="flex gap-2 items-center">
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
              <button
                type="button"
                onClick={() => setChildren([...children, { name: '', group: 'Aspirant' }])}
                className="flex items-center gap-2 text-sm text-accent font-bold active:opacity-70 px-1"
              >
                <PlusCircle size={18} />
                Legg til barn
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="pb-8 pt-4 shrink-0">
        <Button
          size="lg"
          className="w-full"
          onClick={handleSave}
          loading={saving}
          disabled={!form.full_name.trim()}
        >
          Lagre profil
        </Button>
      </div>

      {/* Avatar picker modal */}
      {showAvatarPicker && (
        <AvatarPicker
          currentAvatarId={avatarId}
          onSelect={(newId) => {
            setAvatarId(newId)
            setShowAvatarPicker(false)
          }}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  )
}
