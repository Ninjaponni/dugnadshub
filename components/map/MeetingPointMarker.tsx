'use client'

import { Marker } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'
import type { MeetingPoint } from '@/lib/supabase/types'

interface MeetingPointMarkerProps {
  point: MeetingPoint
  onClick?: (point: MeetingPoint) => void
}

// Møteplass-markør for plastdugnad — oppmøte- og samlingssted
export default function MeetingPointMarker({ point, onClick }: MeetingPointMarkerProps) {
  return (
    <Marker longitude={point.lng} latitude={point.lat} anchor="bottom">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick?.(point)
        }}
        className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-semibold whitespace-nowrap active:scale-95 transition-transform"
        title={point.name}
      >
        <MapPin size={14} />
        Møteplass
      </button>
    </Marker>
  )
}
