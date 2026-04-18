'use client'

import { useCallback, useEffect, useState } from 'react'

type ThemeSetting = 'light' | 'dark' | 'system'

// Hook for dark mode — leser/skriver localStorage, setter data-theme på <html>
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeSetting>('system')
  const [isDark, setIsDark] = useState(false)

  // Les lagret tema ved mount
  useEffect(() => {
    const stored = localStorage.getItem('theme') as ThemeSetting | null
    const setting = stored === 'light' || stored === 'dark' ? stored : 'system'
    setThemeState(setting)
    applyTheme(setting)
  }, [])

  // Lytt på system-endringer (når bruker har valgt "system")
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        setIsDark(mq.matches)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Sett data-theme og oppdater isDark
  function applyTheme(setting: ThemeSetting) {
    document.documentElement.setAttribute('data-theme', setting)
    if (setting === 'dark') {
      setIsDark(true)
    } else if (setting === 'light') {
      setIsDark(false)
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }

  const setTheme = useCallback((newTheme: ThemeSetting) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    if (newTheme === 'system') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', newTheme)
    }
  }, [])

  return { theme, setTheme, isDark }
}
