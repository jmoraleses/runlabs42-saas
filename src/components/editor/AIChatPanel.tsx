'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Icon, useApp } from '@/components/app/shell'
import { apiFetch } from '@/lib/api/client'
import { consumeAIStream, type StreamFile } from '@/lib/ai/stream'
import { assistantErrorContent, formatNetworkStreamError } from '@/lib/ai/streamErrors'
import { resolveStreamCommand } from '@/lib/ai/resolveStreamCommand'
import { ChatAttachmentPreviews } from '@/components/chat/ChatAttachmentPreviews'
import { ChatComposerBar } from '@/components/chat/ChatComposerBar'
import { useImprovePrompt } from '@/hooks/useImprovePrompt'
import { useSpeechNotice } from '@/hooks/useSpeechNotice'
import { SpeechDictationNotice } from '@/components/common/SpeechDictationNotice'
import { useThinkingLevelPreference } from '@/lib/chat/useThinkingLevelPreference'
import {
  addImageAttachment,
  attachmentToApiPayload,
  pasteClipboardImages,
  isImageRefPayload,
  MAX_CHAT_IMAGES,
  type LocalImageAttachment,
} from '@/lib/chat/imageAttachments'
import { AssistantMessage } from '@/components/editor/AssistantMessage'
import { ChatEmptyState } from '@/components/chat/ChatEmptyState'
import { ChatSuggestionChips } from '@/components/chat/ChatSuggestionChips'
import { EditableProjectName } from '@/components/editor/EditableProjectName'
import type { AIModelSelectOption } from '@/components/editor/AIModelSelect'
import type { CategoryModelChoices, ChatModelSelectionMode } from '@/lib/ai/chatModelChoices'
import type { ChatModelCategory } from '@/lib/ai/chatModelCategories'
import {
  CloseChatConfirmDialog,
  SKIP_CHAT_CLOSE_CONFIRM_KEY,
} from '@/components/chat/CloseChatConfirmDialog'
import { ChatRestoreConfirmDialog } from '@/components/chat/ChatRestoreConfirmDialog'
import { ChatSessionTabs } from '@/components/chat/ChatSessionTabs'
import { ChatGenerationSteps, type GenerationStep } from '@/components/chat/ChatGenerationSteps'
import { ChatTypingIndicator } from '@/components/chat/ChatTypingIndicator'
import { ChatUserMessage } from '@/components/chat/ChatUserMessage'
import { ChatVisualEditBubble } from '@/components/chat/ChatVisualEditBubble'
import { ChatInsightBubble } from '@/components/chat/ChatInsightBubble'
import { ChatStudioEventBubble } from '@/components/chat/ChatStudioEventBubble'
import { appendChatInsightMessage } from '@/lib/chat/chatInsightMessages'
import type { ChatInsightPayload } from '@/lib/ai/chatInsight'
import type { ChatMessage, ProjectChatSession } from '@/lib/chat/types'
import { ChatContextFileChips } from '@/components/chat/ChatContextFileChips'
import { ChatCanvasPinChips } from '@/components/chat/ChatCanvasPinChips'
import { buildCanvasPinsPromptSuffix, type CanvasPin } from '@/lib/visual-edit/canvasPins'
import { ChatFileMentionMenu } from '@/components/chat/ChatFileMentionMenu'
import { useChatFileMentions } from '@/components/chat/useChatFileMentions'
import { assistantResponseInProgress } from '@/lib/ai/parseAssistantOutput'
import { parseVisualEditFromContent, type VisualEditMessageMeta } from '@/lib/visual-edit/visualEditMessage'

