'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useApp, Icon } from '@/components/app/shell'
import { useUser } from '@/hooks/useUser'
import { completeOnboarding } from '@/lib/user/onboarding'
import { connectGithubPopup, primeGithubOAuthTab } from '@/lib/auth/connectGithub'
import { apiFetch } from '@/lib/api/client'
import { isDemoActive, loadDemoIntegrationStatus } from '@/lib/auth/demo'
import type { IntegrationStatus } from '@/lib/integrations/types'

const STEPS = ['welcome', 'vercel', 'github', 'project'] as const
type Step = (typeof STEPS)[number]

export function OnboardingPage() {
  const { navigate, t } = useApp() as { navigate: (path: string) => void; t: (key: string) => string }
  const { profile, loading: userLoading } = useUser()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('welcome')
  const [vercelConnected, setVercelConnected] = useState(false)
  const [githubConnected, setGithubConnected] = useState(false)
  const [connectingGithub, setConnectingGithub] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [completing, setCompleting] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Redirect if already onboarded
  useEffect(() => {
    if (!userLoading && profile?.settings?.onboardingCompleted) {
      navigate('/projects')
    }
  }, [userLoading, profile, navigate])

  // Load integration status on mount
  useEffect(() => {
    if (isDemoActive()) {
      const integrations = loadDemoIntegrationStatus()
      setVercelConnected(Boolean(integrations.vercel?.connected))
      setGithubConnected(Boolean(integrations.github?.connected))
      return
    }
    apiFetch<{ integrations: IntegrationStatus }>('/api/integrations/status')
      .then((data) => {
        setVercelConnected(Boolean(data.integrations.vercel?.connected))
        setGithubConnected(Boolean(data.integrations.github?.connected))
      })
      .catch(() => { /* proceed without pre-loaded status */ })
  }, [])

  // Detect Vercel OAuth return
  useEffect(() => {
    if (searchParams.get('vercel') === 'connected') {
      setVercelConnected(true)
      setStep('github')
    }
  }, [searchParams])

  // Detect GitHub popup success
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'runlabs42-github-oauth' && e.data?.success) {
        setGithubConnected(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  async function handleConnectVercel() {
    window.location.href = `/api/integrations/vercel/connect?returnTo=${encodeURIComponent('/onboarding')}`
  }

  async function handleConnectGithub() {
    setGithubError(null)
    setConnectingGithub(true)
    try {
      primeGithubOAuthTab()
      await connectGithubPopup()
      setGithubConnected(true)
    } catch (e) {
      setGithubError(e instanceof Error ? e.message : t('ed.importGithub.connectError'))
    } finally {
      setConnectingGithub(false)
    }
  }

  async function handleFinish() {
    setCompleting(true)
    try {
      await completeOnboarding((profile?.settings as Record<string, unknown>) ?? {})
      if (prompt.trim()) {
        navigate(`/?prompt=${encodeURIComponent(prompt.trim())}`)
      } else {
        navigate('/projects')
      }
    } catch {
      navigate('/projects')
    }
  }

  const stepIndex = STEPS.indexOf(step)
  const progressPct = ((stepIndex) / (STEPS.length - 1)) * 100

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text)',
          marginBottom: 4,
        }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Runlabs42
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Configuración inicial · paso {stepIndex + 1} de {STEPS.length}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        height: 3,
        background: 'var(--border)',
        borderRadius: 99,
        marginBottom: 32,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: 'var(--accent)',
          borderRadius: 99,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '40px 44px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
      }}>
        {step === 'welcome' && <WelcomeStep onContinue={() => setStep('vercel')} />}
        {step === 'vercel' && (
          <VercelStep
            connected={vercelConnected}
            onConnect={handleConnectVercel}
            onContinue={() => setStep('github')}
            onSkip={() => setStep('github')}
          />
        )}
        {step === 'github' && (
          <GithubStep
            connected={githubConnected}
            connecting={connectingGithub}
            error={githubError}
            onConnect={handleConnectGithub}
            onContinue={() => setStep('project')}
            onSkip={() => setStep('project')}
          />
        )}
        {step === 'project' && (
          <ProjectStep
            prompt={prompt}
            onPromptChange={setPrompt}
            completing={completing}
            onFinish={handleFinish}
            textareaRef={textareaRef}
          />
        )}
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            width: i === stepIndex ? 20 : 8,
            height: 8,
            borderRadius: 99,
            background: i <= stepIndex ? 'var(--accent)' : 'var(--border)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>
    </div>
  )
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const { t } = useApp() as { t: (key: string) => string }
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 'var(--radius-xl)',
        background: 'color-mix(in srgb, var(--accent) 12%, var(--surface-2))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        color: 'var(--accent)',
      }}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', margin: '0 0 12px' }}>
        Bienvenido a Runlabs42
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 32px' }}>
        Tu plataforma de desarrollo con IA. Describe lo que quieres construir, genera el código al instante y despliégalo en segundos.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 36, textAlign: 'left' }}>
        {[
          { icon: '⚡', title: 'IA integrada', desc: 'Claude, GPT-5 y Gemini disponibles' },
          { icon: '🚀', title: 'Deploy inmediato', desc: t('onb.welcome.feature.deploy.desc') },
          { icon: '🔁', title: 'Editor en vivo', desc: t('onb.welcome.feature.live.desc') },
          { icon: '🛒', title: 'Marketplace', desc: 'Vende y compra plantillas de código' },
        ].map(item => (
          <div key={item.title} style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px 24px' }} onClick={onContinue}>
        Empezar la configuración →
      </button>
    </div>
  )
}

function VercelStep({
  connected,
  onConnect,
  onContinue,
  onSkip,
}: {
  connected: boolean
  onConnect: () => void
  onContinue: () => void
  onSkip: () => void
}) {
  const { t } = useApp() as { t: (key: string) => string }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          flexShrink: 0,
        }}>
          <Icon.Vercel style={{ width: 24, height: 24 }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            {t('onb.vercel.title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t('onb.vercel.subtitle')}</p>
        </div>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 20 }}>
        {t('onb.vercel.body')}
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          t('onb.vercel.bullet1'),
          t('onb.vercel.bullet2'),
          t('onb.vercel.bullet3'),
        ].map(item => (
          <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-mid)' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, var(--surface-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon.Check style={{ width: 10, height: 10, color: 'var(--accent)' }} />
            </span>
            {item}
          </li>
        ))}
      </ul>

      {connected ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: 'color-mix(in srgb, var(--success, #22c55e) 10%, var(--surface-2))',
            border: '1px solid color-mix(in srgb, var(--success, #22c55e) 30%, var(--border))',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
          }}>
            <Icon.Check style={{ color: 'var(--success, #22c55e)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t('set.vercelConnectedOk')}</span>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onContinue}>
            {t('onb.vercel.continue')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px 24px' }} onClick={onConnect}>
            <Icon.Vercel style={{ width: 16, height: 16 }} /> {t('onb.vercel.connectBtn')}
          </button>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '6px 0', textAlign: 'center' }}
            onClick={onSkip}
          >
            {t('onb.vercel.skip')}
          </button>
        </div>
      )}
    </div>
  )
}

