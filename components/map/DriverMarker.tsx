'use client'

import { useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { Truck } from 'lucide-react'
import type { DriverLocation } from '@/lib/hooks/useDriverLocations'

// Farge per henger-gruppe — gjenbrukes i sjåfør-UI
const TRAILER_COLORS: Record<number, string> = {
  1: '#5C9CE6', // blå
  2: '#a24a33', // accent (terrakotta)
  3: '#6B8F71', // grønn
  4: '#9B7B9E', // lilla
}

interface DriverMarkerProps {
  drivers: DriverLocation[]
}

function timeAgo(updated: string): string {
  const sec = Math.round((Date.now() - new Date(updated).getTime()) / 1000)
  if (sec < 10) return 'akkurat nå'
  if (sec < 60) return `${sec} sek siden`
  return `${Math.round(sec / 60)} min siden`
}

export default function DriverMarker({ drivers }: DriverMarkerProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = drivers.find(d => d.user_id === openId) || null

  return (
    <>
      {drivers.map((d) => {
        const color = TRAILER_COLORS[d.trailer_group] || '#a24a33'
        return (
          <Marker
            key={d.user_id}
            longitude={d.longitude}
            latitude={d.latitude}
            anchor="center"
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setOpenId(d.user_id)
              }}
              className="relative flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform"
              style={{
                background: color,
                width: 36,
                height: 36,
                color: 'white',
              }}
              title={`Henger ${d.trailer_group}`}
            >
              <Truck size={16} strokeWidth={2.5} />
              <span
                className="absolute -top-1 -right-1 bg-white rounded-full text-[10px] font-bold flex items-center justify-center shadow"
                style={{ width: 16, height: 16, color }}
              >
                {d.trailer_group}
              </span>
              {/* Puls-ring */}
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-40"
                style={{ background: color }}
              />
            </button>
          </Marker>
        )
      })}

      {open && (
        <Popup
          longitude={open.longitude}
          latitude={open.latitude}
          anchor="bottom"
          offset={24}
          closeButton={false}
          closeOnClick={true}
          onClose={() => setOpenId(null)}
          className="driver-popup"
        >
          <div className="px-2 py-1 text-xs">
            <div className="font-semibold text-text-primary">
              Henger {open.trailer_group} · {open.full_name || 'Sjåfør'}
            </div>
            <div className="text-text-secondary">
              Oppdatert {timeAgo(open.updated_at)}
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}
