'use client'

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SK_I18N, SK_LANGS } from '@/lib/i18n'
import {
  LANG_STORAGE_KEY,
  getInitialLang,
  getInitialTheme,
  isSupportedLang,
  persistLangCookie,
  persistLangToProfile,
  readStoredLang,
} from '@/lib/locale'
import { LowCreditBanner } from '@/components/app/LowCreditBanner'
import { CookieConsent } from '@/components/app/CookieConsent'
import { useUser } from '@/hooks/useUser'
import { usePlatformFeatures } from '@/hooks/usePlatformFeatures'
import { signOut } from '@/lib/auth/client'
import { openStudio } from '@/lib/projects/openStudio'
import { EditorFocusProvider, useEditorFocusOptional } from '@/contexts/EditorFocusContext'

// Runlabs42 — App shell: theme, i18n, router, top nav, footer, shared icons & primitives.

function BrandWordmark({ size = 'nav' }) {
  const fontSize = size === 'footer' ? 19 : 24
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize,
        letterSpacing: '-0.02em',
        position: 'relative',
        display: 'inline-block',
        paddingRight: size === 'nav' ? 32 : 0,
      }}
    >
      <span>Runlabs</span>
      <span className="brand-42" style={{ marginLeft: 2 }}>
        42
      </span>
      {size === 'nav' && (
        <span
          className="pill pill-mono"
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            padding: '0 5px',
            fontSize: 9,
            lineHeight: 1.4,
            opacity: 0.85,
          }}
        >
          beta
        </span>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------
   Theme + Language context
------------------------------------------------------------------ */

const AppCtx = createContext(null)

function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

function AppProvider({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useUser()
  const { speechDictationEnabled, designClarifyQuestionsEnabled } = usePlatformFeatures()
  const [lang, setLangState] = useState('en')
  const [theme, setTheme] = useState('light')
  const [mounted, setMounted] = useState(false)
  const route = pathname || '/'

  const setLang = useCallback((code) => {
    if (!isSupportedLang(code)) return
    setLangState(code)
    persistLangCookie(code)
  }, [])

  useEffect(() => {
    const storedLang = readStoredLang()
    if (storedLang) {
      setLangState(storedLang)
      persistLangCookie(storedLang)
    } else {
      const next = getInitialLang()
      setLangState(next)
      persistLangCookie(next)
    }
    setTheme(getInitialTheme())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || readStoredLang()) return
    const profileLang = profile?.settings?.language
    if (typeof profileLang === 'string' && isSupportedLang(profileLang)) {
      setLangState(profileLang)
      persistLangCookie(profileLang)
    }
  }, [profile?.settings, mounted])

  useEffect(() => {
    if (!mounted) return
    const storedTheme = localStorage.getItem('sk.theme')
    if (storedTheme === 'light' || storedTheme === 'dark') return
    const profileTheme = profile?.settings?.theme
    if (profileTheme === 'light' || profileTheme === 'dark') setTheme(profileTheme)
  }, [profile?.settings, mounted])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sk.theme', theme)
  }, [theme, mounted])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.setAttribute('lang', lang)
    localStorage.setItem(LANG_STORAGE_KEY, lang)
    persistLangCookie(lang)
  }, [lang, mounted])

  const locale = mounted ? lang : 'en'

  const t = useCallback(
    (key) => {
      const dict = SK_I18N[locale] || SK_I18N.en
      return dict[key] || SK_I18N.en[key] || key
    },
    [locale]
  )

  const navigate = useCallback(
    (path) => {
      router.push(path)
      window.scrollTo({ top: 0, behavior: 'instant' })
    },
    [router]
  )

  const value = React.useMemo(
    () => ({
      lang,
      setLang,
      theme,
      setTheme,
      route,
      navigate,
      t,
      mounted,
      speechDictationEnabled,
      designClarifyQuestionsEnabled,
    }),
    [
      lang,
      setLang,
      theme,
      route,
      navigate,
      t,
      mounted,
      speechDictationEnabled,
      designClarifyQuestionsEnabled,
    ],
  )

  return (
    <AppCtx.Provider value={value}>
      {children}
    </AppCtx.Provider>
  )
}

/* ------------------------------------------------------------------
   Icons (inline SVG — minimal set)
------------------------------------------------------------------ */

