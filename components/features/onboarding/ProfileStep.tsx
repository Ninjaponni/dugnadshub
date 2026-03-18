'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { evaluateBadges } from '@/lib/badges/evaluator'
import Button from '@/components/ui/Button'

interface ProfileStepProps {
  onProfileSaved: () => void
}

// Steg 2: Profil-utfylling med inline skjema
export default function ProfileStep({ onProfileSaved }: ProfileStepProps) {
  const [form, setForm] = useState({ full_name: '', phone: '', child_name: '', child_group: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Hent eksisterende profildata
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoaded(true); return }
      const { data } = await supabase.from('profiles').select('full_name, phone, child_name, child_group').eq('id', user.id).single() as unknown as { data: { full_name: string | null; phone: string | null; child_name: string | null; child_group: string | null } | null }
      if (data) {
        setForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
          child_name: data.child_name || '',
          child_group: data.child_group || '',
        })
      }
      setLoaded(true)
    }
    load()
  }, [])

  const inputClass = `w-full px-4 py-3 rounded-xl bg-white/80 border-0 text-[17px]
    placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30`

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any).upsert({
      id: user.id,
      email: user.email!,
      full_name: form.full_name || null,
      phone: form.phone || null,
      child_name: form.child_name || null,
      child_group: form.child_group || null,
    })

    if (!error) {
      // Tildel Profil-proffen-merket hvis alle felt er fylt ut
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
          className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6"
        >
          <span className="text-4xl">✓</span>
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">Profil lagret!</h2>
        <p className="text-text-secondary">Du fikk merket «Profil-proffen»</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full px-6 pt-12">
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4"
        >
          <User size={32} className="text-accent" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-1">Hvem er du?</h2>
        <p className="text-text-secondary text-[15px]">Fyll ut så vi vet hvem du er — du får ditt første merke!</p>
      </div>

      <div className="space-y-3 flex-1">
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          placeholder="Ditt navn"
          className={inputClass}
        />
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Telefon"
          className={inputClass}
        />
        <input
          type="text"
          value={form.child_name}
          onChange={(e) => setForm({ ...form, child_name: e.target.value })}
          placeholder="Barnets navn"
          className={inputClass}
        />
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
      </div>

      <div className="pb-8 pt-4">
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
    </div>
  )
}
