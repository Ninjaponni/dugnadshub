'use client'

import BottomSheet from '@/components/ui/BottomSheet'
import { Phone } from 'lucide-react'
import type { EventType } from '@/lib/supabase/types'

// Fargekoder per hendelsestype
const bottleColors = [
  { color: '#E57373', label: 'Ledig — ta denne sonen' },
  { color: '#FFD54F', label: 'Delvis tatt — trenger flere' },
  { color: '#5C9CE6', label: 'Fullt bemannet' },
  { color: '#6B8F71', label: 'Ferdigplukket' },
  { color: '#9C7DB8', label: 'Hentet' },
]

const flyerColors = [
  { color: '#E57373', label: 'Ledig — ta denne sonen' },
  { color: '#FFD54F', label: 'Delvis tatt — trenger flere' },
  { color: '#5C9CE6', label: 'Fullt bemannet' },
  { color: '#6B8F71', label: 'Ferdig levert' },
]

interface MapInfoSheetProps {
  open: boolean
  onClose: () => void
  eventType: EventType | null
  contactPhone: string | null
}

// Informasjonsark for dugnadsdeltagere — Stitch-design
export default function MapInfoSheet({ open, onClose, eventType, contactPhone }: MapInfoSheetProps) {
  const isBottleCollection = eventType === 'bottle_collection'
  const colorItems = isBottleCollection ? bottleColors : flyerColors

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-6">
        {/* Tittel */}
        <h3 className="text-lg font-extrabold text-text-primary font-[var(--font-display)]">
          Slik fungerer dugnaden
        </h3>

        {/* Fargekoder */}
        <div>
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">Fargekoder</p>
          <div className="space-y-3">
            {colorItems.map(({ color, label }) => (
              <div key={color + label} className="flex items-center gap-3 text-[14px] text-text-primary font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Steg */}
        <div>
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">Hva gjør jeg?</p>
          <div className="space-y-4">
            <Step n={1}>
              Velg en ledig sone (rød) og trykk <span className="font-bold text-accent">Ta denne sonen</span>
            </Step>
            {isBottleCollection ? (
              <>
                <Step n={2}>
                  Når du er ferdig, trykk <span className="font-bold text-accent">Marker som ferdig</span>
                </Step>
                <Step n={3}>
                  Sjåføren henter panten
                </Step>
              </>
            ) : (
              <Step n={2}>
                Når alle lapper og plakater er levert, trykk <span className="font-bold text-accent">Marker som ferdig</span>
              </Step>
            )}
          </div>
        </div>

        {/* Sjåfør/stripser-info (kun flaskeinnsamling) */}
        {isBottleCollection && (
          <div className="bg-surface-low p-4 rounded-xl">
            <p className="text-[13px] text-text-primary leading-relaxed font-medium">
              Sjåfør eller stripser? Trykk på <strong>Base</strong>-markøren i kartet for å melde deg.
            </p>
          </div>
        )}

        {/* Ring dugnadsansvarlig */}
        {contactPhone && (
          <a
            href={`tel:${contactPhone.replace(/\s+/g, '')}`}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-full text-white font-extrabold text-base active:scale-[0.98] transition-all font-[var(--font-display)]"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))', boxShadow: '0 8px 20px rgba(196,114,74,0.3)' }}
          >
            <Phone size={18} />
            Ring dugnadsansvarlig
          </a>
        )}
      </div>
    </BottomSheet>
  )
}

// Nummerert steg — terrakotta sirkel med hvitt tall
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-6 h-6 rounded-full bg-accent text-white text-[13px] font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <p className="text-[14px] leading-tight text-text-primary">{children}</p>
    </div>
  )
}
