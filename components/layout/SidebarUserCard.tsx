'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'

type Props = {
  name: string
  type: string // "Forelder" | "Musikant"
  role: string // "Samler", "Admin", osv.
  avatarSrc?: string | null
}

// Bunn-kort i sidebar med avatar, navn, type og rolle. Trykk gir profil-siden.
export default function SidebarUserCard({ name, type, role, avatarSrc }: Props) {
  const initial = ((name || '?')[0] || '?').toUpperCase()
  return (
    <Link
      href="/profil"
      className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-low hover:bg-surface-low/70 transition-colors"
    >
      {avatarSrc ? (
        <Image
          src={avatarSrc}
          alt=""
          width={40}
          height={40}
          className="rounded-full w-10 h-10 object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-accent font-bold shrink-0">
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-bold text-text-primary truncate">{name}</div>
        <div className="text-[11.5px] text-text-secondary truncate">{type} · {role}</div>
      </div>
      <ChevronDown size={15} className="text-text-tertiary shrink-0" />
    </Link>
  )
}
