'use client'

import { MapPin } from 'lucide-react'

// Kartside — Mapbox GL legges til i Fase 2
export default function MapPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
        <MapPin size={32} className="text-accent" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Sonekart</h1>
      <p className="text-text-secondary text-[15px]">
        Kart med alle 35 soner kommer i neste fase.
      </p>
    </div>
  )
}