const Icon = {
  Sun: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  Moon: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Globe: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  Github: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.22.7-3.9-1.36-3.9-1.36-.53-1.35-1.3-1.7-1.3-1.7-1.07-.73.08-.72.08-.72 1.18.08 1.8 1.21 1.8 1.21 1.05 1.8 2.76 1.28 3.43.98.11-.76.41-1.28.74-1.57-2.57-.29-5.27-1.29-5.27-5.74 0-1.27.45-2.31 1.2-3.12-.12-.3-.52-1.5.11-3.12 0 0 .98-.31 3.2 1.19a11 11 0 0 1 5.83 0c2.22-1.5 3.2-1.19 3.2-1.19.63 1.62.23 2.82.11 3.12.75.81 1.2 1.85 1.2 3.12 0 4.46-2.7 5.45-5.28 5.73.42.36.79 1.07.79 2.17v3.21c0 .31.21.67.79.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Spark: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" />
    </svg>
  ),
  Bolt: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...p}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  ),
  CreditCard: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  ),
  Activity: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
    </svg>
  ),
  Lock: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Star: (p) => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" {...p}>
      <path d="M12 2 15 9l8 .9-6 5.4 1.8 7.7L12 19l-6.8 4 1.8-7.7L1 9.9 9 9z" />
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Sliders: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <circle cx="4" cy="14" r="2" />
      <circle cx="12" cy="11" r="2" />
      <circle cx="20" cy="16" r="2" />
    </svg>
  ),
  Pencil: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  Infinity: ({ className = '', ...p }) => (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={['composer-icon-infinity', className].filter(Boolean).join(' ')}
      aria-hidden
      {...p}
    >
      <path d="M7.5 8.2a4.5 3.8 0 1 1 0 7.6a4.5 3.8 0 1 1 0-7.6" />
      <path d="M16.5 8.2a4.5 3.8 0 1 0 0 7.6a4.5 3.8 0 1 0 0-7.6" />
    </svg>
  ),
  Bell: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  Folder: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  Save: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  ),
  Download: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  Rocket: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  Code: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  ),
  Settings: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />
    </svg>
  ),
  Send: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  Undo: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8" />
    </svg>
  ),
  Redo: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h7" />
    </svg>
  ),
  RefreshCw: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  Copy: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Mobile: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  ),
  Tablet: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  ),
  Monitor: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  Supabase: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
      <path d="M13.2 1.6c.7-.9 2.1-.4 2.1.8v7.2h5.6c1.3 0 2 1.5 1.2 2.5l-9.3 11.7c-.7.9-2.1.4-2.1-.8v-7.2H5.1c-1.3 0-2-1.5-1.2-2.5L13.2 1.6z" />
    </svg>
  ),
  Vercel: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}>
      <path d="M12 3 22 21H2Z" />
    </svg>
  ),
};

/* ------------------------------------------------------------------
   Framework / model definitions
------------------------------------------------------------------ */

const FRAMEWORKS = [
  { id: "react", name: "React", color: "var(--fw-react)", glyph: "⚛", group: "web" },
  { id: "vue", name: "Vue", color: "var(--fw-vue)", glyph: "▲", group: "web" },
  { id: "next", name: "Next.js", color: "var(--fw-next)", glyph: "▴", group: "web" },
  { id: "svelte", name: "Svelte", color: "var(--fw-svelte)", glyph: "◆", group: "web" },
  { id: "astro", name: "Astro", color: "var(--fw-astro)", glyph: "✺", group: "web" },
  { id: "solid", name: "Solid", color: "var(--fw-solid)", glyph: "◇", group: "web" },
  { id: "vanilla", name: "HTML/JS", color: "var(--fw-vanilla)", glyph: "◉", group: "web" },
  { id: "canvas-app", name: "Canvas Draw", color: "var(--fw-canvas-app)", glyph: "✎", group: "canvas" },
  { id: "canvas-game", name: "Canvas Game", color: "var(--fw-canvas-game)", glyph: "◈", group: "canvas" },
  { id: "p5", name: "p5.js", color: "var(--fw-p5)", glyph: "◎", group: "canvas" },
  { id: "phaser", name: "Phaser", color: "var(--fw-phaser)", glyph: "▣", group: "canvas" },
  { id: "three", name: "Three.js", color: "var(--fw-three)", glyph: "◐", group: "canvas" },
];

