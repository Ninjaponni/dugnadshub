'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { getRouteMeta } from '@/lib/layout/route-meta'

type Props = {
  hasUnread?: boolean
  onBellClick?: () => void
}

// Glass-topbar med per-route tittel og sub. Skjules på fullBleed-ruter (Kart).
export default function DesktopTopbar({ hasUnread = false, onBellClick }: Props) {
  const pathname = usePathname()
  const meta = getRouteMeta(pathname)
  if (meta.fullBleed) return null

  return (
    <header
      className="hidden lg:flex sticky top-0 z-50 items-center gap-5 px-9 py-5 border-b border-surface-low"
      style={{
        // Bygger på kort-fargen så glasset følger dark mode (hardkodet hvit ble uleselig der)
        background: 'color-mix(in srgb, var(--color-card) 70%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-2xl font-extrabold -tracking-[0.02em] m-0 leading-tight text-text-primary">
          {meta.title}
        </h1>
        {meta.sub && <p className="text-[13.5px] text-text-secondary mt-[3px] m-0">{meta.sub}</p>}
      </div>
      <button
        type="button"
        onClick={onBellClick}
        className="relative w-11 h-11 rounded-full bg-card shadow-sm flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Varsler"
      >
        <Bell size={19} />
        {hasUnread && (
          <span
            className="absolute top-[9px] right-[10px] w-[9px] h-[9px] rounded-full bg-danger"
            style={{ border: '2px solid var(--color-card)' }}
          />
        )}
      </button>
    </header>
  )
}
