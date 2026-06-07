'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Pencil, Music } from 'lucide-react'
import { useEffect } from 'react'
import type { Profile, Child, Role } from '@/lib/supabase/types'

const roleLabels: Record<Role, string> = {
  collector: 'Samler',
  driver: 'Sjåfør',
  strapper: 'Stripser',
  host: 'Vert',
  admin: 'Admin',
}

interface Props {
  profile: Profile | null
  badgeCount: number
  zoneCount: number
  onClose: () => void
  onEditRoles: () => void
}

export default function MemberDetailOverlay({ profile, badgeCount, zoneCount, onClose, onEditRoles }: Props) {
  // Lukk på ESC
  useEffect(() => {
    if (!profile) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profile, onClose])

  // Lås body-scroll mens overlayet er åpent, så bakgrunnssiden ikke skroller
  // under finger-drag på mobil.
  useEffect(() => {
    if (!profile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [profile])

  return (
    <AnimatePresence>
      {profile && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="fixed inset-0 z-50 bg-bg flex flex-col"
        >
          {/* Topptekst */}
          <header className="shrink-0 z-10 bg-card border-b border-black/[0.03] safe-top">
            <div className="flex items-center h-14 px-3 max-w-[430px] mx-auto w-full">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center active:opacity-70"
                aria-label="Tilbake"
              >
                <ArrowLeft size={18} className="text-text-primary" />
              </button>
              <h1 className="flex-1 text-center font-[var(--font-display)] text-base font-bold -ml-10">
                Medlem
              </h1>
            </div>
          </header>

          {/* Scrollbart innhold */}
          <main className="flex-1 overflow-y-auto max-w-[430px] mx-auto w-full">
            <div className="px-5 pt-5 pb-10">
              {/* Mini-profil */}
              <div className="flex items-start gap-3.5 mb-2">
                <div className="w-14 h-14 rounded-full bg-surface-low flex items-center justify-center shrink-0">
                  <span className="font-[var(--font-display)] text-[22px] font-bold text-accent">
                    {((profile.full_name || profile.email || '?')[0] || '?').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-[var(--font-display)] text-[22px] font-extrabold tracking-tight m-0">
                    {profile.full_name || 'Ukjent'}
                  </h2>
                  <p className="text-[13.5px] text-text-secondary mt-0.5 mb-2.5">
                    <b className="text-accent font-bold">{badgeCount} merker</b>
                    {' · '}{zoneCount} soner
                  </p>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold bg-accent/10 text-accent">
                      {roleLabels[profile.role]}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold border-[1.5px] border-text-primary/[0.14] text-text-secondary">
                      {profile.is_musician ? (
                        <><Music size={11} /> Musikant{profile.musician_group ? ` · ${profile.musician_group}` : ''}</>
                      ) : 'Forelder'}
                    </span>
                    <button
                      type="button"
                      onClick={onEditRoles}
                      className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-transparent border-[1.5px] border-dashed border-accent/45 text-accent text-xs font-bold active:opacity-70"
                    >
                      <Pencil size={12} /> Endre
                    </button>
                  </div>
                </div>
              </div>

              {/* Kontaktinfo */}
              <div className="mt-4 flex flex-col gap-1">
                {profile.email && (
                  <p className="text-[13.5px] text-text-tertiary">
                    <span className="text-text-secondary">E-post:</span>{' '}
                    <a href={`mailto:${profile.email}`} className="text-accent font-semibold">{profile.email}</a>
                  </p>
                )}
                {profile.phone && (
                  <p className="text-[13.5px] text-text-tertiary">
                    <span className="text-text-secondary">Telefon:</span>{' '}
                    <a href={`tel:${profile.phone}`} className="text-accent font-semibold">{profile.phone}</a>
                  </p>
                )}
                {!profile.is_musician && profile.children && profile.children.length > 0 &&
                  profile.children.map((c: Child, i: number) => (
                    <p key={i} className="text-[13.5px] text-text-tertiary">
                      <span className="text-text-secondary">Barn:</span> {c.name}{c.group ? ` (${c.group})` : ''}
                    </p>
                  ))
                }
                <p className="text-[13.5px] text-text-tertiary">
                  <span className="text-text-secondary">Registrert:</span> {new Date(profile.created_at).toLocaleDateString('nb-NO')}
                </p>
              </div>

              <hr className="my-5 border-0 border-t border-text-primary/[0.07]" />

              {/* Merker + faresone fylles i Task 3 og 5 */}
              <p className="text-text-tertiary text-sm">[Merker kommer]</p>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
