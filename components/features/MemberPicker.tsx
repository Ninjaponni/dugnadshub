'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  full_name: string | null
  children: Array<{ name: string; group: string }> | null
}

interface MemberPickerProps {
  onSelect: (userId: string, fullName: string) => void
  onCancel: () => void
  excludeUserIds?: string[]
}

export default function MemberPicker({ onSelect, onCancel, excludeUserIds = [] }: MemberPickerProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    supabaseRef.current
      .from('profiles')
      .select('id, full_name, children')
      .order('full_name')
      .then(({ data }) => {
        if (data) setMembers(data as Member[])
        setLoading(false)
      })
  }, [])

  const filtered = members.filter((m) => {
    if (excludeUserIds.includes(m.id)) return false
    if (!search) return true
    const q = search.toLowerCase()
    const childMatch = m.children?.some(c => c.name?.toLowerCase().includes(q))
    return (
      m.full_name?.toLowerCase().includes(q) || childMatch
    )
  })

  return (
    <div className="mt-2">
      {/* Søkefelt */}
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk etter medlem..."
          className="w-full pl-8 pr-8 py-2 rounded-[12px] bg-surface-low text-sm outline-none focus:ring-2 focus:ring-accent/30"
          autoFocus
        />
        <button
          onClick={onCancel}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full active:bg-surface-low"
        >
          <X size={14} className="text-text-tertiary" />
        </button>
      </div>

      {/* Medlemsliste */}
      <div className="max-h-[40vh] overflow-auto rounded-[12px]">
        {loading ? (
          <div className="p-4 text-center text-sm text-text-tertiary">Laster...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-tertiary">Ingen treff</div>
        ) : (
          filtered.map((m) => {
            const childNames = m.children?.map(c => c.name).filter(Boolean).join(', ')
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id, m.full_name || 'Ukjent')}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm last:border-0 active:bg-surface-low"
              >
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-medium text-accent shrink-0">
                  {m.full_name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0">
                  <span className="block truncate">{m.full_name || 'Ukjent'}</span>
                  {childNames && (
                    <span className="block text-xs text-text-tertiary truncate">{childNames}</span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
