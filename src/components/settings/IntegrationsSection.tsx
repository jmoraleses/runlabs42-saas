'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api/client'
import { isDemoActive, loadDemoIntegrationStatus } from '@/lib/auth/demo'
import { useUser } from '@/hooks/useUser'
import { Icon, useApp } from '@/components/app/shell'
import { signInWithOAuth } from '@/lib/auth/client'
import { connectGithubPopup, primeGithubOAuthTab } from '@/lib/auth/connectGithub'
import { connectFigmaPopup, primeFigmaOAuthTab } from '@/lib/auth/connectFigma'
import { SK_I18N, formatT } from '@/lib/i18n'
import type { IntegrationStatus } from '@/lib/integrations/types'
import { McpCatalog } from './McpCatalog'

export function IntegrationsSection() {
  const { lang } = useApp() as { lang: keyof typeof SK_I18N }
  const dict = useMemo(
    () => (SK_I18N[lang] ?? SK_I18N.en) as Record<string, string>,
    [lang],
  )
  const t = useCallback((key: string) => dict[key] ?? key, [dict])
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectingVercel, setConnectingVercel] = useState(false)
  const [connectingGithub, setConnectingGithub] = useState(false)
  const [connectingFigma, setConnectingFigma] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgIsError, setMsgIsError] = useState(false)

  const githubSessionConnected =
    user?.app_metadata?.provider === 'github' ||
    (user?.app_metadata?.providers as string[] | undefined)?.includes('github') ||
    false
  const githubConnected = Boolean(status?.github.connected || githubSessionConnected)
  const githubLogin =
    status?.github.login ||
    (user?.user_metadata?.user_name as string | undefined) ||
    (user?.user_metadata?.preferred_username as string | undefined) ||
    user?.email?.split('@')[0]

  async function refresh() {
    setLoading(true)
    if (isDemoActive()) {
      setStatus(loadDemoIntegrationStatus())
      setLoading(false)
      return
    }
    try {
      const data = await apiFetch<{ integrations: IntegrationStatus }>('/api/integrations/status')
      setStatus(data.integrations)
    } catch {
      setStatus(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const vercel = searchParams.get('vercel')
    if (vercel === 'connected') {
      const vercelUser = searchParams.get('vercelUser')
      setMsg(
        vercelUser
          ? formatT(t, 'set.vercelConnectedAs', { user: vercelUser })
          : t('set.vercelConnectedOk'),
      )
      setMsgIsError(false)
      refresh()
    } else if (vercel === 'error') {
      const message = searchParams.get('message')
      setMsg(message ? decodeURIComponent(message) : t('set.connectError'))
      setMsgIsError(true)
    }
    const figma = searchParams.get('figma')
    if (figma === 'connected') {
      setMsg(t('ed.design.figmaConnectedOk'))
      setMsgIsError(false)
      refresh()
    } else if (figma === 'error') {
      const message = searchParams.get('message')
      setMsg(message ? decodeURIComponent(message) : t('set.connectError'))
      setMsgIsError(true)
    }
    const github = searchParams.get('github')
    if (github === 'connected') {
      const ghUser = searchParams.get('githubUser')
      setMsg(
        ghUser
          ? formatT(t, 'set.githubConnectedAs', { user: ghUser })
          : t('set.githubConnectedOk'),
      )
      setMsgIsError(false)
      refresh()
    } else if (github === 'error') {
      const message = searchParams.get('message')
      setMsg(message ? decodeURIComponent(message) : t('set.connectError'))
      setMsgIsError(true)
    }
  }, [searchParams, t])

  async function connectGithub() {
    setMsg(null)
    setMsgIsError(false)
    if (status?.github.oauthConfigured) {
      setConnectingGithub(true)
      try {
        await connectGithubPopup()
        await refresh()
        setMsg(t('set.githubConnectedOk'))
        setMsgIsError(false)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : t('set.connectError'))
        setMsgIsError(true)
      } finally {
        setConnectingGithub(false)
      }
      return
    }
    const { error } = await signInWithOAuth('github', '/settings?tab=connect')
    if (error) {
      setMsg(error.message)
      setMsgIsError(true)
    }
  }

  async function connectFigma() {
    setMsg(null)
    setMsgIsError(false)
    setConnectingFigma(true)
    try {
      primeFigmaOAuthTab()
      await connectFigmaPopup()
      await refresh()
      setMsg(t('ed.design.figmaConnectedOk'))
      setMsgIsError(false)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('set.connectError'))
      setMsgIsError(true)
    } finally {
      setConnectingFigma(false)
    }
  }

  function connectVercel() {
    setMsg(null)
    setMsgIsError(false)
    setConnectingVercel(true)
    window.location.href = '/api/integrations/vercel/connect'
  }

  if (loading) {
    return <p className="integrations-loading">{t('set.connectLoading')}</p>
  }

  return (
    <div className="integrations-section">

      <div className="integrations-card">
        {msg && (
          <p className={`integrations-msg${msgIsError ? ' integrations-msg--error' : ''}`}>{msg}</p>
        )}

        <div className="integrations-card--row">
          <div className="integrations-card-info">
            <h4 className="integrations-item-title">
              <Icon.Github />
              {t('set.github')}
            </h4>
            <p className="integrations-card-desc">
              {githubConnected && githubLogin
                ? formatT(t, 'set.githubConnectedAs', { user: githubLogin })
                : t('set.githubDesc')}
            </p>
          </div>
          <div className="integrations-card-action">
            {githubConnected ? (
              <span className="integrations-connected">{t('set.githubConnected')}</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={connectingGithub}
                onClick={() => {
                  primeGithubOAuthTab()
                  void connectGithub()
                }}
              >
                {connectingGithub ? t('set.connecting') : t('set.connectBtn')}
              </button>
            )}
          </div>
        </div>

        <div className="integrations-card--row integrations-card--row-divide">
          <div className="integrations-card-info">
            <h4 className="integrations-item-title">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path fill="#f24e1e" d="M7 3h6a4 4 0 0 1 0 8H7V3zm0 8h7a4 4 0 0 1 0 8H7v-8zM7 3v16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3z" />
              </svg>
              Figma
            </h4>
            <p className="integrations-card-desc">
              {status?.figma.connected
                ? t('ed.design.figmaConnectedDesc')
                : t('ed.design.figmaConnectHint')}
            </p>
          </div>
          <div className="integrations-card-action">
            {status?.figma.connected ? (
              <span className="integrations-connected">{t('set.githubConnected')}</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={connectingFigma || !status?.figma.oauthConfigured}
                onClick={() => void connectFigma()}
              >
                {connectingFigma ? t('set.connecting') : t('set.connectBtn')}
              </button>
            )}
          </div>
        </div>

        <div className="integrations-card--row integrations-card--row-divide">
          <div className="integrations-card-info">
            <h4 className="integrations-item-title">
              <Icon.Vercel />
              {t('set.vercel')}
            </h4>
            <p className="integrations-card-desc">
              {status?.vercel.connected ? t('set.vercelDeployDesc') : t('set.vercelDesc')}
            </p>
          </div>
          <div className="integrations-card-action">
            {status?.vercel.connected ? (
              <span className="integrations-connected">{t('set.vercelConnected')}</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={connectingVercel}
                onClick={connectVercel}
              >
                {connectingVercel ? t('set.redirecting') : t('set.connectBtn')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="integrations-card">
        <div className="integrations-card-head">
          <h3 className="integrations-card-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            {t('set.mcpTitle')}
          </h3>
          <p className="integrations-card-desc">
            {t('set.mcpDesc')}
          </p>
        </div>
        <McpCatalog />
      </div>
    </div>
  )
}