type AIChatPanelProps = {
  projectId?: string
  projectName?: string
  onProjectNameChange?: (name: string) => void | Promise<void>
  hasWorkspaceFiles?: boolean
  workspaceName?: string
  activePath?: string
  activeCode?: string
  workspaceFiles?: StreamFile[]
  /** Lectura fresca del workspace al enviar (evita props desactualizadas en el 2.º mensaje). */
  getWorkspaceFiles?: () => StreamFile[]
  getActiveCode?: () => string | undefined
  getActivePath?: () => string | undefined
  getChatHistory?: () => ChatMessage[]
  onCreditsUsed?: () => void
  onStreamStart?: () => void | Promise<void>
  /** Crea el proyecto en borrador antes del primer stream (p. ej. primer mensaje de chat). */
  onEnsureProject?: (ctx?: { prompt?: string }) => Promise<string | null | undefined>
  /** Garantiza una sesión de chat activa antes del primer mensaje. */
  onEnsureChatSession?: () => Promise<string | null>
  /** Sesión de chat cargada y lista para persistir mensajes. */
  chatReady?: boolean
  /** Captura el workspace antes de enviar un mensaje user (para restaurar después). */
  captureWorkspaceSnapshot?: () => string | null | Promise<string | null>
  onRestoreToMessage?: (messageIndex: number) => void | Promise<void>
  restoreBusy?: boolean
  onStreamEnd?: () => void
  onStreamError?: (message: string) => void
  onStreamToken?: (chunk: string, accumulated: string) => void
  onStreamFiles?: (files: StreamFile[]) => void | Promise<void>
  onStreamImages?: (images: import('@/lib/ai/stream').StreamImage[]) => void
  onStreamFileOps?: (accumulated: string) => void
  onStreamDone?: (
    accumulated: string,
  ) => void | Promise<{ appliedFiles?: ChatMessage['appliedFiles'] } | void>
  /** Autocorregir errores de compilación tras el chat (toggle en la barra). */
  autofixEnabled?: boolean
  onAutofixEnabledChange?: (enabled: boolean) => void
  onOpenFileFromChat?: (path: string) => void
  getCurrentFileContent?: (path: string) => string
  onApplyReviewFile?: (path: string, content: string) => void
  onStreamCost?: (credits: number) => void
  autoRunPrompt?: {
    id: number
    text: string
    useSpecKit?: boolean
    visualEdit?: VisualEditMessageMeta
    images?: Array<{ id: string; mimeType: string; dataUrl: string; name?: string }>
  } | null
  canvasPins?: CanvasPin[]
  onCanvasPinsChange?: (pins: CanvasPin[]) => void
  /** Tras enviar: limpiar selección visual, marcadores en diseño/preview, etc. */
  onComposerContextClear?: () => void
  selectedElementLabel?: string | null
  modelChoice?: string
  modelOptions?: AIModelSelectOption[]
  onModelChoiceChange?: (modelId: string) => void
  categoryChoices?: CategoryModelChoices
  categoryModels?: CategoryModelChoices
  selectionMode?: ChatModelSelectionMode
  onCategoryModelChange?: (category: ChatModelCategory, modelId: string) => void
  framework?: string
  targetPlatforms?: string[]
  chatSessionId?: string
  messages: ChatMessage[]
  onMessagesChange: (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  chatSessions?: ProjectChatSession[]
  activeChatSessionId?: string
  onSelectChatSession?: (id: string) => void
  onCloseChatSession?: (id: string) => void
  onNewChatSession?: () => void
  newChatLabel?: string
  onGithubImport?: () => void
  githubImportEnabled?: boolean
  githubImportBusy?: boolean
  onFigmaImport?: () => void
  figmaImportEnabled?: boolean
  onCanvaImport?: () => void
  canvaImportEnabled?: boolean
  onStitchImport?: () => void
  stitchImportEnabled?: boolean
  onCloseChat?: () => void
  /** Abre confirmación de eliminar proyecto (Studio). */
  onRequestDeleteProject?: () => void
  /** En Studio la X elimina el proyecto; en otros contextos cierra el chat. */
  closeMode?: 'chat' | 'project'
  geminiEnabled?: boolean
  availableCredits?: number
  noCreditsMessage?: string
  compileFixBusy?: boolean
  onStopCompileFix?: () => void
  onSpeechNotice?: (message: string | null) => void
}

export function AIChatPanel({
  projectId,
  projectName = 'Proyecto',
  onProjectNameChange,
  hasWorkspaceFiles: _hasWorkspaceFiles = false,
  workspaceName = 'Workspace',
  activePath,
  activeCode,
  workspaceFiles = [],
  getWorkspaceFiles,
  getActiveCode,
  getActivePath,
  getChatHistory,
  onCreditsUsed,
  onStreamStart,
  onEnsureProject,
  onEnsureChatSession,
  chatReady = true,
  captureWorkspaceSnapshot,
  onRestoreToMessage,
  restoreBusy = false,
  onStreamEnd,
  onStreamError,
  onStreamToken,
  onStreamFiles,
  onStreamImages,
  onStreamFileOps,
  onStreamDone,
  onOpenFileFromChat,
  getCurrentFileContent,
  onApplyReviewFile,
  onStreamCost,
  autoRunPrompt,
  canvasPins = [],
  onCanvasPinsChange,
  onComposerContextClear,
  selectedElementLabel,
  modelChoice = 'auto',
  modelOptions = [],
  onModelChoiceChange,
  categoryChoices,
  categoryModels,
  selectionMode,
  onCategoryModelChange,
  framework,
  targetPlatforms = ['web', 'ios', 'android'],
  chatSessionId,
  messages,
  onMessagesChange,
  chatSessions = [],
  activeChatSessionId = '',
  onSelectChatSession,
  onCloseChatSession,
  onNewChatSession,
  newChatLabel = 'Chat',
  onGithubImport,
  githubImportEnabled,
  githubImportBusy,
  onFigmaImport,
  figmaImportEnabled = true,
  onCanvaImport,
  canvaImportEnabled = true,
  onStitchImport,
  stitchImportEnabled = true,
  onCloseChat,
  onRequestDeleteProject,
  closeMode = 'chat',
  geminiEnabled: _geminiEnabled = true,
  availableCredits,
  noCreditsMessage,
  compileFixBusy = false,
  onStopCompileFix,
  autofixEnabled = true,
  onAutofixEnabledChange,
  onSpeechNotice,
}: AIChatPanelProps) {
  const { t, speechDictationEnabled } = useApp() as {
    t: (key: string) => string
    speechDictationEnabled?: boolean
  }
  const { speechNotice, setSpeechNotice } = useSpeechNotice()
  const handleSpeechNotice = useCallback(
    (message: string | null) => {
      setSpeechNotice(message)
      onSpeechNotice?.(message)
    },
    [onSpeechNotice, setSpeechNotice],
  )
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [restoreConfirmIndex, setRestoreConfirmIndex] = useState<number | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [buildModeActive, setBuildModeActive] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState<LocalImageAttachment[]>([])
  const [activePhase, setActivePhase] = useState<string | null>(null)
  const [pendingChatInsight, setPendingChatInsight] = useState<ChatInsightPayload | null>(null)
  const phaseStartRef = useRef<Record<string, number>>({})
  const [phaseModels, setPhaseModels] = useState<Record<string, string>>({})
  const { thinkingLevel, setThinkingLevel } = useThinkingLevelPreference()
  const { improvingPrompt, handleImprovePrompt, canImprovePrompt } = useImprovePrompt({
    getText: () => input,
    setText: setInput,
    modelChoice,
    loading: loading || compileFixBusy,
    disabled: githubImportBusy,
    onError: (message) => setAttachError(message),
  })
  const endRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerUploadRef = useRef<HTMLInputElement>(null)
  const autoRunHandled = useRef<number | null>(null)
  const userScrolledUp = useRef(false)
  const runMessageRef = useRef<
    (
      rawText: string,
      extraImages?: LocalImageAttachment[],
      visualEdit?: VisualEditMessageMeta,
      opts?: { force?: boolean },
    ) => Promise<void>
  >(async () => {})
  const streamAbortRef = useRef<AbortController | null>(null)
  /** Promesa de aplicación de archivos del evento SSE `files` (antes de `onDone`). */
  const streamFilesPromiseRef = useRef<Promise<void>>(Promise.resolve())

  const getMentionableFiles = useCallback(
    () => (getWorkspaceFiles?.() ?? workspaceFiles).map((f) => ({ path: f.path, content: f.content })),
    [getWorkspaceFiles, workspaceFiles],
  )
  const fileMentions = useChatFileMentions(getMentionableFiles)

  const clearComposerContext = useCallback(() => {
    setInput('')
    setAttachments([])
    fileMentions.clearContextPaths()
    onCanvasPinsChange?.([])
    onComposerContextClear?.()
  }, [fileMentions.clearContextPaths, onCanvasPinsChange, onComposerContextClear])

  const displayMessages =
    messages[0]?.role === 'assistant' ? messages.slice(1) : messages

  const lastAssistantMessageIndex = useMemo(() => {
    if (loading) return -1
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant' && m.content?.trim()) return i
    }
    return -1
  }, [messages, loading])

  // Detectar si el usuario scrolleó hacia arriba manualmente
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      userScrolledUp.current = distFromBottom > 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-scroll al fondo solo si el usuario no ha scrolleado hacia arriba
  useEffect(() => {
    if (userScrolledUp.current) return
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, compileFixBusy])

  // Auto-resize textarea on input change
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const styles = window.getComputedStyle(el)
    const lineHeightPx = Number.parseFloat(styles.lineHeight) || 22
    const paddingTopPx = Number.parseFloat(styles.paddingTop) || 0
    const paddingBottomPx = Number.parseFloat(styles.paddingBottom) || 0
    const borderTopPx = Number.parseFloat(styles.borderTopWidth) || 0
    const borderBottomPx = Number.parseFloat(styles.borderBottomWidth) || 0
    const verticalExtrasPx = paddingTopPx + paddingBottomPx + borderTopPx + borderBottomPx
    const minHeightPx = lineHeightPx * 2 + verticalExtrasPx
    const maxHeightPx = lineHeightPx * 5 + verticalExtrasPx
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeightPx), maxHeightPx)}px`
  }, [input])

  // Al enviar un mensaje nuevo, forzar scroll al fondo y resetear flag
  function forceScrollToBottom() {
    userScrolledUp.current = false
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const stopStream = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    setLoading(false)
    setBuildModeActive(false)
    onMessagesChange((prev) => {
      const copy = [...prev]
      const last = copy[copy.length - 1]
      if (last?.role === 'assistant' && assistantResponseInProgress(last.content)) {
        copy.pop()
      }
      return copy
    })
    onStreamEnd?.()
  }, [onMessagesChange, onStreamEnd])

  const runMessage = useCallback(async function runMessage(
    rawText: string,
    extraImages?: LocalImageAttachment[],
    visualEdit?: VisualEditMessageMeta,
    opts?: { force?: boolean },
  ) {
    const text = rawText.trim()
    const imgs = extraImages?.length ? extraImages : attachments
    const pinsSnapshot = [...canvasPins]
    if (!text && !imgs.length && !pinsSnapshot.length) return
    if (!opts?.force && loading) return
    if (!opts?.force && !chatReady && onEnsureChatSession) {
      try {
        await onEnsureChatSession()
      } catch {
        /* continuar; setActiveMessages creará sesión si hace falta */
      }
    }

    // Block if user has no credits (client-side guard)
    if (typeof availableCredits === 'number' && availableCredits <= 0) {
      const chatMsg = noCreditsMessage ?? t('ed.noCredits')
      // Debug console always in English
      onStreamError?.('No credits available. Top up your account to keep using the assistant.')
      onMessagesChange((prev) => [
        ...prev,
        { role: 'user' as const, content: text },
        { role: 'assistant' as const, content: `⚠️ ${chatMsg}` },
      ])
      return
    }

    streamAbortRef.current?.abort()
    const streamAbort = new AbortController()
    streamAbortRef.current = streamAbort
    const contextPathsSnapshot = [...fileMentions.contextPaths]
    let promptForAi = text
    if (contextPathsSnapshot.length > 0) promptForAi += fileMentions.contextPromptSuffix
    if (pinsSnapshot.length > 0) promptForAi += buildCanvasPinsPromptSuffix(pinsSnapshot)

    const filesForCount = getWorkspaceFiles?.() ?? workspaceFiles
    const resolved = resolveStreamCommand({
      prompt: promptForAi,
      projectId,
      workspaceFileCount: filesForCount.length,
    })
    setBuildModeActive(resolved.command === '/build')
    setActivePhase(null)
    setPendingChatInsight(null)
    phaseStartRef.current = { decision: Date.now() }
    setPhaseModels({})

    clearComposerContext()
    setLoading(true)

    let streamProjectId = projectId
    try {
      if (!streamProjectId) {
        streamProjectId = (await onEnsureProject?.({ prompt: text })) ?? undefined
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo crear el proyecto. Inténtalo de nuevo.'
      onStreamError?.(msg)
      onMessagesChange((prev) => {
        const copy = [...prev]
        if (copy.length && copy[copy.length - 1]?.role === 'assistant') {
          copy[copy.length - 1] = { role: 'assistant', content: assistantErrorContent(msg) }
        }
        return copy
      })
      streamAbortRef.current = null
      setLoading(false)
      onStreamEnd?.()
      return
    }
    if (!streamProjectId) {
      const msg = 'No se pudo crear el proyecto. Guarda el proyecto e inténtalo de nuevo.'
      onStreamError?.(msg)
      onMessagesChange((prev) => {
        const copy = [...prev]
        if (copy.length && copy[copy.length - 1]?.role === 'assistant') {
          copy[copy.length - 1] = { role: 'assistant', content: assistantErrorContent(msg) }
        }
        return copy
      })
      streamAbortRef.current = null
      setLoading(false)
      onStreamEnd?.()
      return
    }

    if (onEnsureChatSession) {
      try {
        await onEnsureChatSession()
      } catch {
        /* setActiveMessages puede crear sesión local igualmente */
      }
    }

    let workspaceSnapshotId: string | undefined
    if (captureWorkspaceSnapshot) {
      workspaceSnapshotId = (await captureWorkspaceSnapshot()) ?? undefined
    }

    onMessagesChange((prev) => [
      ...prev,
      {
        role: 'user',
        content: text,
        contextPaths: contextPathsSnapshot.length ? contextPathsSnapshot : undefined,
        canvasPins: pinsSnapshot.length ? pinsSnapshot : undefined,
        visualEdit,
        images: imgs.map((i) => ({ previewUrl: i.previewUrl, name: i.name })),
        workspaceSnapshotId,
      },
      { role: 'assistant', content: '' },
    ])

    await onStreamStart?.()

    let acc = ''
    streamFilesPromiseRef.current = Promise.resolve()
    try {
      const payloads = imgs.map(attachmentToApiPayload)
      const imageRefs = payloads.filter(isImageRefPayload)
      const legacyImages = payloads.filter((p) => !isImageRefPayload(p))

      const filesForStream = fileMentions.mergeFilesWithContext(
        (getWorkspaceFiles?.() ?? workspaceFiles).map((f) => ({ path: f.path, content: f.content })),
      )
      const pathForStream = getActivePath?.() ?? activePath
      const codeForStream = getActiveCode?.() ?? activeCode
      const historyForStream = getChatHistory?.() ?? messages

      await consumeAIStream(
        {
          prompt: promptForAi,
          projectId: streamProjectId,
          projectName,
          command: resolved.command,
          activePath: pathForStream,
          code: codeForStream,
          files: filesForStream,
          historyForStream,
          model: modelChoice,
          ...(categoryModels ? { categoryModels } : {}),
          thinkingLevel,
          framework,

          targetPlatforms,
          chatSessionId,
          imageRefs: imageRefs.length ? imageRefs : undefined,
          images: legacyImages.length ? legacyImages : undefined,
        },
        {
          onToken: (tok) => {
            if (streamAbort.signal.aborted) return
            acc += tok
            onStreamToken?.(tok, acc)
            onStreamFileOps?.(acc)
            onMessagesChange((prev) => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { role: 'assistant', content: acc }
              } else {
                copy.push({ role: 'assistant', content: acc })
              }
              return copy
            })
          },
          onFiles: (files) => {
            const applied = onStreamFiles?.(files)
            streamFilesPromiseRef.current = Promise.resolve(applied).then(() => undefined)
            onStreamFileOps?.(acc)
          },
          onImages: (images) => {
            onStreamImages?.(images)
          },
          onPhase: (phase) => {
            if (streamAbort.signal.aborted) return
            phaseStartRef.current[phase] = Date.now()
            setActivePhase(phase)
          },
          onPhaseModel: ({ phase, label }) => {
            if (streamAbort.signal.aborted) return
            setPhaseModels((prev) => ({ ...prev, [phase]: label }))
          },
          onChatInsight: (insight) => {
            if (streamAbort.signal.aborted) return
            setPendingChatInsight(insight)
            phaseStartRef.current['analyze'] = Date.now()
            onMessagesChange((prev) => appendChatInsightMessage(prev, insight))
          },
          onFileDelta: (file) => {
            if (!file?.path) return
            const applied = onStreamFiles?.([file])
            streamFilesPromiseRef.current = Promise.resolve(applied).then(() => undefined)
          },
          onCost: (n) => onStreamCost?.(n),
          onError: (err) => {
            if (streamAbort.signal.aborted) return
            console.error('[AI chat] stream error:', err)
            const content = assistantErrorContent(err)
            onStreamError?.(err)
            onMessagesChange((prev) => {
              const copy = [...prev]
              if (copy.length && copy[copy.length - 1]?.role === 'assistant') {
                copy[copy.length - 1] = { role: 'assistant', content }
              }
              return copy
            })
          },
          onDone: () => {
            if (streamAbort.signal.aborted) return
            void (async () => {
              try {
                await streamFilesPromiseRef.current
              } catch {
                /* handleStreamFiles ya mostró el error */
              }
              const doneResult = await onStreamDone?.(acc)
              if (doneResult?.appliedFiles?.length) {
                onMessagesChange((prev) => {
                  const copy = [...prev]
                  const last = copy.length - 1
                  if (last >= 0 && copy[last]?.role === 'assistant') {
                    copy[last] = { ...copy[last], appliedFiles: doneResult.appliedFiles }
                  }
                  return copy
                })
              }
              onCreditsUsed?.()
              setBuildModeActive(false)
              setActivePhase(null)
              setPendingChatInsight(null)
            })()
          },
        },
        { signal: streamAbort.signal },
      )
    } catch (e) {
      if (streamAbort.signal.aborted || (e as Error)?.name === 'AbortError') return
      const msg = formatNetworkStreamError(e)
      if (!msg) return
      console.error('[AI chat] unexpected error:', e)
      onStreamError?.(msg)
      onMessagesChange((prev) => {
        const copy = [...prev]
        if (copy.length && copy[copy.length - 1]?.role === 'assistant') {
          copy[copy.length - 1] = { role: 'assistant', content: assistantErrorContent(msg) }
        }
        return copy
      })
    } finally {
      if (streamAbortRef.current === streamAbort) streamAbortRef.current = null
      setLoading(false)
      onStreamEnd?.()
    }
  }, [
    loading,
    attachments,
    projectId,
    projectName,
    workspaceFiles,
    getWorkspaceFiles,
    getActiveCode,
    getActivePath,
    getChatHistory,
    messages,
    onMessagesChange,
    onStreamStart,
    onEnsureProject,
    onEnsureChatSession,
    chatReady,
    captureWorkspaceSnapshot,
    onStreamEnd,
    onStreamError,
    onStreamToken,
    onStreamFiles,
    onStreamImages,
    onStreamFileOps,
    onStreamDone,
    onStreamCost,
    onCreditsUsed,
    modelChoice,
    thinkingLevel,
    framework,
    targetPlatforms,
    chatSessionId,
    activeCode,
    activePath,
    availableCredits,
    noCreditsMessage,
    canvasPins,
    onCanvasPinsChange,
    clearComposerContext,
    fileMentions,
    t,
  ])

  useEffect(() => {
    runMessageRef.current = runMessage
  }, [runMessage])

  useEffect(() => {
    const prompt = autoRunPrompt
    if (!prompt) return
    const hasAutoRun = Boolean(prompt.text?.trim()) || Boolean(prompt.images?.length)
    if (!hasAutoRun) return
    if (autoRunHandled.current === prompt.id) return
    autoRunHandled.current = prompt.id
    setInput(prompt.text)
    const pendingImages: LocalImageAttachment[] = (prompt.images ?? []).map((img) => ({
      id: img.id,
      mimeType: img.mimeType,
      dataUrl: img.dataUrl,
      previewUrl: img.dataUrl,
      name: img.name ?? 'image',
    }))
    void runMessageRef.current(
      prompt.text,
      pendingImages.length ? pendingImages : undefined,
      prompt.visualEdit,
      { force: true },
    )
  }, [autoRunPrompt])

  function send() {
    forceScrollToBottom()
    runMessage(input)
  }

  function handleCopyMessage(text: string) {
    if (navigator.clipboard) void navigator.clipboard.writeText(text)
  }

  function handleRegenerate() {
    if (loading) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser?.content) return
    onMessagesChange((prev) => {
      const copy = [...prev]
      while (copy.length && copy[copy.length - 1]?.role === 'assistant') copy.pop()
      return copy
    })
    forceScrollToBottom()
    void runMessageRef.current(lastUser.content)
  }

  async function cleanupChatSession() {
    if (!chatSessionId) return
    try {
      const url = projectId
        ? `/api/projects/${encodeURIComponent(projectId)}/chat/sessions/${encodeURIComponent(chatSessionId)}`
        : `/api/chat/sessions/${encodeURIComponent(chatSessionId)}`
      await fetch(url, { method: 'DELETE', credentials: 'include' })
    } catch {
      /* ignore */
    }
    setAttachments([])
  }

  function handleHeaderClose() {
    if (onRequestDeleteProject) {
      onRequestDeleteProject()
      return
    }
    if (closeMode === 'project' && onCloseChat) {
      onCloseChat()
      return
    }
    requestCloseChat()
  }

  function requestCloseChat() {
    if (typeof window !== 'undefined' && window.localStorage.getItem(SKIP_CHAT_CLOSE_CONFIRM_KEY) === '1') {
      void cleanupChatSession().then(() => onCloseChat?.())
      return
    }
    setCloseConfirmOpen(true)
  }

  async function confirmCloseChat(skipNextTime: boolean) {
    if (skipNextTime && typeof window !== 'undefined') {
      window.localStorage.setItem(SKIP_CHAT_CLOSE_CONFIRM_KEY, '1')
    }
    setCloseConfirmOpen(false)
    await cleanupChatSession()
    onCloseChat?.()
  }

  async function onComposerUploadChange(files: FileList | null) {
    if (!files?.length) return
    const next = [...attachments]
    let lastError: string | null = null
    for (const file of Array.from(files)) {
      if (next.length >= MAX_CHAT_IMAGES) {
        lastError = t('chat.attachMenu.maxImages').replace('{n}', String(MAX_CHAT_IMAGES))
        break
      }
      try {
        next.push(await addImageAttachment(file, chatSessionId, projectId))
      } catch (e) {
        lastError = e instanceof Error ? e.message : t('chat.attachMenu.invalidImage')
      }
    }
    if (lastError) setAttachError(lastError)
    if (next.length > attachments.length) {
      setAttachments(next.slice(0, MAX_CHAT_IMAGES))
      setAttachError(null)
    }
    if (composerUploadRef.current) composerUploadRef.current.value = ''
  }

  async function onPasteImages(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const result = await pasteClipboardImages(e, {
      current: attachments,
      sessionId: chatSessionId,
      projectId,
      maxImagesLabel: t('chat.attachMenu.maxImages'),
      invalidImageLabel: t('chat.attachMenu.invalidImage'),
    })
    if (!result) return
    if (result.added.length) {
      setAttachments((prev) => [...prev, ...result.added].slice(0, MAX_CHAT_IMAGES))
      setAttachError(null)
    } else if (result.error) {
      setAttachError(result.error)
    }
  }

  const placeholder = selectedElementLabel
    ? `${t('chat.placeholder')} (${selectedElementLabel})`
    : t('chat.placeholder')

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const lastAssistantContent = lastAssistant?.content?.trim() ? lastAssistant.content : null
  const showFollowUpSuggestions = Boolean(
    lastAssistantContent && !loading && displayMessages.length > 0,
  )
  const assistantStreaming = Boolean(loading && lastAssistant && !lastAssistant.content?.trim())
  const chatPending = loading || compileFixBusy
  const composerHasAttachments = attachments.length > 0
  const composerHasContext =
    fileMentions.contextPaths.length > 0 || canvasPins.length > 0
  const showComposerAttachCta = !composerHasAttachments && !composerHasContext
  const insightSubtitle = (insight: ChatInsightPayload | null) =>
    insight?.stackHint?.trim() || insight?.summary?.trim().slice(0, 72)
  const pendingAssistant = chatPending ? messages[messages.length - 1] : null
  const pendingAssistantContent =
    pendingAssistant?.role === 'assistant' ? pendingAssistant.content?.trim() ?? '' : ''

  const phaseSubtitle = (id: string) => phaseModels[id]

  const decisionStep: GenerationStep = {
    id: 'decision',
    labelKey: 'chat.step.decision',
    status: pendingChatInsight ? 'done' : chatPending ? 'active' : 'pending',
    startedAt: phaseStartRef.current['decision'],
    subtitle: insightSubtitle(pendingChatInsight),
  }

  const generationSteps: GenerationStep[] = [
        decisionStep,
        {
          id: 'analyze',
          labelKey: 'chat.step.analyzing',
          status: !pendingChatInsight
            ? 'pending'
            : pendingAssistantContent
              ? 'done'
              : 'active',
          startedAt: pendingChatInsight ? phaseStartRef.current['analyze'] : undefined,
          subtitle: pendingChatInsight ? insightSubtitle(pendingChatInsight) : undefined,
        },
        {
          id: 'generate',
          labelKey: 'chat.step.generating',
          status:
            loading && lastAssistant?.content?.trim()
              ? 'active'
              : loading
                ? 'pending'
                : 'done',
          startedAt:
            loading && lastAssistant?.content?.trim()
              ? phaseStartRef.current['generate']
              : undefined,
        },
        {
          id: 'preview',
          labelKey: 'chat.step.updating',
          status: buildModeActive ? 'active' : 'pending',
          startedAt: buildModeActive ? phaseStartRef.current['preview'] : undefined,
        },
      ]

  return (
    <div className="editor-chat-panel editor-chat-panel--lovable">
      <header className="editor-chat-unified-head">
        <div
          className="editor-chat-unified-head__brand"
          title={`${projectName} · ${workspaceName}`}
        >
          <p className="editor-chat-aria-eyebrow">{t('chat.assistantLabel')}</p>
          {onProjectNameChange ? (
            <EditableProjectName
              value={projectName}
              onSave={onProjectNameChange}
              className="editor-chat-project-title editor-chat-unified-head__title"
              as="h2"
            />
          ) : (
            <h2 className="editor-chat-project-title editor-chat-unified-head__title">{projectName}</h2>
          )}
        </div>

        {chatSessions.length > 0 && onSelectChatSession && onCloseChatSession && onNewChatSession ? (
          <ChatSessionTabs
            variant="inline"
            className="editor-chat-unified-head__tabs"
            sessions={chatSessions}
            activeId={activeChatSessionId}
            newChatLabel={newChatLabel}
            onSelect={onSelectChatSession}
            onClose={onCloseChatSession}
            onNew={onNewChatSession}
          />
        ) : null}

        {(onRequestDeleteProject || onCloseChat) && (
          <button
            type="button"
            className="editor-chat-head-btn editor-chat-close-btn editor-chat-unified-head__close"
            aria-label={
              onRequestDeleteProject || closeMode === 'project'
                ? t('projects.deleteConfirmTitleOne')
                : t('chat.closeConfirm.closeBtn')
            }
            title={
              onRequestDeleteProject || closeMode === 'project'
                ? t('projects.deleteConfirmTitleOne')
                : t('chat.closeConfirm.closeBtn')
            }
            onClick={handleHeaderClose}
          >
            <Icon.X />
          </button>
        )}
      </header>
      {closeMode === 'chat' ? (
        <CloseChatConfirmDialog
          open={closeConfirmOpen}
          onCancel={() => setCloseConfirmOpen(false)}
          onConfirm={(skip) => void confirmCloseChat(skip)}
        />
      ) : null}

      <ChatRestoreConfirmDialog
        open={restoreConfirmIndex !== null}
        busy={restoreBusy}
        onCancel={() => setRestoreConfirmIndex(null)}
        onConfirm={() => {
          if (restoreConfirmIndex === null) return
          const index = restoreConfirmIndex
          setRestoreConfirmIndex(null)
          void onRestoreToMessage?.(index)
        }}
      />

      <div ref={scrollContainerRef} className="editor-chat-messages no-scrollbar">
        {displayMessages.length === 0 && !chatPending ? (
          <ChatEmptyState
            onSelectPrompt={(prompt) => {
              forceScrollToBottom()
              void runMessageRef.current(prompt)
            }}
          />
        ) : null}
        {messages.map((msg, messageIndex) => {
          const displayOffset =
            messages[0]?.role === 'assistant' && !messages[0]?.workspaceSnapshotId ? 1 : 0
          if (messageIndex < displayOffset) return null

          const canRestore =
            Boolean(onRestoreToMessage) &&
            msg.role === 'user' &&
            Boolean(msg.workspaceSnapshotId) &&
            messageIndex < messages.length - 1 &&
            !chatPending &&
            !restoreBusy

          const visualEditMeta =
            msg.visualEdit ??
            (msg.role === 'user' ? parseVisualEditFromContent(msg.content) : null)

          const isLastAssistant = messageIndex === lastAssistantMessageIndex

          if (
            chatPending &&
            messageIndex === messages.length - 1 &&
            msg.role === 'assistant' &&
            !msg.studioEvent
          ) {
            return null
          }

          return (
          <div
            key={`${messageIndex}-${msg.role}`}
            className={`editor-chat-msg editor-chat-msg--${msg.role}`}
          >
            <div
              className={
                msg.role === 'user'
                  ? 'chat-bubble chat-bubble--user chat-bubble--aria-user'
                  : 'chat-bubble chat-bubble--assistant'
              }
            >
              {msg.chatInsight ? (
                <ChatInsightBubble insight={msg.chatInsight} />
              ) : msg.studioEvent ? (
                <ChatStudioEventBubble event={msg.studioEvent} />
              ) : msg.role === 'assistant' && msg.content ? (
                <AssistantMessage
                  content={msg.content}
                  appliedFiles={msg.appliedFiles}
                  onOpenFile={onOpenFileFromChat}
                  isReview={
                    messageIndex > 0 &&
                    messages[messageIndex - 1]?.role === 'user' &&
                    /^\s*\/review\b/i.test(messages[messageIndex - 1]?.content ?? '')
                  }
                  getCurrentFileContent={getCurrentFileContent}
                  onApplyReviewFile={onApplyReviewFile}
                />
              ) : visualEditMeta ? (
                <>
                  {msg.images?.length ? (
                    <div className="chat-msg-images">
                      {msg.images.map((img) => (
                        <img key={img.previewUrl} src={img.previewUrl} alt={img.name} />
                      ))}
                    </div>
                  ) : null}
                  <ChatVisualEditBubble meta={visualEditMeta} />
                </>
              ) : (
                <>
                  {msg.images?.length ? (
                    <div className="chat-msg-images">
                      {msg.images.map((img) => (
                        <img key={img.previewUrl} src={img.previewUrl} alt={img.name} />
                      ))}
                    </div>
                  ) : null}
                  {msg.role === 'user' && msg.contextPaths?.length ? (
                    <ChatContextFileChips paths={msg.contextPaths} readOnly />
                  ) : null}
                  {msg.role === 'user' && msg.canvasPins?.length ? (
                    <ChatCanvasPinChips pins={msg.canvasPins} readOnly />
                  ) : null}
                  {msg.role === 'user' && msg.content ? (
                    <ChatUserMessage content={msg.content} />
                  ) : msg.role !== 'user' ? (
                    msg.content
                  ) : null}
                </>
              )}
            </div>
            {msg.content ? (
              <div className="chat-msg-actions">
                <button
                  type="button"
                  className="chat-msg-action-btn"
                  onClick={() => handleCopyMessage(msg.content)}
                  aria-label={t('chat.msg.copyMessage')}
                  title={t('chat.msg.copy')}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="4" y="4" width="9" height="9" rx="1.5" />
                    <path d="M3 11V3h8" />
                  </svg>
                </button>
                {isLastAssistant && (
                  <button
                    type="button"
                    className="chat-msg-action-btn"
                    onClick={handleRegenerate}
                    aria-label={t('chat.msg.regenerate')}
                    title={t('chat.msg.regenerate')}
                  >
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" />
                      <polyline points="13.5 2 13.5 5.5 10 5.5" />
                    </svg>
                  </button>
                )}
              </div>
            ) : null}
              {canRestore ? (
                <button
                  type="button"
                  className="editor-chat-restore-btn"
                  onClick={() => setRestoreConfirmIndex(messageIndex)}
                  title={t('ed.chatRestore.title')}
                  aria-label={t('ed.chatRestore.title')}
                >
                  <Icon.Undo />
                  <span>{t('ed.chatRestore.btn')}</span>
                </button>
              ) : null}
          </div>
          )
        })}
        {chatPending ? (
          <div className="editor-chat-msg editor-chat-msg--assistant">
            <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
              {pendingAssistantContent && loading ? (
                <>
                  <AssistantMessage
                    content={pendingAssistant?.content ?? ''}
                    appliedFiles={pendingAssistant?.appliedFiles}
                    onOpenFile={onOpenFileFromChat}
                    isReview={
                      messages.length > 1 &&
                      messages[messages.length - 2]?.role === 'user' &&
                      /^\s*\/review\b/i.test(messages[messages.length - 2]?.content ?? '')
                    }
                    getCurrentFileContent={getCurrentFileContent}
                    onApplyReviewFile={onApplyReviewFile}
                  />
                  <ChatTypingIndicator />
                </>
              ) : (
                <ChatTypingIndicator />
              )}
            </div>
            {loading ? <ChatGenerationSteps steps={generationSteps} /> : null}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {buildModeActive ? (
        <p className="editor-chat-build-mode" role="status">
          {t('ed.buildModeActive')}
        </p>
      ) : null}

      {showFollowUpSuggestions && lastAssistantContent ? (
        <div className="editor-chat-composer-suggestions">
          <ChatSuggestionChips
            lastResponse={lastAssistantContent}
            onSelect={(prompt) => {
              forceScrollToBottom()
              void runMessageRef.current(prompt)
            }}
          />
        </div>
      ) : null}

      <div
        className={`editor-chat-composer${speechNotice && speechDictationEnabled ? ' chat-composer--speech-notice' : ''}`}
      >
        {speechNotice && speechDictationEnabled ? (
          <SpeechDictationNotice message={speechNotice} />
        ) : null}
        <input
          ref={composerUploadRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => void onComposerUploadChange(e.target.files)}
        />
        <div
          className={`chat-composer__field${composerHasAttachments ? ' chat-composer__field--has-attachments' : ' chat-composer__field--no-attachments'}${composerHasContext ? ' chat-composer__field--has-context' : ''}`}
        >
          <ChatAttachmentPreviews
            attachments={attachments}
            onRemove={(id) => setAttachments((a) => a.filter((x) => x.id !== id))}
          />
          <ChatContextFileChips
            paths={fileMentions.contextPaths}
            onRemove={fileMentions.removeContextPath}
          />
          <ChatCanvasPinChips
            pins={canvasPins}
            onRemove={(id) => onCanvasPinsChange?.(canvasPins.filter((p) => p.id !== id))}
          />
          {showComposerAttachCta ? (
            <button
              type="button"
              className="chat-composer__attach-cta"
              disabled={githubImportBusy || loading || compileFixBusy}
              aria-label={t('chat.attachImage')}
              onClick={() => composerUploadRef.current?.click()}
            >
              <span className="chat-composer__attach-cta-title">{t('chat.attachImage')}</span>
              <span className="chat-composer__attach-cta-desc">
                {t('chat.attachMenu.importImageDesc')}
              </span>
            </button>
          ) : null}
          <div className="chat-composer__input-wrap">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                fileMentions.syncMentionFromInput(
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length,
                )
              }}
              onClick={(e) => {
                const el = e.currentTarget
                fileMentions.syncMentionFromInput(el.value, el.selectionStart ?? el.value.length)
              }}
              onPaste={(e) => void onPasteImages(e)}
              onKeyDown={(e) => {
                if (fileMentions.mentionOpen && fileMentions.options.length) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    fileMentions.setMentionIndex((i) =>
                      Math.min(i + 1, fileMentions.options.length - 1),
                    )
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    fileMentions.setMentionIndex((i) => Math.max(i - 1, 0))
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    const pick = fileMentions.options[fileMentions.mentionIndex]
                    if (pick) {
                      const el = e.currentTarget
                      fileMentions.selectMention(
                        pick.path,
                        el.value,
                        el.selectionStart ?? el.value.length,
                        setInput,
                      )
                    }
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    fileMentions.syncMentionFromInput('', 0)
                    return
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={2}
              placeholder={placeholder}
              aria-label={placeholder}
            />
            <ChatFileMentionMenu
              open={fileMentions.mentionOpen}
              options={fileMentions.options}
              activeIndex={fileMentions.mentionIndex}
              onSelect={(path) => {
                const el = textareaRef.current
                if (!el) return
                fileMentions.selectMention(path, el.value, el.selectionStart ?? el.value.length, setInput)
              }}
            />
          </div>
          <ChatComposerBar
            variant="editor"
            disabled={githubImportBusy}
            loading={loading || compileFixBusy}
            canSend={Boolean(
              input.trim() ||
                attachments.length ||
                fileMentions.contextPaths.length ||
                canvasPins.length,
            )}
            onSend={send}
            autofixEnabled={autofixEnabled}
            onAutofixEnabledChange={onAutofixEnabledChange}
            onStop={() => {
              if (loading) stopStream()
              if (compileFixBusy) onStopCompileFix?.()
            }}
            images={attachments}
            onImagesChange={setAttachments}
            chatSessionId={chatSessionId}
            projectId={projectId}
            onGithubImport={onGithubImport}
            githubImportEnabled={githubImportEnabled}
            onFigmaImport={onFigmaImport}
            figmaImportEnabled={figmaImportEnabled}
            onCanvaImport={onCanvaImport}
            canvaImportEnabled={canvaImportEnabled}
            onStitchImport={onStitchImport}
            stitchImportEnabled={stitchImportEnabled}
            onAttachError={setAttachError}
            attachError={attachError}
            onSpeechNotice={speechDictationEnabled ? handleSpeechNotice : undefined}
            onImprovePrompt={handleImprovePrompt}
            improvingPrompt={improvingPrompt}
            canImprovePrompt={canImprovePrompt}
            modelChoice={modelChoice}
            modelOptions={modelOptions}
            onModelChoiceChange={onModelChoiceChange}
            categoryChoices={categoryChoices}
            selectionMode={selectionMode}
            onCategoryModelChange={onCategoryModelChange}
            thinkingLevel={thinkingLevel}
            onThinkingLevelChange={setThinkingLevel}
            getComposerText={() => input}
            setComposerText={setInput}
            getWorkspaceFiles={getMentionableFiles}
            contextFilePaths={fileMentions.contextPaths}
            onAddContextFile={fileMentions.addContextPath}
          />
        </div>
      </div>
    </div>
  )
}
