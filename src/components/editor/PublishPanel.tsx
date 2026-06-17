'use client'

import React, { useState, useEffect } from 'react'
import { useApp, Icon } from '@/components/app/shell'
import { apiFetch } from '@/lib/api/client'
import { MobileReadinessPanel } from '@/components/editor/MobileReadinessPanel'
import {
  isDemoActive,
  isDemoProjectId,
  updateDemoProject,
} from '@/lib/auth/demo'
import { fetchDemoProjectFiles } from '@/lib/auth/demoProjectFilesClient'
import { getDemoPreviewUrl } from '@/lib/env'
import { runMobileReadinessScan } from '@/lib/mobile/scan'
import { validateProjectForWebDeploy } from '@/lib/mobile/validateDeploy'
import type { CodeTemplate } from '@/lib/codeTemplates'
import type { MobileReadiness } from '@/types/mobile'
import type { DeployValidationResult } from '@/lib/mobile/validateDeploy'
import { runPublishStream } from '@/lib/publish/publishStream'

type PublishPanelProps = {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
  deployedUrl: string | null
  mobileReadiness: MobileReadiness | null
  onDeployed: (url: string) => void
  onReadinessChange: (r: MobileReadiness | null) => void
  onApplyWithAi: (prompt: string) => void
  onPublishGithub: () => void
  publishGithubLoading?: boolean
  integrationsVercelConnected?: boolean
  onConnectVercel?: () => void
  onTriggerAutofix?: (buildLog: string) => void
  codeTemplate?: CodeTemplate
}

