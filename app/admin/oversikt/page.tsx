import Card from '@/components/ui/Card'
import { Users, Map, Calendar, Activity } from 'lucide-react'
import Link from 'next/link'

// Admin dashboard — live oversikt over dugnader
export default function AdminOverviewPage() {
  const cards = [
    { href: '/admin/hendelser', icon: Calendar, label: 'Hendelser', desc: 'Opprett og administrer dugnader' },
    { href: '/admin/medlemmer', icon: Users, label: 'Medlemmer', desc: 'Se og administrer medlemmer' },
    { href: '/kart', icon: Map, label: 'Kart', desc: 'Se sonestatus i sanntid' },
  ]

  return (
    <div>
      {/* Statistikk-kort */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Medlemmer', value: '—', icon: Users },
          { label: 'Aktive soner', value: '36', icon: Map },
          { label: 'Hendelser', value: '—', icon: Calendar },
          { label: 'Online nå', value: '—', icon: Activity },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className="text-text-secondary" />
              <span className="text-xs text-text-secondary">{label}</span>
            </div>
            <p className="text-2xl font-bold font-mono">{value}</p>
          </Card>
        ))}
      </div>

      {/* Hurtiglenker */}
      <h2 className="text-lg font-semibold mb-3">Administrasjon</h2>
      <div className="space-y-3">
        {cards.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="p-4 flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-text-secondary">{desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
