'use client'

import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { DesignFrameLoadingGradient } from '@/components/editor/DesignFrameLoadingGradient'
import { DesignStitchCursorOverlay } from '@/components/editor/DesignStitchCursorOverlay'
import { canvasFrameHeight } from '@/lib/design/canvasFrame'
import {
  clampPageHeight,
  contentBoundedPageHeight,
  measureDocumentContentHeight,
  resolvePageCanvasHeight,
} from '@/lib/design/pageHeight'
import type { DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import { canvasPrimaryPageId, type DesignPageMeta } from '@/lib/design/types'
import { DesignPagePinLayer } from '@/components/editor/DesignPagePinLayer'
import type { PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPin, CanvasPinKind } from '@/lib/visual-edit/canvasPins'

type DesignPageFrameProps = {
  projectId: string
  page: DesignPageMeta
  selected?: boolean
  live?: boolean
  previewReady?: boolean
  /** HTML de la pantalla persistido (mostrar iframe aunque sigan generándose imágenes). */
  htmlReady?: boolean
  variantBadge?: string
  building?: boolean
  /** Degradado aurora en el marco (pantallas del plan aún sin HTML; sin iframe). */
  pendingAurora?: boolean
  /** HTML listo pero siguen generándose assets (imágenes) en el iframe. */
  loadingAssets?: boolean
  previewBreakpoint?: DesignPreviewBreakpoint
  onSelect?: () => void
  onDoubleClick?: () => void
  onReimagine?: () => void
  onBuild?: () => void
  onPreview?: () => void
  onApplyVariant?: () => void
  iframeKey?: number
  previewAssetStamp?: number
  onIframeLoad?: () => void
  composer?: React.ReactNode
  moveMode?: boolean
  onMovePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onMovePointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onMovePointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
  onFrameContextMenu?: (e: React.MouseEvent, page: DesignPageMeta) => void
  onPageNameClick?: (page: DesignPageMeta) => void
  renaming?: boolean
  renameDraft?: string
  onRenameDraftChange?: (value: string) => void
  onRenameSubmit?: () => void
  onRenameCancel?: () => void
  connectTargetMode?: boolean
  onConnectTargetClick?: () => void
  pagePins?: CanvasPin[]
  pagePinDraft?: PinAreaPercent | null
  pagePinDraftLabel?: string
  pagePinDraftTone?: CanvasPinKind
  pagePinCaptureTone?: CanvasPinKind
  pagePinsEditable?: boolean
  pagePinCapture?: boolean
  onPagePinAreaChange?: (id: string, area: PinAreaPercent) => void
  onPagePinEdit?: (pinId: string) => void
  onPagePinAreaSelected?: (area: PinAreaPercent) => void
  onPagePinRemove?: (id: string) => void
  placedPinsHostedOnCanvas?: boolean
  onContentHeightMeasured?: (pageId: string, height: number) => void
  /** Altura estable del lienzo (evita encoger el marco tras refresh del spec). */
  contentHeightHint?: number
}

export const DesignPageFrame = forwardRef<HTMLIFrameElement | null, DesignPageFrameProps>(
  function DesignPageFrame(
    {
      projectId,
      page,
      selected,
      live = false,
      previewReady = true,
      htmlReady = false,
      variantBadge,
      building,
      pendingAurora = false,
      loadingAssets = false,
      previewBreakpoint,
      onSelect,
      onDoubleClick,
      onReimagine,
      onBuild,
      onPreview,
      onApplyVariant,
      iframeKey = 0,
      previewAssetStamp = 0,
      onIframeLoad,
      composer,
      moveMode = false,
      onMovePointerDown,
      onMovePointerMove,
      onMovePointerUp,
      onFrameContextMenu,
      onPageNameClick,
      renaming = false,
      renameDraft = '',
      onRenameDraftChange,
      onRenameSubmit,
      onRenameCancel,
      connectTargetMode = false,
      onConnectTargetClick,
      pagePins = [],
      pagePinDraft = null,
      pagePinDraftLabel,
      pagePinDraftTone = 'area',
      pagePinCaptureTone = 'area',
      pagePinsEditable = false,
      pagePinCapture = false,
      onPagePinAreaChange,
      onPagePinEdit,
      onPagePinAreaSelected,
      onPagePinRemove,
      placedPinsHostedOnCanvas = false,
      onContentHeightMeasured,
      contentHeightHint,
    },
    ref,
  ) {
    const { t } = useApp() as { t: (key: string) => string }
    const previewStageRef = useRef<HTMLDivElement>(null)
    const w = page.width ?? 390
    const frameH = canvasFrameHeight(page)
    const isImagePage = page.media === 'image' || page.path.endsWith('.png')
    const imageMockupLive = isImagePage && live
    const hasHtml = Boolean(htmlReady || (previewReady && !isImagePage))
    const showPendingAurora = Boolean(pendingAurora && building && !hasHtml)
    const showCreating = Boolean(showPendingAurora || (live && building && !hasHtml))
    const showImage = Boolean(isImagePage && live && !showCreating)
    const showIframe = Boolean(live && !isImagePage && !showPendingAurora)
    const [previewIframeLoaded, setPreviewIframeLoaded] = useState(false)

    /** Solo antes del primer paint del iframe; luego el HTML en construcción queda visible. */
    const showInitialBuildingOverlay = Boolean(
      showIframe && building && !previewIframeLoaded,
    )
    const showCursorOverlay = Boolean(showIframe && building && hasHtml)
    const chromeExtra = composer ? 88 : imageMockupLive ? 0 : 36
    const labelExtra = imageMockupLive ? 24 : 0

    const innerIframeRef = useRef<HTMLIFrameElement | null>(null)
    const lastReportedHeightRef = useRef(0)
    const [measuredHeight, setMeasuredHeight] = useState<number | null>(
      contentHeightHint && contentHeightHint > 0 ? contentHeightHint : null,
    )
    const [imageFailed, setImageFailed] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)

    const setIframeRef = useCallback(
      (el: HTMLIFrameElement | null) => {
        innerIframeRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      },
      [ref],
    )

    const reloadAssetsInIframe = useCallback((stamp: number) => {
      if (stamp <= 0) return
      innerIframeRef.current?.contentWindow?.postMessage(
        { type: 'runlabs42-reload-design-assets', k: stamp },
        '*',
      )
    }, [])

    useEffect(() => {
      setImageFailed(false)
      setImageLoaded(false)
      setPreviewIframeLoaded(false)
    }, [page.path, page.id, iframeKey, w, previewBreakpoint])

    useEffect(() => {
      const seed =
        contentHeightHint && contentHeightHint > 0 ? contentHeightHint : null
      setMeasuredHeight(seed)
      lastReportedHeightRef.current = seed ?? 0
    }, [page.path, page.id, iframeKey, w, previewBreakpoint])

    useEffect(() => {
      if (!contentHeightHint || contentHeightHint <= 0) return
      setMeasuredHeight((prev) =>
        prev == null || contentHeightHint > prev + 32 ? contentHeightHint : prev,
      )
      lastReportedHeightRef.current = Math.max(
        lastReportedHeightRef.current,
        contentHeightHint,
      )
    }, [contentHeightHint])

    useEffect(() => {
      if (!showIframe || previewAssetStamp <= 0) return
      reloadAssetsInIframe(previewAssetStamp)
    }, [previewAssetStamp, showIframe, reloadAssetsInIframe])

    const specFrameHeight = resolvePageCanvasHeight(page)
    const viewportFrameHeight = contentBoundedPageHeight(specFrameHeight, measuredHeight)
    const displayContentHeight = viewportFrameHeight

    const measureIframeContent = useCallback(() => {
      if (isImagePage || !showIframe) return
      const doc = innerIframeRef.current?.contentDocument
      if (!doc) return
      const h = measureDocumentContentHeight(doc)
      if (h < 120) return
      const clamped = clampPageHeight(h)
      const floor =
        contentHeightHint && contentHeightHint > 0 ? contentHeightHint : 0
      const nextH = floor > 0 ? Math.max(clamped, floor) : clamped
      setMeasuredHeight(nextH)
      const reportH = nextH
      if (Math.abs(reportH - lastReportedHeightRef.current) > 48) {
        lastReportedHeightRef.current = reportH
        onContentHeightMeasured?.(page.id, reportH)
      }
    }, [isImagePage, showIframe, page.id, onContentHeightMeasured, contentHeightHint])

    useEffect(() => {
      if (isImagePage || !showIframe) return
      const doc = innerIframeRef.current?.contentDocument
      const body = doc?.body
      if (!body || typeof ResizeObserver === 'undefined') return
      const ro = new ResizeObserver(() => measureIframeContent())
      ro.observe(body)
      for (const child of Array.from(body.children)) {
        if (child instanceof HTMLElement) ro.observe(child)
      }
      return () => ro.disconnect()
    }, [isImagePage, showIframe, measureIframeContent, iframeKey, page.path])

    const onImageLoad = useCallback(
      (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget
        if (img.naturalWidth > 0) {
          setMeasuredHeight(Math.round((img.naturalHeight / img.naturalWidth) * w))
        }
        setImageFailed(false)
        setImageLoaded(true)
        onIframeLoad?.()
      },
      [w, onIframeLoad],
    )

    const onImageError = useCallback(() => {
      setImageFailed(true)
      setImageLoaded(false)
      setMeasuredHeight(null)
    }, [])

    const previewPageId = canvasPrimaryPageId(page.id)
    const src = isImagePage
      ? `/api/projects/${projectId}/design/preview/file/${page.path}?k=${iframeKey}`
      : `/api/projects/${projectId}/design/preview?page=${encodeURIComponent(previewPageId)}&k=${iframeKey}&reveal=1&cursor=${showCursorOverlay || !building ? '0' : '1'}`

    const buildingAriaLabel =
      building || !previewReady || imageFailed
        ? `${page.name} — ${t('ed.design.building')}`
        : page.name

    const onPreviewIframeLoad = useCallback(() => {
      setPreviewIframeLoaded(true)
      if (previewAssetStamp > 0) reloadAssetsInIframe(previewAssetStamp)
      onIframeLoad?.()
      measureIframeContent()
      window.requestAnimationFrame(() => measureIframeContent())
      window.setTimeout(() => measureIframeContent(), 450)
    }, [previewAssetStamp, reloadAssetsInIframe, onIframeLoad, measureIframeContent])

    return (
      <div
        className={`design-page-frame${selected ? ' is-selected' : ''}${live ? ' is-live' : ''}${showCreating ? ' is-building' : ''}${moveMode ? ' design-page-frame--move' : ''}${imageMockupLive ? ' design-page-frame--image-mockup' : ''}`}
        data-page-id={page.id}
        style={{
          left: page.x ?? 0,
          top: page.y ?? 0,
          width: w,
          height: imageMockupLive
            ? (showCreating ? frameH : labelExtra + displayContentHeight)
            : showCreating && !showIframe
              ? viewportFrameHeight + (imageMockupLive ? labelExtra : 0)
              : displayContentHeight + chromeExtra + labelExtra,
        }}
        onPointerDownCapture={(e) => {
          if (!connectTargetMode) return
          e.preventDefault()
          e.stopPropagation()
          onSelect?.()
          onConnectTargetClick?.()
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.()
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onDoubleClick?.()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onFrameContextMenu?.(e, page)
        }}
        onPointerDown={onMovePointerDown}
        onPointerMove={onMovePointerMove}
        onPointerUp={onMovePointerUp}
        onPointerCancel={onMovePointerUp}
      >
        <div className="design-page-frame__chrome">
          {imageMockupLive ? (
            renaming ? (
              <input
                type="text"
                className="design-page-frame__name-input design-page-frame__name-input--artboard"
                value={renameDraft}
                autoFocus
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onRenameDraftChange?.(e.target.value)}
                onBlur={() => onRenameSubmit?.()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    onRenameCancel?.()
                  }
                }}
              />
            ) : (
              <span
                className="design-page-frame__artboard-label"
                onPointerDown={(e) => {
                  if (!onPageNameClick) return
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  if (!onPageNameClick) return
                  e.preventDefault()
                  e.stopPropagation()
                  onPageNameClick(page)
                }}
              >
                {page.name}
              </span>
            )
          ) : (
            <>
              {renaming ? (
                <input
                  type="text"
                  className="design-page-frame__name-input"
                  value={renameDraft}
                  autoFocus
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onRenameDraftChange?.(e.target.value)}
                  onBlur={() => onRenameSubmit?.()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.currentTarget.blur()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      onRenameCancel?.()
                    }
                  }}
                />
              ) : (
                <span
                  className="design-page-frame__label"
                  onPointerDown={(e) => {
                    if (!onPageNameClick) return
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    if (!onPageNameClick) return
                    e.preventDefault()
                    e.stopPropagation()
                    onPageNameClick(page)
                  }}
                >
                  {showCreating ? t('ed.design.generatingScreen') : page.name}
                </span>
              )}
              <div className="design-page-frame__chrome-end">
                {variantBadge ? (
                  <span className="design-page-frame__badge design-page-frame__badge--variant">{variantBadge}</span>
                ) : null}
                {previewBreakpoint && onPageNameClick ? (
                  <button
                    type="button"
                    className="design-page-frame__action"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPageNameClick(page)
                    }}
                  >
                    {t('ed.design.canvasMenu.renamePage')}
                  </button>
                ) : null}
                {live && !showCreating && !building ? (
                  <div className="design-page-frame__actions">
                    {onReimagine ? (
                      <button
                        type="button"
                        className="design-page-frame__action"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReimagine()
                        }}
                      >
                        {t('ed.design.reimagine')}
                      </button>
                    ) : null}
                    {onBuild ? (
                      <button
                        type="button"
                        className="design-page-frame__action design-page-frame__action--primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          onBuild()
                        }}
                      >
                        {t('ed.design.buildBtn')}
                      </button>
                    ) : null}
                    {onPreview ? (
                      <button
                        type="button"
                        className="design-page-frame__action"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPreview()
                        }}
                      >
                        {t('ed.design.previewBtn')}
                      </button>
                    ) : null}
                    {onApplyVariant ? (
                      <button
                        type="button"
                        className="design-page-frame__action design-page-frame__action--primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          onApplyVariant()
                        }}
                      >
                        {t('ed.design.applyVariant')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {showCreating && !showIframe && !showImage ? (
          <div
            className="design-page-frame__device design-page-frame__building"
            style={{ height: viewportFrameHeight }}
            aria-busy="true"
            aria-label={buildingAriaLabel}
          >
            <DesignFrameLoadingGradient variant="full" showCursor={false} />
          </div>
        ) : null}

        {showImage ? (
          <div ref={previewStageRef} className="design-page-frame__image-stage">
            {!imageLoaded && !imageFailed ? (
              <div className="design-page-frame__building design-page-frame__building--overlay" aria-hidden="true">
                <DesignFrameLoadingGradient variant="mockupOverlay" />
              </div>
            ) : null}
            <img
              className={`design-page-frame__image-mockup${imageLoaded ? ' is-loaded' : ''}`}
              src={src}
              alt={page.name}
              onLoad={onImageLoad}
              onError={onImageError}
            />
            <DesignPagePinLayer
              stageRef={previewStageRef}
              captureActive={pagePinCapture}
              pins={pagePins}
              draft={pagePinDraft}
              draftLabel={pagePinDraftLabel}
              draftTone={pagePinDraftTone}
              pinCaptureTone={pagePinCaptureTone}
              pinsEditable={pagePinsEditable}
              onPinAreaChange={onPagePinAreaChange}
              onPinEdit={onPagePinEdit}
              onAreaSelected={onPagePinAreaSelected}
              onRemovePin={onPagePinRemove}
              placedPinsHostedOnCanvas={placedPinsHostedOnCanvas}
            />
          </div>
        ) : null}

        {showIframe ? (
          <div ref={previewStageRef} className="design-page-frame__preview">
            {showInitialBuildingOverlay ? (
              <div
                className="design-page-frame__building design-page-frame__building--overlay design-page-frame__building--initial"
                aria-busy="true"
                aria-label={buildingAriaLabel}
              >
                <DesignFrameLoadingGradient variant="full" showCursor={false} />
              </div>
            ) : null}
            <iframe
              key={`${previewPageId}-${iframeKey}`}
              ref={setIframeRef}
              className="design-page-frame__iframe"
              title={page.name}
              src={src}
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
              style={{ height: displayContentHeight }}
              onLoad={onPreviewIframeLoad}
            />
            <DesignStitchCursorOverlay
              active={showCursorOverlay}
              iframeRef={innerIframeRef}
              stageRef={previewStageRef}
            />
            <DesignPagePinLayer
              stageRef={previewStageRef}
              captureActive={pagePinCapture}
              pins={pagePins}
              draft={pagePinDraft}
              draftLabel={pagePinDraftLabel}
              draftTone={pagePinDraftTone}
              pinCaptureTone={pagePinCaptureTone}
              pinsEditable={pagePinsEditable}
              onPinAreaChange={onPagePinAreaChange}
              onPinEdit={onPagePinEdit}
              onAreaSelected={onPagePinAreaSelected}
              onRemovePin={onPagePinRemove}
              placedPinsHostedOnCanvas={placedPinsHostedOnCanvas}
            />
          </div>
        ) : null}

        {connectTargetMode ? (
          <button
            type="button"
            className="design-page-frame__connect-target"
            aria-label={t('ed.design.toolConnect')}
            onClick={(e) => {
              e.stopPropagation()
              onSelect?.()
              onConnectTargetClick?.()
            }}
          />
        ) : null}

        {composer ? <div className="design-page-frame__composer">{composer}</div> : null}
      </div>
    )
  },
)
