'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { useApp, Icon, AppShell, MarketingShell, FRAMEWORKS } from '@/components/app/shell'
import { apiFetch } from '@/lib/api/client'
import { isDemoActive, shouldUseDemoData, findDemoProject } from '@/lib/auth/demo'
import {
  ensureDemoSeedData,
  findDemoMarketplaceProduct,
  isDemoMarketplaceId,
  loadDemoMarketplaceProducts,
  withDemoMarketplaceCovers,
} from '@/lib/auth/demo-seed'
import { useUser } from '@/hooks/useUser'
import { useMarketplaceOwned } from '@/hooks/useMarketplaceOwned'
import {
  acquireTemplateAndCreateProject,
  getMarketplacePrice,
  importMarketplaceToProject,
  isDemoMarketplaceFlow,
  loadDemoMarketplacePurchasesList,
  studioPathForProject,
} from '@/lib/marketplace/acquireTemplate'

function Lightbox({ url, onClose, closeLabel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
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
      <button type="button" className="project-lightbox-close" aria-label={closeLabel} onClick={onClose}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="project-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt="" className="project-lightbox-img" draggable={false} />
      </div>
    </div>,
    document.body,
  )
}

function priceLabel(item, t) {
  if (item.price === 0) return t('mp.free')
  return `${item.price} ${t('mp.creditsUnit')}`
}

function MarketplacePage() {
  const { route } = useApp()
  const searchParams = useSearchParams()
  const queryId = searchParams.get('id')

  const detailFromPath =
    route.startsWith('/marketplace/') && route !== '/marketplace/purchases'
      ? route.replace('/marketplace/', '')
      : null

  if (route === '/marketplace/purchases') {
    return <MarketplacePurchasesPage />
  }

  const productId = detailFromPath || (route === '/marketplace' && queryId ? queryId : null)
  if (productId) {
    return <MarketplaceDetailPage productId={productId} />
  }

  return <MarketplaceBrowsePage />
}

