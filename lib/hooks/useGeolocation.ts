'use client'

import { useEffect, useState } from 'react'

interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
}

// GPS-posisjon med live oppdatering
export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolokasjon støttes ikke')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setError(null)
      },
      (err) => {
        setError(err.message)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return { position, error }
}
