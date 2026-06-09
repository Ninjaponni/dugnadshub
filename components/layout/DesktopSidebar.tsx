'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, Truck, Ticket, Award, User, Calendar, Users, Bell } from 'lucide-react'
import SidebarUserCard from './SidebarUserCard'
import VakterSubNav from './VakterSubNav'
import KorpsLogo from '@/components/ui/KorpsLogo'
import type { Profile } from '@/lib/supabase/types'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  driversOnly?: boolean
  badge?: number
  count?: number
}

const MEMBER_NAV: NavItem[] = [
  { href: '/hjem', label: 'Hjem', icon: Home },
  { href: '/kart', label: 'Kart', icon: Map },
  { href: '/sjafor', label: 'Henting', icon: Truck, driversOnly: true },
  { href: '/vakter', label: 'Vakter', icon: Ticket },
  { href: '/merker', label: 'Merker', icon: Award },
  { href: '/profil', label: 'Profil', icon: User },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/hendelser', label: 'Hendelser', icon: Calendar },
  { href: '/admin/medlemmer', label: 'Medlemmer', icon: Users },
  { href: '/admin/varsler', label: 'Varsler', icon: Bell },
]

type SidebarProfile = Pick<Profile, 'full_name' | 'role' | 'avatar_url'> & { type?: string }

type Props = {
  profile: SidebarProfile
  memberCount?: number
  unseenBadges?: number
  shiftEvents?: Array<{ id: string; title: string; navLabel?: string; closed?: boolean }>
}

// 264px sticky sidebar med MEDLEM/ADMIN-grupper. Synlig kun fra lg+.
export default function DesktopSidebar({
  profile,
  memberCount,
  unseenBadges,
  shiftEvents = [],
}: Props) {
  const pathname = usePathname()
  const isDriver = profile.role === 'driver' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'

  const memberItems = MEMBER_NAV.filter(it => !it.driversOnly || isDriver).map(it => ({
    ...it,
    badge: it.href === '/merker' && unseenBadges ? unseenBadges : undefined,
  }))

  const adminItems = ADMIN_NAV.map(it => ({
    ...it,
    count: it.href === '/admin/medlemmer' ? memberCount : undefined,
  }))

  const roleLabel =
    profile.role === 'admin'
      ? 'Admin'
      : profile.role === 'driver'
        ? 'Sjåfør'
        : profile.role === 'strapper'
          ? 'Stripser'
          : profile.role === 'host'
            ? 'Vert'
            : 'Samler'

  return (
    <aside className="hidden lg:flex w-[264px] shrink-0 h-screen sticky top-0 flex-col bg-card border-r border-text-primary/[0.06] px-[18px] py-6 overflow-y-auto">
      {/* Merkevareblokk */}
      <div className="flex items-center gap-3 px-2 mb-7 shrink-0" style={{ minHeight: 44 }}>
        <KorpsLogo size={36} className="shrink-0" />
        <div className="min-w-0">
          <div className="font-display text-[19px] font-extrabold text-accent leading-none tracking-tight">
            Dugnadshub
          </div>
          <div className="text-[10.5px] font-semibold text-text-tertiary mt-[3px] truncate">
            Tillerbyen Skolekorps
          </div>
        </div>
      </div>

      {/* MEDLEM-navigasjon */}
      <nav className="flex flex-col gap-[3px]">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-text-tertiary px-3.5 pb-2">
          Medlem
        </div>
        {memberItems.map(it => (
          <div key={it.href}>
            <NavLink item={it} active={pathname.startsWith(it.href)} />
            {/* Vakter-undermeny vises kun når man er på /vakter */}
            {it.href === '/vakter' && pathname.startsWith('/vakter') && shiftEvents.length > 0 && (
              <VakterSubNav events={shiftEvents} />
            )}
          </div>
        ))}
      </nav>

      {/* ADMIN-navigasjon — vises kun for admin-rolle */}
      {isAdmin && (
        <>
          <div className="h-px bg-text-primary/[0.07] my-[26px] mx-2" />
          <nav className="flex flex-col gap-[3px]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-text-tertiary px-3.5 pb-2">
              Admin
            </div>
            {adminItems.map(it => (
              <NavLink key={it.href} item={it} active={pathname.startsWith(it.href)} />
            ))}
          </nav>
        </>
      )}

      {/* Dytter brukerkortet til bunnen */}
      <div className="flex-1" />

      <SidebarUserCard
        name={profile.full_name || 'Bruker'}
        type={profile.type || 'Forelder'}
        role={roleLabel}
        avatarSrc={profile.avatar_url}
      />
    </aside>
  )
}

// Enkelt nav-lenkeelement med aktiv-state, badge og teller
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-[13px] px-3.5 py-2.5 rounded-[14px] transition-all ${
        active
          ? 'text-white shadow-[0_6px_18px_rgba(162,74,51,0.25)]'
          : 'text-text-secondary hover:bg-surface-low'
      }`}
      style={
        active
          ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }
          : undefined
      }
    >
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      <span className={`text-[14.5px] flex-1 ${active ? 'font-bold' : 'font-semibold'}`}>
        {item.label}
      </span>
      {/* Antall-teller for f.eks. Medlemmer */}
      {item.count != null && (
        <span className={`text-xs font-bold ${active ? 'text-white/85' : 'text-text-tertiary'}`}>
          {item.count}
        </span>
      )}
      {/* Rød varselbadge for uleste merker */}
      {item.badge != null && !active && (
        <span className="min-w-[19px] h-[19px] px-1.5 rounded-full bg-danger text-white text-[10.5px] font-bold flex items-center justify-center">
          {item.badge}
        </span>
      )}
    </Link>
  )
}
