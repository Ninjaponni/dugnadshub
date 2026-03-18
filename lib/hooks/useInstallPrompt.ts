'use client'

import { useEffect, useState, useCallback } from 'react'

// Detekterer plattform og gir tilgang til PWA install-prompt (Android)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Plattformdeteksjon
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios')
    } else if (/android/.test(ua)) {
      setPlatform('android')
    }

    // Sjekk om appen allerede kjører som PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone)
    setIsStandalone(!!standalone)

    // Lytt på Android install-prompt
    function handlePrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }, [deferredPrompt])

  return {
    platform,
    isStandalone,
    canInstall: !!deferredPrompt,
    promptInstall,
  }
}
