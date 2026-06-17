'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { apiFetch } from '@/lib/api/client'
import { isDemoActive, isDemoProjectId, loadDemoIntegrationStatus, updateDemoProject } from '@/lib/auth/demo'
import { projectFileContentUrl } from '@/lib/projects/projectFilesApi'
import { DesignPagesCanvas } from '@/components/editor/DesignPagesCanvas'
import type {
  AgentActivityPhase,
  DesignAgentLogEntry,
  DesignAgentPhaseBlock,
} from '@/components/editor/DesignAgentLog'
import { WebStudioActivityPanel } from '@/components/editor/webStudio/WebStudioActivityPanel'
import { WebStudioZoomControl } from '@/components/editor/webStudio/WebStudioZoomControl'
import {
  WebStudioPromptBar,
  type WebStudioPromptBarHandle,
} from '@/components/editor/webStudio/WebStudioPromptBar'
import { WebStudioElementPanel } from '@/components/editor/webStudio/WebStudioElementPanel'
import { WebStudioThemePanel } from '@/components/editor/webStudio/WebStudioThemePanel'
import { useVisualEdit } from '@/hooks/useVisualEdit'
import type { ElementDescriptor, VisualEditMode, VisualPatch } from '@/lib/visual-edit/protocol'
import {
  VISUAL_EDIT_CHANNEL,
  isMessageFromPreviewIframe,
  isVisualEditMessage,
  postToBridge,
} from '@/lib/visual-edit/protocol'
import {
  WebStudioToolsRail,
  type WebStudioCanvasTool,
} from '@/components/editor/webStudio/WebStudioToolsRail'
import { StitchPrototypePlayer } from '@/components/editor/StitchPrototypePlayer'
import {
  pinFromElement,
  elementPinKey,
  nextElementPinLabel,
  normalizePageDisplayName,
  pagePinKey,
  pagePinsFromSelectedPageIds,
  toIterateElementContext,
  type DesignElementContextPin,
  type DesignPageContextPin,
} from '@/lib/design/elementContext'
import {
  autoLayoutPages,
  expandCanvasPagesWithMockupFrames,
  mergePagesIntoSpec,
  pageHtmlPath,
  pageMockupPath,
  parseDesignSpec,
  resolveDesignPages,
  type PagePreviewStamps,
  bumpPagePreviewStampsForPageIds,
  bumpPagePreviewStampsFromPaths,
} from '@/lib/design/pages'
import { applyDevicePresetToDesignFiles } from '@/lib/design/applyDevicePreset'
import {
  canvasPrimaryPageId,
  designSpecPageId,
  isCanvasImagePage,
  isDesignCanvasFilePath,
  isMockupCompanionCanvasPage,
  type DesignPageMeta,
  type DesignTokens,
} from '@/lib/design/types'
import {
  DESIGN_CANVAS_DEFAULT_ZOOM_PERCENT,
  useDesignCanvasViewport,
} from '@/hooks/useDesignCanvasViewport'
import { useDesignElementEditor } from '@/hooks/useDesignElementEditor'
import { useCanvasPinOverlayRects } from '@/hooks/useCanvasPinOverlayRects'
import { useElementPinOverlayRects } from '@/hooks/useElementPinOverlayRects'
import { useIframeOverlayRect } from '@/hooks/useIframeOverlayRect'
import { ElementTextEditOverlay } from '@/components/editor/ElementTextEditOverlay'
import {
  DESIGN_BREAKPOINT_PRESETS,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'
import {
  buildGeneratingPlaceholderPage,
  isGeneratingPlaceholderPage,
} from '@/lib/design/generatingPlaceholder'
import {
  canClearStreamCanvasOverlay,
  mergeStreamCanvasOverlayPages,
  resolveDesignCanvasPages,
} from '@/lib/design/canvasPages'
import { canvasFrameHeight, CANVAS_FRAME_VIEWPORT_MAX } from '@/lib/design/canvasFrame'
import {
  DESIGN_SYSTEM_PAGE_ID,
  nextLinkId,
  PROTOTYPE_PAGE_ID,
} from '@/lib/design/prototypePages'
import type { DesignVariant, PrototypeLink } from '@/lib/design/types'
import { envelopeFromDesignMd } from '@/lib/design/designMd'
import {
  parseTokensJsonEnvelope,
  specTokensFromEnvelope,
} from '@/lib/design/normalizeDesignTokens'
import { ensureDesignTokens } from '@/lib/design/themeTokens'
import { isDesignPreviewPlaceholderHtml } from '@/lib/design/isDesignPreviewPlaceholderHtml'
import { isOrchestrationPlaceholderHtml } from '@/lib/design/orchestrationFallbackHtml'
import { DESIGN_TOKENS_PATH } from '@/lib/design/orchestrationParse'
import {
  orchestrationPhaseGroup,
  preferCompactOrchestrationPhases,
} from '@/lib/design/orchestrationPhases'
import { DESIGN_SPEC_JSON, isImageMockupPath } from '@/lib/design/types'
import { DESIGN_SPEC_MD } from '@/lib/design/types'
import type { NodeInsertedPayload } from '@/lib/visual-edit/protocol'
import { insertNodeToSource } from '@/lib/visual-edit/insertNodeToSource'
import {
  copyOrDownloadPagePng,
  designPagePngFileName,
} from '@/lib/design/copyDesignPagePng.client'
import {
  designPageAssetPaths,
  imageExtensionFromMime,
  isVisualEditImageElement,
  readImageFileAsDataUrl,
} from '@/lib/design/replaceDesignImageAsset.client'
import { WebStudioFigmaImportDialog } from '@/components/editor/webStudio/WebStudioFigmaImportDialog'
import { WebStudioFigmaExportDialog } from '@/components/editor/webStudio/WebStudioFigmaExportDialog'
import { WebStudioClarifyDialog } from '@/components/editor/webStudio/WebStudioClarifyDialog'
import { fetchDesignClarify } from '@/lib/design/designClarify.client'
import {
  formatClarificationPromptBlock,
  type DesignClarifyAnswer,
  type DesignClarifyQuestion,
} from '@/lib/design/designClarify'
import { consumeDesignConvertStream } from '@/lib/ai/designStream'
import { consumeDesignGenerateStream } from '@/lib/ai/designGenerateStream'
import {
  formatDesignActivityMessage,
  stripDesignLogParentheticals,
  humanizeDesignPageId,
} from '@/lib/design/activityLog'
import type { DesignBrief } from '@/lib/design/designBrief'
import { inferDesignBriefFromPrompt, mergeDesignBrief } from '@/lib/design/designBrief'
import type { DesignGenerateImagePayload } from '@/lib/design/designReferenceImages.client'
import { promptImpliesVisualReference } from '@/lib/design/designReferenceIntent'
import { consumeStudioReplaceDesign } from '@/lib/projects/openStudio'
import {
  DesignCanvasContextMenu,
  isDesignCanvasBackgroundTarget,
  type DesignCanvasContextMenuAction,
  type DesignCanvasContextMenuState,
} from '@/components/editor/DesignCanvasContextMenu'
import { WebStudioAreaPinDock } from '@/components/editor/webStudio/WebStudioAreaPinDock'
import { DesignCanvasPinOverlays } from '@/components/editor/webStudio/DesignCanvasPinOverlays'
import { DesignElementPinOverlays } from '@/components/editor/webStudio/DesignElementPinOverlays'
import {
  formatPinAreaLabel,
  pinAreaCenter,
  type PinAreaPercent,
} from '@/lib/visual-edit/canvasPinArea'
import {
  buildCanvasPinsPromptSuffix,
  createCanvasPinId,
  nextCanvasPinLabel,
  type CanvasPin,
  type CanvasPinKind,
} from '@/lib/visual-edit/canvasPins'

export type DesignWorkspaceChatContext = {
  activePageId: string | null
  hasMockup: boolean
}

type DesignHtmlSnapshot = { path: string; content: string }

type AreaPinDraft = PinAreaPercent & {
  pageId: string
  pageName: string
  element: ElementDescriptor | null
  kind: CanvasPinKind
  label: string
  editingPinId?: string
  initialDescription?: string
}

type ElementPinDraft = DesignElementContextPin & {
  label: string
}

type PendingPrototypeConnection = {
  fromPageId: string
  fromPageName: string
  fromSkId: string
  fromTagName: string
}

function resolveSiblingLevelSkIdsFromHtml(
  html: string,
  sourceSkId: string,
  sourceTagName: string,
): string[] {
  if (!html.trim()) return [sourceSkId]
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const source = doc.querySelector(`[data-sk-id="${CSS.escape(sourceSkId)}"]`)
    if (!source) return [sourceSkId]
    const parent = source.parentElement
    if (!parent) return [sourceSkId]
    const tag = sourceTagName.toLowerCase()
    const siblings = [...parent.children]
      .filter((el) => el.tagName.toLowerCase() === tag)
      .map((el) => el.getAttribute('data-sk-id')?.trim() ?? '')
      .filter(Boolean)
    return siblings.length > 0 ? [...new Set(siblings)] : [sourceSkId]
  } catch {
    return [sourceSkId]
  }
}

export type DesignGenerateOptions = {
  modify?: boolean
  images?: DesignGenerateImagePayload[]
  /** Si true, genera assets [IMAGE:] (requiere Imagen habilitado en admin). */
  generateImages?: boolean
  /** Modelo Vertex para assets [IMAGE:] (compositor; si falta, admin). */
  imageModelId?: string
  /** Brief explícito; si falta, se infiere del prompt. */
  brief?: Partial<DesignBrief>
  /** Solo añade una pantalla nueva; no regenera las existentes (por defecto si ya hay pantallas). */
  newPageOnly?: boolean
  /** Sustituye el diseño persistido (nueva web en el mismo proyecto). */
  replaceDesign?: boolean
  /** Regenera HTML solo de estas pantallas (ids); el resto no se toca. */
  rebuildPageIds?: string[]
}

export type DesignWorkspaceHandle = {
  approve: () => Promise<void>
  convert: () => Promise<void>
  generate: (prompt?: string, opts?: DesignGenerateOptions) => Promise<void>
  /** @deprecated usa generate */
  reimagine: (prompt?: string) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  /** Quita marcadores del compositor (área, elemento, página) tras enviar por el chat. */
  clearComposerMarkers: () => void
  refreshIframe: () => void | Promise<void>
  applyDeviceBreakpoint: (device: DesignPreviewBreakpoint) => Promise<void>
  openFigmaImport: () => void
  openStitchImport: () => void
  openCanvasImageUpload: () => void
  getChatContext: () => DesignWorkspaceChatContext
  pushActivity: (message: string, status?: DesignAgentLogEntry['status']) => void
}

type DesignWorkspaceProps = {
  projectId: string
  projectName?: string
  framework?: string
  codeTemplates?: import('@/lib/codeTemplates').CodeTemplate[]
  codeTemplate?: import('@/lib/codeTemplates').CodeTemplate
  designPaths?: string[]
  designJson: string | null
  designMd?: string | null
  hasMockup: boolean
  designApprovedAt?: string | null
  busy?: boolean
  modelChoice?: string
  modelOptions?: import('@/components/editor/AIModelSelect').AIModelSelectOption[]
  onModelChoiceChange?: (id: string) => void
  categoryChoices?: import('@/lib/ai/chatModelChoices').CategoryModelChoices
  categoryModels?: import('@/lib/ai/chatModelChoices').CategoryModelChoices
  selectionMode?: import('@/lib/ai/chatModelChoices').ChatModelSelectionMode
  onCategoryModelChange?: (category: import('@/lib/ai/chatModelCategories').ChatModelCategory, modelId: string) => void
  deviceBreakpoint?: DesignPreviewBreakpoint
  getWorkspaceFiles?: () => import('@/components/chat/useChatFileMentions').WorkspaceFileOption[]
  onRefreshFiles: () => void | Promise<void>
  onApprove: (at: string) => void
  onConvertDone: () => void
  /** Si se define, el lienzo abre el menú de plantilla en lugar de convertir al instante. */
  onRequestConvert?: () => void
  onBusyChange?: (busy: boolean) => void
  onSpeechNotice?: (message: string | null) => void
  onGithubImport?: () => void
  githubImportEnabled?: boolean
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void
  onDeviceChange?: (device: DesignPreviewBreakpoint) => void
  onOpenWorkspaceFile?: (path: string) => void
  onViewCode?: () => void
  onDownload?: () => void
  /** Spec y rutas de lienzo cargados del servidor (el padre actualiza fase / hasMockup). */
  onDesignSurfaceLoaded?: (surface: {
    designJson: string | null
    paths: string[]
  }) => void
  /** Lienzo montado (p. ej. prompt pendiente desde la landing). */
  onReady?: () => void
}

