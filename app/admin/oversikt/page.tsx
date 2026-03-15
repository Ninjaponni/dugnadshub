'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import { Users, Map, Calendar, Activity, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

// Statistikk fra databasen
interface Stats {
  totalMembers: number
  activeEvents: number
  upcomingEvents: number
  zonesClaimed: number
  totalZones: number
}

// Admin dashboard — live oversikt over dugnader
export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      // Parallelle kall for å hente all statistikk
      const [profilesRes, eventsRes, assignmentsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id, status') as unknown as Promise<{ data: Array<{ id: string; status: string }> | null }>,
        supabase.from('zone_assignments').select('id, status') as unknown as Promise<{ data: Array<{ id: string; status: string }> | null }>,
      ])

      const events = eventsRes.data || []
      const assignments = assignmentsRes.data || []

      setStats({
        totalMembers: profilesRes.count || 0,
        activeEvents: events.filter(e => e.status === 'active').length,
        upcomingEvents: events.filter(e => e.status === 'upcoming').length,
        zonesClaimed: assignments.filter(a => a.status !== 'available').length,
        totalZones: assignments.length,
      })
      setLoading(false)
    }

    load()
  }, [supabase])

  const statCards = [
    { label: 'Medlemmer', value: stats?.totalMembers ?? '—', icon: Users },
    { label: 'Aktive hendelser', value: stats?.activeEvents ?? '—', icon: Activity },
    { label: 'Kommende', value: stats?.upcomingEvents ?? '—', icon: Calendar },
    { label: 'Soner tatt', value: stats ? `${stats.zonesClaimed}/${stats.totalZones}` : '—', icon: Map },
  ]

  const navCards = [
    { href: '/admin/hendelser', icon: Calendar, label: 'Hendelser', desc: 'Opprett og administrer dugnader' },
    { href: '/admin/medlemmer', icon: Users, label: 'Medlemmer', desc: 'Se og administrer medlemmer' },
    { href: '/kart', icon: Map, label: 'Kart', desc: 'Se sonestatus i sanntid' },
  ]

  return (
    <div>
      {/* Statistikk-kort */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {statCards.map(({ label, value, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card animate={false} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className="text-text-secondary" />
                <span className="text-xs text-text-secondary">{label}</span>
              </div>
              {loading ? (
                <div className="h-8 w-16 bg-black/5 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold font-mono">{value}</p>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Hurtiglenker */}
      <h2 className="text-lg font-semibold mb-3">Administrasjon</h2>
      <div className="space-y-3">
        {navCards.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="p-4 flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{label}</p>
                <p className="text-sm text-text-secondary">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-text-tertiary shrink-0" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
