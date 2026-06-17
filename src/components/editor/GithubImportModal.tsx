'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { connectGithubPopup, primeGithubOAuthTab } from '@/lib/auth/connectGithub'
import { useApp, Icon } from '@/components/app/shell'
import { Modal } from '@/components/ui/Modal'

type Repo = { fullName: string; name: string; defaultBranch: string }

type GithubImportModalProps = {
  projectId: string
  open: boolean
  onClose: () => void
  onImported: () => void
}

type ReposResponse = {
  repos: Repo[]
  login?: string | null
}

type ApiErrBody = {
  error?: string
  details?: { needsGithubConnect?: boolean; oauthConfigured?: boolean }
}

function requiresGithubConnect(res: Response, data: ApiErrBody): boolean {
  if (data.details?.needsGithubConnect) return true
  if (data.error === 'github_auth_required') return true
  if (res.status === 403) return true
  return false
}

export function GithubImportModal({ projectId, open, onClose, onImported }: GithubImportModalProps) {
  const { t, navigate } = useApp() as {
    t: (k: string) => string
    navigate: (path: string) => void
  }
  const [repos, setRepos] = useState<Repo[]>([])
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [oauthConfigured, setOauthConfigured] = useState(true)
  const [selected, setSelected] = useState('')
  const [branch, setBranch] = useState('main')
  const [error, setError] = useState<string | null>(null)

  const resetState = useCallback(() => {
    setRepos([])
    setGithubLogin(null)
    setNeedsAuth(false)
    setNeedsSignIn(false)
    setError(null)
    setSelected('')
    setBranch('main')
  }, [])

  const loadRepos = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNeedsAuth(false)
    setNeedsSignIn(false)
    try {
      const res = await fetch('/api/github/repos', { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as ReposResponse & ApiErrBody

      if (!res.ok) {
        if (res.status === 401) {
          setNeedsSignIn(true)
          return
        }
        if (requiresGithubConnect(res, data)) {
          setNeedsAuth(true)
          setOauthConfigured(data.details?.oauthConfigured !== false)
          setRepos([])
          return
        }
        throw new Error(data.error ?? t('ed.importGithub.error'))
      }

      setRepos(data.repos ?? [])
      setGithubLogin(data.login ?? null)
      if (data.repos?.[0]) {
        setSelected(data.repos[0].fullName)
        setBranch(data.repos[0].defaultBranch)
      } else {
        setSelected('')
        setNeedsAuth(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ed.importGithub.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }
    void loadRepos()
  }, [open, loadRepos, resetState])

  function handleConnectGithub() {
    primeGithubOAuthTab()
    void handleConnectGithubAsync()
  }

  async function handleConnectGithubAsync() {
    setConnecting(true)
    setError(null)
    try {
      await connectGithubPopup()
      await loadRepos()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ed.importGithub.connectError'))
    } finally {
      setConnecting(false)
    }
  }

  async function handleImport() {
    if (!selected || needsAuth || needsSignIn) return
    setImporting(true)
    setError(null)
    try {
      await apiFetch(`/api/projects/${projectId}/import/github`, {
        method: 'POST',
        body: JSON.stringify({ repo: selected, branch }),
      })
      onImported()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('ed.importGithub.error')
      if (msg === 'github_auth_required' || msg.includes('autorizado')) {
        setNeedsAuth(true)
        setError(null)
      } else {
        setError(msg)
      }
    } finally {
      setImporting(false)
    }
  }

  const showImportForm = !loading && !needsAuth && !needsSignIn && repos.length > 0
  const showConnectStep = !loading && needsAuth && !needsSignIn
  const showSignInStep = !loading && needsSignIn

  return (
    <Modal open={open} onClose={onClose} panelClassName="github-import-modal" labelledBy="github-import-title">
      <div className="modal-head">
        <h2 id="github-import-title" className="modal-title">
          {t('ed.importGithub.title')}
        </h2>
        <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} aria-label={t('ed.close')}>
          <Icon.X />
        </button>
      </div>
      <p className="modal-body">{t('ed.importGithub.desc')}</p>

      {githubLogin && showImportForm && (
        <p className="github-import-connected">
          {t('ed.importGithub.connectedAs').replace('{user}', githubLogin)}
        </p>
      )}

      {loading && <p>{t('ed.importGithub.loading')}</p>}

      {showConnectStep && (
        <div className="github-import-connect">
          <p>{t('ed.importGithub.connectLead')}</p>
          {!oauthConfigured && (
            <p className="integrations-msg integrations-msg--error">{t('ed.importGithub.oauthNotConfigured')}</p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={connecting || !oauthConfigured}
              onClick={handleConnectGithub}
          >
            <Icon.Github />
            {connecting ? t('ed.importGithub.connecting') : t('ed.importGithub.connectBtn')}
          </button>
        </div>
      )}

      {showSignInStep && (
        <div className="github-import-connect">
          <p>{t('ed.importGithub.signInLead')}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose()
              navigate(`/auth/signin?next=${encodeURIComponent(window.location.pathname)}`)
            }}
          >
            {t('ed.importGithub.signInBtn')}
          </button>
        </div>
      )}

      {error && !showConnectStep && !showSignInStep && (
        <p className="integrations-msg integrations-msg--error">{error}</p>
      )}

      {showImportForm && (
        <div className="github-import-form">
          <label>
            {t('ed.importGithub.repo')}
            <select
              value={selected}
              onChange={(e) => {
                const repo = repos.find((r) => r.fullName === e.target.value)
                setSelected(e.target.value)
                if (repo) setBranch(repo.defaultBranch)
              }}
            >
              {repos.map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('ed.importGithub.branch')}
            <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </label>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t('ed.importGithub.cancel')}
        </button>
        {showConnectStep && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={connecting || !oauthConfigured}
              onClick={handleConnectGithub}
          >
            <Icon.Github />
            {connecting ? t('ed.importGithub.connecting') : t('ed.importGithub.connectBtn')}
          </button>
        )}
        {showImportForm && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={importing || !selected}
            onClick={() => void handleImport()}
          >
            {importing ? t('ed.importGithub.importing') : t('ed.importGithub.confirm')}
          </button>
        )}
      </div>
    </Modal>
  )
}
