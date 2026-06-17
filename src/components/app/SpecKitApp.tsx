'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppProvider } from './shell'
import { ErrorBoundary } from '@/components/app/ErrorBoundary'
import { RouteSkeleton } from '@/components/app/RouteSkeleton'
import { SK_I18N } from '@/lib/i18n'
import { LandingPage } from '@/views/LandingPage'
import { PricingPage } from '@/views/PricingPage'
import { ContactPage } from '@/views/ContactPage'
import { AuthPage } from '@/views/AuthPage'
import { SettingsPage } from '@/views/SettingsPage'
import { LegalPage } from '@/views/LegalPage'
import { AboutPage } from '@/views/AboutPage'

/** Rutas pesadas en chunks aparte: evita que HMR del Studio rompa ajustes/suscripción. */
const EditorPage = dynamic(
  () => import('@/views/EditorPage').then((m) => ({ default: m.EditorPage })),
  { loading: () => <RouteSkeleton label="Cargando Studio…" /> },
)
const ProjectsPage = dynamic(
  () => import('@/views/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
  { loading: () => <RouteSkeleton label="Cargando proyectos…" /> },
)
const MarketplacePage = dynamic(
  () => import('@/views/MarketplacePage').then((m) => ({ default: m.MarketplacePage })),
  { loading: () => <RouteSkeleton label="Cargando marketplace…" /> },
)
const AdminPage = dynamic(
  () => import('@/views/AdminPage').then((m) => ({ default: m.AdminPage })),
  { loading: () => <RouteSkeleton label="Cargando admin…" /> },
)
const OnboardingPage = dynamic(
  () => import('@/views/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
  { loading: () => <RouteSkeleton label="Cargando…" /> },
)
function MaintenancePage() {
  const [lang, setLang] = useState('en')
  useEffect(() => {
    const stored = localStorage.getItem('sk.lang') || 'es'
    setLang(stored)
  }, [])

  const dict = SK_I18N[lang as keyof typeof SK_I18N] || SK_I18N.en
  const title = dict['maintenance.title.default'] || 'Estamos mejorando Runlabs42'
  const message = dict['maintenance.message.default'] || 'La plataforma estará disponible en breve. Pedimos disculpas por las molestias causadas.'
  const estimatedTimeLabel = dict['maintenance.estimatedTime'] || 'Tiempo estimado'
  const needHelpLabel = dict['maintenance.needHelp'] || '¿Necesitas ayuda?'

  try {
    const config = JSON.parse(localStorage.getItem('adm.maintenanceConfig') || '{}')
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '40px 20px',
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 'var(--radius-xl)',
            background: 'color-mix(in srgb, var(--warning) 14%, var(--surface-2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--warning)',
            marginBottom: 6,
          }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: 'var(--text)',
            margin: 0,
          }}>
            {config.title || title}
          </h1>
          <p style={{
            fontSize: 15,
            color: 'var(--text-muted)',
            lineHeight: 1.65,
            margin: 0,
          }}>
            {config.message || message}
          </p>
          {config.estimatedTime && (
            <div style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              fontSize: 14,
              color: 'var(--text-mid)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              {estimatedTimeLabel}: {config.estimatedTime}
            </div>
          )}
          {config.contactEmail && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              {needHelpLabel} <a style={{ color: 'var(--accent)' }} href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
            </p>
          )}
        </div>
      </div>
    )
  } catch (e) {
    return <RouteSkeleton label="Cargando…" />
  }
}

function CreditsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/settings?tab=billing')
  }, [router])
  return <RouteSkeleton label="Redirigiendo…" />
}

function DashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/projects')
  }, [router])
  return <RouteSkeleton label="Redirigiendo…" />
}

function Router() {
  const route = usePathname() || '/'
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)

  useEffect(() => {
    try {
      const config = JSON.parse(localStorage.getItem('adm.maintenanceConfig') || '{}')
      setMaintenanceEnabled(config.enabled === true)
    } catch {}
  }, [])

  if (maintenanceEnabled && route !== '/admin') {
    return <MaintenancePage />
  }

  if (route === '/onboarding')
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando…" />}>
        <OnboardingPage />
      </Suspense>
    )

  if (route === '/' || route === '') return <LandingPage />
  if (route === '/pricing') return <PricingPage />
  if (route === '/contact')
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando contacto…" />}>
        <ContactPage />
      </Suspense>
    )
  if (route === '/about') return <AboutPage />
  if (route === '/legal/privacy' || route === '/legal/cookies' || route === '/legal/terms')
    return <LegalPage />
  if (route === '/auth/signin')
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando inicio de sesión…" />}>
        <AuthPage mode="signin" />
      </Suspense>
    )
  if (route === '/auth/signup')
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando registro…" />}>
        <AuthPage mode="signup" />
      </Suspense>
    )
  if (route === '/auth/reset' || route === '/auth/reset/confirm') {
    return <AuthPage mode="signin" />
  }
  if (route === '/credits' || route.startsWith('/credits/')) return <CreditsRedirect />
  if (route === '/projects' || route.startsWith('/projects/'))
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando proyectos…" />}>
        <ProjectsPage />
      </Suspense>
    )
  if (route.startsWith('/editor')) {
    // Legacy redirect: /editor → /studio
    if (typeof window !== 'undefined') window.history.replaceState(null, '', route.replace('/editor', '/studio'))
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando editor…" />}>
        <EditorPage />
      </Suspense>
    )
  }
  if (route.startsWith('/studio'))
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando Studio…" />}>
        <EditorPage />
      </Suspense>
    )
  if (route.startsWith('/marketplace'))
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando marketplace…" />}>
        <MarketplacePage />
      </Suspense>
    )
  if (route.startsWith('/settings'))
    return (
      <Suspense fallback={<RouteSkeleton label="Cargando ajustes…" />}>
        <SettingsPage />
      </Suspense>
    )
  if (route.startsWith('/dashboard')) return <DashboardRedirect />
  if (route.startsWith('/admin')) return <AdminPage />

  return <LandingPage />
}

export default function SpecKitApp() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <Router />
      </ErrorBoundary>
    </AppProvider>
  )
}
