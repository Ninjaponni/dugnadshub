'use client'

import { usePathname } from 'next/navigation'
import { getRouteMeta } from '@/lib/layout/route-meta'

// Desktop-innholdsområdet. På fullBleed-ruter (Kart) fyller innholdet hele
// flaten ved siden av sidebaren — ingen padding, ingen max-width, og `relative`
// så et `lg:absolute inset-0`-kart havner innenfor flaten i stedet for å dekke
// hele viewporten (og dermed skjule menyen). Andre ruter beholder padded main.
export default function DesktopMain({ children }: { children: React.ReactNode }) {
  const meta = getRouteMeta(usePathname())

  if (meta.fullBleed) {
    return <main className="flex-1 relative overflow-hidden min-w-0">{children}</main>
  }

  return <main className="max-w-[1320px] w-full mx-auto px-9 py-8">{children}</main>
}
