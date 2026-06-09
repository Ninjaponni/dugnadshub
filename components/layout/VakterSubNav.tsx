'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Event = {
  id: string
  title: string
  navLabel?: string
  closed?: boolean
}

// Ekspanderende sub-liste under Vakter i sidebaren. Viser kommende arrangement-events.
// Vises kun når man er på /vakter eller /arrangement/*.
export default function VakterSubNav({ events }: { events: Event[] }) {
  const pathname = usePathname()
  return (
    <div className="relative ml-[27px] pl-[15px] my-1 flex flex-col gap-px">
      <span className="absolute left-0 top-1 bottom-1 w-[1.5px] bg-text-primary/[0.07] rounded-full" />
      {events.map((e, i) => {
        const href = `/arrangement/${e.id}`
        const selected = pathname === href
        return (
          <Link
            key={e.id}
            href={href}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-[10px] transition-colors ${
              selected ? 'bg-surface-low text-accent font-bold' : 'text-text-secondary hover:bg-surface-low'
            }`}
            style={{ animation: `subItemIn .3s ease ${i * 45}ms` }}
          >
            {selected && (
              <span className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-[1.5px] h-[18px] bg-accent rounded-full" />
            )}
            <span className="text-[13.5px] flex-1 truncate">{e.navLabel || e.title}</span>
            {e.closed && (
              <span
                title="Påmelding stengt"
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: '#d6a417' }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}
