'use client'

import BottomSheet from '@/components/ui/BottomSheet'
import { Phone } from 'lucide-react'
import type { EventType } from '@/lib/supabase/types'

// Fargekoder — samme som MapLegend
const colorItems = [
  { color: '#EF4444', label: 'Ledig — ta denne sonen' },
  { color: '#F59E0B', label: 'Delvis tatt — trenger flere' },
  { color: '#007AFF', label: 'Fullt bemannet' },
  { color: '#22C55E', label: 'Ferdigplukket' },
  { color: '#8B5CF6', label: 'Hentet' },
]

interface MapInfoSheetProps {
  open: boolean
  onClose: () => void
  eventType: EventType | null
  contactPhone: string | null
}

// Informasjonsark for dugnadsdeltagere
export default function MapInfoSheet({ open, onClose, eventType, contactPhone }: MapInfoSheetProps) {
  const isBottleCollection = eventType === 'bottle_collection'

  return (
    <BottomSheet open={open} onClose={onClose} title="Slik fungerer dugnaden">
      {/* Fargekoder */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Fargekoder</p>
        <div className="space-y-2">
          {colorItems.map(({ color, label }) => (
            <div key={color} className="flex items-center gap-2.5 text-sm">
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: color, opacity: 0.6 }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steg */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Hva gjør jeg?</p>
        <div className="space-y-3">
          <Step n={1}>
            Velg en ledig sone (rød) og trykk <strong>Ta denne sonen</strong>
          </Step>
          <Step n={2}>
            Når du er ferdig, trykk <strong>Marker som ferdig</strong>
          </Step>
          {isBottleCollection && (
            <Step n={3}>
              Sjåføren henter panten
            </Step>
          )}
        </div>
      </div>

      {/* Sjåfør/stripser-info (kun flaskeinnsamling) */}
      {isBottleCollection && (
        <div className="mb-5 p-3 bg-bg rounded-xl">
          <p className="text-sm">
            <strong>Sjåfør eller stripser?</strong> Trykk på <strong>Base</strong>-markøren i kartet for å melde deg.
          </p>
        </div>
      )}

      {/* Ring dugnadsansvarlig */}
      {contactPhone && (
        <a
          href={`tel:${contactPhone.replace(/\s+/g, '')}`}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-accent text-white font-semibold rounded-xl text-sm active:opacity-80 transition-opacity"
        >
          <Phone size={16} />
          Ring dugnadsansvarlig
        </a>
      )}
    </BottomSheet>
  )
}

// Nummerert steg-komponent
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <p className="text-sm leading-snug">{children}</p>
    </div>
  )
}
