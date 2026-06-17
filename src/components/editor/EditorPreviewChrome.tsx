'use client'

import React from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { EditableProjectName } from '@/components/editor/EditableProjectName'

type WorkspaceView = 'preview' | 'panel'

type EditorPreviewChromeProps = {
  view?: WorkspaceView
  onViewChange?: (view: WorkspaceView) => void
  pageTitle?: string
  onPageTitleChange?: (name: string) => void | Promise<void>
  pageMeta?: string
  viewport: 'sm' | 'md' | 'lg'
  onViewportChange: (v: 'sm' | 'md' | 'lg') => void
  onRefresh?: () => void
  /** Si false, el botón de actualizar se muestra deshabilitado. */
  canRefresh?: boolean
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  /** Oculta pestañas Vista previa / Panel cuando el workspace ya tiene sus propias tabs. */
  hideViewTabs?: boolean
  /** Oculta título/meta (p. ej. cuando van en la barra superior del workspace). */
  showPageTitle?: boolean
  onCapture?: () => void
  /** Si false, el botón de captura se muestra deshabilitado. */
  canCapture?: boolean
  capturing?: boolean
  /** Controles integrados en la barra superior del workspace (misma fila que tabs y acciones). */
  placement?: 'canvas' | 'toolbar'
  /** Avisos (p. ej. Guardado) al inicio del grupo de iconos del preview. */
  noticeSlot?: React.ReactNode
  /** Botones Guardar / Descargar / Desplegar en la zona derecha de la barra. */
  actionsSlot?: React.ReactNode
  focusMode?: boolean
  onToggleFocusMode?: () => void
  /** Si false, el botón de modo foco se muestra deshabilitado. */
  canFocus?: boolean
  /** `design`: barra con refresh, dispositivo, historial y acciones del workspace. */
  variant?: 'preview' | 'design'
  /** Toggle PC / tablet / móvil (variant design). */
  designDeviceSlot?: React.ReactNode
}

