'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp, Icon, AppShell, FRAMEWORKS } from '@/components/app/shell'
import { useProjects } from '@/hooks/useProjects'
import { useUser } from '@/hooks/useUser'
import { useIntegrationsGate } from '@/hooks/useIntegrationsGate'
import { PlatformBadgeRow } from '@/components/common/PlatformBadge'
import { ProjectCatalogCard } from '@/components/projects/ProjectCatalogCard'
import { openStudio } from '@/lib/projects/openStudio'
import { ProjectCardPreview } from '@/components/projects/ProjectCardPreview'
import { ProjectDeleteConfirmDialog } from '@/components/projects/ProjectDeleteConfirmDialog'
import { isDemoActive, updateDemoProject } from '@/lib/auth/demo'
import { getDemoPreviewUrl } from '@/lib/env'
import {
  addDemoMarketplaceProduct,
  DEMO_MARKETPLACE_STORAGE_QUOTA_ERROR,
} from '@/lib/auth/demo-seed'
import {
  getProjectMarketplaceMeta,
  isProjectMarketplaceListed,
  getProjectMarketplaceRating,
} from '@/lib/projects/marketplaceListing'
import { downloadProjectZip } from '@/lib/projects/downloadProjectZip'
import {
  appendProjectCoverImage,
  MAX_PROJECT_COVERS,
  readImageFileAsDataUrl,
  setProjectCoverImages,
} from '@/lib/projects/manageCovers'
import { apiFetch } from '@/lib/api/client'
import { IntegrationReminderBanner } from '@/components/app/IntegrationReminderBanner'

const DEFAULT_FRAMEWORK = 'react'
const LOCALE_BY_LANG = {
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  nl: 'nl-NL',
  it: 'it-IT',
}

function AutoDismissNotice({ notice, onDismiss, durationMs = 3500 }) {
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(id)
  }, [notice, onDismiss, durationMs])

  if (!notice) return null
  return createPortal(
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 68,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10200,
        background: notice.type === 'success'
          ? 'color-mix(in srgb, var(--success) 14%, var(--surface))'
          : 'color-mix(in srgb, var(--danger) 14%, var(--surface))',
        border: `1px solid ${notice.type === 'success' ? 'color-mix(in srgb, var(--success) 35%, transparent)' : 'color-mix(in srgb, var(--danger) 35%, transparent)'}`,
        color: notice.type === 'success' ? 'var(--success)' : 'var(--danger)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 20px',
        fontSize: 14,
        fontWeight: 500,
        boxShadow: 'var(--shadow-md)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {notice.message}
    </div>,
    document.body,
  )
}

function Lightbox({ url, onClose, closeLabel = 'Close' }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="project-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        className="project-lightbox-close"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="project-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt="" className="project-lightbox-img" draggable={false} />
      </div>
    </div>,
    document.body,
  )
}

