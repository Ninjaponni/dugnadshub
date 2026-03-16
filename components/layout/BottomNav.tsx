'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, Award, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const tabs = [
  { href: '/hjem', label: 'Hjem', icon: Home },
  { href: '/kart', label: 'Kart', icon: Map },
  { href: '/merker', label: 'Merker', icon: Award },
  { href: '/profil', label: 'Profil', icon: User },
]

// iOS-stil tab bar med glassmorfisme + notification badge for merker
export default function BottomNav() {
  const pathname = usePathname()
  const [unseenBadges, setUnseenBadges] = useState(0)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) return

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
  }, [pathname]) // Sjekk på nytt ved navigasjon

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-black/5 safe-bottom">
      <div className="flex justify-around items-center max-w-[430px] mx-auto h-14">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          const showBadge = href === '/merker' && unseenBadges > 0 && !active

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 w-16 py-1"
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.5}
                  className={active ? 'text-accent' : 'text-text-tertiary'}
                />
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {/* Notification badge */}
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
              <span className={`text-[10px] ${active ? 'text-accent font-medium' : 'text-text-tertiary'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
