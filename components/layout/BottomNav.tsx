'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, Award, User, Truck } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isMockMode } from '@/lib/mock/useMock'

const baseTabs = [
  { href: '/hjem', label: 'Hjem', icon: Home },
  { href: '/kart', label: 'Kart', icon: Map },
  { href: '/merker', label: 'Merker', icon: Award },
  { href: '/profil', label: 'Profil', icon: User },
]

const driverTab = { href: '/sjafor', label: 'Henting', icon: Truck }

// Stitch-stil bottom nav — aktiv tab = gradient-sirkel, inaktiv = grå ikon + label
export default function BottomNav() {
  const pathname = usePathname()
  const [unseenBadges, setUnseenBadges] = useState(0)
  const [isDriver, setIsDriver] = useState(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (isMockMode()) {
      setIsDriver(true)
      setUnseenBadges(1)
      return
    }
    async function check() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) return

      const { data: profile } = await supabaseRef.current
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single() as unknown as { data: { role: string } | null }

      if (profile && (profile.role === 'driver' || profile.role === 'admin')) {
        setIsDriver(true)
      }

      const { data } = await supabaseRef.current
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id) as unknown as { data: Array<{ badge_id: number }> | null }

      if (!data) return

      const seenKey = `seen_badges_${user.id}`
      const seenRaw = localStorage.getItem(seenKey)
      const seen = seenRaw ? new Set(JSON.parse(seenRaw) as number[]) : new Set<number>()

      const unseen = data.filter(b => !seen.has(b.badge_id)).length
      setUnseenBadges(unseen)
    }

    check()
  }, [pathname])

  const tabs = isDriver
    ? [...baseTabs.slice(0, 3), driverTab, baseTabs[3]]
    : baseTabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card safe-bottom">
      <div className="rounded-t-[2rem] shadow-[0_-4px_20px_rgba(57,56,43,0.08)] max-w-[430px] mx-auto bg-card">
        <div className="flex justify-around items-end px-4 pb-1 pt-2 h-20">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            const showBadge = href === '/merker' && unseenBadges > 0 && !active

            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center"
              >
                {active ? (
                  /* Aktiv tab — gradient-sirkel med hvitt ikon */
                  <motion.div
                    layoutId="active-tab"
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg mb-1"
                    style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <Icon size={24} strokeWidth={2} className="text-white" />
                  </motion.div>
                ) : (
                  /* Inaktiv tab — grå ikon + uppercase label */
                  <div className="flex flex-col items-center justify-center p-2 relative">
                    <div className="relative">
                      <Icon size={22} strokeWidth={1.5} className="text-text-tertiary" />
                      {showBadge && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-danger flex items-center justify-center"
                        >
                          <span className="text-[9px] font-bold text-white">{unseenBadges}</span>
                        </motion.div>
                      )}
                    </div>
                    <span className="text-[10px] text-text-tertiary tracking-widest uppercase mt-1 font-medium">
                      {label}
                    </span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
