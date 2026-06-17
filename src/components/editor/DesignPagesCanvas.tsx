'use client'

import React, { useEffect, useRef } from 'react'
import { DesignPageFrame } from '@/components/editor/DesignPageFrame'
import { StitchPrototypeFrame } from '@/components/editor/StitchPrototypeFrame'
import { StitchDesignSystemFrame } from '@/components/editor/StitchDesignSystemFrame'
import { useApp } from '@/components/app/shell'
import type { DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import { pageHtmlPath } from '@/lib/design/pages'
import {
  canvasPrimaryPageId,
  isCanvasImagePage,
  isMockupCompanionCanvasPage,
  pageMockupPath,
  type DesignPageMeta,
  type DesignTokens,
  type DesignVariant,
} from '@/lib/design/types'
import type { WebStudioCanvasTool } from '@/components/editor/webStudio/WebStudioToolsRail'
import {
  expectedDesignPageImagePaths,
  shouldShowMockupAssetGradient,
} from '@/lib/design/designImagePaths'
import { isCanvasPreviewHtmlReady } from '@/lib/design/stitchParity'
import { useDesignFrameDrag } from '@/hooks/useDesignFrameDrag'
import type { useDesignCanvasViewport } from '@/hooks/useDesignCanvasViewport'
import type { PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'
import type { CanvasPin, CanvasPinKind } from '@/lib/visual-edit/canvasPins'

type ViewportState = ReturnType<typeof useDesignCanvasViewport>

type DesignPagesCanvasProps = {
  projectId: string
  pages: DesignPageMeta[]
  activePageId: string | null
  onSelectPage: (id: string) => void
  /** Clic en el marco sin arrastre (herramienta flecha). */
  onPageFrameClick?: (id: string) => void
  onFocusPage: (id: string) => void
  activeIframeRef?: React.RefObject<HTMLIFrameElement | null>
  onActiveIframeLoad?: () => void
  previewBreakpoint?: DesignPreviewBreakpoint
  frameComposer?: React.ReactNode
  onReimagine?: () => void
  onConvert?: () => void
  variants?: DesignVariant[]
  onApplyVariant?: (variantId: string) => void
  viewport: ViewportState
  bounds: { width: number; height: number }
  projectName?: string
  designTokens?: DesignTokens
  selectedPageIds?: Set<string>
  onPlayPrototype?: () => void
  canvasTool?: WebStudioCanvasTool
  connectLocked?: boolean
  onCommitPagePosition?: (pageId: string, x: number, y: number) => void | Promise<void>
  onFrameContextMenu?: (e: React.MouseEvent, page: DesignPageMeta) => void
  onPageNameClick?: (pageId: string) => void
  renamingPageId?: string | null
  renameDraft?: string
  onRenameDraftChange?: (value: string) => void
  onRenameSubmit?: (pageId: string) => void
  onRenameCancel?: () => void
  readyPreviewPaths?: Set<string>
  getCanvasHtmlContent?: (htmlPath: string) => string | null | undefined
  generating?: boolean
  /** Plan en curso: degradado en todas las pantallas sin ocultar el lienzo. */
  sitePlanning?: boolean
  /** Id de pantalla con generación HTML en curso (preview en iframe cuando hay fragmento real). */
  streamingPageId?: string | null
  pagePreviewStamps?: import('@/lib/design/pages').PagePreviewStamps
  canvasPins?: CanvasPin[]
  areaPinDraft?: (PinAreaPercent & { pageId: string; label?: string; kind?: CanvasPinKind }) | null
  onPagePinAreaSelected?: (pageId: string, area: PinAreaPercent) => void
  onPagePinAreaChange?: (pageId: string, pinId: string, area: PinAreaPercent) => void
  onPagePinEdit?: (pageId: string, pinId: string) => void
  onPagePinRemove?: (id: string) => void
  onPageContentHeightMeasured?: (pageId: string, height: number) => void
  /** Altura ya medida/persistida: evita parpadeo al refrescar el spec. */
  contentHeightHints?: Record<string, number>
}

export function DesignPagesCanvas({
  projectId,
  pages,
  activePageId,
  onSelectPage,
  onPageFrameClick,
  onFocusPage,
  activeIframeRef,
  onActiveIframeLoad,
  previewBreakpoint,
  frameComposer,
  onReimagine,
  onConvert,
  variants = [],
  onApplyVariant,
  viewport,
  bounds,
  projectName,
  designTokens,
  selectedPageIds,
  onPlayPrototype,
  canvasTool = 'select',
  connectLocked = false,
  onCommitPagePosition,
  onFrameContextMenu,
  onPageNameClick,
  renamingPageId = null,
  renameDraft = '',
  onRenameDraftChange,
  onRenameSubmit,
  onRenameCancel,
  readyPreviewPaths,
  getCanvasHtmlContent,
  generating = false,
  sitePlanning = false,
  streamingPageId = null,
  pagePreviewStamps = {},
  canvasPins = [],
  areaPinDraft = null,
  onPagePinAreaSelected,
  onPagePinAreaChange,
  onPagePinEdit,
  onPagePinRemove,
  onPageContentHeightMeasured,
  contentHeightHints,
}: DesignPagesCanvasProps) {
  const pinToolActive = canvasTool === 'rect'
  const pinCaptureTone: CanvasPinKind = 'area'
  const pagePinsEditable = !pinToolActive
  const { t } = useApp() as { t: (key: string) => string }
  const {
    viewportRef,
    worldRef,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = viewport
  const moveFrames = canvasTool === 'select'

  const frameDrag = useDesignFrameDrag({
    enabled: moveFrames,
    scale: viewport.scale,
    onSelectPage,
    onFrameClick: moveFrames ? onPageFrameClick : undefined,
    onCommitPosition: onCommitPagePosition ?? (() => {}),
  })

  useEffect(() => {
    frameDrag.clearOffsets()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset al refrescar páginas
  }, [pages.length, projectId])

  return (
    <div className="design-pages-canvas">
      <div
        ref={viewportRef}
        className="design-pages-canvas__viewport"
        data-canvas-pan
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={worldRef}
          className="design-pages-canvas__world"
          style={{
            width: bounds.width,
            height: bounds.height,
          }}
        >
          {pages.map((page) => {
            const isActive = activePageId === page.id
            const isVariant = page.id.startsWith('variant-')
            const variantId = isVariant ? page.id.replace('variant-', '') : null
            const pos = frameDrag.resolvePagePosition(page)
            const positionedPage = { ...page, x: pos.x, y: pos.y }
            const moveHandlers = moveFrames
              ? {
                  moveMode: true,
                  onMovePointerDown: (e: React.PointerEvent<HTMLDivElement>) =>
                    frameDrag.onFramePointerDown(page, e),
                  onMovePointerMove: frameDrag.onFramePointerMove,
                  onMovePointerUp: frameDrag.onFramePointerUp,
                }
              : {}

            if (page.frameType === 'prototype') {
              return (
                <StitchPrototypeFrame
                  key={page.id}
                  page={positionedPage}
                  selected={isActive}
                  projectName={projectName}
                  onSelect={() => onSelectPage(page.id)}
                  onDoubleClick={() => onFocusPage(page.id)}
                  onPlay={onPlayPrototype}
                  {...moveHandlers}
                />
              )
            }
            if (page.frameType === 'designSystem') {
              return (
                <StitchDesignSystemFrame
                  key={page.id}
                  page={positionedPage}
                  tokens={designTokens}
                  selected={isActive}
                  onSelect={() => onSelectPage(page.id)}
                  {...moveHandlers}
                />
              )
            }

            const codeSelected =
              selectedPageIds?.has(canvasPrimaryPageId(page.id)) &&
              !isMockupCompanionCanvasPage(page)
            const displayPage =
              codeSelected && page.frameType === 'screen'
                ? { ...positionedPage, name: page.name.startsWith('☑ ') ? page.name : `☑ ${page.name}` }
                : positionedPage
            const isImagePage = isCanvasImagePage(displayPage)
            const pageId = canvasPrimaryPageId(displayPage.id)
            const htmlPath = pageHtmlPath(pageId)
            const mockupPath = pageMockupPath(pageId)
            const htmlContent = getCanvasHtmlContent?.(htmlPath) ?? null
            const pathMarkedReady = Boolean(readyPreviewPaths?.has(htmlPath))
            const htmlReady =
              isCanvasPreviewHtmlReady(htmlContent) ||
              // Si el servidor ya marcó la ruta HTML como lista, debe mostrarse aunque sea corta.
              // Evita marcos en blanco para páginas recién creadas.
              pathMarkedReady
            const mockupReady = Boolean(
              readyPreviewPaths?.has(mockupPath) ||
                (displayPage.path.endsWith('.png') && readyPreviewPaths?.has(displayPage.path)),
            )
            const pageIsStreaming = Boolean(
              generating && streamingPageId && pageId === streamingPageId,
            )
            /** Aurora en pantallas del plan que aún no tienen HTML (no en la que se está generando). */
            const showPendingAurora = Boolean(
              generating &&
                !isImagePage &&
                !isVariant &&
                !htmlReady &&
                !pageIsStreaming,
            )
            const contentReady = isImagePage ? mockupReady : htmlReady
            const previewReady = contentReady
            const showLivePreview =
              isImagePage ||
              htmlReady ||
              mockupReady ||
              (pageIsStreaming && htmlReady)
            const framePlanning = Boolean(sitePlanning && generating && !isVariant)
            const frameBuilding = Boolean(
              framePlanning || showPendingAurora || (pageIsStreaming && !htmlReady),
            )
            const expectedImagePaths = !isImagePage
              ? expectedDesignPageImagePaths(getCanvasHtmlContent?.(htmlPath), htmlPath)
              : []
            const frameLoadingAssets = Boolean(
              showLivePreview &&
                htmlReady &&
                !isImagePage &&
                shouldShowMockupAssetGradient(expectedImagePaths, readyPreviewPaths, generating),
            )
            const stamps = pagePreviewStamps[pageId] ?? { html: 0, assets: 0 }
            const pinsForPage = canvasPins.filter(
              (p) => p.pageId === pageId || p.pageId === displayPage.id,
            )
            const draftForPage =
              areaPinDraft &&
              (areaPinDraft.pageId === pageId || areaPinDraft.pageId === displayPage.id)
                ? areaPinDraft
                : null

            return (
              <DesignPageFrame
                key={`${page.id}-${stamps.html}`}
                ref={isActive && !isVariant && !isImagePage ? activeIframeRef : undefined}
                projectId={projectId}
                page={displayPage}
                selected={isActive || Boolean(codeSelected)}
                live={showLivePreview}
                previewReady={previewReady}
                htmlReady={htmlReady}
                pendingAurora={showPendingAurora}
                building={frameBuilding}
                loadingAssets={frameLoadingAssets}
                iframeKey={stamps.html}
                previewAssetStamp={stamps.assets}
                variantBadge={isVariant ? t('ed.design.variantBadge') : undefined}
                previewBreakpoint={isActive ? previewBreakpoint : undefined}
                onSelect={() => {
                  onSelectPage(page.id)
                  if (!moveFrames) onPageFrameClick?.(page.id)
                }}
                onDoubleClick={() => onFocusPage(page.id)}
                onIframeLoad={isActive && !isVariant ? onActiveIframeLoad : undefined}
                onReimagine={isActive && !isVariant ? onReimagine : undefined}
                onBuild={isActive && !isVariant ? onConvert : undefined}
                onPreview={
                  isActive && !isVariant
                    ? () =>
                        window.open(
                          `/api/projects/${projectId}/design/preview?page=${encodeURIComponent(pageId)}`,
                          '_blank',
                        )
                    : undefined
                }
                onApplyVariant={
                  isVariant && variantId && onApplyVariant
                    ? () => onApplyVariant(variantId)
                    : undefined
                }
                composer={isActive && !isVariant ? frameComposer : undefined}
                connectTargetMode={canvasTool === 'connect' && connectLocked}
                onConnectTargetClick={() => onPageFrameClick?.(page.id)}
                onFrameContextMenu={onFrameContextMenu}
                onPageNameClick={onPageNameClick ? () => onPageNameClick(page.id) : undefined}
                renaming={renamingPageId === page.id}
                renameDraft={renameDraft}
                onRenameDraftChange={onRenameDraftChange}
                onRenameSubmit={onRenameSubmit ? () => onRenameSubmit(page.id) : undefined}
                onRenameCancel={onRenameCancel}
                pagePins={pinsForPage}
                pagePinDraft={draftForPage}
                pagePinDraftLabel={draftForPage?.label}
                pagePinDraftTone={areaPinDraft?.kind ?? pinCaptureTone}
                pagePinCaptureTone={pinCaptureTone}
                pagePinsEditable={pagePinsEditable}
                pagePinCapture={pinToolActive && !areaPinDraft && showLivePreview}
                onPagePinAreaChange={
                  onPagePinAreaChange
                    ? (pinId, area) => onPagePinAreaChange(pageId, pinId, area)
                    : undefined
                }
                onPagePinEdit={
                  onPagePinEdit ? (pinId) => onPagePinEdit(pageId, pinId) : undefined
                }
                onPagePinAreaSelected={
                  onPagePinAreaSelected
                    ? (area) => onPagePinAreaSelected(pageId, area)
                    : undefined
                }
                onPagePinRemove={onPagePinRemove}
                placedPinsHostedOnCanvas
                onContentHeightMeasured={onPageContentHeightMeasured}
                contentHeightHint={contentHeightHints?.[page.id]}
                {...moveHandlers}
              />
            )
          })}
        </div>
      </div>
      {variants.length > 0 ? (
        <p className="design-pages-canvas__variants-hint">{t('ed.design.variantsOnCanvas')}</p>
      ) : null}
    </div>
  )
}