function formatUpdatedAt(iso, lang, t) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const locale = LOCALE_BY_LANG[lang] || 'en-US'
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return t('projects.relative.today')
  if (days === 1) return t('projects.relative.yesterday')
  if (days < 14) {
    return t('projects.relative.daysAgo').replace('{n}', String(days))
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDate(iso, lang) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const locale = LOCALE_BY_LANG[lang] || 'en-US'
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

const MAX_DETAIL_SCREENSHOTS = 4

function buildDetailScreenshotSlots(coverImgs, hasLivePreview, lang, fwColor, t) {
  const slots = coverImgs.length
    ? coverImgs.map((url, i) => ({
        url,
        label: i === 0 ? t('projects.page.home') : `${t('projects.page.short')} ${i + 1}`,
        isLive: false,
        empty: false,
        color: fwColor,
      }))
    : hasLivePreview
      ? [{ url: null, label: t('projects.page.home'), isLive: true, empty: false, color: fwColor }]
      : []

  const fallbackLabels = [
    t('projects.page.home'),
    `${t('projects.page.short')} 2`,
    `${t('projects.page.short')} 3`,
    `${t('projects.page.short')} 4`,
  ]

  while (slots.length < MAX_DETAIL_SCREENSHOTS) {
    const i = slots.length
    slots.push({
      url: null,
      label: fallbackLabels[i] ?? `${t('projects.page.full')} ${i + 1}`,
      isLive: false,
      empty: true,
      color: fwColor,
    })
  }

  return slots.slice(0, MAX_DETAIL_SCREENSHOTS)
}

function slotToCoverIndex(slots, slotIndex) {
  const slot = slots[slotIndex]
  if (!slot || slot.empty || slot.isLive || !slot.url) return -1
  let coverIdx = 0
  for (let i = 0; i < slotIndex; i++) {
    const s = slots[i]
    if (s.url && !s.isLive && !s.empty) coverIdx++
  }
  return coverIdx
}

/* ───── Publish Modal (inline, takes a project) ───── */
function ProjectPublishModal({ project, onClose, onPublished, queueLabel }) {
  const { t } = useApp()
  const [title, setTitle] = useState(project?.name ?? '')
  const [desc, setDesc] = useState(project?.description ?? '')
  const [paid, setPaid] = useState(false)
  const [price, setPrice] = useState(12)
  const framework = project?.framework ?? 'next'
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)

  const fw = FRAMEWORKS.find((f) => f.id === (project?.framework ?? framework)) ?? FRAMEWORKS[0]

  // all cover images to show
  const allImages = project?.coverImages?.length
    ? project.coverImages
    : project?.coverUrl
      ? [project.coverUrl]
      : []

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  async function publish() {
    if (!title.trim()) {
      setError(t('mp.publish.titleRequired'))
      return
    }
    if (!allImages.length) {
      setError(t('mp.publish.imageRequired'))
      return
    }
    setPublishing(true)
    setError(null)
    try {
      if (isDemoActive()) {
        await new Promise((r) => setTimeout(r, 600))
        addDemoMarketplaceProduct({
          id: `demo-user-${project?.id ?? crypto.randomUUID()}`,
          name: title.trim(),
          desc: desc ?? '',
          price: paid ? price : 0,
          stars: 0,
          rating: 0,
          framework: project?.framework ?? 'react',
          category: 'general',
          author: '@demo',
          previewUrl: project?.coverUrl ?? null,
          coverImages: allImages.length ? allImages : null,
          demoProjectId: project?.id ?? null,
        })
        if (project?.id) updateDemoProject(project.id, { marketplaceListed: true })
        onPublished?.()
        setPublishing(false)
        return
      }
      await apiFetch('/api/marketplace/products', {
        method: 'POST',
        body: JSON.stringify({
          name: title.trim(),
          description: desc,
          framework: project?.framework ?? framework,
          projectId: project?.id,
          priceCredits: paid ? price : 0,
          category: 'general',
          previewUrl: project?.coverUrl ?? null,
          coverImages: allImages.length ? allImages : null,
        }),
      })
      onPublished?.()
    } catch (e) {
      const raw = e instanceof Error ? e.message : ''
      setError(
        raw === DEMO_MARKETPLACE_STORAGE_QUOTA_ERROR
          ? t('mp.publish.storageQuota')
          : raw || t('mp.publish.error'),
      )
    }
    setPublishing(false)
  }

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--bg) 65%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 10100,
        padding: '12px 20px 40px',
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: 600,
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t('mp.publish.title')}</h3>
            {queueLabel ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{queueLabel}</p>
            ) : null}
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} className="btn btn-icon btn-ghost" aria-label={t('mp.acquire.close')}>
            <Icon.X />
          </button>
        </div>

        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Cover image strip */}
              {allImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {allImages.map((url, i) => (
                    <div
                      key={i}
                      style={{
                        flexShrink: 0,
                        width: i === 0 ? 160 : 80,
                        aspectRatio: '4/5',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: i === 0 ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: 'var(--bg-elev)',
                      }}
                    >
                      <img
                        src={url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Project info row */}
              {project && (
                <div style={{
                  display: 'flex', gap: 12, padding: '12px 14px',
                  background: 'var(--bg-elev)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', alignItems: 'center',
                }}>
                  {project.coverUrl ? (
                    <div style={{
                      width: 40, height: 50, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0,
                      border: '1px solid var(--border)',
                    }}>
                      <img src={project.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                      background: `linear-gradient(135deg, color-mix(in srgb, ${fw.color} 20%, var(--surface)) 0%, var(--surface-2) 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 18, color: fw.color,
                    }}>
                      {project.name?.[0]?.toUpperCase() ?? 'P'}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {project.deployedUrl ?? t('projects.notDeployed')}
                    </div>
                  </div>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: fw.color, fontWeight: 600, background: `color-mix(in srgb, ${fw.color} 12%, transparent)`, padding: '3px 8px', borderRadius: 20 }}>{fw.label}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="label">{t('mp.publish.titleLabel')}</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={project?.name} />
              </div>

              {/* Description */}
              <div>
                <label className="label">{t('mp.publish.descLabel')}</label>
                <textarea
                  className="input"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical' }}
                  placeholder={t('projects.detail.descPlaceholder')}
                />
              </div>

              {/* Pricing */}
              <div>
                <label className="label">{t('mp.publish.pricing')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div className="mp-chips" style={{ width: 'fit-content', flexShrink: 0 }}>
                    {[false, true].map((p) => (
                      <button
                        key={String(p)}
                        type="button"
                        className={`mp-chip${paid === p ? ' is-active' : ''}`}
                        onClick={() => setPaid(p)}
                      >
                        {p ? t('mp.publish.paid') : t('mp.publish.free')}
                      </button>
                    ))}
                  </div>
                  {paid && (
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      style={{ maxWidth: 130, margin: 0 }}
                      placeholder={t('mp.publish.priceLabel')}
                    />
                  )}
                </div>
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" onClick={onClose} className="btn btn-ghost">{t('mp.acquire.cancel')}</button>
                <button type="button" onClick={publish} disabled={publishing || !allImages.length} className="btn btn-accent">
                  {publishing ? t('mp.publish.submitting') : t('mp.publish.submit')}
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ProjectStarRating({ rating }) {
  const full = Math.floor(rating ?? 0)
  const half = (rating ?? 0) - full >= 0.5
  return (
    <span className="project-detail-star-row" aria-label={`${(rating ?? 0).toFixed(1)} estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= full
        const isHalf = !filled && i === full + 1 && half
        return (
          <svg key={i} viewBox="0 0 24 24" width="18" height="18" aria-hidden
            fill={filled ? 'currentColor' : isHalf ? 'url(#phalf)' : 'none'}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          >
            {isHalf && (
              <defs>
                <linearGradient id="phalf" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )
      })}
    </span>
  )
}

/* ───── Project Detail Page ───── */
function ProjectDetailPage({ projectId }) {
  const { t, navigate, lang } = useApp()
  const { projects, loading, refresh } = useProjects()
  const { profile } = useUser()
  const { status: integrationsStatus } = useIntegrationsGate()
  const [publishOpen, setPublishOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionNotice, setActionNotice] = useState(null)
  const [activeScreen, setActiveScreen] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [editing, setEditing] = useState(null) // 'title' | 'desc' | null
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [savingField, setSavingField] = useState(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [dragFromSlot, setDragFromSlot] = useState(null)
  const [imageIsLandscapeByUrl, setImageIsLandscapeByUrl] = useState({})
  const coverFileInputRef = useRef(null)

  const project = projects.find((p) => p.id === projectId)

  const isLive = !!project?.deployedUrl
  const isMarketplaceListed = isProjectMarketplaceListed(project)
  const projectRating = isMarketplaceListed ? getProjectMarketplaceRating(project) : null
  const platforms = project?.targetPlatforms?.length ? project.targetPlatforms : ['web']
  const fw = FRAMEWORKS.find((f) => f.id === (project?.framework ?? DEFAULT_FRAMEWORK)) ?? FRAMEWORKS[0]
  const coverImgs = useMemo(
    () =>
      project?.coverImages?.length
        ? project.coverImages
        : project?.coverUrl
          ? [project.coverUrl]
          : [],
    [project?.coverImages, project?.coverUrl],
  )
  const screenshotSlots = useMemo(
    () => buildDetailScreenshotSlots(coverImgs, !coverImgs.length && isLive, lang, fw.color, t),
    [coverImgs, isLive, lang, fw.color, t],
  )
  const activeSlot = screenshotSlots[activeScreen] ?? screenshotSlots[0]
  const activeIsLandscape = activeSlot?.url ? imageIsLandscapeByUrl[activeSlot.url] : undefined

  const handleImageLoad = useCallback((url, event) => {
    if (!url) return
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (!naturalWidth || !naturalHeight) return
    const isLandscape = naturalWidth > naturalHeight
    setImageIsLandscapeByUrl((prev) => (
      prev[url] === isLandscape ? prev : { ...prev, [url]: isLandscape }
    ))
  }, [])

  useEffect(() => {
    if (activeScreen >= screenshotSlots.length) {
      setActiveScreen(Math.max(0, screenshotSlots.length - 1))
    }
  }, [screenshotSlots.length, activeScreen])

  const persistCoverImages = useCallback(
    async (urls) => {
      if (!project) return
      setCoverBusy(true)
      setActionNotice(null)
      try {
        await setProjectCoverImages(project.id, urls)
        await refresh()
        setActionNotice({ type: 'success', message: t('projects.detail.coverSaved') })
      } catch (err) {
        const msg = err instanceof Error && err.message === 'max_covers'
          ? t('projects.detail.coverMax')
          : err instanceof Error
            ? err.message
            : t('projects.action.failed')
        setActionNotice({ type: 'error', message: msg })
      } finally {
        setCoverBusy(false)
      }
    },
    [project, refresh, t],
  )

  const handleDeleteCoverAtSlot = useCallback(
    (slotIndex) => {
      const coverIdx = slotToCoverIndex(screenshotSlots, slotIndex)
      if (coverIdx < 0 || !project) return
      const next = coverImgs.filter((_, i) => i !== coverIdx)
      void persistCoverImages(next)
    },
    [screenshotSlots, coverImgs, project, persistCoverImages],
  )

  const handleReorderCovers = useCallback(
    (fromSlot, toSlot) => {
      if (fromSlot == null || toSlot == null || fromSlot === toSlot) return
      const fromIdx = slotToCoverIndex(screenshotSlots, fromSlot)
      const toIdx = slotToCoverIndex(screenshotSlots, toSlot)
      if (fromIdx < 0 || toIdx < 0) return
      const next = [...coverImgs]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      void persistCoverImages(next)
    },
    [screenshotSlots, coverImgs, persistCoverImages],
  )

  const handleAddCoverImage = useCallback(async (file) => {
    if (!project || !file) return
    const isSupportedType = file.type === 'image/png' || file.type === 'image/jpeg'
    if (!isSupportedType || file.size > 2 * 1024 * 1024) {
      setActionNotice({ type: 'error', message: t('projects.detail.coverInvalid') })
      return
    }
    setCoverBusy(true)
    setActionNotice(null)
    try {
      const imageData = await readImageFileAsDataUrl(file)
      await appendProjectCoverImage(project.id, imageData)
      await refresh()
      setActionNotice({ type: 'success', message: t('projects.detail.coverSaved') })
    } catch (err) {
      const msg = err instanceof Error && err.message === 'max_covers'
        ? t('projects.detail.coverMax')
        : err instanceof Error
          ? err.message
          : t('projects.action.failed')
      setActionNotice({ type: 'error', message: msg })
    } finally {
      setCoverBusy(false)
      if (coverFileInputRef.current) coverFileInputRef.current.value = ''
    }
  }, [project, refresh, t])

  async function saveField(field, value) {
    if (!project) return
    const trimmed = typeof value === 'string' ? value.trim() : value
    const current = field === 'name' ? (project.name ?? '') : (project.description ?? '')
    if (trimmed === current) {
      setEditing(null)
      return
    }
    setSavingField(field)
    try {
      if (isDemoActive()) {
        updateDemoProject(project.id, { [field]: trimmed })
      } else {
        await apiFetch(`/api/projects/${project.id}`, {
          method: 'PUT',
          body: JSON.stringify({ [field]: trimmed }),
        })
      }
      await refresh()
      setEditing(null)
    } catch (err) {
      setActionNotice({ type: 'error', message: err instanceof Error ? err.message : t('projects.action.failed') })
    } finally {
      setSavingField(null)
    }
  }

  async function handleDeploy() {
    if (!project) return
    if (isDemoActive()) {
      const demoUrl = getDemoPreviewUrl(project.id)
      updateDemoProject(project.id, { deployedUrl: demoUrl })
      setActionNotice({ type: 'success', message: t('projects.action.deployOk') })
      await refresh()
      return
    }
    if (!integrationsStatus?.vercel?.connected) {
      navigate('/settings?tab=connect')
      return
    }
    setActionBusy(true)
    setActionNotice(null)
    try {
      await apiFetch(`/api/projects/${project.id}/deploy`, { method: 'POST' })
      setActionNotice({ type: 'success', message: t('projects.action.deployOk') })
      await refresh()
    } catch (err) {
      setActionNotice({ type: 'error', message: err instanceof Error ? err.message : t('projects.action.failed') })
    } finally {
      setActionBusy(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="app-page projects-page">
          <div className="container">
            <div className="projects-loading">
              <span className="projects-spinner projects-spinner--lg" aria-hidden />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!project) {
    return (
      <AppShell>
        <div className="app-page projects-page">
          <div className="container">
            <div className="projects-empty card">
            <h3>{t('projects.detail.notFound')}</h3>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/projects')}>
              ← {t('projects.detail.back')}
            </button>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="app-page projects-page">
        <div className="container">
          <nav className="project-detail-nav" aria-label={t('projects.detail.back')}>
            <button type="button" className="project-detail-back" onClick={() => navigate('/projects')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              {t('projects.detail.back')}
            </button>
          </nav>

          <header className="project-detail-hero card">
            <div className="project-detail-hero__main">
              <h1 className="project-detail-title">{project.name}</h1>
            </div>
            <div className="project-detail-hero__actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={actionBusy}
                onClick={() => void handleDeploy()}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                </svg>
                {t('projects.detail.deployBtn')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/studio?project=${encodeURIComponent(project.id)}`)}
              >
                {t('projects.detail.openBtn')}
                <Icon.Arrow />
              </button>
            </div>
          </header>

          <div className="project-detail-layout">
            <div className="project-detail-preview-panel card">
              <div className="project-detail-screenshots-header">
                <h2 className="project-detail-section-title project-detail-section-title--upper">{t('projects.detail.pages')}</h2>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm project-detail-capture-btn"
                  onClick={() => coverFileInputRef.current?.click()}
                  disabled={coverBusy || coverImgs.length >= MAX_PROJECT_COVERS}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {t('projects.detail.addImage')}
                </button>
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void handleAddCoverImage(file)
                  }}
                />
              </div>
              <div className={`mp-detail-screenshots${coverBusy ? ' is-busy' : ''}`}>
                <div
                  className={`mp-detail-screenshot-main${
                    !activeSlot?.url && !activeSlot?.isLive ? ' ucard-cover-placeholder' : ''
                  }`}
                >
                  {activeSlot?.isLive ? (
                    <ProjectCardPreview
                      projectId={project.id}
                      name={project.name}
                      deployedUrl={project.deployedUrl}
                      placeholderLabel={t('projects.previewPlaceholder')}
                    />
                  ) : activeSlot?.url ? (
                    <>
                      <img
                        src={activeSlot.url}
                        alt={activeSlot.label}
                        className="mp-detail-screenshot-img"
                        onLoad={(event) => handleImageLoad(activeSlot.url, event)}
                        style={
                          activeIsLandscape === undefined
                            ? undefined
                            : activeIsLandscape
                              ? { width: '100%', height: 'auto' }
                              : { width: 'auto', height: '100%' }
                        }
                        draggable={false}
                      />
                      <button
                        type="button"
                        className="project-detail-zoom-btn"
                        aria-label={t('projects.detail.zoomImage')}
                        onClick={() => setLightboxUrl(activeSlot.url)}
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="11" cy="11" r="7" />
                          <path d="m21 21-4.35-4.35" />
                          <path d="M11 8v6M8 11h6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="project-detail-screenshot-delete"
                        aria-label={t('projects.detail.deleteImage')}
                        disabled={coverBusy}
                        onClick={(e) => { e.stopPropagation(); handleDeleteCoverAtSlot(activeScreen) }}
                      >
                        <Icon.X />
                      </button>
                    </>
                  ) : null}
                  <div className="mp-detail-screenshot-overlay">
                    <span className="mp-detail-screenshot-page-label">{activeSlot?.label}</span>
                  </div>
                </div>
                {coverImgs.length > 0 && (
                  <div className="mp-detail-screenshot-thumbs">
                    {screenshotSlots.filter((slot) => !slot.empty).map((slot, i) => (
                      <div
                        key={slot.url ?? slot.label}
                        className={`project-detail-thumb-wrap${dragFromSlot === i ? ' is-dragging' : ''}${i === 0 ? ' is-cover' : ''}`}
                        draggable={!slot.isLive && !coverBusy}
                        onDragStart={() => {
                          if (slot.isLive) return
                          setDragFromSlot(i)
                        }}
                        onDragEnd={() => setDragFromSlot(null)}
                        onDragOver={(e) => {
                          if (slot.isLive) return
                          e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragFromSlot != null) handleReorderCovers(dragFromSlot, i)
                          setDragFromSlot(null)
                        }}
                      >
                        {i === 0 && (
                          <span className="project-detail-thumb-cover-badge">
                            {t('projects.detail.cover')}
                          </span>
                        )}
                        <button
                          type="button"
                          className={`mp-detail-screenshot-thumb${activeScreen === i ? ' is-active' : ''}`}
                          onClick={() => setActiveScreen(i)}
                        >
                          {slot.url ? (
                            <img
                              src={slot.url}
                              alt={slot.label}
                              className="mp-detail-thumb-img"
                              onLoad={(event) => handleImageLoad(slot.url, event)}
                              style={
                                imageIsLandscapeByUrl[slot.url] === undefined
                                  ? undefined
                                  : imageIsLandscapeByUrl[slot.url]
                                    ? { width: '100%', height: 'auto' }
                                    : { width: 'auto', height: '100%' }
                              }
                              draggable={false}
                            />
                          ) : null}
                          {!slot.isLive && (
                            <span className="project-detail-thumb-drag-handle" aria-hidden>
                              <svg viewBox="0 0 10 16" width="8" height="12" fill="currentColor">
                                <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
                                <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
                                <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
                              </svg>
                            </span>
                          )}
                        </button>
                        {slot.url && !slot.isLive && (
                          <button
                            type="button"
                            className="project-detail-thumb-delete"
                            aria-label={t('projects.detail.deleteImage')}
                            disabled={coverBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCoverAtSlot(i)
                            }}
                          >
                            <Icon.X />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="project-detail-info-panel card">
                <div className="project-detail-info-header">
                  <h2 className="project-detail-section-title project-detail-section-title--upper">{t('projects.detail.publicInfo')}</h2>
                </div>

                <div className="project-detail-field">
                  <label className="project-detail-field-label">{t('projects.detail.titleLabel')}</label>
                  {editing === 'title' ? (
                    <div className="project-detail-field-edit">
                      <input
                        className="input"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        autoFocus
                        disabled={savingField === 'name'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveField('name', draftTitle)
                          if (e.key === 'Escape') setEditing(null)
                        }}
                      />
                      <div className="project-detail-field-edit-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditing(null)}
                          disabled={savingField === 'name'}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void saveField('name', draftTitle)}
                          disabled={savingField === 'name' || !draftTitle.trim()}
                        >
                          {savingField === 'name'
                            ? t('common.saving')
                            : t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="project-detail-field-display"
                      onClick={() => {
                        setDraftTitle(project.name ?? '')
                        setEditing('title')
                      }}
                    >
                      <span>{project.name}</span>
                      <span className="project-detail-edit-btn" aria-hidden>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                    </button>
                  )}
                </div>

                <div className="project-detail-field">
                  <label className="project-detail-field-label">{t('projects.detail.descLabel')}</label>
                  {editing === 'desc' ? (
                    <div className="project-detail-field-edit">
                      <textarea
                        className="input"
                        value={draftDesc}
                        onChange={(e) => setDraftDesc(e.target.value)}
                        rows={4}
                        style={{ resize: 'vertical' }}
                        placeholder={t('projects.detail.descPlaceholder')}
                        autoFocus
                        disabled={savingField === 'description'}
                      />
                      <div className="project-detail-field-edit-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditing(null)}
                          disabled={savingField === 'description'}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void saveField('description', draftDesc)}
                          disabled={savingField === 'description'}
                        >
                          {savingField === 'description'
                            ? t('common.saving')
                            : t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="project-detail-field-display project-detail-field-display--desc"
                      onClick={() => {
                        setDraftDesc(project.description ?? '')
                        setEditing('desc')
                      }}
                    >
                      <span className={project.description ? '' : 'project-detail-desc-placeholder'}>
                        {project.description || t('projects.detail.descPlaceholder')}
                      </span>
                      <span className="project-detail-edit-btn" aria-hidden>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                    </button>
                  )}
                </div>
            </div>

            <aside className="project-detail-sidebar">
              <div className="project-detail-publish-card card">
                <div className="project-detail-publish-card__header">
                  <h3 className="project-detail-publish-card__title">{t('projects.detail.marketplaceTitle')}</h3>
                  <span
                    className={`project-detail-publish-badge${isMarketplaceListed ? '' : ' project-detail-publish-badge--unpublished'}`}
                  >
                    {isMarketplaceListed
                      ? t('projects.detail.marketplacePublished')
                      : t('projects.detail.marketplaceUnpublished')}
                  </span>
                </div>
                <p className="project-detail-publish-card__desc">
                  {isMarketplaceListed
                    ? t('projects.detail.marketplacePublishedDesc')
                    : t('projects.detail.marketplaceDesc')}
                </p>
                <button
                  type="button"
                  className="btn btn-accent project-detail-publish-action"
                  onClick={() => setPublishOpen(true)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  {isMarketplaceListed ? t('projects.detail.updatePublishBtn') : t('projects.detail.publishBtn')}
                </button>
              </div>

              <div className="project-detail-details-card card">
                <h3 className="project-detail-details-title">{t('projects.cardDetail')}</h3>

                <dl className="project-detail-dl">
                  <div className="project-detail-dl-row">
                    <dt>{t('projects.detail.owner')}</dt>
                    <dd>
                      {profile?.avatarUrl && (
                        <img src={profile.avatarUrl} alt="" width={18} height={18} style={{ borderRadius: '50%' }} />
                      )}
                      <span>{profile?.fullName ?? profile?.username ?? t('common.you')}</span>
                    </dd>
                  </div>
                  <div className="project-detail-dl-row">
                    <dt>{t('projects.detail.status')}</dt>
                    <dd>
                      <span className={`project-detail-status${isLive ? ' project-detail-status--live' : ''}`}>
                        <span className="project-detail-status-dot" />
                        {isLive ? t('projects.detail.statusLive') : t('projects.detail.statusDraft')}
                      </span>
                    </dd>
                  </div>
                  <div className="project-detail-dl-row project-detail-dl-row--platforms">
                    <dt>{t('projects.detail.platforms')}</dt>
                    <dd>
                      <PlatformBadgeRow platforms={platforms} className="platform-badge-row--detail" />
                    </dd>
                  </div>
                  <div className="project-detail-dl-row">
                    <dt>{t('projects.detail.created')}</dt>
                    <dd>{formatDate(project.createdAt, lang)}</dd>
                  </div>
                  <div className="project-detail-dl-row">
                    <dt>{t('projects.detail.updated')}</dt>
                    <dd>{formatDate(project.updatedAt ?? project.createdAt, lang)}</dd>
                  </div>
                  {isLive && (
                    <div className="project-detail-dl-row">
                      <dt>URL</dt>
                      <dd>
                        <a href={project.deployedUrl} target="_blank" rel="noopener noreferrer" className="project-detail-url">
                          {project.deployedUrl.replace(/^https?:\/\//, '')}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {isMarketplaceListed && (
                <div className="project-detail-rating-card card">
                  <h3 className="project-detail-details-title">{t('projects.detail.ratingTitle')}</h3>
                  {projectRating && projectRating.rating > 0 ? (
                    <div className="project-detail-rating-body">
                      <span className="project-detail-rating-number">{projectRating.rating.toFixed(1)}</span>
                      <ProjectStarRating rating={projectRating.rating} />
                      <span className="project-detail-rating-count">
                        {projectRating.reviewCount > 0
                          ? t('projects.detail.basedOnReviews')
                              .replace('{n}', String(projectRating.reviewCount))
                          : t('projects.detail.noReviews')}
                      </span>
                    </div>
                  ) : (
                    <p className="project-detail-rating-empty">
                      {t('projects.detail.noRatings')}
                    </p>
                  )}
                </div>
              )}

              <AutoDismissNotice notice={actionNotice} onDismiss={() => setActionNotice(null)} />
            </aside>
          </div>
        </div>
      </div>

      {publishOpen && (
        <ProjectPublishModal
          project={project}
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            void refresh()
            setActionNotice({ type: 'success', message: t('projects.action.publishOk') })
            setPublishOpen(false)
          }}
        />
      )}

      {lightboxUrl && (
        <Lightbox
          url={lightboxUrl}
          onClose={() => setLightboxUrl(null)}
          closeLabel={t('ed.close')}
        />
      )}
    </AppShell>
  )
}

/* ───── Projects list (internal) ───── */
function ProjectsListPage() {
  const { t, navigate, lang } = useApp()
  const { isAuthenticated } = useUser()
  const { projects, loading, error, remove, refresh } = useProjects()
  const { status: integrationsStatus } = useIntegrationsGate()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionNotice, setActionNotice] = useState(null)
  const [publishQueue, setPublishQueue] = useState([])
  const publishTotalRef = useRef(0)
  const [listLightboxUrl, setListLightboxUrl] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, query])

  const selectedProjects = useMemo(
    () => projects.filter((p) => selectedIds.has(p.id)),
    [projects, selectedIds],
  )

  const selectedCount = selectedIds.size
  const singleSelected = selectedCount === 1 ? selectedProjects[0] : null

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))
  const someFilteredSelected = filtered.some((p) => selectedIds.has(p.id))
  const selectAllRef = useRef(null)

  useEffect(() => {
    const el = selectAllRef.current
    if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected
  }, [someFilteredSelected, allFilteredSelected])

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const p of filtered) next.delete(p.id)
      } else {
        for (const p of filtered) next.add(p.id)
      }
      return next
    })
  }, [allFilteredSelected, filtered])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const openPublishFlow = useCallback(() => {
    if (!selectedProjects.length) return
    publishTotalRef.current = selectedProjects.length
    setPublishQueue([...selectedProjects])
  }, [selectedProjects])

  function handlePublishDone() {
    void refresh()
    const total = publishTotalRef.current
    setPublishQueue([])
    setActionNotice({
      type: 'success',
      message:
        total > 1
          ? t('projects.action.publishOkMany').replace('{n}', String(total))
          : t('projects.action.publishOk'),
    })
  }

  function handlePublishPublished() {
    const remaining = publishQueue.slice(1)
    if (remaining.length > 0) {
      setPublishQueue(remaining)
      return
    }
    handlePublishDone()
  }

  async function handleDownload() {
    if (!selectedProjects.length) return
    setActionBusy(true)
    setActionNotice(null)
    try {
      for (const p of selectedProjects) await downloadProjectZip(p.id, p.name)
    } catch (err) {
      const key = err instanceof Error && err.message === 'no_files' ? 'projects.action.noFiles' : null
      setActionNotice({
        type: 'error',
        message: key ? t(key) : err instanceof Error ? err.message : t('projects.action.failed'),
      })
    } finally {
      setActionBusy(false)
    }
  }

  async function confirmDelete() {
    const ids = [...selectedIds]
    if (!ids.length) return
    setActionBusy(true)
    try {
      for (const id of ids) await remove(id)
      clearSelection()
      setDeleteOpen(false)
    } catch (err) {
      setActionNotice({ type: 'error', message: err instanceof Error ? err.message : t('projects.action.failed') })
    } finally {
      setActionBusy(false)
    }
  }

  async function handleGithub() {
    if (!singleSelected) return
    if (isDemoActive() && !isAuthenticated) {
      navigate(`/auth/signup?next=${encodeURIComponent('/projects')}`)
      return
    }
    setActionBusy(true)
    setActionNotice(null)
    try {
      const res = await apiFetch(`/api/projects/${singleSelected.id}/publish/github`, { method: 'POST' })
      if (res.url) window.open(res.url, '_blank', 'noopener')
      setActionNotice({ type: 'success', message: t('projects.action.githubOk') })
      await refresh()
    } catch (err) {
      setActionNotice({ type: 'error', message: err instanceof Error ? err.message : t('projects.action.failed') })
    } finally {
      setActionBusy(false)
    }
  }

  async function handleDeploy() {
    if (!singleSelected) return
    if (isDemoActive()) {
      const demoUrl = getDemoPreviewUrl(singleSelected.id)
      updateDemoProject(singleSelected.id, { deployedUrl: demoUrl })
      setActionNotice({ type: 'success', message: t('projects.action.deployOk') })
      await refresh()
      return
    }
    if (!integrationsStatus?.vercel?.connected) {
      navigate('/settings?tab=connect')
      return
    }
    setActionBusy(true)
    setActionNotice(null)
    try {
      const res = await apiFetch(`/api/projects/${singleSelected.id}/deploy`, { method: 'POST' })
      if (res.url) setActionNotice({ type: 'success', message: t('projects.action.deployOk') })
      await refresh()
    } catch (err) {
      setActionNotice({ type: 'error', message: err instanceof Error ? err.message : t('projects.action.failed') })
    } finally {
      setActionBusy(false)
    }
  }

  const selectionLabel =
    selectedCount === 0
      ? t('projects.action.selectHint')
      : selectedCount === 1
        ? t('projects.selectedOne')
        : t('projects.selectedMany').replace('{n}', String(selectedCount))

  const needsSingle = selectedCount > 1

  return (
    <AppShell>
      {!integrationsStatus?.github?.connected && (
        <IntegrationReminderBanner type="github" />
      )}
      <div className="app-page projects-page fadein">
        <div className="container">
        <header className="app-page-header projects-hero">
          <div className="app-page-header__main projects-hero__text">
            <p className="eyebrow">{t('projects.eyebrow')}</p>
            <h1>{t('projects.title')}</h1>
            <p className="app-page-header__lead">{t('projects.subtitle')}</p>
          </div>
          {!loading && projects.length > 0 ? (
            <div className="projects-hero__stat" aria-hidden>
              <span className="projects-hero__stat-value">{projects.length}</span>
              <span className="projects-hero__stat-label">
                {projects.length === 1 ? t('projects.countOne') : t('projects.countMany').replace('{n}', String(projects.length))}
              </span>
            </div>
          ) : null}
        </header>


        {error ? (
          <div className="projects-alert" role="alert">{error}</div>
        ) : null}

        <AutoDismissNotice notice={actionNotice} onDismiss={() => setActionNotice(null)} />

        {loading ? (
          <div className="projects-loading">
            <span className="projects-spinner projects-spinner--lg" aria-hidden />
            <p>{t('projects.loading')}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="projects-empty card">
            <span className="projects-empty__icon" aria-hidden><Icon.Folder /></span>
            <h3>{t('projects.emptyTitle')}</h3>
            <p>{t('projects.empty')}</p>
            <div className="projects-empty__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  openStudio(navigate, lang === 'en' ? 'en' : 'es')
                }}
              >
                {t('dash.createProject')} <Icon.Arrow />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="projects-list-controls card">
              <div className="projects-list-controls__row">
                <label className="projects-select-all">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="projects-select-all__input"
                    checked={allFilteredSelected && filtered.length > 0}
                    disabled={!filtered.length}
                    onChange={toggleSelectAllFiltered}
                    aria-label={
                      allFilteredSelected
                        ? t('projects.deselectAll')
                        : t('projects.selectAll')
                    }
                  />
                  <span className="projects-select-all__box" aria-hidden />
                  <span className="projects-select-all__label">
                    {allFilteredSelected
                      ? t('projects.deselectAll')
                      : t('projects.selectAll')}
                  </span>
                </label>
                <span className="projects-list-controls__divider" aria-hidden />
                <p className="projects-list-controls__summary">
                  {selectedCount > 0 ? (
                    <>
                      <strong>{selectionLabel}</strong>
                      {query.trim() && filtered.length !== projects.length ? (
                        <span className="projects-list-controls__filter-note">
                          {' '}
                          · {t('projects.filteredCount').replace('{n}', String(filtered.length))}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    selectionLabel
                  )}
                </p>
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm projects-list-controls__clear"
                    onClick={clearSelection}
                  >
                    {t('projects.clearSelection')}
                  </button>
                ) : null}
                <span className="projects-list-controls__spacer" />
                <label className="projects-search psearch">
                  <Icon.Search />
                  <input
                    type="search"
                    className="input"
                    placeholder={t('projects.searchPlaceholder')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t('projects.searchPlaceholder')}
                  />
                </label>
              </div>
            </div>

            <div
              className={`projects-bulk-bar card${selectedCount > 0 ? ' is-active' : ''}`}
              role="toolbar"
              aria-label={t('projects.action.toolbar')}
              aria-hidden={selectedCount === 0}
            >
              <p className="projects-bulk-bar__label">
                {selectedCount > 0
                  ? selectionLabel
                  : t('projects.action.selectHint')}
              </p>
              <div className="projects-bulk-bar__actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!selectedCount || actionBusy}
                  onClick={() => void handleDownload()}
                >
                  <Icon.Download />
                  {t('projects.action.download')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!singleSelected || actionBusy}
                  title={needsSingle ? t('projects.action.selectOne') : undefined}
                  onClick={() => void handleGithub()}
                >
                  <Icon.Github />
                  {t('projects.action.github')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!singleSelected || actionBusy}
                  title={needsSingle ? t('projects.action.selectOne') : undefined}
                  onClick={() => void handleDeploy()}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                  </svg>
                  {t('projects.action.deploy')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-ghost--danger"
                  disabled={!selectedCount || actionBusy}
                  onClick={() => setDeleteOpen(true)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  {t('projects.action.delete')}
                </button>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  disabled={!selectedCount || actionBusy}
                  onClick={openPublishFlow}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  {t('projects.action.publish')}
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="projects-no-results text-muted">{t('projects.noResults')}</p>
            ) : (
              <ul
                className="projects-grid pgrid"
                role="listbox"
                aria-label={t('projects.title')}
                aria-multiselectable="true"
              >
                {filtered.map((p) => {
                  const marketplaceMeta = getProjectMarketplaceMeta(p)
                  const marketplacePriceLabel = marketplaceMeta
                    ? (marketplaceMeta.priceCredits === 0
                      ? t('mp.free')
                      : `${marketplaceMeta.priceCredits} ${t('mp.creditsUnit')}`)
                    : null
                  const marketplaceRatingLabel = marketplaceMeta && marketplaceMeta.rating > 0
                    ? marketplaceMeta.rating.toFixed(1)
                    : null
                  return (
                  <ProjectCatalogCard
                    key={p.id}
                    project={p}
                    selected={selectedIds.has(p.id)}
                    marketplaceListed={isProjectMarketplaceListed(p)}
                    marketplaceLabel={t('projects.published')}
                    marketplacePriceLabel={marketplacePriceLabel}
                    marketplaceRatingLabel={marketplaceRatingLabel}
                    createdLabel={formatDate(p.createdAt, lang)}
                    createdMetaLabel={t('projects.metaCreated')}
                    liveLabel={t('projects.detail.statusLive')}
                    detailLabel={t('projects.cardDetail')}
                    openLabel={t('projects.open')}
                    selectLabel={t('projects.select')}
                    deselectLabel={t('projects.deselect')}
                    onToggleSelect={() => toggleSelect(p.id)}
                    onOpen={() => navigate(`/studio?project=${encodeURIComponent(p.id)}`)}
                    onDetail={() => navigate(`/projects/${encodeURIComponent(p.id)}`)}
                    zoomLabel={t('projects.zoom')}
                    onZoom={(url) => setListLightboxUrl(url)}
                  />
                  )
                })}
              </ul>
            )}
          </>
        )}

        <ProjectDeleteConfirmDialog
          open={deleteOpen}
          count={selectedCount}
          busy={actionBusy}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => void confirmDelete()}
        />

        {publishQueue.length > 0 && (
          <ProjectPublishModal
            key={publishQueue[0].id}
            project={publishQueue[0]}
            queueLabel={
              publishTotalRef.current > 1
                ? t('projects.action.publishQueue')
                    .replace('{current}', String(publishTotalRef.current - publishQueue.length + 1))
                    .replace('{total}', String(publishTotalRef.current))
                : undefined
            }
            onClose={() => setPublishQueue([])}
            onPublished={handlePublishPublished}
          />
        )}

        {listLightboxUrl && (
          <Lightbox
            url={listLightboxUrl}
            onClose={() => setListLightboxUrl(null)}
            closeLabel={t('ed.close')}
          />
        )}
        </div>
      </div>
    </AppShell>
  )
}

/* ───── Router wrapper ───── */
export function ProjectsPage() {
  const { route } = useApp()
  const detailId =
    route.startsWith('/projects/') && route !== '/projects/'
      ? decodeURIComponent(route.replace('/projects/', ''))
      : null
  if (detailId) return <ProjectDetailPage projectId={detailId} />
  return <ProjectsListPage />
}