function EditorPreviewChromeInner({
  view = 'preview',
  onViewChange,
  pageTitle,
  onPageTitleChange,
  pageMeta,
  viewport,
  onViewportChange,
  onRefresh,
  canRefresh = true,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  hideViewTabs = false,
  showPageTitle = true,
  onCapture,
  canCapture = true,
  capturing = false,
  placement = 'canvas',
  noticeSlot,
  actionsSlot,
  focusMode = false,
  onToggleFocusMode,
  canFocus = true,
  variant = 'preview',
  designDeviceSlot,
}: EditorPreviewChromeProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const isDesignChrome = variant === 'design'

  const start = (
    <>
      {hideViewTabs && showPageTitle && pageTitle ? (
        <div className="editor-chrome-page">
          {onPageTitleChange ? (
            <EditableProjectName
              value={pageTitle}
              onSave={onPageTitleChange}
              className="editor-chrome-page-title"
              as="h2"
            />
          ) : (
            <span className="editor-chrome-page-title">{pageTitle}</span>
          )}
          {pageMeta ? <span className="editor-chrome-page-meta">{pageMeta}</span> : null}
        </div>
      ) : null}
      {!hideViewTabs && onViewChange ? (
        <div className="editor-view-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'preview'}
            className={`editor-view-tab${view === 'preview' ? ' is-active' : ''}`}
            onClick={() => onViewChange('preview')}
          >
            {t('ed.previewView')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'panel'}
            className={`editor-view-tab${view === 'panel' ? ' is-active' : ''}`}
            onClick={() => onViewChange('panel')}
          >
            {t('ed.panel')}
          </button>
        </div>
      ) : null}
    </>
  )

  const viewportPresets: {
    id: 'sm' | 'md' | 'lg'
    Glyph: typeof Icon.Monitor
    labelKey: string
  }[] = [
    { id: 'lg', Glyph: Icon.Monitor, labelKey: 'ed.viewport.desktop' },
    { id: 'md', Glyph: Icon.Tablet, labelKey: 'ed.viewport.tablet' },
    { id: 'sm', Glyph: Icon.Mobile, labelKey: 'ed.viewport.mobile' },
  ]

  const viewportGroup = (
    <div className="editor-viewport-group" role="group" aria-label={t('ed.viewport')}>
      {viewportPresets.map(({ id, Glyph, labelKey }) => (
        <button
          key={id}
          type="button"
          className={`editor-viewport-btn${viewport === id ? ' is-active' : ''}`}
          onClick={() => onViewportChange(id)}
          aria-pressed={viewport === id}
          title={t(labelKey)}
          aria-label={t(labelKey)}
        >
          <Glyph />
        </button>
      ))}
    </div>
  )

  const refreshBtn = onRefresh ? (
    <div className="editor-chrome-group editor-chrome-group--history" role="group" aria-label={t('ed.refresh')}>
      <button
        type="button"
        className={`editor-icon-btn editor-icon-btn--history${canRefresh ? '' : ' is-disabled'}`}
        onClick={onRefresh}
        disabled={!canRefresh}
        aria-label={t('ed.refresh')}
        title={t('ed.refresh')}
      >
        <Icon.RefreshCw />
      </button>
    </div>
  ) : null

  const focusBtn = onToggleFocusMode ? (
    <div className="editor-chrome-group editor-chrome-group--history">
      <button
        type="button"
        className={`editor-icon-btn editor-icon-btn--history editor-focus-toggle${focusMode ? ' is-active' : ''}${canFocus ? '' : ' is-disabled'}`}
        onClick={onToggleFocusMode}
        disabled={!canFocus}
        title={focusMode ? t('ed.focusMode.off') : t('ed.focusMode.on')}
        aria-label={focusMode ? t('ed.focusMode.off') : t('ed.focusMode.on')}
        aria-pressed={focusMode}
      >
        {focusMode ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M9 3H5a2 2 0 0 0-2 2v4M21 15v4a2 2 0 0 1-2 2h-4M15 3h6v6M3 15v6h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  ) : null

  const captureBtn = onCapture ? (
    <div className="editor-chrome-group editor-chrome-group--history">
      <button
        type="button"
        className={`editor-capture-btn${capturing ? ' is-busy' : ''}${canCapture && !capturing ? '' : ' is-disabled'}`}
        onClick={onCapture}
        disabled={!canCapture || capturing}
        aria-label={capturing ? t('ed.capturing') : t('ed.captureSnapshot')}
        title={capturing ? t('ed.capturing') : t('ed.captureSnapshot')}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
    </div>
  ) : null

  const historyGroup = (
    <div className="editor-chrome-group editor-chrome-group--history" role="group" aria-label={t('ed.undo')}>
      <button
        type="button"
        className={`editor-icon-btn editor-icon-btn--history${canUndo ? '' : ' is-disabled'}`}
        aria-label={t('ed.undo')}
        title={t('ed.undo')}
        disabled={!canUndo}
        onClick={() => onUndo?.()}
      >
        <Icon.Undo />
      </button>
      <button
        type="button"
        className={`editor-icon-btn editor-icon-btn--history${canRedo ? '' : ' is-disabled'}`}
        aria-label={t('ed.redo')}
        title={t('ed.redo')}
        disabled={!canRedo}
        onClick={() => onRedo?.()}
      >
        <Icon.Redo />
      </button>
    </div>
  )

  const chromeNoTitle = hideViewTabs && !showPageTitle

  const previewToolCluster = (
    <div className="editor-toolbar-preview-cluster">
      {refreshBtn}
      {onRefresh ? <span className="editor-toolbar-preview-divider" aria-hidden /> : null}
      {viewportGroup}
      <span className="editor-toolbar-preview-divider" aria-hidden />
      <div className="editor-toolbar-preview-tools">
        {focusBtn}
        {captureBtn}
        {historyGroup}
      </div>
    </div>
  )

  const designToolCluster = (
    <div className="editor-toolbar-preview-cluster editor-toolbar-preview-cluster--design">
      {refreshBtn}
      {designDeviceSlot ? (
        <>
          <span className="editor-toolbar-preview-divider" aria-hidden />
          {designDeviceSlot}
        </>
      ) : null}
      <span className="editor-toolbar-preview-divider" aria-hidden />
      {historyGroup}
      {noticeSlot ? (
        <>
          <span className="editor-toolbar-preview-divider" aria-hidden />
          <div className="editor-chrome-notices editor-chrome-notices--design">{noticeSlot}</div>
        </>
      ) : null}
    </div>
  )

  if (placement === 'toolbar') {
    return (
      <>
        <div className="editor-toolbar-chrome-preview-slot">
          {isDesignChrome ? designToolCluster : previewToolCluster}
        </div>
        <div
          className={`editor-toolbar-chrome-end-slot${isDesignChrome ? ' editor-toolbar-chrome-end-slot--design' : ''}`}
        >
          {!isDesignChrome && noticeSlot ? (
            <div className="editor-chrome-notices">{noticeSlot}</div>
          ) : null}
          {actionsSlot}
        </div>
      </>
    )
  }

  const center = (
    <>
      {previewToolCluster}
      {noticeSlot ? <div className="editor-chrome-notices">{noticeSlot}</div> : null}
    </>
  )

  return (
    <header className={`editor-canvas-chrome${chromeNoTitle ? ' editor-canvas-chrome--no-title' : ''}`}>
      {!chromeNoTitle ? <div className="editor-canvas-chrome-start">{start}</div> : null}
      <div className="editor-canvas-chrome-center">{center}</div>
    </header>
  )
}

export const EditorPreviewChrome = React.memo(EditorPreviewChromeInner)
