export const LANG_STORAGE_KEY = 'sk.lang'

export const SUPPORTED_LANG_CODES = ['en', 'es', 'fr', 'de', 'nl', 'it'] as const

export type SupportedLang = (typeof SUPPORTED_LANG_CODES)[number]

export function isSupportedLang(code: string): code is SupportedLang {
  return (SUPPORTED_LANG_CODES as readonly string[]).includes(code)
}

export function detectBrowserLang(): SupportedLang {
  const navLang = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase()
  return isSupportedLang(navLang) ? navLang : 'en'
}

export function readStoredLang(): SupportedLang | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(LANG_STORAGE_KEY)
  return stored && isSupportedLang(stored) ? stored : null
}

export function getInitialLang(): SupportedLang {
  return readStoredLang() ?? detectBrowserLang()
}

export function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem('sk.theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function persistLangCookie(code: SupportedLang) {
  if (typeof window === 'undefined') return
  document.cookie = `${LANG_STORAGE_KEY}=${code};path=/;max-age=31536000;samesite=lax`
}

export async function persistLangToProfile(
  code: SupportedLang,
  currentSettings?: Record<string, unknown> | null,
) {
  if (typeof window === 'undefined') return
  try {
    const { apiFetch } = await import('@/lib/api/client')
    const { isDemoActive } = await import('@/lib/auth/demo')
    if (isDemoActive()) return
    await apiFetch('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        settings: { ...(currentSettings ?? {}), language: code },
      }),
    })
  } catch {
    /* ignore — localStorage remains source of truth */
  }
}