export const FRAMEWORK_GROUPS = {
  web: { labelKey: "framework.group.web" },
  canvas: { labelKey: "framework.group.canvas" },
};

// Modelos gratuitos de Gemini (free tier — sin tarjeta de crédito)
const MODELS = [
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", inputPerM: 0.075, outputPerM: 0.30, runlabsInputPerM: 0, runlabsOutputPerM: 0, tag: "Más rápido · Gratis", color: "#34d399", free: true },
  { id: "gemini-2.0-flash",      name: "Gemini 2.0 Flash",      inputPerM: 0.10, outputPerM: 0.40, runlabsInputPerM: 0, runlabsOutputPerM: 0, tag: "Equilibrado · Gratis", color: "#4f7cff", free: true },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", inputPerM: 0.30, outputPerM: 2.50, runlabsInputPerM: 0, runlabsOutputPerM: 0, tag: "Thinking · Gratis", color: "#f59e0b", free: true },
  { id: "gemini-2.5-pro",   name: "Gemini 2.5 Pro",   inputPerM: 1.25, outputPerM: 10.0, runlabsInputPerM: 0, runlabsOutputPerM: 0, tag: "Proyectos grandes · Gratis", color: "#f97316", free: true },
];

/* ------------------------------------------------------------------
   Top nav
------------------------------------------------------------------ */

function ThemeToggle() {
  const { theme, setTheme, t } = useApp();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => setTheme(next)}
      title={t("theme." + next)}
      aria-label={t("theme." + next)}
    >
      {theme === "dark" ? <Icon.Sun /> : <Icon.Moon />}
    </button>
  );
}

