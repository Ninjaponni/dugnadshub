'use client'

import { useEffect, useRef, useState } from 'react'

// Sjåfør deler live-posisjon mens denne hooken er aktiv.
// - watchPosition gir hyppige oppdateringer, men vi sender bare hvert 10. sek til API
// - Wake Lock holder skjermen på (telefon i holder i bilen)
// - Hvis API returnerer 410 (utenfor tidsvindu) stopper vi automatisk
//
// Krav: bruker må være logget inn og være sjåfør på event_id

interface UseShareLocationResult {
  active: boolean
  error: string | null
  lastUpdate: Date | null
  start: () => Promise<void>
  stop: () => Promise<void>
}

const SEND_INTERVAL_MS = 10_000

export function useShareLocation(eventId: string | null): UseShareLocationResult {
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const lastSentRef = useRef<number>(0)
  const tokenRef = useRef<string | null>(null)
  const stoppedRef = useRef(false)

  async function getToken(): Promise<string | null> {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function sendPosition(lat: number, lng: number, acc: number) {
    if (!eventId || !tokenRef.current) return
    try {
      const res = await fetch('/api/driver/update-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          event_id: eventId,
          latitude: lat,
          longitude: lng,
          accuracy: acc,
        }),
      })
      if (res.status === 410) {
        // Utenfor tidsvindu — stopp deling pent
        await stop()
        setError('Hendelsen er ferdig, deling stoppet')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || `Kunne ikke sende posisjon (${res.status})`)
        return
      }
      setError(null)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil')
    }
  }

  async function start() {
    if (!eventId) {
      setError('Ingen aktiv hendelse')
      return
    }
    if (!navigator.geolocation) {
      setError('Geolokasjon støttes ikke')
      return
    }

    const token = await getToken()
    if (!token) {
      setError('Ikke innlogget')
      return
    }
    tokenRef.current = token
    stoppedRef.current = false

    // Be om Wake Lock — best effort, ikke kritisk hvis den feiler
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> } }).wakeLock.request('screen')
      }
    } catch {
      // ignorer — noen nettlesere blokkerer dette
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentRef.current < SEND_INTERVAL_MS) return
        lastSentRef.current = now
        sendPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
      },
      (err) => {
        setError(err.message)
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 5_000,
      }
    )

    setActive(true)
    setError(null)
  }

  async function stop() {
    if (stoppedRef.current) return
    stoppedRef.current = true

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release() } catch { /* ok */ }
      wakeLockRef.current = null
    }

    // Nullstill posisjon på server
    if (eventId && tokenRef.current) {
      try {
        await fetch(`/api/driver/update-location?event_id=${eventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${tokenRef.current}` },
        })
      } catch { /* best effort */ }
    }

    setActive(false)
    setLastUpdate(null)
  }

  // Gjenoppta Wake Lock hvis fanen blir synlig igjen (Safari slipper den ved tab-bytte)
  useEffect(() => {
    if (!active) return
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && active && !wakeLockRef.current) {
        if ('wakeLock' in navigator) {
          (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> } })
            .wakeLock.request('screen')
            .then(lock => { wakeLockRef.current = lock })
            .catch(() => { /* ignorer */ })
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [active])

  // Cleanup ved unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => { /* ok */ })
      }
    }
  }, [])

  return { active, error, lastUpdate, start, stop }
}
