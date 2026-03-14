'use client'

import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Plus, Calendar } from 'lucide-react'

// Hendelsesadministrasjon — opprett og rediger dugnader
export default function EventsAdminPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Hendelser</h2>
        <Button size="sm">
          <Plus size={16} />
          Ny hendelse
        </Button>
      </div>

      <Card className="p-6 text-center">
        <Calendar size={32} className="text-text-tertiary mx-auto mb-3" />
        <p className="text-text-secondary">
          Ingen hendelser opprettet ennå
        </p>
        <p className="text-sm text-text-tertiary mt-1">
          Opprett en hendelse for å starte planlegging
        </p>
      </Card>
    </div>
  )
}