function MarketplaceBrowsePage() {
  const { t, route, navigate } = useApp()
  const { isAuthenticated, profile } = useUser()
  const { isOwned, refreshOwned } = useMarketplaceOwned()
  const isApp = route.startsWith('/studio') || route.startsWith('/settings')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [price, setPrice] = useState('all')
  const [sort, setSort] = useState('popular')
  const [selected, setSelected] = useState(null)
  const [acquiringId, setAcquiringId] = useState(null)
  const [acquireError, setAcquireError] = useState(null)

  async function handleFreeAcquire(item) {
    if (!item?.id) return
    if (!isAuthenticated) {
      navigate('/auth/signin?next=/marketplace')
      return
    }
    setAcquiringId(item.id)
    setAcquireError(null)
    try {
      const { projectId } = await acquireTemplateAndCreateProject(item, profile)
      await refreshOwned()
      navigate(studioPathForProject(projectId))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setAcquireError(msg === 'INSUFFICIENT_CREDITS' ? t('mp.acquire.insufficientCredits') : msg)
    }
    setAcquiringId(null)
  }

  function handlePaidAcquire(item) {
    if (!item?.id) return
    if (!isAuthenticated) {
      navigate('/auth/signin?next=/marketplace')
      return
    }
    setSelected(item)
  }

  async function handleOpenOwned(item) {
    if (!item?.id) return
    if (!isAuthenticated) {
      navigate('/auth/signin?next=/marketplace')
      return
    }
    setAcquiringId(item.id)
    setAcquireError(null)
    try {
      const demo = isDemoMarketplaceFlow(item.id, profile)
      const project = await importMarketplaceToProject(item.id, item.name, { demo })
      navigate(studioPathForProject(project.id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setAcquireError(msg)
    }
    setAcquiringId(null)
  }

  useEffect(() => {
    setLoading(true)
    apiFetch('/api/marketplace/products')
      .then((d) => setItems(d.products ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [profile])

  const filtered = useMemo(() => {
    let r = items.slice()
    if (query) {
      const q = query.toLowerCase()
      r = r.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.author.toLowerCase().includes(q) ||
          (i.desc && i.desc.toLowerCase().includes(q))
      )
    }
    if (price === 'free') r = r.filter((i) => i.price === 0)
    if (price === 'paid') r = r.filter((i) => i.price > 0)
    if (sort === 'popular') r.sort((a, b) => b.stars - a.stars)
    if (sort === 'new') r = [...r].reverse()
    if (sort === 'price') r.sort((a, b) => a.price - b.price)
    return r
  }, [query, price, sort, items])

  const Shell = isApp ? AppShell : MarketingShell
  const priceFilters = [
    { id: 'all', label: t('mp.filter.all') },
    { id: 'free', label: t('mp.filter.free') },
    { id: 'paid', label: t('mp.filter.paid') },
  ]

  const resultCountLabel =
    filtered.length === 1
      ? t('mp.resultOne')
      : t('mp.resultMany').replace('{n}', String(filtered.length))

  return (
    <Shell>
      <div className="app-page marketplace-page">
        <div className="container">
          <header className="app-page-header projects-hero">
            <div className="app-page-header__main projects-hero__text">
            <p className="eyebrow">{t('mp.eyebrow')}</p>
            <h1>{t('mp.title')}</h1>
            <p className="app-page-header__lead">{t('mp.subtitle')}</p>
            </div>
            {!loading && items.length > 0 ? (
              <div className="projects-hero__stat" aria-hidden>
                <span className="projects-hero__stat-value">{filtered.length}</span>
                <span className="projects-hero__stat-label">{resultCountLabel}</span>
              </div>
            ) : null}
          </header>

          <div className="projects-list-controls card">
            <div className="projects-list-controls__row">
              <label className="projects-search psearch" style={{ maxWidth: 'min(560px, 100%)' }}>
                <Icon.Search />
                <input
                  type="search"
                  className="input"
                  placeholder={t('mp.search')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={t('mp.search')}
                />
              </label>
              <span className="projects-list-controls__spacer" />
              <div className="mp-toolbar-controls">
                <select
                  className="input mp-filter"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  aria-label={t('mp.filter.aria')}
                >
                  {priceFilters.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input mp-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label={t('mp.sort.aria')}
                >
                  <option value="popular">{t('mp.sort.popular')}</option>
                  <option value="new">{t('mp.sort.new')}</option>
                  <option value="price">{t('mp.sort.price')}</option>
                </select>
              </div>
            </div>
          </div>

          <p className="projects-count-meta">
            <span className="projects-count-meta__stat plist-stat">{resultCountLabel}</span>
          </p>

          {acquireError && (
            <p className="mp-acquire-error" role="alert">
              {acquireError}
            </p>
          )}

          {loading ? (
            <p className="mp-loading">{t('mp.loading')}</p>
          ) : filtered.length === 0 ? (
            <div className="projects-empty card">
              <span className="projects-empty__icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </span>
              <h3>{t('mp.emptyTitle')}</h3>
              <p>{t('mp.empty')}</p>
            </div>
          ) : (
            <div className="mp-grid">
              {filtered.map((it) => {
                if (!it?.id && !it?.name) return null
                const owned = isOwned(it.id)
                const coverUrl = it.coverImages?.[0] ?? it.previewUrl ?? null
                return (
                  <article
                    key={it.id ?? it.name}
                    className={`ucard mp-card${owned ? ' mp-card--owned' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => it.id && navigate(`/marketplace/${it.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && it.id && navigate(`/marketplace/${it.id}`)}
                  >
                    <div className="ucard-thumb mp-card-thumb">
                      <div
                        className={`ucard-thumb-inner${
                          coverUrl
                            ? ' ucard-thumb-inner--cover'
                            : ' ucard-thumb-inner--placeholder'
                        }`}
                      >
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={it.name}
                            className="ucard-thumb-cover"
                            draggable={false}
                          />
                        ) : null}
                      </div>
                      <span className={`ucard-badge-tl pill mp-card-badge pill--${it.price === 0 ? 'free' : 'paid'}`}>
                        {it.price === 0 ? t('mp.free') : `${it.price} ${t('mp.creditsUnit')}`}
                      </span>
                      {owned && isAuthenticated && (
                        <span className="ucard-badge-tr pill mp-card-badge mp-card-badge--owned">
                          <Icon.Check />
                          {t('mp.owned')}
                        </span>
                      )}
                    </div>
                    <div className="ucard-body mp-card-body">
                      <h2 className="ucard-name mp-card-title">{it.name}</h2>
                      <p className="ucard-meta mp-card-author">
                        {t('mp.card.by')} {it.author}
                        {it.rating != null && (
                          <>
                            {' '}
                            · <Icon.Star /> {it.rating}
                          </>
                        )}
                      </p>
                      {it.desc ? <p className="ucard-desc mp-card-desc">{it.desc}</p> : null}
                    </div>
                    <div className="ucard-foot mp-card-foot">
                      <span className="mp-card-price" style={{ color: it.price === 0 ? 'var(--success)' : undefined }}>
                        {priceLabel(it, t)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (owned) handleOpenOwned(it)
                          else if (it.price === 0) handleFreeAcquire(it)
                          else handlePaidAcquire(it)
                        }}
                        disabled={acquiringId === it.id}
                        className={`btn btn-sm${owned ? ' btn-primary' : ' btn-subtle'}`}
                      >
                        {acquiringId === it.id
                          ? t('mp.acquire.processing')
                          : owned
                            ? t('mp.openOwned')
                            : it.price === 0
                              ? t('mp.get')
                              : t('mp.buy')}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <AcquireModal
          item={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => refreshOwned()}
        />
      )}
    </Shell>
  )
}

function Modal({ children, onClose, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
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
          maxWidth: width,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function AcquireModal({ item, onClose, onSuccess }) {
  const { t, navigate } = useApp()
  const { profile } = useUser()
  const [step, setStep] = useState('review')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [projectId, setProjectId] = useState(null)
  const price = getMarketplacePrice(item)
  const credits = profile?.credits ?? 0
  const fw = FRAMEWORKS.find((f) => f.id === item.framework) ?? FRAMEWORKS[0]

  async function confirmPurchase() {
    if (!item.id) return
    setBusy(true)
    setError(null)
    try {
      const { projectId: id } = await acquireTemplateAndCreateProject(item, profile)
      setProjectId(id)
      onSuccess?.(id)
      setStep('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(msg === 'INSUFFICIENT_CREDITS' ? t('mp.acquire.insufficientCredits') : msg)
    }
    setBusy(false)
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
          {step === 'done' ? t('mp.acquire.successTitle') : t('mp.acquire.titlePaid')}
        </h3>
        <span className="spacer" />
        <button type="button" onClick={onClose} className="btn btn-icon btn-ghost" aria-label={t('mp.acquire.close')}>
          <Icon.X />
        </button>
      </div>

      <div style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            gap: 14,
            padding: 14,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-sm)',
              background: `linear-gradient(135deg, color-mix(in srgb, ${fw.color} 30%, var(--surface)) 0%, var(--surface-2) 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: fw.color,
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {fw.glyph}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('mp.card.by')} {item.author} · {priceLabel(item, t)}
            </div>
          </div>
        </div>

        {step === 'review' && (
          <>
            <div
              style={{
                display: 'grid',
                gap: 10,
                marginBottom: 16,
                padding: 14,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-elev)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-mid)' }}>{t('mp.acquire.yourBalance')}</span>
                <strong className="mono">{credits} {t('mp.creditsUnit')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-mid)' }}>{t('mp.acquire.cost')}</span>
                <strong className="mono">{price} {t('mp.creditsUnit')}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--text-mid)' }}>{t('mp.acquire.after')}</span>
                <strong className="mono" style={{ color: credits >= price ? 'var(--success)' : 'var(--danger)' }}>
                  {Math.max(0, credits - price)} {t('mp.creditsUnit')}
                </strong>
              </div>
            </div>
            <p style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.55, margin: '0 0 20px' }}>
              {t('mp.acquire.descPaid').replace('{n}', String(price))}
            </p>
            {error && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>
                {error === t('mp.acquire.insufficientCredits') && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/settings?tab=billing')}>
                    {t('mp.acquire.buyCredits')}
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={onClose} className="btn btn-ghost">
                {t('mp.acquire.cancel')}
              </button>
              <button type="button" onClick={confirmPurchase} disabled={busy || credits < price} className="btn btn-accent">
                {busy ? t('mp.acquire.processing') : t('mp.acquire.confirmPaid')}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--success) 16%, transparent)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Icon.Check />
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-mid)', marginBottom: 22 }}>{t('mp.acquire.successDescStudio')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {projectId && (
                <button type="button" onClick={() => navigate(studioPathForProject(projectId))} className="btn btn-accent">
                  {t('mp.acquire.openStudio')}
                </button>
              )}
              <button type="button" onClick={() => navigate('/projects')} className="btn btn-primary">
                {t('mp.acquire.viewProjects')}
              </button>
              <button type="button" onClick={onClose} className="btn btn-ghost">
                {t('mp.acquire.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}


function StarRating({ rating }) {
  const full = Math.floor(rating ?? 0)
  const half = (rating ?? 0) - full >= 0.5
  return (
    <span className="mp-detail-stars" aria-label={`${rating ?? 0} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="14" height="14" fill={i <= full ? 'currentColor' : (i === full + 1 && half ? 'url(#half)' : 'none')} stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <defs>
            <linearGradient id="half"><stop offset="50%" stopColor="currentColor" /><stop offset="50%" stopColor="none" /></linearGradient>
          </defs>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

function demoProductToView(p) {
  const enriched = withDemoMarketplaceCovers(p)
  return {
    ...enriched,
    description: enriched.desc,
    priceCredits: enriched.price,
  }
}

function MarketplaceDetailPage({ productId }) {
  const { t, navigate } = useApp()
  const { isAuthenticated, profile } = useUser()
  const { isOwned, refreshOwned } = useMarketplaceOwned()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const owned = isOwned(productId)
  const [msg, setMsg] = useState(null)
  const [msgType, setMsgType] = useState('success')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [activeScreenshot, setActiveScreenshot] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const Shell = isAuthenticated ? AppShell : MarketingShell

  useEffect(() => {
    setLoading(true)
    if (isDemoMarketplaceId(productId) || isDemoActive() || shouldUseDemoData(profile)) {
      ensureDemoSeedData()
      const local = findDemoMarketplaceProduct(productId)
      if (local) {
        const view = demoProductToView(local)
        setProduct(view)
        setEditTitle(view.name ?? '')
        setEditDesc(view.desc ?? '')
        setLoading(false)
        return
      }
    }
    apiFetch(`/api/marketplace/products/${productId}`)
      .then((d) => {
        setProduct(d.product)
        setEditTitle(d.product?.name ?? '')
        setEditDesc(d.product?.desc ?? d.product?.description ?? '')
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [productId, profile])

  // Re-sync covers when demo project data changes (e.g. after Studio capture)
  useEffect(() => {
    const onDemoChange = () => {
      if (!product?.demoProjectId) return
      const proj = findDemoProject(product.demoProjectId)
      if (!proj) return
      const covers = proj.coverImages?.length
        ? proj.coverImages
        : proj.coverUrl ? [proj.coverUrl] : null
      if (covers) {
        setProduct((prev) => prev ? { ...prev, coverImages: covers, previewUrl: covers[0] } : prev)
      }
    }
    window.addEventListener('runlabs:demo-change', onDemoChange)
    return () => window.removeEventListener('runlabs:demo-change', onDemoChange)
  }, [product?.demoProjectId])

  async function handleTemplateAction() {
    if (!isAuthenticated) {
      navigate(`/auth/signin?next=/marketplace/${productId}`)
      return
    }
    const item = { ...product, id: productId }
    const price = getMarketplacePrice(item)
    if (!owned && price > 0) {
      setPayModalOpen(true)
      return
    }
    setImporting(true)
    setMsg(null)
    try {
      const demo = isDemoMarketplaceFlow(productId, profile)
      let pid
      if (owned) {
        const project = await importMarketplaceToProject(productId, product.name, { demo })
        pid = project.id
      } else {
        const result = await acquireTemplateAndCreateProject(item, profile)
        pid = result.projectId
        await refreshOwned()
      }
      navigate(studioPathForProject(pid))
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Error'
      setMsgType('error')
      setMsg(errMsg === 'INSUFFICIENT_CREDITS' ? t('mp.acquire.insufficientCredits') : errMsg)
    }
    setImporting(false)
  }

  if (loading) {
    return (
      <Shell>
        <p className="mp-loading">{t('mp.loading')}</p>
      </Shell>
    )
  }

  if (!product) {
    return (
      <Shell>
        <div className="container mp-detail">
          <p>{t('mp.detail.notFound')}</p>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/marketplace')}>
            {t('mp.detail.back')}
          </button>
        </div>
      </Shell>
    )
  }

  const fw = FRAMEWORKS.find((f) => f.id === product.framework) ?? FRAMEWORKS[0]
  const credits = product.priceCredits ?? product.price ?? 0
  const isFree = credits === 0
  const authorInitial = (product.author ?? '?')[0]?.toUpperCase()

  // Use real cover images if available, fall back to previewUrl, then placeholder
  const coverImgs = product.coverImages?.length
    ? product.coverImages
    : product.previewUrl
      ? [product.previewUrl]
      : []
  const mockScreenshots = coverImgs.length
    ? coverImgs.slice(0, 4).map((url, i) => ({
        url,
        label: i === 0 ? t('projects.page.home') : `${t('projects.page.short')} ${i + 1}`,
        color: fw.color,
      }))
    : [{ url: null, label: t('projects.page.home'), color: fw.color }]

  return (
    <Shell>
      <div className="mp-detail-page app-page">
        <div className="container">
          {/* Back */}
          <button type="button" className="btn btn-ghost btn-sm mp-detail-back" onClick={() => navigate('/marketplace')}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            {t('mp.detail.back')}
          </button>

          <div className="mp-detail-layout">
            <div className="mp-detail-preview-col card">
              <div className="mp-detail-screenshots">
                <div
                  className={`mp-detail-screenshot-main${
                    !mockScreenshots[activeScreenshot]?.url ? ' ucard-cover-placeholder' : ''
                  }`}
                  style={{
                    cursor: mockScreenshots[activeScreenshot]?.url ? 'zoom-in' : 'default',
                  }}
                  onClick={() => mockScreenshots[activeScreenshot]?.url && setLightboxUrl(mockScreenshots[activeScreenshot].url)}
                  role={mockScreenshots[activeScreenshot]?.url ? 'button' : undefined}
                  aria-label={mockScreenshots[activeScreenshot]?.url ? t('projects.detail.zoomImage') : undefined}
                >
                  {mockScreenshots[activeScreenshot]?.url ? (
                    <img
                      src={mockScreenshots[activeScreenshot].url}
                      alt={mockScreenshots[activeScreenshot].label}
                      className="mp-detail-screenshot-img"
                      draggable={false}
                    />
                  ) : null}
                  {mockScreenshots[activeScreenshot]?.url && (
                    <div className="mp-detail-zoom-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /><path d="M11 8v6M8 11h6" />
                      </svg>
                    </div>
                  )}
                  <div className="mp-detail-screenshot-overlay">
                    <span className="mp-detail-screenshot-page-label">{mockScreenshots[activeScreenshot]?.label}</span>
                  </div>
                </div>
                <div className="mp-detail-screenshot-thumbs">
                  {mockScreenshots.map((s, i) => (
                    <button
                      key={s.url ?? s.label}
                      type="button"
                      className={`mp-detail-screenshot-thumb${
                        activeScreenshot === i ? ' is-active' : ''
                      }${!s.url ? ' ucard-cover-placeholder' : ''}`}
                      onClick={() => setActiveScreenshot(i)}
                    >
                      {s.url ? (
                        <img src={s.url} alt={s.label} className="mp-detail-thumb-img" draggable={false} />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mp-detail-main">
              <div className="mp-detail-content card">
                <div className="mp-detail-content-header">
                  {editingTitle ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}
                        autoFocus
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingTitle(false)}>
                        {t('common.save')}
                      </button>
                    </div>
                  ) : (
                    <div className="mp-detail-title-row">
                      <h1 className="mp-detail-h1">{editTitle || product.name}</h1>
                      {isAuthenticated && (
                        <button type="button" className="btn btn-ghost btn-sm mp-detail-edit-btn" onClick={() => setEditingTitle(true)}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                </div>

                <div className="mp-detail-desc-section">
                  {editingDesc ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        className="input"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={5}
                        style={{ resize: 'vertical' }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingDesc(false)}>
                          {t('common.cancel')}
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingDesc(false)}>
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mp-detail-desc-display" onClick={isAuthenticated ? () => setEditingDesc(true) : undefined} style={{ cursor: isAuthenticated ? 'pointer' : 'default' }}>
                      <p className="mp-detail-desc-text">{editDesc || product.desc || product.description || t('mp.detail.noDescription')}</p>
                      {isAuthenticated && (
                        <button type="button" className="btn btn-ghost btn-sm mp-detail-edit-btn">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Sidebar ── */}
            <aside className="mp-detail-sidebar">
              {/* Purchase card */}
              <div className="mp-detail-buy-card card">
                {owned && isAuthenticated && (
                  <div className="mp-detail-owned-badge">
                    <Icon.Check />
                    {t('mp.owned')}
                  </div>
                )}
                <div className="mp-detail-buy-price">
                  {isFree ? (
                    <span className="mp-detail-buy-price-free">{t('mp.free')}</span>
                  ) : (
                    <>
                      <span className="mp-detail-buy-price-amount">{credits}</span>
                      <span className="mp-detail-buy-price-unit">{t('mp.creditsUnit')}</span>
                    </>
                  )}
                </div>

                {msg && (
                  <div
                    style={{
                      fontSize: 13,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 8,
                      background: msgType === 'success' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
                      color: msgType === 'success' ? 'var(--success)' : 'var(--danger)',
                      border: `1px solid color-mix(in srgb, ${msgType === 'success' ? 'var(--success)' : 'var(--danger)'} 30%, transparent)`,
                    }}
                  >
                    {msg}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={importing}
                  onClick={handleTemplateAction}
                >
                  {importing
                    ? t('mp.detail.importing')
                    : owned
                      ? t('mp.openOwned')
                      : isFree
                        ? t('mp.detail.get')
                        : t('mp.detail.buy').replace('{n}', String(credits))}
                </button>
              </div>

              {/* Author + Stats unified card */}
              <div className="mp-detail-info-card card">
                <div className="mp-detail-author-row">
                  <div className="mp-detail-author-avatar" style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${fw.color} 35%, var(--surface)) 0%, color-mix(in srgb, ${fw.color} 12%, var(--surface-2)) 100%)`,
                    color: fw.color,
                  }}>
                    {authorInitial}
                  </div>
                  <div>
                    <div className="mp-detail-author-name">{product.authorName ?? product.author ?? '—'}</div>
                    <div className="mp-detail-author-sub">{t('mp.detail.creator')}</div>
                  </div>
                </div>

                <div className="mp-detail-info-divider" />

                <dl className="mp-detail-stats-dl">
                  {product.rating != null && (
                    <div className="mp-detail-stat-row">
                      <dt>{t('projects.detail.ratingTitle')}</dt>
                      <dd>
                        <StarRating rating={product.rating} />
                        <span className="mp-detail-stat-rating-val">{product.rating}</span>
                      </dd>
                    </div>
                  )}
                  {product.stars != null && (
                    <div className="mp-detail-stat-row">
                      <dt>{t('mp.detail.downloads')}</dt>
                      <dd>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>{product.stars}</span>
                      </dd>
                    </div>
                  )}
                  <div className="mp-detail-stat-row">
                    <dt>{t('projects.framework')}</dt>
                    <dd><span style={{ color: fw.color, fontWeight: 600 }}>{fw.label ?? fw.id}</span></dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {payModalOpen && product && (
        <AcquireModal
          item={{ ...product, id: productId }}
          onClose={() => setPayModalOpen(false)}
          onSuccess={() => refreshOwned()}
        />
      )}

      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} closeLabel={t('ed.close')} />
      )}
    </Shell>
  )
}

function PurchaseRow({ purchase, navigate, t }) {
  const { profile } = useUser()
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const productId = purchase.product_id ?? purchase.product?.id

  async function importToProject() {
    if (!productId) return
    setImporting(true)
    setError(null)
    try {
      const demo = isDemoMarketplaceFlow(productId, profile)
      const project = await importMarketplaceToProject(productId, purchase.product?.name, { demo })
      navigate(studioPathForProject(project.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
    setImporting(false)
  }

  return (
    <div className="mp-purchase-row">
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 600 }}>{purchase.product?.name ?? 'Plantilla'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {new Date(purchase.purchased_at).toLocaleDateString()}
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{error}</p>}
      </div>
      {productId && (
        <button type="button" className="btn btn-primary btn-sm" disabled={importing} onClick={importToProject}>
          {importing ? t('mp.detail.importing') : t('mp.purchases.import')}
        </button>
      )}
    </div>
  )
}

function MarketplacePurchasesPage() {
  const { t, navigate } = useApp()
  const { isAuthenticated, loading: authLoading, profile } = useUser()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      setLoading(false)
      navigate('/auth/signin?next=/marketplace/purchases')
      return
    }

    if (shouldUseDemoData(profile)) {
      ensureDemoSeedData()
      setPurchases(loadDemoMarketplacePurchasesList())
      setLoading(false)
      return
    }

    apiFetch('/api/marketplace/purchases')
      .then((d) => setPurchases(d.purchases ?? []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false))
  }, [authLoading, isAuthenticated, navigate, profile])

  return (
    <AppShell>
      <div className="container app-page">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/marketplace')} style={{ marginBottom: 20 }}>
          ← {t('mp.purchases.back')}
        </button>
        <header className="app-page-header">
          <h1>{t('mp.purchases.title')}</h1>
          <p className="app-page-header__lead">{t('mp.step3.desc')}</p>
        </header>

        {loading ? (
          <p className="mp-loading">{t('mp.loading')}</p>
        ) : purchases.length === 0 ? (
          <p className="mp-empty" style={{ padding: '32px 0' }}>
            {t('mp.purchases.empty')}
          </p>
        ) : (
          <div className="mp-purchases-list">
            {purchases.map((p) => (
              <PurchaseRow key={p.id} purchase={p} navigate={navigate} t={t} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

export { MarketplacePage }
