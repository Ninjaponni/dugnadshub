'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, Award, User } from 'lucide-react'
import { motion } from 'framer-motion'

const tabs = [
  { href: '/hjem', label: 'Hjem', icon: Home },
  { href: '/kart', label: 'Kart', icon: Map },
  { href: '/merker', label: 'Merker', icon: Award },
  { href: '/profil', label: 'Profil', icon: User },
]

// iOS-stil tab bar med glassmorfisme
export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-black/5 safe-bottom">
      <div className="flex justify-around items-center max-w-[430px] mx-auto h-14">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
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