function GithubStep({
  connected,
  connecting,
  error,
  onConnect,
  onContinue,
  onSkip,
}: {
  connected: boolean
  connecting: boolean
  error: string | null
  onConnect: () => void
  onContinue: () => void
  onSkip: () => void
}) {
  const { t } = useApp() as { t: (key: string) => string }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          flexShrink: 0,
        }}>
          <Icon.Github style={{ width: 24, height: 24 }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            {t('onb.github.title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t('onb.github.subtitle')}</p>
        </div>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 20 }}>
        {t('onb.github.body')}
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          t('onb.github.bullet1'),
          t('onb.github.bullet2'),
          t('onb.github.bullet3'),
        ].map(item => (
          <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-mid)' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent) 15%, var(--surface-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon.Check style={{ width: 10, height: 10, color: 'var(--accent)' }} />
            </span>
            {item}
          </li>
        ))}
      </ul>

      {error && (
        <p className="integrations-msg integrations-msg--error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {connected ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: 'color-mix(in srgb, var(--success, #22c55e) 10%, var(--surface-2))',
            border: '1px solid color-mix(in srgb, var(--success, #22c55e) 30%, var(--border))',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
          }}>
            <Icon.Check style={{ color: 'var(--success, #22c55e)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t('set.githubConnectedOk')}</span>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onContinue}>
            {t('onb.github.continue')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px 24px' }}
            disabled={connecting}
            onClick={onConnect}
          >
            <Icon.Github style={{ width: 16, height: 16 }} />
            {connecting ? t('set.connecting') : t('onb.github.connectBtn')}
          </button>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '6px 0', textAlign: 'center' }}
            onClick={onSkip}
          >
            {t('onb.github.skip')}
          </button>
        </div>
      )}
    </div>
  )
}

function ProjectStep({
  prompt,
  onPromptChange,
  completing,
  onFinish,
  textareaRef,
}: {
  prompt: string
  onPromptChange: (v: string) => void
  completing: boolean
  onFinish: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}) {
  useEffect(() => {
    textareaRef.current?.focus()
  }, [textareaRef])

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 'var(--radius-xl)',
        background: 'color-mix(in srgb, var(--accent) 12%, var(--surface-2))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        color: 'var(--accent)',
      }}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>
        ¿Qué quieres construir?
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 24px' }}>
        Describe tu proyecto y la IA generará el código. Puedes dejarlo en blanco e ir al dashboard.
      </p>
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={e => onPromptChange(e.target.value)}
        placeholder="Una app de lista de tareas con autenticación, o un dashboard de métricas, o una landing page para mi SaaS…"
        rows={4}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          fontSize: 14,
          lineHeight: 1.65,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          marginBottom: 20,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onFinish()
        }}
      />
      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '12px 24px' }}
        disabled={completing}
        onClick={onFinish}
      >
        {completing ? 'Cargando…' : prompt.trim() ? 'Empezar a construir →' : 'Ir al dashboard →'}
      </button>
      {prompt.trim() && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          O pulsa ⌘↵ para continuar
        </p>
      )}
    </div>
  )
}
