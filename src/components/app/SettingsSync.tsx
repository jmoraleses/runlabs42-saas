'use client'

import { useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { useApp } from '@/components/app/shell'
import { isSupportedLang, readStoredLang } from '@/lib/locale'

const THEME_KEY = 'sk.theme'

function readStoredTheme(): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

/** Keep theme/language aligned with localStorage; profile is fallback only when local is empty. */
export function SettingsSync() {
  const { profile } = useUser()
  const { setLang, setTheme } = useApp() as {
    setLang: (code: string) => void
    setTheme: (theme: string) => void
  }

  useEffect(() => {
    const storedLang = readStoredLang()
    if (storedLang) {
      setLang(storedLang)
      return
    }
    const s = profile?.settings as { language?: string } | undefined
    if (s?.language && isSupportedLang(s.language)) {
      setLang(s.language)
    }
  }, [profile?.settings, setLang])

  useEffect(() => {
    const storedTheme = readStoredTheme()
    if (storedTheme) {
      setTheme(storedTheme)
      return
    }
    const s = profile?.settings as { theme?: string } | undefined
    if (s?.theme === 'light' || s?.theme === 'dark') {
      setTheme(s.theme)
    }
  }, [profile?.settings, setTheme])

  return null
}
