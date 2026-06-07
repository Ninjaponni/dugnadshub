'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// Hook for toast-bekreftelser med automatisk lukking etter 2.4s
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMessage(null), 2400)
  }, [])

  // Rydd ved unmount slik at timer ikke kjører etter at komponenten er borte
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { message, showToast }
}