export const DesignWorkspace = React.forwardRef(function DesignWorkspace(
  {
    projectId,
    projectName = 'Proyecto',
    framework = 'react',
    codeTemplates = [],
    codeTemplate = 'html',
    designPaths = [],
    designJson,
    designMd = null,
    hasMockup,
    designApprovedAt = null,
    busy: busyProp,
    modelChoice = 'auto',
    modelOptions = [],
    onModelChoiceChange,
    categoryChoices,
    categoryModels,
    selectionMode,
    onCategoryModelChange,
    deviceBreakpoint = 'desktop',
    getWorkspaceFiles,
    onRefreshFiles,
    onApprove,
    onConvertDone,
    onRequestConvert,
    onBusyChange,
    onSpeechNotice,
    onGithubImport,
    githubImportEnabled = false,
    onHistoryChange,
    onDeviceChange,
    onOpenWorkspaceFile,
    onViewCode,
    onDownload,
    onDesignSurfaceLoaded,
    onReady,
  }: DesignWorkspaceProps,
  ref: React.Ref<DesignWorkspaceHandle>,
) {
  const { t, designClarifyQuestionsEnabled } = useApp() as {
    t: (key: string) => string
    designClarifyQuestionsEnabled?: boolean
  }

  useEffect(() => {
    onReady?.()
  }, [projectId, onReady])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set())
  const [agentPhases, setAgentPhases] = useState<DesignAgentPhaseBlock[]>([])
  const agentPhaseRef = React.useRef<AgentActivityPhase>('design')
  const designAbortRef = React.useRef<AbortController | null>(null)
  const lastDesignPhaseEventRef = React.useRef<string | null>(null)
  const [localBusy, setLocalBusy] = useState(false)
  const [playOpen, setPlayOpen] = useState(false)
  const [elementPins, setElementPins] = useState<DesignElementContextPin[]>([])
  const [canvasPins, setCanvasPins] = useState<CanvasPin[]>([])
  const [areaPinDraft, setAreaPinDraft] = useState<AreaPinDraft | null>(null)
  const [elementPinDraft, setElementPinDraft] = useState<ElementPinDraft | null>(null)
  const [canvasMenu, setCanvasMenu] = useState<DesignCanvasContextMenuState>(null)
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null)
  const [designHistory, setDesignHistory] = useState({ canUndo: false, canRedo: false })
  const previewStampRef = React.useRef(0)
  const refreshFilesTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const promptBarRef = React.useRef<WebStudioPromptBarHandle>(null)
  const [canvasTool, setCanvasTool] = useState<WebStudioCanvasTool>('select')
  const [pendingConnection, setPendingConnection] = useState<PendingPrototypeConnection | null>(null)
  const canvasAreaRef = React.useRef<HTMLDivElement>(null)
  const canvasImageInputRef = React.useRef<HTMLInputElement>(null)
  const imageReplaceInputRef = React.useRef<HTMLInputElement>(null)
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [themePanelOpen, setThemePanelOpen] = useState(false)
  const [elementActionMenuOpen, setElementActionMenuOpen] = useState(false)
  const [themeSaving, setThemeSaving] = useState(false)
  const [figmaImportOpen, setFigmaImportOpen] = useState(false)
  const [figmaExportOpen, setFigmaExportOpen] = useState(false)
  const [figmaConnected, setFigmaConnected] = useState(false)
  const [figmaOAuthConfigured, setFigmaOAuthConfigured] = useState(false)
  const [clarifySession, setClarifySession] = useState<{
    prompt: string
    opts?: DesignGenerateOptions
    questions: DesignClarifyQuestion[]
  } | null>(null)
  const [clarifyLoading, setClarifyLoading] = useState(false)
  const clarifyAbortRef = React.useRef<AbortController | null>(null)
  const [pagePreviewStamps, setPagePreviewStamps] = useState<PagePreviewStamps>({})
  /** Pantalla cuyo HTML se está generando (fase SSE `page:…`). */
  const [streamingPageId, setStreamingPageId] = useState<string | null>(null)
  /** Fase del stream de diseño (plan → páginas HTML). */
  const [designRunPhase, setDesignRunPhase] = useState<'idle' | 'plan' | 'tokens' | 'pages'>('idle')
  /** Si la generación actual incluyó la fase Spec-Kit (/design/plan). */
  const specKitPlanRunRef = React.useRef(false)
  const [visualMode, setVisualMode] = useState<VisualEditMode>('off')
  const [inspectorSync, setInspectorSync] = useState<'idle' | 'applied' | 'preview-only' | 'draft'>('idle')
  const designUndoStack = React.useRef<DesignHtmlSnapshot[]>([])
  const designRedoStack = React.useRef<DesignHtmlSnapshot[]>([])
  const deviceBreakpointRef = React.useRef(deviceBreakpoint)
  const skipDeviceApplyRef = React.useRef(true)
  const pendingBreakpointFitRef = React.useRef(false)
  /** Rutas/páginas del stream SSE antes de que el refresh del workspace termine. */
  const [streamReplaceDesign, setStreamReplaceDesign] = useState(false)
  const lastGeneratedPageIdRef = useRef<string | null>(null)
  const [streamCanvasOverlay, setStreamCanvasOverlay] = useState<{
    paths: string[]
    pages: DesignPageMeta[] | null
  } | null>(null)
  /** Spec + rutas cargados directo del API (no dependen del árbol de archivos ni de buffers). */
  const [serverDesignSurface, setServerDesignSurface] = useState<{
    designJson: string | null
    paths: string[]
  } | null>(null)
  const onDesignSurfaceLoadedRef = React.useRef(onDesignSurfaceLoaded)
  onDesignSurfaceLoadedRef.current = onDesignSurfaceLoaded
  const serverSurfaceFingerprintRef = React.useRef<string | null>(null)
  const connectInFlightRef = React.useRef(false)
  const pageContentHeightsRef = React.useRef(new Map<string, number>())
  const [pageContentHeightsVersion, setPageContentHeightsVersion] = useState(0)

  /** El padre puede ir un render detrás; localBusy manda para el botón Parar. */
  const busy = localBusy || Boolean(busyProp)

  const setBusy = useCallback(
    (v: boolean) => {
      setLocalBusy(v)
      onBusyChange?.(v)
    },
    [onBusyChange],
  )

  const reloadDesignSurfaceFromServer = useCallback(async () => {
    try {
      let designJson: string | null = null
      const pathSet = new Set<string>()
      let metaPaths: string[] = []

      try {
        const listRes = await apiFetch<{ files?: { path: string }[] }>(
          `/api/projects/${projectId}/files?meta=1`,
        )
        metaPaths = (listRes.files ?? []).map((f) => f.path).filter(Boolean)
        for (const p of metaPaths) {
          if (isDesignCanvasFilePath(p)) pathSet.add(p)
        }
      } catch {
        /* listado meta opcional */
      }

      if (metaPaths.includes(DESIGN_SPEC_JSON)) {
        try {
          const specRes = await apiFetch<{ file?: { content?: string } }>(
            projectFileContentUrl(projectId, DESIGN_SPEC_JSON),
          )
          designJson = specRes.file?.content?.trim() ? specRes.file.content : null
        } catch {
          /* spec en manifiesto pero lectura falló */
        }
      }

      const surface = {
        designJson,
        paths: [...pathSet],
      }
      const fingerprint = JSON.stringify(surface)
      if (serverSurfaceFingerprintRef.current === fingerprint) return
      serverSurfaceFingerprintRef.current = fingerprint
      setServerDesignSurface(surface)
      onDesignSurfaceLoadedRef.current?.(surface)
    } catch {
      /* no bloquear el lienzo si falla el prefetch */
    }
  }, [projectId])

  useEffect(() => {
    serverSurfaceFingerprintRef.current = null
    pageContentHeightsRef.current.clear()
    setPageContentHeightsVersion(0)
    setServerDesignSurface(null)
    setStreamCanvasOverlay(null)
    setActivePageId(null)
    setSelectedPageIds(new Set())
    setPagePreviewStamps({})
    setStreamingPageId(null)
    setDesignRunPhase('idle')
    void reloadDesignSurfaceFromServer()
  }, [projectId, reloadDesignSurfaceFromServer])

  /** Mantener overlay del stream hasta que el servidor refleje spec + HTML del plan. */
  useEffect(() => {
    if (!streamCanvasOverlay || busy) return
    if (canClearStreamCanvasOverlay(streamCanvasOverlay, serverDesignSurface)) {
      setStreamCanvasOverlay(null)
    }
  }, [streamCanvasOverlay, serverDesignSurface, busy])

  useEffect(
    () => () => {
      if (refreshFilesTimerRef.current) clearTimeout(refreshFilesTimerRef.current)
    },
    [],
  )

  const effectiveDesignJson =
    serverDesignSurface?.designJson ?? designJson ?? null

  const spec = useMemo(() => parseDesignSpec(effectiveDesignJson), [effectiveDesignJson])
  const designMdContent = useMemo(() => {
    if (!getWorkspaceFiles) return ''
    return getWorkspaceFiles().find((f) => f.path === DESIGN_SPEC_MD)?.content ?? ''
  }, [getWorkspaceFiles, effectiveDesignJson, serverDesignSurface?.paths])
  const designTokens = useMemo((): DesignTokens | undefined => {
    const md = designMdContent.trim()
    if (md) {
      const fromMd = specTokensFromEnvelope(envelopeFromDesignMd(md))
      if (fromMd.colors?.primary) return ensureDesignTokens(fromMd)
    }
    const fromSpec = spec?.tokens
    if (fromSpec?.colors?.primary) return ensureDesignTokens(fromSpec)
    const raw = getWorkspaceFiles?.().find((f) => f.path === DESIGN_TOKENS_PATH)?.content
    if (raw?.trim()) {
      return ensureDesignTokens(
        specTokensFromEnvelope(parseTokensJsonEnvelope(raw)),
      )
    }
    return fromSpec ? ensureDesignTokens(fromSpec) : undefined
  }, [spec, getWorkspaceFiles, effectiveDesignJson, designMdContent])
  const projectTitle = spec?.title?.trim() || projectName
  const prototypeLinks = spec?.prototypeLinks ?? []

  const canvasFileRefs = useMemo(() => {
    const paths = new Set<string>()
    for (const p of designPaths) {
      if (isDesignCanvasFilePath(p)) paths.add(p)
    }
    for (const p of serverDesignSurface?.paths ?? []) {
      if (isDesignCanvasFilePath(p)) paths.add(p)
    }
    for (const p of streamCanvasOverlay?.paths ?? []) {
      if (isDesignCanvasFilePath(p)) paths.add(p)
    }
    const workspaceFiles = getWorkspaceFiles?.() ?? []
    return [...paths].map((path) => ({
      path,
      content: workspaceFiles.find((f) => f.path === path)?.content,
    }))
  }, [designPaths, serverDesignSurface?.paths, streamCanvasOverlay?.paths, getWorkspaceFiles])

  const pages = useMemo(
    () =>
      resolveDesignCanvasPages(
        canvasFileRefs,
        effectiveDesignJson,
        streamCanvasOverlay?.pages,
        { streamReplaceDesign },
      ),
    [canvasFileRefs, effectiveDesignJson, streamCanvasOverlay?.pages, streamReplaceDesign],
  )

  /** Rutas con archivo ya persistido (PNG o HTML real, sin borrador genérico). */
  const readyPreviewPaths = useMemo(() => {
    const paths = new Set<string>()
    const consider = (p: string) => {
      if (!isDesignCanvasFilePath(p)) return
      if (p.endsWith('.html')) {
        const content = getWorkspaceFiles?.().find((f) => f.path === p)?.content
        if (!content?.trim()) return
        if (isOrchestrationPlaceholderHtml(content) || isDesignPreviewPlaceholderHtml(content)) {
          return
        }
      }
      paths.add(p)
    }
    for (const p of serverDesignSurface?.paths ?? []) consider(p)
    for (const p of streamCanvasOverlay?.paths ?? []) consider(p)
    return paths
  }, [serverDesignSurface?.paths, streamCanvasOverlay?.paths, getWorkspaceFiles])

  const screenPages = useMemo(
    () =>
      pages.filter(
        (p) =>
          p.frameType !== 'prototype' &&
          p.frameType !== 'designSystem' &&
          !isGeneratingPlaceholderPage(p),
      ),
    [pages],
  )

  useEffect(() => {
    let seeded = false
    for (const p of screenPages) {
      const specId = designSpecPageId(p.id)
      if (pageContentHeightsRef.current.has(specId)) continue
      const h = p.height ?? 0
      if (h > 0) {
        pageContentHeightsRef.current.set(specId, h)
        seeded = true
      }
    }
    if (seeded) setPageContentHeightsVersion((v) => v + 1)
  }, [screenPages, effectiveDesignJson])

  const contentHeightHints = useMemo(() => {
    const hints: Record<string, number> = {}
    for (const p of screenPages) {
      const specId = designSpecPageId(p.id)
      const h =
        pageContentHeightsRef.current.get(specId) ??
        pageContentHeightsRef.current.get(canvasPrimaryPageId(p.id))
      if (h && h > 0) hints[p.id] = h
    }
    return hints
  }, [screenPages, pageContentHeightsVersion])

  const pagePins = useMemo(
    () => pagePinsFromSelectedPageIds(selectedPageIds, screenPages),
    [selectedPageIds, screenPages],
  )

  const activePage = useMemo(
    () => screenPages.find((p) => p.id === activePageId) ?? screenPages[0] ?? null,
    [screenPages, activePageId],
  )
  const activePageIsImage = Boolean(activePage && isCanvasImagePage(activePage))

  const resolveActiveHtmlPath = useCallback(() => {
    const primaryId = activePageId ? canvasPrimaryPageId(activePageId) : null
    if (primaryId) return pageHtmlPath(primaryId)
    const first = screenPages.find((p) => !isCanvasImagePage(p)) ?? screenPages[0]
    return first ? pageHtmlPath(canvasPrimaryPageId(first.id)) : null
  }, [activePageId, screenPages])

  const readActiveHtmlContent = useCallback(() => {
    const path = resolveActiveHtmlPath()
    if (!path || !getWorkspaceFiles) return null
    return getWorkspaceFiles().find((f) => f.path === path)?.content ?? null
  }, [resolveActiveHtmlPath, getWorkspaceFiles])

  const getCanvasHtmlContent = useCallback(
    (htmlPath: string) => {
      if (!htmlPath || !getWorkspaceFiles) return null
      const content = getWorkspaceFiles().find((f) => f.path === htmlPath)?.content ?? null
      if (content?.trim() && isOrchestrationPlaceholderHtml(content)) return null
      if (content?.trim() && isDesignPreviewPlaceholderHtml(content)) return null
      return content
    },
    [getWorkspaceFiles],
  )

  const notifyHistory = useCallback(() => {
    const state = {
      canUndo: designUndoStack.current.length > 0,
      canRedo: designRedoStack.current.length > 0,
    }
    setDesignHistory(state)
    onHistoryChange?.(state)
  }, [onHistoryChange])

  const flushRefreshFiles = useCallback(async () => {
    if (refreshFilesTimerRef.current) {
      clearTimeout(refreshFilesTimerRef.current)
      refreshFilesTimerRef.current = null
    }
    await Promise.resolve(onRefreshFiles())
    await reloadDesignSurfaceFromServer()
  }, [onRefreshFiles, reloadDesignSurfaceFromServer])

  const scheduleRefreshFiles = useCallback(() => {
    if (refreshFilesTimerRef.current) clearTimeout(refreshFilesTimerRef.current)
    refreshFilesTimerRef.current = setTimeout(() => {
      refreshFilesTimerRef.current = null
      void (async () => {
        await Promise.resolve(onRefreshFiles())
        await reloadDesignSurfaceFromServer()
      })()
    }, 450)
  }, [onRefreshFiles, reloadDesignSurfaceFromServer])

  const pushDesignUndoSnapshot = useCallback(() => {
    const path = resolveActiveHtmlPath()
    const content = readActiveHtmlContent()
    if (!path || content == null) return
    designUndoStack.current = [...designUndoStack.current.slice(-49), { path, content }]
    designRedoStack.current = []
    notifyHistory()
  }, [resolveActiveHtmlPath, readActiveHtmlContent, notifyHistory])

  const persistPatch = useCallback(
    async (patch: VisualPatch, element: ElementDescriptor, previousText?: string) => {
      pushDesignUndoSnapshot()
      await apiFetch(`/api/projects/${projectId}/design/patch`, {
        method: 'POST',
        body: JSON.stringify({
          patch,
          element,
          previousText,
          pageId: activePageId ? canvasPrimaryPageId(activePageId) : undefined,
        }),
      })
      scheduleRefreshFiles()
    },
    [projectId, activePageId, scheduleRefreshFiles, pushDesignUndoSnapshot],
  )

  const handleNodeInserted = useCallback(
    async (payload: NodeInsertedPayload) => {
      const path = resolveActiveHtmlPath()
      const content = readActiveHtmlContent()
      if (!path || content == null) return
      pushDesignUndoSnapshot()
      const { code: next, applied } = insertNodeToSource(
        content,
        {
          kind: payload.placement.kind,
          skId: payload.placement.skId,
          parentSkId: payload.placement.parentSkId,
          text: payload.element.text,
        },
        payload.element,
      )
      if (!applied || next === content) return
      await apiFetch(`/api/projects/${projectId}/files`, {
        method: 'PUT',
        body: JSON.stringify({ path, content: next }),
      })
      scheduleRefreshFiles()
    },
    [
      resolveActiveHtmlPath,
      readActiveHtmlContent,
      pushDesignUndoSnapshot,
      projectId,
      scheduleRefreshFiles,
    ],
  )

  const handleHtmlUpdated = useCallback(
    async (html: string) => {
      const path = resolveActiveHtmlPath()
      if (!path) return
      pushDesignUndoSnapshot()
      await apiFetch(`/api/projects/${projectId}/files`, {
        method: 'PUT',
        body: JSON.stringify({ path, content: html }),
      })
      scheduleRefreshFiles()
    },
    [resolveActiveHtmlPath, pushDesignUndoSnapshot, projectId, scheduleRefreshFiles],
  )

  const canvasToolRef = React.useRef(canvasTool)
  canvasToolRef.current = canvasTool
  const sidePanelOpenRef = React.useRef(sidePanelOpen)
  sidePanelOpenRef.current = sidePanelOpen
  const messageSourcePageIdRef = React.useRef<string | null>(null)

  const resolvePinPage = useCallback(
    (element: ElementDescriptor, sourcePageId?: string | null) => {
      const rawId =
        sourcePageId ??
        activePageId ??
        screenPages.find((p) => !isCanvasImagePage(p))?.id ??
        screenPages[0]?.id
      if (!rawId) return null
      const pageId = canvasPrimaryPageId(rawId)
      const page = pages.find((p) => p.id === pageId || p.id === `${pageId}--mockup`)
      return pinFromElement(element, pageId, page?.name ?? projectTitle)
    },
    [activePageId, screenPages, pages, projectTitle],
  )

  const handleElementSelectRef = React.useRef<(element: ElementDescriptor | null) => void>(() => {})
  const preserveSelectionOnceRef = React.useRef(false)

  const onColorPickerFocus = useCallback(() => {
    preserveSelectionOnceRef.current = false
  }, [])

  const onColorPickerBlur = useCallback(() => {
    preserveSelectionOnceRef.current = true
  }, [])

  const consumePreserveSelectionOnce = useCallback(() => {
    if (!preserveSelectionOnceRef.current) return false
    preserveSelectionOnceRef.current = false
    return true
  }, [])

  const {
    iframeRef,
    selected: selectedElement,
    handleIframeLoad,
    syncBridgeMode,
    applyPatch,
    clearSelection,
    cancelPlacement,
    moveSibling,
    pickAtPoint,
    send: sendToBridge,
  } = useVisualEdit(
    visualMode,
    setVisualMode,
    handleNodeInserted,
    handleHtmlUpdated,
    (element) => handleElementSelectRef.current(element),
    {
      canvasRootRef: canvasAreaRef,
      preserveSelectionOnceRef,
      onMessageSourcePageId: (pageId) => {
        messageSourcePageIdRef.current = pageId
      },
    },
  )

  useEffect(() => {
    const connectedByPage = prototypeLinks.reduce<Record<string, string[]>>((acc, link) => {
      const pageId = canvasPrimaryPageId(link.fromPageId)
      const skId = String(link.fromSkId ?? '').trim()
      if (!pageId || !skId) return acc
      const current = acc[pageId] ?? []
      if (!current.includes(skId)) current.push(skId)
      acc[pageId] = current
      return acc
    }, {})
    sendToBridge({
      channel: VISUAL_EDIT_CHANNEL,
      type: 'set-link-assignments',
      payload: connectedByPage,
    })
  }, [prototypeLinks, pagePreviewStamps, sendToBridge])

  useEffect(() => {
    if (
      activePageIsImage &&
      (canvasTool === 'edit' ||
        canvasTool === 'connect' ||
        canvasTool === 'properties' ||
        canvasTool === 'palette')
    ) {
      setCanvasTool('select')
      setSidePanelOpen(false)
      setThemePanelOpen(false)
      setPendingConnection(null)
      clearSelection()
    }
  }, [activePageIsImage, canvasTool, clearSelection])

  const canvasPreviewPageIds = useCallback(() => {
    return screenPages
      .filter(
        (p) =>
          p.frameType !== 'prototype' &&
          p.frameType !== 'designSystem' &&
          !isCanvasImagePage(p),
      )
      .map((p) => canvasPrimaryPageId(p.id))
  }, [screenPages])

  const bumpCanvasPreviewStamps = useCallback((pageIds: string[]) => {
    if (!pageIds.length) return
    previewStampRef.current += 1
    setPagePreviewStamps((prev) => bumpPagePreviewStampsForPageIds(prev, pageIds))
  }, [])

  const refreshPreview = useCallback(() => {
    const pageId = activePageId
      ? canvasPrimaryPageId(activePageId)
      : canvasPreviewPageIds()[0]
    if (!pageId) return
    bumpCanvasPreviewStamps([pageId])
  }, [activePageId, canvasPreviewPageIds, bumpCanvasPreviewStamps])

  const refreshAllCanvasPreviews = useCallback(() => {
    const ids = canvasPreviewPageIds()
    if (!ids.length) return
    bumpCanvasPreviewStamps(ids)
  }, [canvasPreviewPageIds, bumpCanvasPreviewStamps])

  const refreshDesignSurface = useCallback(async () => {
    await flushRefreshFiles()
    refreshAllCanvasPreviews()
  }, [flushRefreshFiles, refreshAllCanvasPreviews])

  const applyDeviceBreakpointToCanvas = useCallback(
    async (device: DesignPreviewBreakpoint) => {
      if (busy) return
      deviceBreakpointRef.current = device
      const preset = DESIGN_BREAKPOINT_PRESETS[device]
      const specPages = pages
        .filter(
          (p) =>
            !isMockupCompanionCanvasPage(p) &&
            p.frameType !== 'prototype' &&
            p.frameType !== 'designSystem' &&
            p.id !== DESIGN_SYSTEM_PAGE_ID &&
            p.id !== PROTOTYPE_PAGE_ID &&
            !isGeneratingPlaceholderPage(p),
        )
        .map((p) => ({
          ...p,
          id: designSpecPageId(p.id),
          width: preset.width,
        }))
      if (!specPages.length) return

      const needsResize = specPages.some((p) => (p.width ?? 0) !== preset.width)
      if (spec?.targetDevice === device && !needsResize) return

      const laidOut = autoLayoutPages(specPages)
      const specContent = mergePagesIntoSpec(
        spec ? { ...spec, targetDevice: device } : null,
        laidOut,
        projectTitle,
      )
      const writes: Array<{ path: string; content: string }> = [
        { path: DESIGN_SPEC_JSON, content: specContent },
      ]

      if (getWorkspaceFiles) {
        const designFiles = getWorkspaceFiles()
          .filter(
            (f) =>
              f.path === DESIGN_SPEC_JSON ||
              (isDesignCanvasFilePath(f.path) && f.path.endsWith('.html')),
          )
          .map((f) => ({ path: f.path, content: f.content }))
        if (designFiles.some((f) => f.path === DESIGN_SPEC_JSON)) {
          const withDevice = applyDevicePresetToDesignFiles(designFiles, device)
          for (const file of withDevice) {
            if (file.path === DESIGN_SPEC_JSON) continue
            const prev = designFiles.find((f) => f.path === file.path)
            if (prev && prev.content !== file.content) writes.push(file)
          }
        }
      }

      setBusy(true)
      try {
        for (const file of writes) {
          await apiFetch(`/api/projects/${projectId}/files`, {
            method: 'PUT',
            body: JSON.stringify(file),
          })
        }
        await refreshDesignSurface()
        pendingBreakpointFitRef.current = true
      } finally {
        setBusy(false)
      }
    },
    [
      busy,
      pages,
      spec,
      projectTitle,
      getWorkspaceFiles,
      projectId,
      refreshDesignSurface,
      setBusy,
    ],
  )

  useEffect(() => {
    if (skipDeviceApplyRef.current) {
      skipDeviceApplyRef.current = false
      deviceBreakpointRef.current = deviceBreakpoint
      return
    }
    if (deviceBreakpointRef.current === deviceBreakpoint) return
    void applyDeviceBreakpointToCanvas(deviceBreakpoint)
  }, [deviceBreakpoint, applyDeviceBreakpointToCanvas])

  const discardPropertiesEdits = useCallback(() => {
    refreshPreview()
    setInspectorSync('idle')
  }, [refreshPreview])

  const restoreHtmlSnapshot = useCallback(
    async (snap: DesignHtmlSnapshot) => {
      await apiFetch(`/api/projects/${projectId}/files`, {
        method: 'PUT',
        body: JSON.stringify({ path: snap.path, content: snap.content }),
      })
      await refreshDesignSurface()
    },
    [projectId, refreshDesignSurface],
  )

  const syncVisualMode = useCallback(
    (tool: WebStudioCanvasTool) => {
      if (activePageIsImage) {
        setVisualMode('off')
        syncBridgeMode('off')
        return
      }
      if (tool === 'pan') {
        setVisualMode('pan')
        syncBridgeMode('pan')
        return
      }
      if (tool === 'connect') {
        if (pendingConnection) {
          setVisualMode('off')
          syncBridgeMode('off')
        } else {
          setVisualMode('select')
          syncBridgeMode('select')
        }
        return
      }
      if (tool === 'edit' || tool === 'properties' || tool === 'palette') {
        setVisualMode('select')
        syncBridgeMode('select')
        return
      }
      if (tool === 'rect') {
        setVisualMode('off')
        syncBridgeMode('off')
        return
      }
      setVisualMode('off')
      syncBridgeMode('off')
    },
    [syncBridgeMode, activePageIsImage, pendingConnection],
  )

  useEffect(() => {
    syncVisualMode(canvasTool)
  }, [canvasTool, syncVisualMode])

  const elementEditor = useDesignElementEditor({
    applyPatch,
    clearSelection,
    onPatchPersist: persistPatch,
  })

  const removeElementPin = useCallback((pin: DesignElementContextPin) => {
    const key = elementPinKey(pin)
    setElementPins((prev) => prev.filter((p) => elementPinKey(p) !== key))
  }, [])

  const finishElementPinDraft = useCallback(() => {
    setElementPinDraft(null)
  }, [])

  const handleElementPinCommit = useCallback(
    (description: string) => {
      if (!elementPinDraft) return
      const pin: DesignElementContextPin = {
        skId: elementPinDraft.skId,
        tagName: elementPinDraft.tagName,
        text: elementPinDraft.text,
        pageId: elementPinDraft.pageId,
        pageName: elementPinDraft.pageName,
        label: elementPinDraft.label,
        rect: elementPinDraft.rect,
        description: description.trim(),
      }
      const key = elementPinKey(pin)
      setElementPins((prev) => {
        const idx = prev.findIndex((p) => elementPinKey(p) === key)
        if (idx < 0) return [...prev, pin]
        const next = [...prev]
        next[idx] = pin
        return next
      })
      setElementPinDraft(null)
      elementEditor.closeInlineEdit()
      window.setTimeout(() => promptBarRef.current?.focus(), 0)
    },
    [elementPinDraft, elementEditor],
  )

  handleElementSelectRef.current = (element) => {
    if (!element) {
      setElementActionMenuOpen(false)
      return
    }
    if (canvasToolRef.current === 'properties' || sidePanelOpenRef.current) {
      setElementActionMenuOpen(false)
      return
    }
    if (canvasToolRef.current !== 'edit') return
    const sourcePageId = messageSourcePageIdRef.current
    if (sourcePageId && sourcePageId !== activePageId) {
      setActivePageId(sourcePageId)
    }
    setElementActionMenuOpen(true)
  }

  const pickAtPointInPage = useCallback(
    (pageId: string, area: PinAreaPercent): Promise<ElementDescriptor | null> => {
      const canvas = canvasAreaRef.current
      if (!canvas) return Promise.resolve(null)
      const frame = canvas.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`)
      const preview = frame?.querySelector<HTMLElement>(
        '.design-page-frame__preview, .design-page-frame__image-stage',
      )
      const iframe = preview?.querySelector<HTMLIFrameElement>('iframe.design-page-frame__iframe')
      if (!preview || !iframe) return Promise.resolve(null)
      const previewRect = preview.getBoundingClientRect()
      const iframeRect = iframe.getBoundingClientRect()
      const center = pinAreaCenter(area)
      const clientX = previewRect.left + (center.xPercent / 100) * previewRect.width
      const clientY = previewRect.top + (center.yPercent / 100) * previewRect.height
      const ix = clientX - iframeRect.left
      const iy = clientY - iframeRect.top
      if (ix < 0 || iy < 0 || ix > iframeRect.width || iy > iframeRect.height) {
        return Promise.resolve(null)
      }
      return new Promise((resolve) => {
        const onMessage = (ev: MessageEvent) => {
          if (!isMessageFromPreviewIframe(ev, iframe)) return
          if (!isVisualEditMessage(ev.data) || ev.data.channel !== VISUAL_EDIT_CHANNEL) return
          if (ev.data.type !== 'pin-picked') return
          window.removeEventListener('message', onMessage)
          resolve(ev.data.payload.element ?? null)
        }
        window.addEventListener('message', onMessage)
        postToBridge(iframe, {
          channel: VISUAL_EDIT_CHANNEL,
          type: 'pick-at-point',
          payload: { clientX: ix, clientY: iy },
        })
        window.setTimeout(() => {
          window.removeEventListener('message', onMessage)
          resolve(null)
        }, 400)
      })
    },
    [],
  )

  const finishAreaPinTool = useCallback(() => {
    setAreaPinDraft(null)
    setCanvasTool('select')
  }, [])

  const handleAreaSelected = useCallback(
    async (pageId: string, area: PinAreaPercent) => {
      if (areaPinDraft || canvasTool !== 'rect') return
      const kind: CanvasPinKind = 'area'
      const primaryId = canvasPrimaryPageId(pageId)
      const page = pages.find((p) => p.id === pageId || p.id === primaryId)
      const pageName = page?.name ?? projectTitle
      if (primaryId !== activePageId) setActivePageId(pageId)
      const element = await pickAtPointInPage(pageId, area)
      setAreaPinDraft({
        ...area,
        pageId: primaryId,
        pageName,
        element,
        kind,
        label: nextCanvasPinLabel(canvasPins, kind),
      })
    },
    [
      areaPinDraft,
      canvasTool,
      canvasPins,
      pages,
      projectTitle,
      activePageId,
      pickAtPointInPage,
    ],
  )

  const handleAreaPinCommit = useCallback(
    (description: string) => {
      if (!areaPinDraft) return
      const trimmed = description.trim()
      if (!trimmed) return
      if (areaPinDraft.editingPinId) {
        setCanvasPins((prev) =>
          prev.map((p) =>
            p.id === areaPinDraft.editingPinId ? { ...p, description: trimmed } : p,
          ),
        )
        setAreaPinDraft(null)
        window.setTimeout(() => promptBarRef.current?.focus(), 0)
        return
      }
      const pin: CanvasPin = {
        id: createCanvasPinId(),
        pageId: areaPinDraft.pageId,
        pageName: areaPinDraft.pageName,
        xPercent: areaPinDraft.xPercent,
        yPercent: areaPinDraft.yPercent,
        widthPercent: areaPinDraft.widthPercent,
        heightPercent: areaPinDraft.heightPercent,
        label: areaPinDraft.label,
        kind: areaPinDraft.kind,
        description: trimmed,
        elementSkId: areaPinDraft.element?.skId,
        elementTag: areaPinDraft.element?.tagName,
      }
      setCanvasPins((prev) => [...prev, pin])
      setAreaPinDraft(null)
      setCanvasTool('select')
      window.setTimeout(() => promptBarRef.current?.focus(), 0)
    },
    [areaPinDraft],
  )

  const handleCanvasPinEdit = useCallback(
    (pageId: string, pinId: string) => {
      const pin = canvasPins.find((p) => p.id === pinId)
      if (!pin) return
      const primaryId = canvasPrimaryPageId(pageId)
      const page = pages.find((p) => p.id === pageId || p.id === primaryId)
      const pageName = pin.pageName ?? page?.name ?? projectTitle
      if (primaryId !== activePageId) setActivePageId(pageId)
      setAreaPinDraft({
        xPercent: pin.xPercent,
        yPercent: pin.yPercent,
        widthPercent: pin.widthPercent,
        heightPercent: pin.heightPercent,
        pageId: pin.pageId ?? primaryId,
        pageName,
        element: null,
        kind: pin.kind ?? 'area',
        label: pin.label ?? (pin.kind === 'image' ? 'img' : 'area'),
        editingPinId: pin.id,
        initialDescription: pin.description,
      })
    },
    [canvasPins, pages, projectTitle, activePageId],
  )

  const removeCanvasPin = useCallback((id: string) => {
    setCanvasPins((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const updateCanvasPinArea = useCallback(
    (_pageId: string, pinId: string, area: PinAreaPercent) => {
      setCanvasPins((prev) =>
        prev.map((p) =>
          p.id === pinId
            ? {
                ...p,
                xPercent: area.xPercent,
                yPercent: area.yPercent,
                widthPercent: area.widthPercent,
                heightPercent: area.heightPercent,
              }
            : p,
        ),
      )
    },
    [],
  )

  useEffect(() => {
    if (!elementPinDraft && !areaPinDraft) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (elementPinDraft) finishElementPinDraft()
      else if (areaPinDraft) finishAreaPinTool()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [elementPinDraft, areaPinDraft, finishElementPinDraft, finishAreaPinTool])

  const onCanvasAreaPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target
      if (target instanceof Element && target.closest('.web-studio-element-action-menu')) {
        return
      }
      promptBarRef.current?.closeMenus()
      setCanvasMenu(null)
      setElementActionMenuOpen(false)
      if (canvasTool === 'pan' || canvasTool === 'rect' || canvasTool === 'connect') return
      if (!isDesignCanvasBackgroundTarget(e.target)) return
      if (consumePreserveSelectionOnce()) return
      setActivePageId(null)
      clearSelection()
    },
    [canvasTool, clearSelection, consumePreserveSelectionOnce],
  )

  const overlayPos = useIframeOverlayRect(
    canvasAreaRef,
    iframeRef,
    selectedElement?.rect,
  )
  const pageLayoutKey = useMemo(
    () => pages.map((p) => `${p.id}:${p.x ?? 0},${p.y ?? 0}`).join('|'),
    [pages],
  )
  const canvasPinOverlays = useCanvasPinOverlayRects(canvasAreaRef, canvasPins, pageLayoutKey)
  const canvasPinToolActive = canvasTool === 'rect'
  const elementPinOverlays = useElementPinOverlayRects(canvasAreaRef, elementPins)

  const undoDesignEdit = useCallback(async () => {
    const entry = designUndoStack.current.pop()
    if (!entry) return
    const path = resolveActiveHtmlPath()
    const current = readActiveHtmlContent()
    if (path && current != null) {
      designRedoStack.current = [...designRedoStack.current.slice(-49), { path, content: current }]
    }
    await restoreHtmlSnapshot(entry)
    notifyHistory()
  }, [resolveActiveHtmlPath, readActiveHtmlContent, restoreHtmlSnapshot, notifyHistory])

  const redoDesignEdit = useCallback(async () => {
    const entry = designRedoStack.current.pop()
    if (!entry) return
    const path = resolveActiveHtmlPath()
    const current = readActiveHtmlContent()
    if (path && current != null) {
      designUndoStack.current = [...designUndoStack.current.slice(-49), { path, content: current }]
    }
    await restoreHtmlSnapshot(entry)
    notifyHistory()
  }, [resolveActiveHtmlPath, readActiveHtmlContent, restoreHtmlSnapshot, notifyHistory])

  useEffect(() => {
    if (!pages.length) {
      setActivePageId(null)
      return
    }
    setActivePageId((cur) => (cur && pages.some((p) => p.id === cur) ? cur : pages[0]?.id ?? null))
  }, [pages])

  const finalizeAgentPhasesOnStop = useCallback(() => {
    const phase = agentPhaseRef.current
    setAgentPhases((prev) =>
      prev.map((block) => {
        const steps = block.steps.map((s) =>
          s.status === 'pending' ? { ...s, status: 'done' as const } : s,
        )
        if (block.phase !== phase) return { ...block, steps }
        return {
          ...block,
          steps: [
            ...steps,
            {
              id: `stop-${Date.now()}`,
              message: t('ed.design.stopped'),
              status: 'done' as const,
            },
          ],
        }
      }),
    )
  }, [t])

  const stopDesignRun = useCallback(() => {
    designAbortRef.current?.abort()
    finalizeAgentPhasesOnStop()
    setBusy(false)
  }, [finalizeAgentPhasesOnStop, setBusy])

  const pushLog = useCallback(
    (
      message: string,
      status: DesignAgentLogEntry['status'] = 'done',
      phase?: AgentActivityPhase,
    ) => {
      const targetPhase = phase ?? agentPhaseRef.current
      const safe = stripDesignLogParentheticals(message)
        .replace(/\bvertex\s*ai\b/gi, '')
        .replace(/\bvertex\b/gi, '')
        .replace(/\bgoogle\s*cloud\b/gi, '')
        .replace(/\bagent\s*platform\b/gi, '')
        .replace(/\b(imagen\s*4|gemini|nano\s*banana)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      const normalized = safe || message

      setAgentPhases((prev) => {
        let blocks = [...prev]
        let idx = blocks.findIndex((b) => b.phase === targetPhase)
        if (idx === -1) {
          blocks.push({ phase: targetPhase, steps: [] })
          blocks.sort((a, b) => {
            if (a.phase === b.phase) return 0
            return a.phase === 'design' ? -1 : 1
          })
          idx = blocks.findIndex((b) => b.phase === targetPhase)
        }

        const block = blocks[idx]!
        let steps = [...block.steps]

        if (status === 'pending') {
          const currentPending = steps.find((s) => s.status === 'pending')
          if (currentPending?.message === normalized) {
            blocks[idx] = { ...block, steps }
            return blocks
          }
          steps = steps.map((s) =>
            s.status === 'pending' ? { ...s, status: 'done' as const } : s,
          )
          steps.push({
            id: `${Date.now()}-${Math.random()}`,
            message: normalized,
            status: 'pending',
          })
        } else {
          steps = steps.map((s) =>
            s.status === 'pending' ? { ...s, status: 'done' as const } : s,
          )
          steps = [
            ...steps.slice(-23),
            { id: `${Date.now()}-${Math.random()}`, message: normalized, status },
          ]
        }

        blocks[idx] = { ...block, steps }
        return blocks
      })
    },
    [],
  )

  const designLog = useCallback(
    (key: string, status: DesignAgentLogEntry['status'] = 'done', vars?: Record<string, string>) => {
      pushLog(formatDesignActivityMessage(t(key), vars), status, 'design')
    },
    [pushLog, t],
  )

  useEffect(() => {
    if (isDemoActive()) {
      setFigmaConnected(loadDemoIntegrationStatus().figma.connected)
      return
    }
    void apiFetch<{ integrations: { figma: { connected: boolean; oauthConfigured: boolean } } }>('/api/integrations/status')
      .then((d) => {
        setFigmaConnected(d.integrations.figma.connected)
        setFigmaOAuthConfigured(d.integrations.figma.oauthConfigured)
      })
      .catch(() => setFigmaConnected(false))
  }, [])

  const variants = useMemo(() => {
    const ids = new Set<string>()
    for (const p of designPaths) {
      const m = p.match(/^design\/variants\/([^/]+)\//)
      if (m?.[1]) ids.add(m[1])
    }
    return [...ids].map((id): DesignVariant => ({ id }))
  }, [designPaths])

  const applyVariant = useCallback(
    async (variantId: string) => {
      if (!activePageId) return
      setBusy(true)
      try {
        await apiFetch(`/api/projects/${projectId}/design/apply-variant`, {
          method: 'POST',
          body: JSON.stringify({ variantId, pageId: activePageId }),
        })
        await flushRefreshFiles()
        pushLog(t('ed.design.variantApplied'), 'done')
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
      } finally {
        setBusy(false)
      }
    },
    [activePageId, projectId, flushRefreshFiles, pushLog, t, setBusy],
  )

  useEffect(() => {
    if (!selectedElement || canvasTool !== 'properties') return
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
      e.preventDefault()
      moveSibling(selectedElement.skId, e.key === 'ArrowUp' ? 'up' : 'down')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedElement, canvasTool, moveSibling])

  const applyDesignStreamFiles = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== 'object') return [] as string[]
    const data = payload as { paths?: string[]; pages?: DesignPageMeta[] }
    if (!Array.isArray(data.paths) && !Array.isArray(data.pages)) return [] as string[]
    const incoming = (data.paths ?? []).filter(
      (p): p is string => typeof p === 'string' && isDesignCanvasFilePath(p),
    )
    setStreamCanvasOverlay((prev) => {
      const nextPages = Array.isArray(data.pages)
        ? mergeStreamCanvasOverlayPages(prev?.pages, data.pages)
        : (prev?.pages ?? null)
      return {
        paths: [...new Set([...(prev?.paths ?? []), ...incoming])],
        pages: nextPages,
      }
    })
    return incoming
  }, [])

  const runGenerate = useCallback(
    async (prompt: string, opts?: DesignGenerateOptions) => {
      const designPrompt = prompt.trim() || t('ed.design.defaultGeneratePrompt')

      const hasSelectedPages = selectedPageIds.size > 0
      const hasElementOrAreaPins = elementPins.length > 0 || canvasPins.length > 0
      const isModify = Boolean(
        opts?.modify || hasSelectedPages || hasElementOrAreaPins,
      )
      agentPhaseRef.current = 'design'
      const seedPaths = new Set<string>()
      for (const p of serverDesignSurface?.paths ?? []) {
        if (isDesignCanvasFilePath(p)) seedPaths.add(p)
      }
      for (const p of designPaths) {
        if (isDesignCanvasFilePath(p)) seedPaths.add(p)
      }
      const seedJson = serverDesignSurface?.designJson ?? designJson ?? null
      const isPrimaryProductPage = (p: { id: string; frameType?: string }) =>
        p.frameType !== 'prototype' &&
        p.frameType !== 'designSystem' &&
        !isGeneratingPlaceholderPage(p)

      setStreamingPageId(null)
      specKitPlanRunRef.current = false
      setDesignRunPhase(isModify ? 'pages' : 'tokens')

      setBusy(true)
      designAbortRef.current?.abort()
      const abort = new AbortController()
      designAbortRef.current = abort
      const { signal } = abort

      if (isModify) {
        lastDesignPhaseEventRef.current = null
        pushLog(t('ed.design.logModify'), 'pending', 'design')
      } else {
        lastDesignPhaseEventRef.current = 'design-system'
        pushLog(t('ed.design.phase.design-system'), 'pending', 'design')
      }
      let designStreamFailed = false
      try {
        if (
          opts?.images?.length &&
          !opts.images.every(
            (img) =>
              Boolean(img.url?.trim()) ||
              Boolean(img.data?.replace(/^data:[^;]+;base64,/, '').trim().length > 64),
          )
        ) {
          pushLog(t('ed.design.referenceImageUnresolved'), 'error')
          return
        }
        if (
          !opts?.images?.length &&
          promptImpliesVisualReference(designPrompt) &&
          !isModify
        ) {
          pushLog(t('ed.design.referenceImageRequired'), 'error')
          return
        }

        const firstCanvasPinPageId = canvasPins.find((p) => p.pageId)?.pageId
        const selectedRebuild = [...selectedPageIds]
          .map((id) => canvasPrimaryPageId(id))
          .filter(Boolean)
        const referencePageId = elementPins.length
          ? canvasPrimaryPageId(elementPins[0]!.pageId)
          : selectedRebuild.length
            ? selectedRebuild[0]
            : firstCanvasPinPageId
              ? canvasPrimaryPageId(firstCanvasPinPageId)
              : undefined
        const explicitRebuild = opts?.rebuildPageIds
          ?.map((id) => canvasPrimaryPageId(id))
          .filter(Boolean)
        const rebuildPageIds = explicitRebuild?.length
          ? explicitRebuild
          : selectedRebuild.length
            ? selectedRebuild
            : hasElementOrAreaPins && referencePageId
              ? [referencePageId]
              : undefined

        const hasReferenceImages = Boolean(
          opts?.images?.some((img) => Boolean(img.data?.trim() || img.url?.trim())),
        )

        const hadPagesBefore =
          pages.some(isPrimaryProductPage) ||
          resolveDesignCanvasPages(
            [...seedPaths].map((path) => ({ path })),
            seedJson,
            streamCanvasOverlay?.pages ?? null,
          ).some(isPrimaryProductPage)

        const replaceDesign =
          opts?.replaceDesign === true ||
          consumeStudioReplaceDesign() ||
          (hasReferenceImages &&
            !isModify &&
            !rebuildPageIds?.length &&
            !referencePageId &&
            !hadPagesBefore)

        lastGeneratedPageIdRef.current = null
        setStreamReplaceDesign(replaceDesign)
        setStreamCanvasOverlay({
          paths: replaceDesign ? [] : [...seedPaths],
          pages: null,
        })

        if (rebuildPageIds?.length) {
          bumpCanvasPreviewStamps(rebuildPageIds.map((id) => canvasPrimaryPageId(id)))
        } else if (!hadPagesBefore) {
          setPagePreviewStamps({})
        }

        if (replaceDesign) {
          setPagePreviewStamps({})
          setActivePageId(null)
          setSelectedPageIds(new Set())
        }

        const wantsNewPageOnly = replaceDesign
          ? false
          : opts?.newPageOnly === true ||
            (opts?.newPageOnly !== false &&
              hadPagesBefore &&
              !rebuildPageIds?.length)

        const elementContexts =
          elementPins.length > 0 ? elementPins.map(toIterateElementContext) : undefined

        const hasReferenceImagesForBrief = Boolean(
          opts?.images?.some((img) => Boolean(img.data?.trim() || img.url?.trim())),
        )
        const promptInferred = inferDesignBriefFromPrompt(designPrompt)
        const brief = mergeDesignBrief(
          { prompt: designPrompt, ...opts?.brief },
          hasReferenceImagesForBrief
            ? { ...promptInferred, siteType: undefined }
            : promptInferred,
        )
        await consumeDesignGenerateStream(
          projectId,
          {
            prompt: designPrompt,
            projectName,
            framework,
            model: modelChoice,
            device: deviceBreakpoint,
            images: opts?.images,
            replaceDesign,
            forceNewPage: wantsNewPageOnly,
            newPageOnly: wantsNewPageOnly,
            rebuildPageIds,
            referencePageId: referencePageId || undefined,
            elementContexts,
            brief: {
              businessModel: brief.businessModel,
              brandTone: brief.brandTone,
              ...(hasReferenceImagesForBrief
                ? {}
                : { siteType: brief.siteType, requiredSections: brief.requiredSections }),
            },
            generateImages: opts?.generateImages !== false,
            imageModelId: opts?.imageModelId,
          },
            {
              onPhase: (phase) => {
                const builtPage = phase.match(/^page:([^:]+):1\/1$/)
                if (builtPage?.[1]) {
                  lastGeneratedPageIdRef.current = canvasPrimaryPageId(builtPage[1])
                }
                const compactPhases = preferCompactOrchestrationPhases()
                const logPhase = compactPhases ? orchestrationPhaseGroup(phase) : phase
                if (logPhase === lastDesignPhaseEventRef.current) return
                lastDesignPhaseEventRef.current = logPhase
                const compactMacro =
                  logPhase === 'design-system' ||
                  logPhase === 'layout' ||
                  logPhase === 'html' ||
                  logPhase === 'html-refine' ||
                  logPhase === 'assets'
                if (
                  logPhase === 'design-system' ||
                  (!compactPhases &&
                    (phase === 'design-md' ||
                      phase === 'design-md-ready' ||
                      phase === 'design-md:brief-fallback' ||
                      phase.startsWith('design-md-step:') ||
                      phase === 'visual-audit' ||
                      phase === 'visual-audit-ready' ||
                      phase === 'layout-from-visual-audit' ||
                      phase === 'visual-identity' ||
                      phase === 'palette-generation' ||
                      phase === 'typography-ui' ||
                      phase === 'tokens-review' ||
                      phase === 'stitch-parity'))
                ) {
                  setDesignRunPhase('tokens')
                  const phaseLabel = t(`ed.design.phase.${logPhase}`)
                  pushLog(
                    phaseLabel === `ed.design.phase.${logPhase}`
                      ? t('ed.design.phase.design-md')
                      : phaseLabel,
                    'pending',
                    'design',
                  )
                } else if (logPhase === 'layout' || (!compactPhases && phase === 'layout-planning')) {
                  setDesignRunPhase('plan')
                  pushLog(t(`ed.design.phase.${logPhase}`), 'pending', 'design')
                } else if (
                  logPhase === 'html' ||
                  logPhase === 'html-refine' ||
                  logPhase === 'assets' ||
                  (!compactPhases &&
                    (phase === 'content-generation' ||
                      phase === 'html-build:monolith' ||
                      phase === 'html-build:incremental' ||
                      phase === 'html-build:sequential-fallback' ||
                      phase === 'asset-planning' ||
                      phase === 'asset-generation'))
                ) {
                  if (phase.startsWith('html-build:incomplete:')) {
                    const ids = phase.slice('html-build:incomplete:'.length)
                    designLog('ed.design.logHtmlIncomplete', 'error', { pages: ids })
                  } else {
                    setDesignRunPhase('pages')
                    pushLog(t(`ed.design.phase.${logPhase}`), 'pending', 'design')
                  }
                } else if (compactMacro) {
                  /* fase técnica ya cubierta por macro compacta */
                } else if (phase.startsWith('page-part:')) {
                  setDesignRunPhase('pages')
                  const parts = phase.slice('page-part:'.length).split(':')
                  const pageId = parts[0]?.trim()
                  if (pageId) setStreamingPageId(pageId)
                  designLog('ed.design.logHtmlPart', 'pending', {
                    page: humanizeDesignPageId(pageId ?? ''),
                    part: parts.slice(1).join(':') || '…',
                  })
                } else if (phase.startsWith('page:')) {
                  setDesignRunPhase('pages')
                  const parts = phase.slice('page:'.length).split(':')
                  const pageId = parts[0]?.trim()
                  if (parts[1] === 'html-review') {
                    setStreamingPageId(null)
                    designLog('ed.design.logHtmlReview', 'pending', {
                      page: humanizeDesignPageId(pageId ?? ''),
                    })
                  } else if (parts[1] === 'html-failed') {
                    setStreamingPageId(null)
                    designLog('ed.design.logHtmlFailed', 'error', {
                      page: humanizeDesignPageId(pageId ?? ''),
                      reason: parts.slice(2).join(':') || '…',
                    })
                  } else if (pageId) {
                    setStreamingPageId(pageId)
                    designLog('ed.design.logHtmlOne', 'pending', {
                      page: humanizeDesignPageId(pageId ?? ''),
                      progress: parts[1] ?? '',
                    })
                  }
                } else if (phase.startsWith('mockup:')) {
                  const parts = phase.slice('mockup:'.length).split(':')
                  designLog('ed.design.logMockupOne', 'pending', {
                    page: humanizeDesignPageId(parts[0] ?? ''),
                    progress: parts[1] ?? '',
                  })
                } else if (phase.startsWith('page-assets:')) {
                  const parts = phase.slice('page-assets:'.length).split(':')
                  designLog('ed.design.logPageImages', 'pending', {
                    page: humanizeDesignPageId(parts[0] ?? ''),
                    progress: parts[1] ?? '',
                  })
                } else if (phase === 'images') {
                  designLog('ed.design.logImages', 'pending')
                } else if (phase === 'images-failed') {
                  designLog('ed.design.logImagesFailed', 'error')
                } else if (phase.startsWith('images-unavailable:')) {
                  const reason = phase.slice('images-unavailable:'.length)
                  const key =
                    reason === 'trial'
                      ? 'ed.design.logImagesUnavailableTrial'
                      : reason === 'admin'
                        ? 'ed.design.logImagesUnavailableAdmin'
                        : reason === 'models'
                          ? 'ed.design.logImagesUnavailableModels'
                          : 'ed.design.logImagesUnavailableVertex'
                  designLog(key, 'error')
                } else if (phase.startsWith('html:')) {
                  const parts = phase.slice('html:'.length).split(':')
                  designLog('ed.design.logHtmlOne', 'pending', {
                    page: humanizeDesignPageId(parts[0] ?? ''),
                    progress: parts[1] ?? '',
                  })
                } else if (phase.startsWith('image:')) {
                  const name = phase.slice('image:'.length).split('/').pop() ?? phase
                  designLog('ed.design.logImageOne', 'pending', { name })
                }
              },
              onError: (msg) => {
                designStreamFailed = true
                throw new Error(msg)
              },
              onFiles: async (payload) => {
                const paths = applyDesignStreamFiles(payload)
                if (paths.length) {
                  setPagePreviewStamps((prev) => bumpPagePreviewStampsFromPaths(prev, paths))
                }
                if (
                  paths.some((p) => p.endsWith('.html')) ||
                  paths.includes(DESIGN_SPEC_JSON) ||
                  paths.includes(DESIGN_SPEC_MD) ||
                  paths.includes(DESIGN_TOKENS_PATH)
                ) {
                  void reloadDesignSurfaceFromServer()
                }
                if (isDemoProjectId(projectId)) {
                  updateDemoProject(projectId, { designPhase: 'design' })
                }
                if (refreshFilesTimerRef.current) {
                  clearTimeout(refreshFilesTimerRef.current)
                  refreshFilesTimerRef.current = null
                }
                refreshFilesTimerRef.current = setTimeout(() => {
                  refreshFilesTimerRef.current = null
                  void flushRefreshFiles()
                }, 50)
              },
              onDone: async () => {
                await flushRefreshFiles()
                await reloadDesignSurfaceFromServer()
                const builtId = lastGeneratedPageIdRef.current
                if (replaceDesign && builtId) {
                  setActivePageId(builtId)
                }
              },
            },
          { signal },
        )
        if (signal.aborted) {
          finalizeAgentPhasesOnStop()
          return
        }
        setElementPins([])
        setCanvasPins([])

        if (!designStreamFailed) {
          pushLog(t('ed.design.logDone'), 'done', 'design')
          if (isDemoProjectId(projectId)) {
            updateDemoProject(projectId, { designPhase: 'design' })
          }
        }
        await refreshDesignSurface()
        await reloadDesignSurfaceFromServer()
        if (!designStreamFailed) {
          setStreamCanvasOverlay(null)
          setStreamReplaceDesign(false)
        }
      } catch (e) {
        if (signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
          finalizeAgentPhasesOnStop()
          return
        }
        const raw = e instanceof Error ? e.message : ''
        const generic = /vertex|google\s*cloud|agent\s*platform/i.test(raw)
        pushLog(generic ? t('ed.design.error') : raw || t('ed.design.error'), 'error', agentPhaseRef.current)
      } finally {
        if (designAbortRef.current === abort) designAbortRef.current = null
        setStreamingPageId(null)
        setDesignRunPhase('idle')
        specKitPlanRunRef.current = false
        setBusy(false)
      }
    },
    [
      projectId,
      projectName,
      framework,
      modelChoice,
      deviceBreakpoint,
      designJson,
      pages,
      designPaths,
      serverDesignSurface,
      streamCanvasOverlay?.pages,
      elementPins,
      selectedPageIds,
      canvasPins,
      flushRefreshFiles,
      reloadDesignSurfaceFromServer,
      refreshDesignSurface,
      onRefreshFiles,
      setBusy,
      pushLog,
      finalizeAgentPhasesOnStop,
      designLog,
      applyDesignStreamFiles,
      scheduleRefreshFiles,
      bumpCanvasPreviewStamps,
      t,
    ],
  )

  const runApprove = useCallback(async () => {
    setBusy(true)
    try {
      const res = await apiFetch<{ designApprovedAt: string }>(
        `/api/projects/${projectId}/design/approve`,
        { method: 'POST', body: '{}' },
      )
      onApprove(res.designApprovedAt)
      pushLog(t('ed.design.approved'), 'done')
    } finally {
      setBusy(false)
    }
  }, [projectId, onApprove, setBusy, pushLog, t])

  function readLinkResolutionStats(files: Array<{ path: string; content: string }>): {
    resolved: number
    total: number
  } | null {
    const raw = files.find((f) => f.path === 'spec/link-validation.json')?.content
    if (!raw?.trim()) return null
    try {
      const parsed = JSON.parse(raw) as {
        summary?: { scanned?: number; unresolved?: number }
      }
      const total = Number(parsed.summary?.scanned ?? 0)
      const unresolved = Number(parsed.summary?.unresolved ?? 0)
      if (!Number.isFinite(total) || total <= 0) return null
      const resolved = Math.max(0, total - Math.max(0, unresolved))
      return { resolved, total }
    } catch {
      return null
    }
  }

  const runConvert = useCallback(async () => {
    agentPhaseRef.current = 'code'
    setBusy(true)
    designAbortRef.current?.abort()
    const abort = new AbortController()
    designAbortRef.current = abort
    const { signal } = abort
    pushLog(t('ed.design.logConvert'), 'pending', 'code')
    try {
      if (!designApprovedAt) {
        const approved = await apiFetch<{ designApprovedAt: string }>(
          `/api/projects/${projectId}/design/approve`,
          { method: 'POST', body: '{}', signal },
        )
        if (signal.aborted) return
        onApprove(approved.designApprovedAt)
      }

      const templates =
        codeTemplates.length > 0 ? [...new Set(codeTemplates)] : [codeTemplate]
      for (const tpl of templates) {
        if (signal.aborted) return
        pushLog(`${t('ed.design.logConvert')} [${tpl}]`, 'pending', 'code')
        await consumeDesignConvertStream(
          projectId,
          {
            prompt: t('ed.design.convertPrompt'),
            framework,
            codeTemplate: tpl,
            projectName,
            model: modelChoice,
            selectedPageIds: [...selectedPageIds],
          },
          {
            onFiles: async (files) => {
              const linkStats = readLinkResolutionStats(files)
              await onRefreshFiles()
              if (linkStats) {
                pushLog(
                  t('ed.design.logLinksResolved')
                    .replace('{resolved}', String(linkStats.resolved))
                    .replace('{total}', String(linkStats.total)),
                  'done',
                  'code',
                )
              }
            },
            onDone: () => {
              pushLog(`${t('ed.design.converted')} [${tpl}]`, 'done', 'code')
            },
            onError: (msg) => pushLog(msg, 'error', 'code'),
          },
          { signal },
        )
      }
      onConvertDone()
      if (signal.aborted) return
    } catch (e) {
      if (signal.aborted || (e instanceof Error && e.name === 'AbortError')) return
      pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error', 'code')
    } finally {
      if (designAbortRef.current === abort) designAbortRef.current = null
      setBusy(false)
    }
  }, [
    projectId,
    projectName,
    framework,
    codeTemplates,
    codeTemplate,
    modelChoice,
    selectedPageIds,
    designApprovedAt,
    onApprove,
    onConvertDone,
    onRefreshFiles,
    setBusy,
    pushLog,
    t,
  ])

  const clearComposerMarkers = useCallback(() => {
    setCanvasPins([])
    setElementPins([])
    setAreaPinDraft(null)
    setElementPinDraft(null)
  }, [])

  const requestDesignGenerate = useCallback(
    async (prompt: string, opts?: DesignGenerateOptions) => {
      const designPrompt = prompt.trim() || t('ed.design.defaultGeneratePrompt')
      const hasSelectedPages = selectedPageIds.size > 0
      const hasElementOrAreaPins = elementPins.length > 0 || canvasPins.length > 0
      const isModify = Boolean(
        opts?.modify || hasSelectedPages || hasElementOrAreaPins,
      )

      if (isModify || designClarifyQuestionsEnabled === false) {
        await runGenerate(designPrompt, opts)
        return
      }

      clarifyAbortRef.current?.abort()
      const abort = new AbortController()
      clarifyAbortRef.current = abort
      setClarifyLoading(true)
      pushLog(t('ed.design.clarify.loading'), 'pending', 'design')

      try {
        const result = await fetchDesignClarify(
          projectId,
          { prompt: designPrompt, model: modelChoice },
          abort.signal,
        )
        if (abort.signal.aborted) return
        if (result.questions.length > 0) {
          setClarifySession({ prompt: designPrompt, opts, questions: result.questions })
          pushLog(t('ed.design.clarify.waiting'), 'pending', 'design')
        } else {
          await runGenerate(designPrompt, opts)
        }
      } catch (e) {
        if (abort.signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
          return
        }
        await runGenerate(designPrompt, opts)
      } finally {
        if (clarifyAbortRef.current === abort) clarifyAbortRef.current = null
        setClarifyLoading(false)
      }
    },
    [
      projectId,
      modelChoice,
      designClarifyQuestionsEnabled,
      selectedPageIds,
      elementPins,
      canvasPins,
      runGenerate,
      pushLog,
      t,
    ],
  )

  const completeClarify = useCallback(
    async (answers: DesignClarifyAnswer[], skipped: boolean) => {
      const session = clarifySession
      setClarifySession(null)
      if (!session) return
      const block = skipped
        ? ''
        : formatClarificationPromptBlock(answers, session.questions)
      const enrichedPrompt = block ? `${session.prompt}\n\n${block}` : session.prompt
      await runGenerate(enrichedPrompt, session.opts)
    },
    [clarifySession, runGenerate],
  )

  React.useImperativeHandle(ref, () => ({
    approve: runApprove,
    convert: runConvert,
    generate: (prompt?: string, opts?: DesignGenerateOptions) =>
      requestDesignGenerate(prompt?.trim() || t('ed.design.defaultGeneratePrompt'), {
        images: opts?.images,
        modify: opts?.modify,
        generateImages: opts?.generateImages,
        imageModelId: opts?.imageModelId,
        brief: opts?.brief,
      }),
    reimagine: (prompt?: string) =>
      runGenerate(prompt?.trim() || t('ed.design.defaultGeneratePrompt'), {
        modify: Boolean(activePageId && hasMockup),
      }),
    undo: undoDesignEdit,
    redo: redoDesignEdit,
    clearComposerMarkers,
    refreshIframe: refreshDesignSurface,
    applyDeviceBreakpoint: applyDeviceBreakpointToCanvas,
    openFigmaImport: () => setFigmaImportOpen(true),
    openStitchImport: () => {
      void requestStitchImport()
    },
    openCanvasImageUpload: () => requestCanvasImageUpload(),
    getChatContext: () => ({
      activePageId,
      hasMockup: hasMockup || screenPages.length > 0,
    }),
    pushActivity: pushLog,
  }))

  const pageHeightCommitTimersRef = React.useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  )

  const patchLocalDesignJsonHeight = useCallback(
    (designJson: string, specPageId: string, height: number) => {
      const parsed = parseDesignSpec(designJson)
      if (!parsed?.pages?.length) return designJson
      return JSON.stringify(
        {
          ...parsed,
          pages: parsed.pages.map((p) =>
            p.id === specPageId ? { ...p, height } : p,
          ),
        },
        null,
        2,
      )
    },
    [],
  )

  const handlePageContentHeightMeasured = useCallback(
    (pageId: string, height: number) => {
      // Mantiene estable la altura base del spec al previsualizar en tablet/mobile.
      if (deviceBreakpoint !== 'desktop') return
      const primaryId = canvasPrimaryPageId(pageId)
      const specId = designSpecPageId(pageId)
      const page = pages.find((p) => p.id === pageId || p.id === primaryId)
      if (!page || page.frameType === 'designSystem' || page.frameType === 'prototype') {
        return
      }
      const specH = page.height ?? 0
      const cachedH = pageContentHeightsRef.current.get(specId)
      // Spec ya inflado: solo permitir corregir hacia abajo, no reconfirmar alturas enormes.
      if (
        specH > CANVAS_FRAME_VIEWPORT_MAX &&
        Math.abs(height - specH) < 64
      ) {
        return
      }
      // Evita persistir un “encogimiento” tras refresh (medición en iframe recién bajo).
      if (
        cachedH != null &&
        cachedH > CANVAS_FRAME_VIEWPORT_MAX &&
        height < cachedH - 48 &&
        height < specH - 48
      ) {
        return
      }
      if (
        specH > 0 &&
        specH <= CANVAS_FRAME_VIEWPORT_MAX &&
        height < specH - 48
      ) {
        return
      }
      if (Math.abs(specH - height) < 48) return

      pageContentHeightsRef.current.set(specId, height)
      setPageContentHeightsVersion((v) => v + 1)

      const timers = pageHeightCommitTimersRef.current
      const prev = timers.get(specId)
      if (prev) clearTimeout(prev)
      timers.set(
        specId,
        setTimeout(() => {
          timers.delete(specId)
          void apiFetch(`/api/projects/${projectId}/design/pages`, {
            method: 'PATCH',
            body: JSON.stringify({ pageId: specId, height }),
          })
            .then(() => {
              setServerDesignSurface((surface) => {
                if (!surface?.designJson) return surface
                return {
                  ...surface,
                  designJson: patchLocalDesignJsonHeight(
                    surface.designJson,
                    specId,
                    height,
                  ),
                }
              })
            })
            .catch(() => {
              /* Página aún no en spec (stream) o marco transitorio */
            })
        }, 800),
      )
    },
    [pages, projectId, deviceBreakpoint, patchLocalDesignJsonHeight],
  )

  const commitPagePosition = useCallback(
    async (rawPageId: string, x: number, y: number) => {
      const pageId = designSpecPageId(rawPageId)
      try {
        await apiFetch(`/api/projects/${projectId}/design/pages`, {
          method: 'PATCH',
          body: JSON.stringify({ pageId, x, y }),
        })
        scheduleRefreshFiles()
      } catch {
        /* Página aún no en spec (stream) o marco transitorio — no romper el lienzo */
      }
    },
    [projectId, scheduleRefreshFiles],
  )
  const bounds = useMemo(() => {
    if (!pages.length) {
      if (busy) {
        const preset = DESIGN_BREAKPOINT_PRESETS[deviceBreakpoint]
        return { x: 0, y: 0, width: preset.width + 120, height: preset.height + 200 }
      }
      return { x: 0, y: 0, width: 800, height: 600 }
    }
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = 0
    let maxY = 0
    for (const p of pages) {
      const px = p.x ?? 0
      const py = p.y ?? 0
      const w = p.width ?? 390
      const specId = designSpecPageId(p.id)
      const measuredH =
        pageContentHeightsRef.current.get(specId) ??
        pageContentHeightsRef.current.get(canvasPrimaryPageId(p.id))
      const frameH =
        (measuredH && measuredH > 0
          ? Math.max(canvasFrameHeight(p), measuredH)
          : canvasFrameHeight(p)) + 80
      minX = Math.min(minX, px)
      minY = Math.min(minY, py)
      maxX = Math.max(maxX, px + w)
      maxY = Math.max(maxY, py + frameH)
    }
    const safeMinX = Number.isFinite(minX) ? minX : 0
    const safeMinY = Number.isFinite(minY) ? minY : 0
    return {
      x: safeMinX,
      y: safeMinY,
      width: Math.max(1, maxX + 120),
      height: Math.max(1, maxY + 120),
    }
  }, [pages, busy, deviceBreakpoint, pageContentHeightsVersion])
  const boundsRef = React.useRef(bounds)
  boundsRef.current = bounds

  const boundsViewportKey = useMemo(() => {
    if (!pages.length) return `empty:${busy ? 1 : 0}`
    return pages
      .map(
        (p) =>
          `${p.id}:${p.x ?? 0}:${p.y ?? 0}:${p.width ?? 0}:${p.frameType ?? ''}`,
      )
      .join('|')
  }, [pages, busy])

  const canvasInteraction =
    canvasTool === 'pan' ? 'hand' : canvasTool === 'select' ? 'select' : 'neutral'
  const viewport = useDesignCanvasViewport(canvasInteraction)

  useEffect(() => {
    const b = boundsRef.current
    if (pendingBreakpointFitRef.current) {
      pendingBreakpointFitRef.current = false
      viewport.fitToContent(b, { force: true })
    } else {
      viewport.applyDefaultView(b)
    }
  }, [boundsViewportKey, viewport.applyDefaultView, viewport.fitToContent])

  useEffect(() => {
    const el = viewport.viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      viewport.applyDefaultView(boundsRef.current)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewport.applyDefaultView])

  useEffect(() => {
    if (!themePanelOpen && !sidePanelOpen) return
    setElementActionMenuOpen(false)

    function onPointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest('.web-studio-tools-rail')) return
      if (target.closest('.web-studio-theme-float')) return
      if (target.closest('.web-studio-element-panel')) return
      if (target.closest('.insp2-color-popover')) return

      if (themePanelOpen) {
        setThemePanelOpen(false)
        setCanvasTool((tool) => (tool === 'palette' ? 'select' : tool))
      }
      if (sidePanelOpen) {
        discardPropertiesEdits()
        setSidePanelOpen(false)
        setCanvasTool((tool) => (tool === 'properties' ? 'select' : tool))
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [themePanelOpen, sidePanelOpen, discardPropertiesEdits])

  useEffect(() => {
    if (canvasTool !== 'edit') setElementActionMenuOpen(false)
  }, [canvasTool])

  useEffect(() => {
    if (canvasTool !== 'connect') return
    if (!selectedElement?.skId) {
      return
    }
    const fromPageId = canvasPrimaryPageId(messageSourcePageIdRef.current ?? activePageId ?? '')
    if (!fromPageId) {
      return
    }
    const fromPageName = pages.find((p) => p.id === fromPageId)?.name ?? fromPageId
    setPendingConnection({
      fromPageId,
      fromPageName,
      fromSkId: selectedElement.skId,
      fromTagName: selectedElement.tagName,
    })
  }, [canvasTool, selectedElement, activePageId, pages, pendingConnection])

  const handleCanvasToolChange = useCallback(
    (tool: WebStudioCanvasTool) => {
      if (
        activePageIsImage &&
        (tool === 'edit' || tool === 'connect' || tool === 'properties' || tool === 'palette')
      ) {
        setCanvasTool('select')
        setSidePanelOpen(false)
        return
      }
      if (tool === 'palette') {
        setElementActionMenuOpen(false)
        const opening = !themePanelOpen || canvasTool !== 'palette'
        if (sidePanelOpen) discardPropertiesEdits()
        setThemePanelOpen(opening)
        setSidePanelOpen(false)
        setCanvasTool(opening ? 'palette' : 'select')
        cancelPlacement()
        elementEditor.closeInlineEdit()
        if (!opening) clearSelection()
        return
      }
      if (tool === 'properties') {
        setElementActionMenuOpen(false)
        const opening = !sidePanelOpen || canvasTool !== 'properties'
        if (!opening) discardPropertiesEdits()
        setSidePanelOpen(opening)
        setThemePanelOpen(false)
        setCanvasTool(opening ? 'properties' : 'select')
        cancelPlacement()
        elementEditor.closeInlineEdit()
        return
      }
      if (tool === 'edit') {
        if (sidePanelOpen) discardPropertiesEdits()
        setSidePanelOpen(false)
        setThemePanelOpen(false)
        setPendingConnection(null)
        setCanvasTool('edit')
        cancelPlacement()
        elementEditor.closeInlineEdit()
        return
      }
      if (tool === 'connect') {
        if (canvasTool === 'connect') {
          // Re-click on link tool restarts the connection flow.
          setPendingConnection(null)
          clearSelection()
          setCanvasTool('connect')
          return
        }
        if (sidePanelOpen) discardPropertiesEdits()
        setSidePanelOpen(false)
        setThemePanelOpen(false)
        cancelPlacement()
        elementEditor.closeInlineEdit()
        if (!selectedElement?.skId) {
          pushLog(t('ed.design.connect.pickElement'), 'done')
        } else {
          const fromPageId = canvasPrimaryPageId(messageSourcePageIdRef.current ?? activePageId ?? '')
          if (fromPageId) {
            const fromPageName = pages.find((p) => p.id === fromPageId)?.name ?? fromPageId
            setPendingConnection({
              fromPageId,
              fromPageName,
              fromSkId: selectedElement.skId,
              fromTagName: selectedElement.tagName,
            })
            pushLog(
              t('ed.design.connect.ready')
                .replace('{from}', fromPageName)
                .replace('{skId}', selectedElement.skId),
              'done',
            )
          }
        }
        setCanvasTool('connect')
        return
      }
      setElementActionMenuOpen(false)
      if (sidePanelOpen) discardPropertiesEdits()
      setSidePanelOpen(false)
      setThemePanelOpen(false)
      elementEditor.closeInlineEdit()
      cancelPlacement()
      setPendingConnection(null)
      if (tool === 'pan' || tool === 'select') clearSelection()
      if (tool !== 'rect') setAreaPinDraft(null)
      setElementPinDraft(null)
      setCanvasTool(tool)
    },
    [
      activePageIsImage,
      canvasTool,
      sidePanelOpen,
      themePanelOpen,
      activePageId,
      elementEditor,
      clearSelection,
      cancelPlacement,
      discardPropertiesEdits,
      selectedElement,
      pages,
      pushLog,
      t,
    ],
  )

  useEffect(() => {
    if (canvasTool !== 'connect') return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      const hadPending = Boolean(pendingConnection)
      setPendingConnection(null)
      clearSelection()
      if (hadPending) pushLog(t('ed.design.connect.cancelled'), 'done')
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [canvasTool, pendingConnection, clearSelection, pushLog, t])

  const handleElementActionMenu = useCallback(
    (action: 'editText' | 'aiEdit' | 'properties' | 'delete' | 'replaceImage') => {
      if (!selectedElement) return
      setElementActionMenuOpen(false)
      if (action === 'replaceImage') {
        imageReplaceInputRef.current?.click()
        return
      }
      if (action === 'editText') {
        elementEditor.editText()
        return
      }
      if (action === 'delete') {
        elementEditor.deleteElement(selectedElement)
        return
      }
      if (action === 'properties') {
        setSidePanelOpen(true)
        setThemePanelOpen(false)
        setCanvasTool('properties')
        setVisualMode('select')
        syncBridgeMode('select')
        return
      }
      if (action !== 'aiEdit') return
      const sourcePageId = messageSourcePageIdRef.current
      const pin = resolvePinPage(selectedElement, sourcePageId)
      if (!pin) return
      const key = elementPinKey(pin)
      const existing = elementPins.find((p) => elementPinKey(p) === key)
      setElementPinDraft({
        ...pin,
        rect: selectedElement.rect,
        label: existing?.label ?? nextElementPinLabel(elementPins),
        description: existing?.description,
      })
      elementEditor.closeInlineEdit()
      clearSelection()
    },
    [selectedElement, elementEditor, syncBridgeMode, resolvePinPage, elementPins, clearSelection],
  )

  function togglePageSelection(page: DesignPageMeta) {
    if (
      page.frameType === 'prototype' ||
      page.frameType === 'designSystem' ||
      isMockupCompanionCanvasPage(page)
    ) {
      return
    }
    const id = canvasPrimaryPageId(page.id)
    setSelectedPageIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const removePagePin = useCallback((pin: DesignPageContextPin) => {
    const key = pagePinKey(pin)
    setSelectedPageIds((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const fallbackAgentPhases = useMemo<DesignAgentPhaseBlock[]>(
    () => [
      {
        phase: 'design',
        steps: [
          { id: 'fallback-clarify', message: t('ed.design.clarify.loading'), status: 'done' },
          {
            id: 'fallback-design-system',
            message: t('ed.design.phase.design-system'),
            status: 'done',
          },
          { id: 'fallback-stop-1', message: t('ed.design.stopped'), status: 'done' },
          { id: 'fallback-stop-2', message: t('ed.design.stopped'), status: 'done' },
        ],
      },
    ],
    [t],
  )
  const activityPhases =
    busy || agentPhases.some((block) => block.steps.length > 0)
      ? agentPhases
      : fallbackAgentPhases

  const menuPageId = canvasMenu?.pageId ?? activePageId

  const saveDesignTheme = useCallback(
    async (payload: { tokens: DesignTokens; designMd?: string; scope?: 'page' | 'all' }) => {
      setThemeSaving(true)
      try {
        await apiFetch(`/api/projects/${projectId}/design/theme`, {
          method: 'POST',
          body: JSON.stringify({
            tokens: payload.tokens,
            colorMode: payload.tokens.colorMode,
            colors: payload.tokens.colors,
            designMd: payload.designMd,
            pageId: payload.scope === 'page' ? (activePageId ?? undefined) : undefined,
          }),
        })
        await flushRefreshFiles()
        await refreshDesignSurface()
        pushLog(t('ed.design.themeApplied'), 'done')
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
        throw e
      } finally {
        setThemeSaving(false)
      }
    },
    [projectId, activePageId, flushRefreshFiles, refreshDesignSurface, pushLog, t],
  )

  const runReimagine = useCallback(async () => {
    const rawPageId = menuPageId ?? activePageId
    if (!rawPageId) return
    const pageId = canvasPrimaryPageId(rawPageId)
    setBusy(true)
    pushLog(t('ed.design.logReimagine'), 'pending')
    try {
      await apiFetch(`/api/projects/${projectId}/design/reimagine`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: t('ed.design.reimagineDefault'),
          pageId,
        }),
      })
      pushLog(t('ed.design.reimagined'), 'done')
      await flushRefreshFiles()
    } catch (e) {
      pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
    } finally {
      setBusy(false)
    }
  }, [projectId, menuPageId, activePageId, pushLog, t, flushRefreshFiles, setBusy])

  const focusPageInViewport = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return
      setActivePageId(pageId)
      viewport.focusOnRect({
        x: page.x ?? 0,
        y: page.y ?? 0,
        width: page.width ?? 390,
        height: (page.height ?? 844) + 80,
      })
    },
    [pages, viewport],
  )

  const requestCanvasImageUpload = useCallback(() => {
    canvasImageInputRef.current?.click()
  }, [])

  async function requestStitchImport() {
    const stitchProjectId = window.prompt(
      'ID del proyecto Stitch a importar (ej: projects/123 o 123):',
      '',
    )?.trim()
    if (!stitchProjectId) return

    const titleGuess = window
      .prompt('Título para este diseño importado (opcional):', projectName || 'Stitch import')
      ?.trim()

    setBusy(true)
    pushLog('Conectando con Stitch…', 'pending')
    try {
      const conn = await apiFetch<{ ok: boolean; message?: string }>(
        '/api/auto/stitch/connect',
        {
          method: 'POST',
          body: JSON.stringify({ projectId: stitchProjectId }),
        },
      )
      if (!conn.ok) {
        throw new Error(conn.message || 'No se pudo conectar con Stitch')
      }

      pushLog('Importando pantallas desde Stitch…', 'pending')
      const res = await apiFetch<{ count: number; pageIds: string[] }>(
        `/api/projects/${projectId}/design/stitch/import`,
        {
          method: 'POST',
          body: JSON.stringify({
            stitchProjectId,
            projectTitle: titleGuess || projectName || 'Stitch import',
          }),
        },
      )

      await flushRefreshFiles()
      await refreshDesignSurface()
      const firstPageId = res.pageIds?.[0]
      if (firstPageId) {
        setActivePageId(firstPageId)
        focusPageInViewport(firstPageId)
      }
      pushLog(`Importación Stitch completada (${res.count} pantallas).`, 'done')
    } catch (e) {
      pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onCanvasImageFileChange = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      const form = new FormData()
      form.append('file', file)
      setBusy(true)
      pushLog(t('ed.design.logUploadImage'), 'pending')
      try {
        const res = await apiFetch<{ pageId: string }>(
          `/api/projects/${projectId}/design/upload`,
          { method: 'POST', body: form },
        )
        await flushRefreshFiles()
        await refreshDesignSurface()
        setActivePageId(res.pageId)
        focusPageInViewport(res.pageId)
        pushLog(t('ed.design.logUploadImageDone'), 'done')
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
      } finally {
        setBusy(false)
        if (canvasImageInputRef.current) canvasImageInputRef.current.value = ''
      }
    },
    [
      projectId,
      flushRefreshFiles,
      refreshDesignSurface,
      focusPageInViewport,
      pushLog,
      setBusy,
      t,
    ],
  )

  const handleReplaceImageFile = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (!file || !selectedElement || !isVisualEditImageElement(selectedElement)) return

      const htmlPath = resolveActiveHtmlPath()
      if (!htmlPath) return

      setBusy(true)
      try {
        const content = await readImageFileAsDataUrl(file)
        const fileName = `replacement-${Date.now()}.${imageExtensionFromMime(file.type)}`
        const { projectPath, srcAttr } = designPageAssetPaths(htmlPath, fileName)

        await apiFetch(`/api/projects/${projectId}/files`, {
          method: 'PUT',
          body: JSON.stringify({ path: projectPath, content }),
        })

        const patch: VisualPatch = {
          skId: selectedElement.skId,
          property: 'src',
          value: srcAttr,
        }
        applyPatch(patch)
        await persistPatch(patch, selectedElement)
        setInspectorSync('applied')
        window.setTimeout(() => setInspectorSync('idle'), 2400)
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.replaceImageError'), 'error')
      } finally {
        setBusy(false)
        if (imageReplaceInputRef.current) imageReplaceInputRef.current.value = ''
      }
    },
    [
      selectedElement,
      resolveActiveHtmlPath,
      projectId,
      persistPatch,
      applyPatch,
      pushLog,
      setBusy,
      t,
    ],
  )

  const duplicatePage = useCallback(
    async (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page || page.frameType === 'prototype' || page.frameType === 'designSystem') return
      const path = page.path || pageHtmlPath(pageId)
      const content = getWorkspaceFiles?.()?.find((f) => f.path === path)?.content ?? ''
      setBusy(true)
      try {
        const res = await apiFetch<{ pageId: string; path: string }>(
          `/api/projects/${projectId}/design/pages`,
          {
            method: 'POST',
            body: JSON.stringify({ name: `${page.name.replace(/^☑\s*/, '')} (copia)` }),
          },
        )
        if (content) {
          await apiFetch(`/api/projects/${projectId}/files`, {
            method: 'PUT',
            body: JSON.stringify({ path: res.path, content }),
          })
        }
        await flushRefreshFiles()
        setActivePageId(res.pageId)
        pushLog(t('ed.design.canvasMenu.duplicated'), 'done')
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
      } finally {
        setBusy(false)
      }
    },
    [pages, projectId, getWorkspaceFiles, flushRefreshFiles, pushLog, t, setBusy],
  )

  const deletePage = useCallback(
    async (rawPageId: string) => {
      const pageId = canvasPrimaryPageId(rawPageId)
      const target = pages.find((p) => p.id === pageId || p.id === rawPageId)
      if (
        target?.frameType === 'designSystem' ||
        target?.frameType === 'prototype' ||
        pageId === DESIGN_SYSTEM_PAGE_ID ||
        pageId === PROTOTYPE_PAGE_ID
      ) {
        return
      }
      if (screenPages.length <= 1) return
      setBusy(true)
      try {
        await apiFetch(
          `/api/projects/${projectId}/design/pages?pageId=${encodeURIComponent(pageId)}`,
          { method: 'DELETE' },
        )
        await flushRefreshFiles()
        pushLog(t('ed.design.canvasMenu.deleted'), 'done')
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
      } finally {
        setBusy(false)
      }
    },
    [screenPages.length, projectId, flushRefreshFiles, pushLog, t, setBusy],
  )

  const persistPrototypeLinks = useCallback(
    async (links: PrototypeLink[]) => {
      await apiFetch(`/api/projects/${projectId}/design/links`, {
        method: 'PATCH',
        body: JSON.stringify({ links }),
      })
      await flushRefreshFiles()
    },
    [projectId, flushRefreshFiles],
  )

  const startRenamePage = useCallback(
    (rawPageId: string) => {
      const pageId = canvasPrimaryPageId(rawPageId)
      const page = pages.find((p) => p.id === pageId || p.id === rawPageId)
      if (!page || page.frameType === 'prototype' || page.frameType === 'designSystem') return
      setRenamingPageId(page.id)
      setRenameDraft(page.name.replace(/^☑\s*/, '').trim())
    },
    [pages],
  )

  const cancelRenamePage = useCallback(() => {
    setRenamingPageId(null)
    setRenameDraft('')
  }, [])

  const submitRenamePage = useCallback(
    async (rawPageId: string) => {
      const pageId = canvasPrimaryPageId(rawPageId)
      const page = pages.find((p) => p.id === pageId || p.id === rawPageId)
      if (!page || page.frameType === 'prototype' || page.frameType === 'designSystem') return
      const currentName = page.name.replace(/^☑\s*/, '').trim()
      const nextName = renameDraft.trim()
      if (!nextName || nextName === currentName) {
        cancelRenamePage()
        return
      }
      setBusy(true)
      try {
        await apiFetch(`/api/projects/${projectId}/design/pages`, {
          method: 'PATCH',
          body: JSON.stringify({ pageId, name: nextName }),
        })
        await flushRefreshFiles()
        pushLog(t('ed.design.canvasMenu.renamed').replace('{name}', nextName), 'done')
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
      } finally {
        setBusy(false)
        cancelRenamePage()
      }
    },
    [pages, renameDraft, projectId, flushRefreshFiles, pushLog, t, setBusy, cancelRenamePage],
  )

  const connectSelectedElementToPage = useCallback(
    async (targetRawPageId: string) => {
      if (connectInFlightRef.current) return
      const toPageId = canvasPrimaryPageId(targetRawPageId)
      const toPage = pages.find((p) => p.id === toPageId || p.id === targetRawPageId)
      if (!toPage || toPage.frameType === 'prototype' || toPage.frameType === 'designSystem') return
      const sourcePageRaw =
        pendingConnection?.fromPageId ?? messageSourcePageIdRef.current ?? activePageId
      const fromPageId = canvasPrimaryPageId(sourcePageRaw ?? '')
      if (!fromPageId) {
        pushLog(t('ed.design.connect.missingSourcePage'), 'error')
        return
      }
      if (fromPageId === toPageId) {
        pushLog(t('ed.design.connect.samePage'), 'error')
        return
      }
      const sourceSkId = pendingConnection?.fromSkId ?? selectedElement?.skId
      const sourceTagName = pendingConnection?.fromTagName ?? selectedElement?.tagName
      if (!sourceSkId || !sourceTagName) {
        pushLog(t('ed.design.connect.pickElement'), 'error')
        return
      }
      connectInFlightRef.current = true
      const sourcePath = pageHtmlPath(fromPageId)
      const sourceHtml =
        getWorkspaceFiles?.()?.find((f) => f.path === sourcePath)?.content ?? ''
      const levelSkIds = resolveSiblingLevelSkIdsFromHtml(sourceHtml, sourceSkId, sourceTagName)
      const newLinks: PrototypeLink[] = levelSkIds.map((skId) => ({
        id: nextLinkId(),
        fromPageId,
        fromSkId: skId,
        toPageId,
        label: toPage.name,
      }))
      const deduped = [
        ...prototypeLinks.filter(
          (link) =>
            !newLinks.some(
              (nextLink) =>
                link.fromPageId === nextLink.fromPageId &&
                link.fromSkId === nextLink.fromSkId &&
                link.toPageId === nextLink.toPageId,
            ),
        ),
        ...newLinks,
      ]
      setBusy(true)
      try {
        await persistPrototypeLinks(deduped)
        setActivePageId(targetRawPageId)
        // Connection finished; keep tool enabled and reset source so user can pick another link.
        setPendingConnection(null)
        clearSelection()
        pushLog(
          t('ed.design.connect.created')
            .replace('{from}', fromPageId)
            .replace('{to}', toPageId),
          'done',
        )
      } catch (e) {
        pushLog(e instanceof Error ? e.message : t('ed.design.error'), 'error')
      } finally {
        connectInFlightRef.current = false
        setBusy(false)
      }
    },
    [
      pages,
      activePageId,
      selectedElement,
      pendingConnection,
      prototypeLinks,
      persistPrototypeLinks,
      pushLog,
      t,
      setBusy,
      getWorkspaceFiles,
      clearSelection,
    ],
  )

  const openCanvasMenu = useCallback(
    (e: React.MouseEvent, target: 'canvas' | 'frame', pageId?: string, pageName?: string) => {
      e.preventDefault()
      e.stopPropagation()
      if (target === 'frame' && pageId) {
        setActivePageId(pageId)
      }
      setCanvasMenu({
        x: e.clientX,
        y: e.clientY,
        target,
        pageId,
        pageName,
      })
    },
    [],
  )

  const onCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (canvasToolRef.current === 'edit') {
        e.preventDefault()
        return
      }
      if (!isDesignCanvasBackgroundTarget(e.target)) return
      openCanvasMenu(e, 'canvas')
    },
    [openCanvasMenu],
  )

  const onFrameContextMenu = useCallback(
    (e: React.MouseEvent, page: DesignPageMeta) => {
      if (canvasToolRef.current === 'edit') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      openCanvasMenu(e, 'frame', page.id, page.name)
    },
    [openCanvasMenu],
  )

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!isVisualEditMessage(ev.data) || ev.data.channel !== VISUAL_EDIT_CHANNEL) return
      const msg = ev.data
      if (msg.type === 'preview-pointer-down') {
        setCanvasMenu(null)
        setElementActionMenuOpen(false)
        return
      }
      if (msg.type !== 'preview-context-menu') return
      const canvas = canvasAreaRef.current
      if (!canvas) return
      const iframes = canvas.querySelectorAll<HTMLIFrameElement>('iframe.design-page-frame__iframe')
      let matched: HTMLIFrameElement | null = null
      for (const iframe of iframes) {
        if (iframe.contentWindow === ev.source) {
          matched = iframe
          break
        }
      }
      if (!matched) return
      const frame = matched.closest<HTMLElement>('[data-page-id]')
      const pageId = frame?.getAttribute('data-page-id') ?? undefined
      const pageName =
        frame?.querySelector('.design-page-frame__label')?.textContent?.trim() || pageId || ''
      if (pageId) setActivePageId(pageId)
      if (canvasToolRef.current === 'edit') {
        setCanvasMenu(null)
        return
      }
      const rect = matched.getBoundingClientRect()
      setCanvasMenu({
        x: rect.left + msg.payload.clientX,
        y: rect.top + msg.payload.clientY,
        target: pageId ? 'frame' : 'canvas',
        pageId,
        pageName,
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const onCanvasContextMenuAction = useCallback(
    (action: DesignCanvasContextMenuAction) => {
      const pageId = menuPageId ?? activePageId

      if (action === 'undo') {
        void undoDesignEdit()
        return
      }
      if (action === 'redo') {
        void redoDesignEdit()
        return
      }
      if (action === 'copy' || action === 'copyAsHtml') {
        const page = pageId ? pages.find((p) => p.id === pageId) : null
        const path = page?.path ?? resolveActiveHtmlPath()
        const html =
          (path ? getWorkspaceFiles?.()?.find((f) => f.path === path)?.content : null) ??
          selectedElement?.text ??
          readActiveHtmlContent() ??
          ''
        if (html) void navigator.clipboard.writeText(html).catch(() => undefined)
        return
      }
      if (action === 'copyAsPng' && pageId) {
        const page = pages.find((p) => p.id === pageId)
        const pngPath = page
          ? page.path?.endsWith('.png')
            ? page.path
            : page.mockupPath ?? pageMockupPath(canvasPrimaryPageId(page.id))
          : null
        if (!pngPath) return
        void (async () => {
          try {
            const encoded = pngPath
              .split('/')
              .map((seg) => encodeURIComponent(seg))
              .join('/')
            const res = await fetch(
              `/api/projects/${projectId}/design/preview/file/${encoded}?k=${Date.now()}`,
            )
            if (!res.ok) throw new Error('fetch failed')
            const blob = await res.blob()
            if (!blob.type.startsWith('image/')) throw new Error('invalid image')
            const fileName = designPagePngFileName(
              normalizePageDisplayName(page?.name ?? pageId),
              canvasPrimaryPageId(pageId),
            )
            const outcome = await copyOrDownloadPagePng(blob, fileName)
            pushLog(
              outcome === 'clipboard'
                ? t('ed.design.canvasMenu.copiedPng')
                : t('ed.design.canvasMenu.downloadedPng'),
              'done',
            )
          } catch {
            pushLog(t('ed.design.canvasMenu.copyPngFailed'), 'error')
          }
        })()
        return
      }
      if (action === 'copyAsDuplicate' && pageId) {
        void duplicatePage(pageId)
        return
      }
      if (action === 'paste') {
        void promptBarRef.current?.pasteImages()
        return
      }
      if (action === 'duplicate' && pageId) {
        void duplicatePage(pageId)
        return
      }
      if (action === 'renamePage' && pageId) {
        startRenamePage(pageId)
        return
      }
      if (action === 'focus' && pageId) {
        focusPageInViewport(pageId)
        return
      }
      if (action === 'delete' && pageId) {
        void deletePage(pageId)
        return
      }
      if (action === 'generate') {
        promptBarRef.current?.focus()
        return
      }
      if (action === 'variations') {
        void runReimagine()
        return
      }
      if (action === 'regenerate') {
        void runGenerate(t('ed.design.logModify'), { modify: true })
        return
      }
      if (action === 'edit') {
        setSidePanelOpen(true)
        setThemePanelOpen(false)
        setCanvasTool('properties')
        setVisualMode('select')
        syncBridgeMode('select')
        return
      }
      if (action === 'designMd') {
        onOpenWorkspaceFile?.(DESIGN_SPEC_MD)
        return
      }
      if (action === 'previewTab' && pageId) {
        window.open(
          `/api/projects/${projectId}/design/preview?page=${encodeURIComponent(pageId)}`,
          '_blank',
        )
        return
      }
      if (action === 'showQrCode' && pageId) {
        const url = `${window.location.origin}/api/projects/${projectId}/design/preview?page=${encodeURIComponent(pageId)}`
        setQrPreviewUrl(url)
        return
      }
      if (action === 'showConnections') {
        if (prototypeLinks.length > 0) {
          setPlayOpen(true)
        } else {
          pushLog(t('ed.design.canvasMenu.noConnections'), 'done')
        }
        return
      }
      if (action === 'viewDetails') {
        setSidePanelOpen(true)
        setThemePanelOpen(false)
        setCanvasTool('properties')
        setVisualMode('select')
        syncBridgeMode('select')
        return
      }
      if (action === 'viewCode') {
        onViewCode?.()
        return
      }
      if (action === 'figmaExport' || action === 'export') {
        setFigmaExportOpen(true)
        return
      }
      if (action === 'download') {
        onDownload?.()
        return
      }
      if (action === 'reload') {
        void flushRefreshFiles().then(() => refreshAllCanvasPreviews())
        return
      }
      if (action === 'format') {
        if (selectedElement) {
          setSidePanelOpen(true)
          setThemePanelOpen(false)
          setCanvasTool('properties')
        } else {
          setThemePanelOpen(true)
          setCanvasTool('palette')
          pushLog(t('ed.design.canvasMenu.formatHint'), 'done')
        }
        promptBarRef.current?.focus()
        return
      }
      if (action === 'upload') {
        requestCanvasImageUpload()
      }
    },
    [
      menuPageId,
      activePageId,
      undoDesignEdit,
      redoDesignEdit,
      selectedElement,
      readActiveHtmlContent,
      resolveActiveHtmlPath,
      pages,
      getWorkspaceFiles,
      duplicatePage,
      startRenamePage,
      focusPageInViewport,
      deletePage,
      runReimagine,
      runGenerate,
      t,
      onOpenWorkspaceFile,
      projectId,
      onDeviceChange,
      onViewCode,
      onDownload,
      pageMockupPath,
      prototypeLinks.length,
      pushLog,
      t,
      flushRefreshFiles,
      refreshAllCanvasPreviews,
      syncBridgeMode,
      setVisualMode,
      requestCanvasImageUpload,
    ],
  )

  useEffect(() => {
    if (!renamingPageId) return
    const pageExists = pages.some((p) => p.id === renamingPageId)
    if (!pageExists) cancelRenamePage()
  }, [pages, renamingPageId, cancelRenamePage])

  return (
    <div
      className={`web-studio-workspace design-workspace web-studio-workspace--activity${sidePanelOpen ? ' web-studio-workspace--side-open' : ''}${themePanelOpen ? ' web-studio-workspace--theme-open' : ''}`}
    >
      <div className="web-studio-canvas design-canvas-main">
        <WebStudioActivityPanel phases={activityPhases} building={busy} />

        {screenPages.length > 0 ? (
          <span className="web-studio-screen-count design-canvas-selection-count">
            {t('ed.design.screensSelected')
              .replace('{n}', String(selectedPageIds.size))
              .replace('{total}', String(screenPages.length))}
          </span>
        ) : null}

        <div
          ref={canvasAreaRef}
          className={`web-studio-canvas-area design-canvas-area${canvasTool === 'pan' ? ' web-studio-canvas-area--hand' : ''}${canvasTool === 'select' ? ' web-studio-canvas-area--select' : ''}${canvasTool === 'edit' || canvasTool === 'connect' || canvasTool === 'properties' || canvasTool === 'palette' ? ' web-studio-canvas-area--edit' : ''}${canvasTool === 'rect' ? ' web-studio-canvas-area--pin-mode' : ''}`}
          onContextMenu={onCanvasContextMenu}
          onPointerDownCapture={onCanvasAreaPointerDown}
        >
          <input
            ref={canvasImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => void onCanvasImageFileChange(e.target.files)}
          />
          <input
            ref={imageReplaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => void handleReplaceImageFile(e.target.files)}
          />
          {canvasPins.length > 0 ? (
            <DesignCanvasPinOverlays
              overlays={canvasPinOverlays}
              editable={!canvasPinToolActive && canvasTool !== 'pan'}
              onPinAreaChange={(pinId, area) => {
                const pin = canvasPins.find((p) => p.id === pinId)
                const pid = pin?.pageId ? canvasPrimaryPageId(pin.pageId) : null
                if (pid) updateCanvasPinArea(pid, pinId, area)
              }}
              onPinEdit={(pinId) => {
                const pin = canvasPins.find((p) => p.id === pinId)
                const pid = pin?.pageId ? canvasPrimaryPageId(pin.pageId) : null
                if (pid) handleCanvasPinEdit(pid, pinId)
              }}
              onRemovePin={removeCanvasPin}
            />
          ) : null}
          {elementPins.length > 0 ? (
            <DesignElementPinOverlays overlays={elementPinOverlays} />
          ) : null}
          {selectedElement &&
          overlayPos &&
          canvasTool === 'palette' &&
          !elementEditor.textEditOpen ? (
            <div
              className="editor-selection-box"
              style={{
                top: overlayPos.top,
                left: overlayPos.left,
                width: overlayPos.width,
                height: overlayPos.height,
              }}
            />
          ) : null}
          {selectedElement &&
          overlayPos &&
          canvasTool === 'edit' &&
          elementActionMenuOpen &&
          !elementEditor.textEditOpen ? (
            <div
              className="web-studio-element-action-menu"
              style={{
                top: overlayPos.top + 2,
                left: overlayPos.left + overlayPos.width + 10,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isVisualEditImageElement(selectedElement) ? (
                <button type="button" onClick={() => handleElementActionMenu('replaceImage')}>
                  {t('ed.replaceImage')}
                </button>
              ) : (
                <button type="button" onClick={() => handleElementActionMenu('editText')}>
                  {t('ed.editText')}
                </button>
              )}
              <button type="button" onClick={() => handleElementActionMenu('aiEdit')}>
                {t('ed.aiEdit')}
              </button>
              <button type="button" onClick={() => handleElementActionMenu('properties')}>
                {t('ed.webStudio.toolProperties')}
              </button>
              <div className="web-studio-element-action-menu__sep" />
              <button
                type="button"
                className="web-studio-element-action-menu__danger"
                onClick={() => handleElementActionMenu('delete')}
              >
                {t('ed.delete')}
              </button>
            </div>
          ) : null}
          {selectedElement && elementEditor.textEditOpen && overlayPos ? (
            <ElementTextEditOverlay
              variant="text"
              position={overlayPos}
              elementLabel={`${selectedElement.tagName} · ${selectedElement.skId}`}
              initialText={selectedElement.text ?? ''}
              onCommit={(value) => elementEditor.commitText(selectedElement, value)}
              onCancel={() => elementEditor.closeInlineEdit()}
            />
          ) : null}
          {pages.length === 0 ? (
            <div className="web-studio-empty" role="status">
              <h3 className="web-studio-empty__title">{t('ed.design.title')}</h3>
              <p className="web-studio-empty__hint">{t('ed.design.lead')}</p>
            </div>
          ) : null}
          {pages.length > 0 ? (
            <DesignPagesCanvas
              projectId={projectId}
              pages={pages}
              projectName={projectName}
              designTokens={designTokens}
              activeIframeRef={iframeRef}
              onActiveIframeLoad={handleIframeLoad}
              selectedPageIds={selectedPageIds}
              activePageId={activePageId}
              onSelectPage={(id) => {
                setActivePageId(id)
              }}
              onPageFrameClick={(id) => {
                if (canvasTool === 'connect') {
                  void connectSelectedElementToPage(id)
                  return
                }
                if (canvasTool !== 'select') return
                const page = pages.find((p) => p.id === id)
                if (page && (page.frameType === 'screen' || !page.frameType)) {
                  togglePageSelection(page)
                }
              }}
              onFocusPage={(id) => {
                setActivePageId(id)
              }}
              onPlayPrototype={() => setPlayOpen(true)}
              viewport={viewport}
              bounds={bounds}
              previewBreakpoint={deviceBreakpoint}
              canvasTool={canvasTool}
              connectLocked={Boolean(pendingConnection)}
              onCommitPagePosition={commitPagePosition}
              onFrameContextMenu={onFrameContextMenu}
              onPageNameClick={(id) => {
                if (canvasTool !== 'select') return
                startRenamePage(id)
              }}
              renamingPageId={renamingPageId}
              renameDraft={renameDraft}
              onRenameDraftChange={setRenameDraft}
              onRenameSubmit={(id) => void submitRenamePage(id)}
              onRenameCancel={cancelRenamePage}
              onReimagine={() => void runReimagine()}
              onConvert={() => (onRequestConvert ? onRequestConvert() : void runConvert())}
              variants={variants}
              onApplyVariant={(variantId) => void applyVariant(variantId)}
              readyPreviewPaths={readyPreviewPaths}
              getCanvasHtmlContent={getCanvasHtmlContent}
              generating={busy}
              sitePlanning={busy && (designRunPhase === 'plan' || designRunPhase === 'tokens')}
              streamingPageId={streamingPageId}
              pagePreviewStamps={pagePreviewStamps}
              canvasPins={canvasPins}
              areaPinDraft={areaPinDraft}
              onPagePinAreaSelected={(pageId, area) => void handleAreaSelected(pageId, area)}
              onPagePinAreaChange={updateCanvasPinArea}
              onPagePinEdit={handleCanvasPinEdit}
              onPagePinRemove={removeCanvasPin}
              onPageContentHeightMeasured={handlePageContentHeightMeasured}
              contentHeightHints={contentHeightHints}
            />
          ) : null}
          {canvasTool === 'connect' ? (
            <div className="web-studio-connect-hint" role="status">
              {pendingConnection
                ? t('ed.design.connect.hintReady')
                    .replace('{from}', normalizePageDisplayName(pendingConnection.fromPageName))
                    .replace('{tag}', pendingConnection.fromTagName)
                    .replace('{skId}', pendingConnection.fromSkId)
                : t('ed.design.connect.hintPickElement')}
            </div>
          ) : null}
          {areaPinDraft ? (
            <WebStudioAreaPinDock
              tone={areaPinDraft.kind === 'image' ? 'image' : 'area'}
              label={areaPinDraft.label}
              locationLabel={[
                formatPinAreaLabel(areaPinDraft),
                `${areaPinDraft.xPercent.toFixed(0)}%, ${areaPinDraft.yPercent.toFixed(0)}%`,
                areaPinDraft.element
                  ? `<${areaPinDraft.element.tagName}> · ${areaPinDraft.element.skId}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              titleKey={
                areaPinDraft.kind === 'image'
                  ? 'ed.webStudio.imagePinTitle'
                  : 'ed.pinEditTitle'
              }
              placeholder={
                areaPinDraft.kind === 'image'
                  ? t('ed.webStudio.imagePinPlaceholder')
                  : undefined
              }
              initialDescription={areaPinDraft.initialDescription}
              commitLabelKey={
                areaPinDraft.editingPinId ? 'ed.inspector.colorAccept' : 'ed.pinEditAdd'
              }
              onCommit={handleAreaPinCommit}
              onCancel={finishAreaPinTool}
            />
          ) : null}
          {elementPinDraft ? (
            <WebStudioAreaPinDock
              tone="element"
              label={elementPinDraft.label}
              titleKey="ed.webStudio.elementPinTitle"
              locationLabel={[
                normalizePageDisplayName(elementPinDraft.pageName),
                `<${elementPinDraft.tagName}> · ${elementPinDraft.skId}`,
              ].join(' · ')}
              placeholder={t('ed.webStudio.elementPinPlaceholder')}
              initialDescription={elementPinDraft.description ?? ''}
              onCommit={handleElementPinCommit}
              onCancel={finishElementPinDraft}
            />
          ) : null}
          {themePanelOpen ? (
            <WebStudioThemePanel
              projectTitle={projectTitle}
              tokens={designTokens}
              designMd={designMdContent}
              saving={themeSaving}
              hasMultiplePages={pages.length > 1}
              onClose={() => {
                setThemePanelOpen(false)
                setCanvasTool('select')
              }}
              onSave={saveDesignTheme}
            />
          ) : null}
        </div>

        <div
          className={`web-studio-right-chrome${sidePanelOpen ? ' web-studio-right-chrome--panel-open' : ''}`}
        >
          {sidePanelOpen ? (
            <WebStudioElementPanel
              projectTitle={projectTitle}
              element={selectedElement}
              syncStatus={inspectorSync}
              onClose={() => {
                setSidePanelOpen(false)
                setCanvasTool('select')
              }}
              onPatch={(patch) => {
                if (selectedElement) applyPatch(patch)
              }}
              onSavePatches={async (patches) => {
                if (!selectedElement) return
                for (const patch of patches) {
                  await persistPatch(patch, selectedElement)
                }
                setInspectorSync('applied')
                window.setTimeout(() => setInspectorSync('idle'), 2400)
              }}
              onDiscard={discardPropertiesEdits}
              onClearSelection={clearSelection}
              onEditText={() => elementEditor.editText()}
              onReplaceImage={() => imageReplaceInputRef.current?.click()}
              onDelete={() => {
                if (selectedElement) elementEditor.deleteElement(selectedElement)
              }}
              onColorPickerBlur={onColorPickerBlur}
              onColorPickerFocus={onColorPickerFocus}
            />
          ) : null}
          <WebStudioToolsRail
            activeTool={canvasTool}
            sidePanelOpen={sidePanelOpen}
            themePanelOpen={themePanelOpen}
            imagePageMode={activePageIsImage}
            onToolChange={handleCanvasToolChange}
            onImageUploadRequest={requestCanvasImageUpload}
          />
        </div>

        <WebStudioZoomControl
          zoomPercent={viewport.zoomPercent}
          onSetZoomPercent={viewport.setZoomPercent}
          onCenter={() => viewport.setZoomPercent(DESIGN_CANVAS_DEFAULT_ZOOM_PERCENT)}
        />

        <WebStudioPromptBar
          ref={promptBarRef}
          disabled={busy || clarifyLoading}
          generating={busy || clarifyLoading}
          onStop={stopDesignRun}
          projectId={projectId}
          elementPins={elementPins}
          onElementPinRemove={removeElementPin}
          canvasPins={canvasPins}
          onCanvasPinRemove={removeCanvasPin}
          modelChoice={modelChoice}
          modelOptions={modelOptions}
          onModelChoiceChange={onModelChoiceChange}
          categoryChoices={categoryChoices}
          categoryModels={categoryModels}
          selectionMode={selectionMode}
          onCategoryModelChange={onCategoryModelChange}
          getWorkspaceFiles={getWorkspaceFiles}
          onGithubImport={onGithubImport}
          githubImportEnabled={githubImportEnabled}
          onFigmaImport={() => setFigmaImportOpen(true)}
          figmaImportEnabled={!busy}
          onStitchImport={() => {
            void requestStitchImport()
          }}
          stitchImportEnabled={!busy}
          onCanvaImport={requestCanvasImageUpload}
          canvaImportEnabled={!busy}
          pagePins={pagePins}
          onPagePinRemove={removePagePin}
          onSpeechNotice={onSpeechNotice}
          onSubmit={(prompt, opts) => {
            void requestDesignGenerate(prompt, {
              modify:
                selectedPageIds.size > 0 ||
                elementPins.length > 0 ||
                canvasPins.length > 0,
              images: opts?.images,
              brief: opts?.brief,
              generateImages: opts?.generateImages,
              imageModelId: opts?.imageModelId,
            })
            clearComposerMarkers()
          }}
        />
        {clarifySession ? (
          <WebStudioClarifyDialog
            questions={clarifySession.questions}
            loading={clarifyLoading || busy}
            onComplete={(answers) => void completeClarify(answers, false)}
            onSkip={() => void completeClarify([], true)}
            onCancel={() => setClarifySession(null)}
          />
        ) : null}
        {qrPreviewUrl ? (
          <div className="design-studio-qr-dialog" role="dialog" aria-modal="true">
            <button
              type="button"
              className="design-studio-qr-dialog__backdrop"
              aria-label={t('ed.close')}
              onClick={() => setQrPreviewUrl(null)}
            />
            <div className="design-studio-qr-dialog__panel">
              <button
                type="button"
                className="design-studio-qr-dialog__close"
                aria-label={t('ed.close')}
                onClick={() => setQrPreviewUrl(null)}
              >
                ×
              </button>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrPreviewUrl)}`}
                width={256}
                height={256}
                alt=""
              />
              <p>{t('ed.design.canvasMenu.qrTitle')}</p>
              <p>{qrPreviewUrl}</p>
            </div>
          </div>
        ) : null}
        <DesignCanvasContextMenu
          menu={canvasMenu}
          variant="select"
          canUndo={designHistory.canUndo}
          canRedo={designHistory.canRedo}
          hasActivePage={Boolean(menuPageId ?? activePageId)}
          canDeletePage={(() => {
            const targetId = menuPageId ?? activePageId
            const target = targetId ? pages.find((p) => p.id === targetId) : null
            if (
              target?.frameType === 'designSystem' ||
              target?.frameType === 'prototype' ||
              targetId === DESIGN_SYSTEM_PAGE_ID ||
              targetId === PROTOTYPE_PAGE_ID
            ) {
              return false
            }
            return screenPages.length > 1
          })()}
          hasSelection={Boolean(selectedElement)}
          busy={busy}
          onClose={() => setCanvasMenu(null)}
          onAction={onCanvasContextMenuAction}
        />
        {figmaImportOpen ? (
          <WebStudioFigmaImportDialog
            projectId={projectId}
            projectName={projectName}
            framework={framework}
            device={deviceBreakpoint}
            figmaConnected={figmaConnected}
            figmaOAuthConfigured={figmaOAuthConfigured}
            onClose={() => setFigmaImportOpen(false)}
            onConnected={() => setFigmaConnected(true)}
            onImported={refreshDesignSurface}
            onBusyChange={(b) => setBusy(b)}
            onLog={pushLog}
          />
        ) : null}
        {figmaExportOpen ? (
          <WebStudioFigmaExportDialog
            projectId={projectId}
            pageIds={activePageId ? [activePageId] : undefined}
            onClose={() => setFigmaExportOpen(false)}
          />
        ) : null}
        {playOpen && prototypeLinks.length > 0 ? (
          <StitchPrototypePlayer
            projectId={projectId}
            pages={pages}
            links={prototypeLinks}
            iframeKey={previewStampRef.current}
            onClose={() => setPlayOpen(false)}
          />
        ) : null}
      </div>
    </div>
  )
})
