'use client'

import { usePathname } from 'next/navigation'
import { getRouteMeta } from '@/lib/layout/route-meta'

// Felles innholdsområde for BÅDE mobil og desktop — children rendres ÉN gang.
// Mobil-wrapper-klassene (max-w, padding) sendes inn fra layouten og gjelder
// under lg; lg:-klassene overstyrer på desktop. Dette erstattet dual-render-
// oppsettet der hele sidetreet ble montert to ganger (som ga dobbel datahenting,
// Realtime-kanaler som stjal topic fra hverandre, og dobbel Mapbox-instans).
//
// På fullBleed-ruter (Kart) er flaten `relative` på lg så et
// `lg:absolute inset-0`-kart fyller flaten ved siden av sidebaren.
export default function DesktopMain({ children, mobileClassName = '' }: { children: React.ReactNode; mobileClassName?: string }) {
  const meta = getRouteMeta(usePathname())

  if (meta.fullBleed) {
    // Kart er fixed på mobil — ingen mobil-wrapper-stiler trengs
    return <div className="lg:flex-1 lg:relative lg:overflow-hidden lg:min-w-0">{children}</div>
  }

  return (
    <div className={`${mobileClassName} lg:max-w-[1320px] lg:w-full lg:mx-auto lg:min-h-0 lg:px-9 lg:py-8`}>
      {children}
    </div>
  )
}
