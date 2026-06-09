'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { getAvatarUrl } from '@/components/features/AvatarPicker'

type Props = {
  name: string
  type: string // "Forelder" eller "Musikant"
  role: string // "Samler", "Admin", osv.
  avatarSrc?: string | null
}

// Bunn-kort i sidebar med avatar, navn, type og rolle. Trykk gir profil-siden.
// avatarSrc er en avatar-ID (f.eks. "avatar03"), ikke en URL. getAvatarUrl mapper til /avatars/<id>.png.
export default function SidebarUserCard({ name, type, role, avatarSrc }: Props) {
  const initial = ((name || '?')[0] || '?').toUpperCase()
  const url = avatarSrc ? getAvatarUrl(avatarSrc) : null
  return (
    <Link
      href="/profil"
      aria-label={`Gå til profil for ${name}`}
      className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-low hover:bg-surface-low/70 transition-colors"
    >
      {url ? (
        <Image
          src={url}
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