function LangSwitcher() {
  const { lang, setLang } = useApp();
  const { profile } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn-ghost"
        style={{ padding: "8px 10px", gap: 6 }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon.Globe />
        <span className="mono app-chrome-lang-code">{lang.toUpperCase()}</span>
        <Icon.Chevron />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            minWidth: 180,
            padding: 6,
            zIndex: 100,
          }}
        >
          {SK_LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
                void persistLangToProfile(l.code, profile?.settings ?? null);
              }}
              style={{
                display: "flex",
                width: "100%",
                gap: 10,
                alignItems: "center",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                background: l.code === lang ? "var(--surface-2)" : "transparent",
                color: "var(--text)",
                fontSize: 13,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  l.code === lang ? "var(--surface-2)" : "transparent")
              }
            >
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, width: 22, color: "var(--text-muted)" }}>
                {l.flag}
              </span>
              <span>{l.label}</span>
              {l.code === lang && (
                <span style={{ marginLeft: "auto", color: "var(--accent)" }}>
                  <Icon.Check />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({ to, children, matchPath }) {
  const { route, navigate } = useApp()
  const activePath = matchPath ?? to.split('?')[0]
  const active =
    activePath === '/'
      ? route === '/' || route === ''
      : route === activePath || route.startsWith(`${activePath}/`)
  return (
    <a
      href={to}
      className={`app-chrome-link${active ? ' is-active' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        navigate(to)
      }}
      style={{
        fontSize: 14,
      }}
      suppressHydrationWarning
    >
      {children}
    </a>
  );
}

function AppChromeAccount() {
  const { t, navigate, lang } = useApp()
  const { profile } = useUser()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const initials =
    profile?.fullName?.slice(0, 1) ||
    profile?.email?.slice(0, 1)?.toUpperCase() ||
    '?'

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  async function logout() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  const menuItems = [
    {
      id: 'studio',
      label: t('nav.studio'),
      icon: <Icon.Code />,
      onClick: () => {
        setOpen(false)
        openStudio(navigate, lang === 'en' ? 'en' : 'es')
      },
    },
    {
      id: 'projects',
      label: t('nav.projects'),
      icon: <Icon.Folder />,
      onClick: () => go('/projects'),
    },
    { id: 'marketplace', label: t('nav.marketplace'), icon: <Icon.Star />, onClick: () => go('/marketplace') },
    { id: 'billing', label: t('set.billing'), icon: <Icon.CreditCard />, onClick: () => go('/settings?tab=billing') },
    { id: 'settings', label: t('nav.settings'), icon: <Icon.Settings />, onClick: () => go('/settings') },
  ]

  return (
    <div className="app-chrome-account" ref={ref}>
      <button
        type="button"
        className="app-chrome-user-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={profile?.fullName || profile?.email || t('nav.account')}
      >
        <span
          className="app-user-avatar"
          style={{
            background: profile?.avatarUrl
              ? `url(${profile.avatarUrl}) center/cover`
              : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          }}
        >
          {!profile?.avatarUrl && initials}
        </span>
        <span className="app-chrome-user-text">
          <span className="app-chrome-user-name">
            {profile?.fullName || profile?.email || t('nav.account')}
          </span>
          {profile?.credits != null && (
            <span className="app-chrome-user-credits mono">
              {profile.credits} {t('credits.short')}
            </span>
          )}
        </span>
        <Icon.Chevron
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 160ms var(--ease)',
          }}
        />
      </button>

      {open && (
        <div className="app-user-dropdown" role="menu">
          <div className="app-user-dropdown-head">
            <span className="app-user-dropdown-name">
              {profile?.fullName || t('nav.account')}
            </span>
            {profile?.email && (
              <span className="app-user-dropdown-email">{profile.email}</span>
            )}
          </div>
          <div className="app-user-dropdown-sep" />
          {menuItems.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              className="app-user-dropdown-item"
              onClick={it.onClick}
            >
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
          <div className="app-user-dropdown-sep" />
          <button
            type="button"
            role="menuitem"
            className="app-user-dropdown-item app-user-dropdown-item--danger"
            onClick={logout}
          >
            <Icon.Lock />
            <span>{t('nav.signout')}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function StudioNavLink() {
  const { t, route, navigate, lang } = useApp()
  const [busy, setBusy] = useState(false)
  const active = route === '/studio' || route.startsWith('/studio/') || route.startsWith('/studio?')

  function handleStudio(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    openStudio(navigate, lang === 'en' ? 'en' : 'es')
    window.setTimeout(() => setBusy(false), 400)
  }

  return (
    <a
      href="/studio"
      className={`app-chrome-link${active ? ' is-active' : ''}`}
      onClick={(e) => void handleStudio(e)}
      aria-busy={busy}
      style={{ fontSize: 14 }}
      suppressHydrationWarning
    >
      {t('nav.studio')}
    </a>
  )
}

function AppChromeNav() {
  const { t, mounted } = useApp()
  const { isAuthenticated } = useUser()
  const canOpenApp = mounted && isAuthenticated

  return (
    <nav className="app-chrome-nav" aria-label={t('nav.main')}>
      <NavLink to="/">{t('nav.home')}</NavLink>
      <NavLink to="/pricing">{t('nav.pricing')}</NavLink>
      <NavLink to="/marketplace">{t('nav.marketplace')}</NavLink>
      {canOpenApp ? (
        <>
          <StudioNavLink />
          <NavLink to="/projects" matchPath="/projects">
            {t('nav.projects')}
          </NavLink>
        </>
      ) : null}
    </nav>
  )
}

function AppChrome({ title, fullWidth = false }) {
  const { navigate, t } = useApp()
  const { isAuthenticated } = useUser()

  return (
    <header className={`app-chrome${fullWidth ? ' app-chrome--full' : ''}`}>
      <div className="app-chrome-inner">
        <a
          href="/"
          className="app-chrome-brand"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <BrandWordmark size="nav" />
        </a>
        <AppChromeNav />
        {title ? <span className="app-chrome-title">{title}</span> : null}
        <span className="spacer" />
        <div className="app-chrome-utils">
          <div className="app-chrome-utils-group">
            <LangSwitcher />
            <ThemeToggle />
          </div>
          {!isAuthenticated ? (
            <>
              <a
                href="/auth/signin"
                className="btn btn-ghost btn-sm"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/auth/signin')
                }}
              >
                {t('nav.signin')}
              </a>
              <a
                href="/auth/signup"
                className="btn btn-primary btn-sm"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/auth/signup')
                }}
              >
                {t('nav.start')}
              </a>
            </>
          ) : (
            <AppChromeAccount />
          )}
        </div>
      </div>
    </header>
  )
}

function AuthenticatedAppLayout({
  children,
  title,
  fullHeight = false,
  hideChrome = false,
}) {
  return (
    <div
      className={`app-layout app-layout--stacked fadein${fullHeight ? ' app-layout--editor' : ''}${hideChrome ? ' app-layout--editor-focus' : ''}`}
      style={fullHeight ? { height: '100vh' } : { minHeight: '100vh' }}
    >
      {!hideChrome ? <AppChrome title={title} fullWidth={fullHeight} /> : null}
      <LowCreditBanner />
      <main
        className="app-main-content"
        style={fullHeight ? { overflow: 'hidden', display: 'flex', flexDirection: 'column' } : undefined}
      >
        {children}
      </main>
      {!fullHeight && <Footer />}
      {!fullHeight && <CookieConsent />}
    </div>
  )
}

function TopNav() {
  return <AppChrome />
}

/* ------------------------------------------------------------------
   Footer
------------------------------------------------------------------ */

function Footer() {
  const { t, navigate } = useApp()
  const columns = [
    {
      title: t('footer.product'),
      items: [
        { label: t('nav.pricing'), path: '/pricing' },
        { label: t('nav.marketplace'), path: '/marketplace' },
      ],
    },
    {
      title: t('footer.resources'),
      items: [
        { label: t('nav.docs'), path: '/' },
        { label: t('nav.studio'), path: '/studio' },
        { label: t('nav.projects'), path: '/projects' },
      ],
    },
    {
      title: t('footer.company'),
      items: [{ label: t('footer.about'), path: '/about' }],
    },
    {
      title: t('footer.legal'),
      items: [
        { label: t('footer.privacy'), path: '/legal/privacy' },
        { label: t('footer.cookies'), path: '/legal/cookies' },
        { label: t('footer.terms'), path: '/legal/terms' },
      ],
    },
  ]
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        marginTop: 80,
        padding: "60px 0 30px",
        background: "var(--bg)",
      }}
    >
      <div
        className="container"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
          gap: 40,
        }}
      >
        <div>
          <div style={{ marginBottom: 14 }}>
            <BrandWordmark size="footer" />
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 260, lineHeight: 1.55 }}>
            {t("footer.tagline")}
          </div>
        </div>

        {columns.map((col, i) => (
          <div key={i}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
                marginBottom: 14,
                letterSpacing: "0.02em",
              }}
            >
              {col.title}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {col.items.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(item.path)
                    }}
                    style={{ color: 'var(--text-muted)', fontSize: 13 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        className="container"
        style={{
          marginTop: 50,
          paddingTop: 24,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("footer.copyright")}</div>
        <div className="spacer" />
        <div className="pill" style={{ background: "transparent" }}>
          <span className="pill-dot" /> All systems normal
        </div>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--text-muted)" }}>
          <Icon.Github />
        </a>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------
   Page wrappers
------------------------------------------------------------------ */

function MarketingShell({ children }) {
  return (
    <div className="fadein" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNav />
      <LowCreditBanner />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
      <CookieConsent />
    </div>
  )
}

function AppShell({ children }) {
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>
}

function EditorAuthenticatedLayout({ children }) {
  const focus = useEditorFocusOptional()
  const hideChrome = Boolean(focus?.focusMode)

  return (
    <AuthenticatedAppLayout fullHeight hideChrome={hideChrome}>
      {children}
    </AuthenticatedAppLayout>
  )
}

/** Editor a pantalla completa con barra superior (nav principal, sin título duplicado). */
function EditorShell({ children }) {
  const { isAuthenticated } = useUser()

  if (!isAuthenticated) {
    return (
      <EditorFocusProvider>
        <div className="fadein" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <TopNav />
          <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {children}
          </main>
        </div>
      </EditorFocusProvider>
    )
  }

  return (
    <EditorFocusProvider>
      <EditorAuthenticatedLayout>{children}</EditorAuthenticatedLayout>
    </EditorFocusProvider>
  )
}

/* ------------------------------------------------------------------
   Expose
------------------------------------------------------------------ */

export {
  AppProvider,
  useApp,
  Icon,
  FRAMEWORKS,
  MODELS,
  TopNav,
  Footer,
  MarketingShell,
  AppShell,
  EditorShell,
  NavLink,
}

export { EditorFocusProvider, useEditorFocus } from '@/contexts/EditorFocusContext'