export function PublishPanel({
  open,
  onClose,
  projectId,
  projectName,
  deployedUrl,
  mobileReadiness,
  onDeployed,
  onReadinessChange,
  onApplyWithAi,
  onPublishGithub,
  publishGithubLoading,
  integrationsVercelConnected,
  onConnectVercel,
  onTriggerAutofix,
  codeTemplate = 'html',
}: PublishPanelProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const [tab, setTab] = useState<'web' | 'mobile'>('web')
  const [deployLoading, setDeployLoading] = useState(false)
  const [deployStatus, setDeployStatus] = useState<'idle' | 'building' | 'ready' | 'error'>('idle')
  const [deployBuildLog, setDeployBuildLog] = useState<string | null>(null)
  const [publishPhase, setPublishPhase] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [buildLoading, setBuildLoading] = useState(false)
  const [validation, setValidation] = useState<DeployValidationResult | null>(null)
  const [buildUrl, setBuildUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Formulario opcional de Marketplace
  const [marketplaceName, setMarketplaceName] = useState(projectName)
  const [marketplaceDesc, setMarketplaceDesc] = useState('')
  const [marketplaceCategory, setMarketplaceCategory] = useState('Landing Page')
  const [marketplaceGithub, setMarketplaceGithub] = useState('')
  const [marketplacePrice, setMarketplacePrice] = useState(0)
  const [marketplacePublishing, setMarketplacePublishing] = useState(false)
  const [marketplacePublished, setMarketplacePublished] = useState(false)

  useEffect(() => {
    setMarketplaceName(projectName)
  }, [projectName])

  if (!open) return null

  async function loadValidation() {
    if (isDemoActive() && isDemoProjectId(projectId)) {
      const files = await fetchDemoProjectFiles(projectId)
      setValidation(validateProjectForWebDeploy(files, { codeTemplate }))
      return
    }
    try {
      const v = await apiFetch<DeployValidationResult>(`/api/projects/${projectId}/validate-deploy`)
      setValidation(v)
    } catch {
      setValidation(null)
    }
  }

  async function pollProductionDeploy(deploymentId: string) {
    const maxAttempts = 90

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const st = await apiFetch<{
          status: string
          url?: string
          buildLog?: string
          errorMessage?: string
        }>(`/api/projects/${projectId}/publish?deploymentId=${encodeURIComponent(deploymentId)}`)
        
        if (st.buildLog) setDeployBuildLog(st.buildLog)
        
        if (st.status === 'ready' && st.url) {
          setDeployStatus('ready')
          onDeployed(st.url)
          return
        }
        
        if (st.status === 'error' || st.status === 'cancelled') {
          setDeployStatus('error')
          const err = st.errorMessage ?? t('ed.deployError')
          setError(err)
          
          // Lanzar la auto-corrección si hay un error y se ha provisto el callback
          if (st.buildLog && onTriggerAutofix) {
            onTriggerAutofix(st.buildLog)
          }
          return
        }
      } catch (e) {
        // Ignorar fallos temporales de red durante el polling
      }
    }
    setDeployStatus('error')
    setError(t('ed.deployTimeout'))
  }

  async function handleDeploy() {
    setError(null)
    setDeployBuildLog(null)
    setDeployStatus('idle')
    setDeployLoading(true)
    await loadValidation()

    if (isDemoActive() && isDemoProjectId(projectId)) {
      const demoUrl = getDemoPreviewUrl(projectId)
      updateDemoProject(projectId, { deployedUrl: demoUrl })
      onDeployed(demoUrl)
      setDeployStatus('ready')
      setDeployLoading(false)
      return
    }

    if (!integrationsVercelConnected) {
      onConnectVercel?.()
      setDeployLoading(false)
      return
    }

    try {
      setPublishPhase('Iniciando publicación…')
      const started = await runPublishStream({
        projectId,
        body: { codeTemplate },
        onEvent: (event) => {
          if (event.message) setPublishPhase(event.message)
          else if (event.phase) setPublishPhase(event.phase)
        },
      })

      if (started.url) onDeployed(started.url)

      if (started.deploymentId) {
        setDeployStatus('building')
        await pollProductionDeploy(started.deploymentId)
      } else {
        setDeployStatus('ready')
      }
      setPublishPhase(null)
    } catch (e) {
      setPublishPhase(null)
      setDeployStatus('error')
      setError(e instanceof Error ? e.message : t('ed.deployError'))
    }
    setDeployLoading(false)
  }

  async function handlePublishMarketplace() {
    setMarketplacePublishing(true)
    setError(null)
    try {
      await apiFetch('/api/marketplace/products', {
        method: 'POST',
        body: JSON.stringify({
          name: marketplaceName,
          description: marketplaceDesc,
          category: marketplaceCategory,
          framework: 'react',
          githubRepo: marketplaceGithub || null,
          priceCredits: marketplacePrice,
          previewUrl: deployedUrl,
          projectId: projectId,
        })
      })
      setMarketplacePublished(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al publicar en el marketplace')
    } finally {
      setMarketplacePublishing(false)
    }
  }

  async function handleScan() {
    setError(null)
    setScanning(true)
    try {
      if (isDemoActive() && isDemoProjectId(projectId)) {
        const files = await fetchDemoProjectFiles(projectId)
        const url = deployedUrl ?? getDemoPreviewUrl(projectId)
        const readiness = await runMobileReadinessScan({ deployedUrl: url, files })
        updateDemoProject(projectId, { mobileReadiness: readiness })
        onReadinessChange(readiness)
      } else {
        const res = await apiFetch<{ readiness: MobileReadiness }>(
          `/api/projects/${projectId}/mobile/scan`,
          { method: 'POST' },
        )
        onReadinessChange(res.readiness)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en el scan')
    }
    setScanning(false)
  }

  async function handleMobileBuild(mode: 'remote' | 'bundled' = 'remote') {
    if (!deployedUrl) {
      setError(t('publish.mobile.needDeploy'))
      return
    }
    setError(null)
    setBuildLoading(true)
    setBuildUrl(null)
    try {
      const res = await apiFetch<{ artifactUrl?: string; downloadHint?: string }>(
        `/api/projects/${projectId}/mobile/build`,
        { method: 'POST', body: JSON.stringify({ mode }) },
      )
      if (res.artifactUrl) setBuildUrl(res.artifactUrl)
      else if (res.downloadHint) setError(res.downloadHint)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ed.mobileBuildError'))
    }
    setBuildLoading(false)
  }

  const mobileLocked = !deployedUrl

  return (
    <div className="publish-panel-backdrop" role="presentation" onClick={onClose}>
      <div
        className="publish-panel"
        role="dialog"
        aria-labelledby="publish-panel-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '90%', borderRadius: '20px' }}
      >
        <header className="publish-panel-header">
          <h2 id="publish-panel-title">{t('publish.title')}</h2>
          <p className="text-muted">{projectName}</p>
          <button type="button" className="btn btn-ghost btn-sm publish-panel-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="publish-panel-tabs">
          <button
            type="button"
            className={`publish-tab${tab === 'web' ? ' is-active' : ''}`}
            onClick={() => setTab('web')}
          >
            {t('publish.tabWeb')}
          </button>
          <button
            type="button"
            className={`publish-tab${tab === 'mobile' ? ' is-active' : ''}`}
            disabled={mobileLocked}
            title={mobileLocked ? t('publish.mobile.needDeploy') : undefined}
            onClick={() => setTab('mobile')}
          >
            {t('publish.tabMobile')}
          </button>
        </div>

        <div className="publish-panel-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {error ? <p className="publish-panel-error">{error}</p> : null}

          {tab === 'web' ? (
            <>
              {!integrationsVercelConnected ? (
                <p className="text-muted" style={{ marginBottom: '16px', fontSize: '13px' }}>
                  {t('publish.web.vercelHint')}
                </p>
              ) : null}

              {codeTemplate !== 'html' ? (
                <p className="text-muted publish-panel-template-hint" style={{ marginBottom: '12px', fontSize: '13px' }}>
                  {t('ed.publish.codeTemplatePreview')}
                </p>
              ) : (
                <p className="text-muted publish-panel-template-hint" style={{ marginBottom: '12px', fontSize: '13px' }}>
                  {t('ed.publish.codeTemplateHtml')}
                </p>
              )}

              {validation && !validation.ok ? (
                <ul className="publish-validation-list">
                  {validation.issues.map((i) => (
                    <li key={i.id} data-severity={i.severity}>
                      {i.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              {deployedUrl ? (
                <div className="publish-deployed">
                  <span className="text-muted">{t('publish.web.liveUrl')}</span>
                  <a href={deployedUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {deployedUrl}
                  </a>
                </div>
              ) : null}

              {publishPhase || deployStatus === 'building' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="chat-composer-improve-btn__spinner" aria-hidden />
                  <p className="publish-panel-status" role="status" style={{ margin: 0 }}>
                    {publishPhase ?? t('publish.web.building')}
                  </p>
                </div>
              ) : null}

              {deployBuildLog && deployStatus !== 'idle' ? (
                <pre className="publish-panel-build-log" style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '8px', fontSize: '11px', maxHeight: '180px', overflowY: 'auto' }}>
                  {deployBuildLog.slice(-4000)}
                </pre>
              ) : null}

              <div className="publish-actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={deployLoading}
                  onClick={() => void handleDeploy()}
                >
                  {deployLoading
                    ? deployStatus === 'building'
                      ? t('publish.web.building')
                      : '…'
                    : t('publish.web.deploy')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ gap: 6 }}
                  disabled={publishGithubLoading}
                  onClick={onPublishGithub}
                >
                  <Icon.Github />
                  {publishGithubLoading ? '…' : t('ed.publish')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadValidation()}>
                  {t('publish.web.validate')}
                </button>
              </div>

              {/* Formulario opcional para Marketplace */}
              {deployedUrl && (
                <div className="publish-marketplace-box" style={{
                  marginTop: '24px',
                  padding: '18px',
                  background: 'color-mix(in srgb, var(--accent) 6%, var(--surface-2))',
                  border: '1px solid color-mix(in srgb, var(--accent) 15%, var(--border))',
                  borderRadius: '16px',
                }}>
                  <h4 style={{ margin: '0 0 6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                    🏪 Publicar en el Marketplace (Opcional)
                  </h4>
                  <p className="text-muted" style={{ fontSize: '12px', margin: '0 0 14px' }}>
                    Comparte tu aplicación terminada con la comunidad. Otros usuarios podrán adquirirla o importarla.
                  </p>

                  {marketplacePublished ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '16px',
                      background: 'color-mix(in srgb, var(--success) 10%, var(--surface))',
                      color: 'var(--success)',
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: '13px'
                    }}>
                      🎉 ¡Tu proyecto ha sido subido con éxito al Marketplace!
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); void handlePublishMarketplace(); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nombre</label>
                          <input
                            type="text"
                            required
                            className="input"
                            style={{ width: '100%', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                            value={marketplaceName}
                            onChange={(e) => setMarketplaceName(e.target.value)}
                          />
                        </div>
                        <div style={{ width: '110px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Precio (cr)</label>
                          <input
                            type="number"
                            min="0"
                            className="input"
                            style={{ width: '100%', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                            value={marketplacePrice}
                            onChange={(e) => setMarketplacePrice(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Descripción</label>
                        <textarea
                          required
                          className="input"
                          rows={2}
                          style={{ width: '100%', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', resize: 'vertical' }}
                          value={marketplaceDesc}
                          onChange={(e) => setMarketplaceDesc(e.target.value)}
                          placeholder="Describe brevemente las funcionalidades de tu app..."
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Categoría</label>
                          <select
                            className="input"
                            style={{ width: '100%', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                            value={marketplaceCategory}
                            onChange={(e) => setMarketplaceCategory(e.target.value)}
                          >
                            <option value="Landing Page">Landing Page</option>
                            <option value="Dashboard">Dashboard</option>
                            <option value="E-commerce">E-commerce</option>
                            <option value="Portfolio">Portfolio</option>
                            <option value="Utility">Utility</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Repositorio GitHub (opcional)</label>
                          <input
                            type="text"
                            className="input"
                            style={{ width: '100%', fontSize: '12px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                            value={marketplaceGithub}
                            onChange={(e) => setMarketplaceGithub(e.target.value)}
                            placeholder="usuario/repositorio"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={marketplacePublishing}
                        style={{ marginTop: '6px', alignSelf: 'flex-start', padding: '8px 16px' }}
                      >
                        {marketplacePublishing ? 'Publicando...' : 'Subir al Marketplace'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <MobileReadinessPanel
                readiness={mobileReadiness}
                scanning={scanning}
                onScan={() => void handleScan()}
                onApplyWithAi={(prompt) => {
                  onApplyWithAi(prompt)
                  onClose()
                }}
              />
              <div className="publish-mobile-build">
                <h4>{t('publish.mobile.exportTitle')}</h4>
                <p className="text-muted">{t('publish.mobile.exportDesc')}</p>
                <div className="publish-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={buildLoading || !deployedUrl}
                    onClick={() => void handleMobileBuild('remote')}
                  >
                    {buildLoading ? '…' : t('publish.mobile.downloadCapacitor')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={buildLoading || !deployedUrl}
                    onClick={() => void handleMobileBuild('bundled')}
                  >
                    {t('publish.mobile.bundledMode')}
                  </button>
                </div>
                {buildUrl ? (
                  <a className="btn btn-accent btn-sm" href={buildUrl} download>
                    {t('publish.mobile.downloadZip')}
                  </a>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
