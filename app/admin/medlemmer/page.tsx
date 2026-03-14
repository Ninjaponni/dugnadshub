'use client'

import Card from '@/components/ui/Card'
import { Users, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'

// Medlemsadministrasjon — se, importer og administrer medlemmer
export default function MembersAdminPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Medlemmer</h2>
        <Button size="sm" variant="secondary">
          <Upload size={16} />
          Importer
        </Button>
      </div>

      <Card className="p-6 text-center">
        <Users size={32} className="text-text-tertiary mx-auto mb-3" />
        <p className="text-text-secondary">
          Ingen medlemmer registrert ennå
        </p>
        <p className="text-sm text-text-tertiary mt-1">
          Medlemmer opprettes automatisk når de logger inn,<br />
          eller importeres fra Excel-fil
        </p>
      </Card>
    </div>
  )
}
