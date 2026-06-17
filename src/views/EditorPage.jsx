'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp, Icon, EditorShell, useEditorFocus } from '@/components/app/shell'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { EditableProjectName } from '@/components/editor/EditableProjectName'
import { EditorWorkspaceEmpty } from '@/components/editor/EditorWorkspaceEmpty'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { MonacoCancelGuard } from '@/components/editor/MonacoCancelGuard'
import { EditorCodePaneHead } from '@/components/editor/EditorCodePaneHead'
import { filesForCodePreview, filesForStudioPreview } from '@/lib/preview/stripLegalBoilerplate'
import { VisualPreviewPanel } from '@/components/editor/VisualPreviewPanel'
import { DesignWorkspace } from '@/components/editor/DesignWorkspace'
import { WebStudioPromptBar } from '@/components/editor/webStudio/WebStudioPromptBar'
import { WebStudioActivityPanel } from '@/components/editor/webStudio/WebStudioActivityPanel'
import { DesignPhaseStepper } from '@/components/editor/DesignPhaseStepper'
import { CreateCodeMenu } from '@/components/editor/CreateCodeMenu'
import { DEFAULT_CODE_TEMPLATE } from '@/lib/codeTemplates'
import { WebStudioDeviceToggle } from '@/components/editor/webStudio/WebStudioDeviceToggle'
import { DEFAULT_DESIGN_DEVICE } from '@/lib/design/breakpoints'
/** @typedef {import('@/components/editor/DesignWorkspace').DesignWorkspaceHandle} DesignWorkspaceHandle */
import { useVercelPreview } from '@/hooks/useVercelPreview'
import { parseDesignSpec } from '@/lib/design/pages'
import {
  DESIGN_SPEC_JSON,
  DESIGN_SPEC_MD,
  hasAppSourceFiles,
  isDesignCanvasFilePath,
} from '@/lib/design/types'
import { EditorPreviewChrome } from '@/components/editor/EditorPreviewChrome'
import { EditorWorkspaceNotice } from '@/components/editor/EditorWorkspaceNotice'
import { SpeechDictationNotice } from '@/components/common/SpeechDictationNotice'
import { useSpeechNotice } from '@/hooks/useSpeechNotice'
import { EditorSplitView } from '@/components/editor/EditorSplitView'
import { EditorResizeHandle } from '@/components/editor/EditorResizeHandle'
import { EditorPanelCollapseHandle } from '@/components/editor/EditorPanelCollapseHandle'
import { useEditorPanelWidths } from '@/hooks/useEditorPanelWidths'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { EditorMobilePanelTabs } from '@/components/editor/EditorMobilePanelTabs'
import { useEditorHistory } from '@/hooks/useEditorHistory'
import { useIntegrationsGate } from '@/hooks/useIntegrationsGate'
import { GithubImportModal } from '@/components/editor/GithubImportModal'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PublishPanel } from '@/components/editor/PublishPanel'
import { TokenCostMeter } from '@/components/editor/TokenCostMeter'
import {
  discardPrimedGithubTab,
  ensureGithubConnected,
  GITHUB_OAUTH_NOT_CONFIGURED,
  GITHUB_SIGN_IN_REQUIRED,
  primeGithubOAuthTab,
} from '@/lib/auth/connectGithub'
import { setPendingGithubImport } from '@/lib/landing/pendingGithubImport'
import { useAIModel } from '@/hooks/useAIModel'
import { useWorkspaceBuffers } from '@/hooks/useWorkspaceBuffers'
import {
  fileOpsFromNewlyCompletedSegments,
  parseFileOperationsFromStream,
  parseAssistantSegments,
} from '@/lib/ai/parseAssistantOutput'
import { streamFilesWereApplied } from '@/lib/ai/streamApplyState'
import { filterFileOpsToPaths } from '@/lib/ai/filterFileOpsToPaths'

import { resolveStreamDefaultPath } from '@/lib/projects/resolveStreamDefaultPath'
import { useStudioProjectLifecycle } from '@/hooks/studio/useStudioProjectLifecycle'
import { useStudioCoverCapture } from '@/hooks/studio/useStudioCoverCapture'
import { useStudioCompileAutofix } from '@/hooks/studio/useStudioCompileAutofix'
import { fileListFromBuffers } from '@/lib/ai/applyFileOperations'
import { detectMissingLocalImports } from '@/lib/ai/resolveLocalImport'
import { detectUndeliveredFilePaths } from '@/lib/ai/detectPromisedPaths'
import { buildChatAppliedFiles } from '@/lib/chat/appliedFiles'
import { isBlankStudioApp } from '@/lib/projects/reconcilePreviewWorkspace'
import { appendStudioChatEvent } from '@/lib/chat/studioEvents'
/** @typedef {import('@/lib/chat/studioEvents').ChatStudioEvent} ChatStudioEvent */
import { useStudioMemoryExtract } from '@/hooks/studio/useStudioMemoryExtract'
import { StudioSaveStatus } from '@/components/studio/StudioSaveStatus'
import {
  consumeStudioFramework,
  consumeStudioLangFromSession,
  consumeStudioProjectJustCreated,
  consumeStudioReentry,
  consumeStudioReplaceDesign,
  peekStudioReentryToken,
  markStudioProjectJustCreated,
} from '@/lib/projects/openStudio'
/** @typedef {import('@/lib/design/designReferenceImages.client').DesignGenerateImagePayload} DesignGenerateImagePayload */
import { downloadWorkspaceZip } from '@/lib/projects/downloadProjectZip'
import { hasPaidSubscription } from '@/lib/pricing/subscription'
import { useUser } from '@/hooks/useUser'
import { apiFetch } from '@/lib/api/client'
import { normalizeProject } from '@/lib/api/projects'
import {
  createDemoProject,
  findDemoProject,
  enableDemo,
  canUseGithubImport,
  isDemoActive,
  isDemoProjectId,
  loadDemoProjectSpec,
  saveDemoProjectSpec,
  loadDemoProjects,
  shouldUseDemoData,
  updateDemoProject,
  removeDemoProject,
  DEMO_EVENT,
} from '@/lib/auth/demo'
import {
  consumePendingEditorSession,
  peekPendingEditorSession,
} from '@/lib/landing/pendingEditorPrompt'
import { nextGenericProjectName } from '@/lib/projects/genericProjectName'
import {
  saveWorkspaceToProject,
  workspaceHasMeaningfulContent,
} from '@/lib/projects/studioCommit'
import { cleanupProjectClientState } from '@/lib/chat/cleanupProjectClientState'
import {
  captureCurrentPreview,
  findPreviewIframe,
} from '@/lib/projects/coverCapture'
import {
  previewFileForRoute,
  previewRouteForFile,
  navigatePreviewToRoute,
  normRoute,
} from '@/lib/preview/previewNavigation'
import { ProjectPreviewFrame } from '@/components/editor/ProjectPreviewFrame'
import { useProjectChatSessions } from '@/hooks/useProjectChatSessions'
import {
  loadWorkspaceSnapshot,
  pruneWorkspaceSnapshots,
  saveWorkspaceSnapshot,
} from '@/lib/chat/workspaceSnapshots'
import { restoreWorkspaceToProject } from '@/lib/projects/restoreWorkspaceSnapshot'
import { ProjectDeleteConfirmDialog } from '@/components/projects/ProjectDeleteConfirmDialog'
import { DebugPanel } from '@/components/editor/DebugPanel'
import { useStudioDebugConsole } from '@/hooks/studio/useStudioDebugConsole'
import { isImageWorkspacePath, workspaceImageDataUrl } from '@/lib/projects/workspaceMedia'
import {
  isSpecWorkspacePath,
  SPEC_KIT_PATHS,
  specContentFromFiles,
} from '@/lib/projects/specPaths'

function isProjectNotFoundError(err) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object' && 'message' in err
          ? String(err.message ?? '')
          : ''
  return /proyecto no encontrado/i.test(msg)
}

// ─── File icon helpers ───────────────────────────────────────────────────────

const FILE_ICON_MAP = {
  tsx: { color: '#3b82f6', label: 'TSX' },
  ts:  { color: '#3b82f6', label: 'TS'  },
  jsx: { color: '#f59e0b', label: 'JSX' },
  js:  { color: '#f59e0b', label: 'JS'  },
  css: { color: '#a855f7', label: 'CSS' },
  scss:{ color: '#a855f7', label: 'SCSS'},
  html:{ color: '#f97316', label: 'HTML'},
  json:{ color: '#6b7280', label: 'JSON'},
  md:  { color: '#10b981', label: 'MD'  },
  svg: { color: '#ec4899', label: 'SVG' },
  png: { color: '#ec4899', label: 'PNG' },
  jpg: { color: '#ec4899', label: 'JPG' },
  gif: { color: '#ec4899', label: 'GIF' },
  webp:{ color: '#ec4899', label: 'IMG' },
}

function FileTypeIcon({ name }) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  const spec = FILE_ICON_MAP[ext]
  if (!spec) return <span style={{ width: 14, flexShrink: 0 }} />
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, flexShrink: 0,
        fontSize: 7, fontWeight: 700, letterSpacing: '-0.02em',
        color: spec.color, fontFamily: 'ui-monospace, monospace',
        lineHeight: 1,
      }}
      aria-hidden
    >
      {spec.label.slice(0,3)}
    </span>
  )
}

// ─── File tree ────────────────────────────────────────────────────────────────

function buildFileTree(paths) {
  const root = { name: 'root', kind: 'folder', path: '', children: [] }
  for (const fullPath of paths) {
    const parts = fullPath.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      if (!node.children) node.children = []
      let child = node.children.find((c) => c.name === part)
      if (!child) {
        child = isFile
          ? { name: part, kind: 'file', path: fullPath }
          : { name: part, kind: 'folder', path: parts.slice(0, i + 1).join('/'), children: [] }
        node.children.push(child)
      }
      node = child
    }
  }
  return root.children ?? []
}

function FileTree({ files, activePath, dirtyPaths, onSelect, onDelete, onRename, onCreateFile, onCreateFolder: _onCreateFolder, emptyLabel, t: _t }) {
  const tree = buildFileTree(files.map((f) => f.path))
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [menu, setMenu] = useState(null) // { x, y, node }
  const [renaming, setRenaming] = useState(null) // path being renamed
  const [renameValue, setRenameValue] = useState('')
  const [creating, setCreating] = useState(null) // { parentPath, kind }
  const [createValue, setCreateValue] = useState('')
  const menuRef = useRef(null)
  const renameInputRef = useRef(null)
  const createInputRef = useRef(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menu) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renaming])

  useEffect(() => {
    if (creating && createInputRef.current) createInputRef.current.focus()
  }, [creating])

  const toggleFolder = (folderPath) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) next.delete(folderPath)
      else next.add(folderPath)
      return next
    })
  }

  const openMenu = (e, node) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, node })
  }

  const commitRename = () => {
    if (!renaming || !renameValue.trim()) { setRenaming(null); return }
    const dir = renaming.includes('/') ? renaming.slice(0, renaming.lastIndexOf('/') + 1) : ''
    const newPath = dir + renameValue.trim()
    if (newPath !== renaming) onRename?.(renaming, newPath)
    setRenaming(null)
  }

  const commitCreate = () => {
    if (!creating || !createValue.trim()) { setCreating(null); return }
    const base = creating.parentPath ? creating.parentPath + '/' : ''
    const name = createValue.trim()
    if (creating.kind === 'folder') {
      onCreateFile?.(base + name + '/.gitkeep', '')
    } else {
      onCreateFile?.(base + name, '')
    }
    setCreating(null)
    setCreateValue('')
  }

  const renderNode = (node, depth = 0) => {
    const isFolder = node.kind === 'folder'
    const isOpen = isFolder && !collapsed.has(node.path)
    const isSpec = isSpecWorkspacePath(node.path)

    return (
      <div key={node.path || node.name}>
        <div
          role="button"
          tabIndex={0}
          className={`editor-file-row${node.path === activePath ? ' is-active' : ''}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => isFolder ? toggleFolder(node.path) : onSelect(node.path)}
          onContextMenu={(e) => openMenu(e, node)}
          onDoubleClick={() => {
            if (!isFolder && !isSpec) {
              setRenaming(node.path)
              setRenameValue(node.name)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (isFolder) toggleFolder(node.path)
              else onSelect(node.path)
            }
            if (e.key === 'F2' && !isFolder && !isSpec) {
              setRenaming(node.path)
              setRenameValue(node.name)
            }
          }}
        >
          {isFolder ? (
            <>
              <Icon.Chevron
                style={{
                  transform: isOpen ? 'rotate(0)' : 'rotate(-90deg)',
                  transition: 'transform 160ms var(--ease)',
                  width: 12, height: 12,
                }}
              />
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
                {isOpen
                  ? <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>
                  : <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>
                }
              </svg>
            </>
          ) : (
            <FileTypeIcon name={node.name} />
          )}

          {renaming === node.path ? (
            <input
              ref={renameInputRef}
              className="editor-file-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null) }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="editor-file-name">
              {node.name}
              {!isFolder && dirtyPaths.has(node.path) ? ' •' : ''}
            </span>
          )}
        </div>

        {/* Inline new file/folder input */}
        {isFolder && creating?.parentPath === node.path && (
          <div style={{ paddingLeft: 8 + (depth + 1) * 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FileTypeIcon name={creating.kind === 'folder' ? '__folder__' : createValue || 'file.ts'} />
            <input
              ref={createInputRef}
              className="editor-file-rename-input"
              placeholder={creating.kind === 'folder' ? 'folder-name' : 'file.tsx'}
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              onBlur={commitCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitCreate() }
                if (e.key === 'Escape') { setCreating(null); setCreateValue('') }
              }}
            />
          </div>
        )}

        {isFolder && isOpen && node.children?.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  if (!tree.length && !creating) return <p className="editor-rail-empty">{emptyLabel}</p>

  return (
    <div className="editor-file-tree" onContextMenu={(e) => { e.preventDefault(); openMenu(e, { kind: 'folder', path: '', name: 'root' }) }}>
      {/* Root-level new file input */}
      {creating?.parentPath === '' && (
        <div style={{ paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <FileTypeIcon name={createValue || (creating.kind === 'folder' ? '__folder__' : 'file.ts')} />
          <input
            ref={createInputRef}
            className="editor-file-rename-input"
            placeholder={creating.kind === 'folder' ? 'folder-name' : 'file.tsx'}
            value={createValue}
            onChange={(e) => setCreateValue(e.target.value)}
            onBlur={commitCreate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitCreate() }
              if (e.key === 'Escape') { setCreating(null); setCreateValue('') }
            }}
          />
        </div>
      )}
      {tree.map((n) => renderNode(n, 0))}

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          className="file-context-menu"
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menu.node.kind === 'folder' && (
            <>
              <button onClick={() => { setCreating({ parentPath: menu.node.path, kind: 'file' }); setCreateValue(''); setMenu(null) }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                Nuevo archivo
              </button>
              <button onClick={() => { setCreating({ parentPath: menu.node.path, kind: 'folder' }); setCreateValue(''); setMenu(null) }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                Nueva carpeta
              </button>
              <div className="file-context-menu__sep" />
            </>
          )}
          {menu.node.kind === 'file' && !isSpecWorkspacePath(menu.node.path) && (
            <>
              <button onClick={() => { setRenaming(menu.node.path); setRenameValue(menu.node.name); setMenu(null) }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Renombrar
              </button>
              <button
                className="file-context-menu__danger"
                onClick={() => {
                  if (window.confirm(`¿Eliminar ${menu.node.name}?`)) onDelete?.(menu.node.path)
                  setMenu(null)
                }}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Eliminar
              </button>
            </>
          )}
          {menu.node.kind === 'folder' && menu.node.path !== '' && (
            <button
              className="file-context-menu__danger"
              onClick={() => {
                if (window.confirm(`¿Eliminar carpeta ${menu.node.name} y su contenido?`)) {
                  files.filter(f => f.path.startsWith(menu.node.path + '/')).forEach(f => onDelete?.(f.path))
                }
                setMenu(null)
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              Eliminar carpeta
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function EditorFileTabs({ tabs, activePath, dirtyPaths, onSelect, onClose }) {
  if (!tabs.length) return null

  return (
    <div className="editor-file-tabs" role="tablist">
      {tabs.map((path) => (
        <button
          key={path}
          type="button"
          role="tab"
          aria-selected={path === activePath}
          className={`editor-file-tab${path === activePath ? ' is-active' : ''}`}
          onClick={() => onSelect(path)}
        >
          <span>{path.split('/').pop()}</span>
          {dirtyPaths.has(path) && <span className="editor-file-tab-dot" />}
          {tabs.length > 1 && (
            <span
              role="button"
              tabIndex={0}
              className="editor-file-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onClose(path)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  onClose(path)
                }
              }}
            >
              ×
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function EditorPageInner() {
  const { t, navigate, lang, speechDictationEnabled } = useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const studioFreshNonce = searchParams.get('_studio')
  const langParam = searchParams.get('lang')
  const sessionLang = consumeStudioLangFromSession()
  const studioLang =
    langParam === 'en' || sessionLang === 'en' || lang === 'en' ? 'en' : 'es'
  const aiStreamActiveRef = useRef(false)
  /** Archivos aplicados vía evento SSE `files` en el turno actual del stream. */
  const streamFilesAppliedRef = useRef(false)
  const streamAppliedPathsRef = useRef([])
  const pathsBeforeStreamRef = useRef(new Set())
  const lastStreamAccRef = useRef('')
  const streamPersistedPathsRef = useRef(new Set())
  const streamApplyChainRef = useRef(Promise.resolve())
  const streamPendingFilesRef = useRef(new Map())
  const streamFlushScheduledRef = useRef(false)
  const previewRouteLockRef = useRef(null)
  const [lastPreviewError, setLastPreviewError] = useState(null)
  /** Evita lanzar más de un autofix de imports faltantes por turno de chat. */
  const missingImportsFixRanRef = useRef(false)
  const runMissingImportsFixRef = useRef(null)
  const runUndeliveredFilesFixRef = useRef(null)
  const undeliveredFilesFixRanRef = useRef(false)
  /** Autofix de compilación solo tras cambios vía chat (no edición manual). */
  const compileAutofixFromChatRef = useRef(false)
  const compileFixActiveRef = useRef(false)
  const AUTOFIX_ENABLED_STORAGE = 'sk.editor.autofixEnabled'
  const [autofixEnabled, setAutofixEnabled] = useState(true)
  const autofixEnabledRef = useRef(true)
  const { user, profile, refresh: refreshUser, isAuthenticated, loading: userLoading } = useUser()
  const { status: integrationsStatus, loading: gateLoading, refresh: refreshIntegrations } = useIntegrationsGate(navigate)
  const [githubImportOpen, setGithubImportOpen] = useState(false)
  const [githubImportBusy, setGithubImportBusy] = useState(false)
  const [vercelDeployModal, setVercelDeployModal] = useState(false)
  const {
    modelChoice,
    setModelChoice,
    categoryChoices,
    categoryModels,
    selectionMode,
    setCategoryModelChoice,
    options: modelOptions,
    geminiEnabled,
    selectedLabel: modelSelectedLabel,
  } = useAIModel()
  const codeModelChoice =
    selectionMode === 'custom' && categoryChoices?.code ? categoryChoices.code : modelChoice
  const pendingPromptHandledRef = useRef(false)
  /** @type {React.MutableRefObject<null | { text: string, images?: DesignGenerateImagePayload[], generateImages?: boolean, imageModelId?: string }>} */
  const pendingDesignPromptRef = useRef(null)
  const [designBootstrapBusy, setDesignBootstrapBusy] = useState(false)
  const [designWorkspaceReady, setDesignWorkspaceReady] = useState(false)
  const handleDesignWorkspaceReady = useCallback(() => {
    setDesignWorkspaceReady(true)
  }, [])
  const { focusMode, setFocusMode, toggleFocusMode } = useEditorFocus()

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusMode, setFocusMode])

  useEffect(() => {
    pendingPromptHandledRef.current = false
    setDesignWorkspaceReady(false)
  }, [projectId])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTOFIX_ENABLED_STORAGE)
      if (stored === '0') {
        setAutofixEnabled(false)
        autofixEnabledRef.current = false
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Refresh integrations if Vercel OAuth just completed and returned here
  useEffect(() => {
    if (searchParams.get('vercel') === 'connected') {
      void refreshIntegrations()
    }
  }, [searchParams, refreshIntegrations])

  useEffect(() => {
    if (isDemoActive() || isDemoProjectId(projectId)) {
      enableDemo()
    }
  }, [projectId])

  const [draftProjectId, setDraftProjectId] = useState(null)
  const effectiveProjectId = projectId ?? draftProjectId
  /** Solo cargar archivos/chat del servidor tras confirmar que el proyecto es del usuario. */
  const [projectAccessGranted, setProjectAccessGranted] = useState(
    () => !projectId || isDemoProjectId(projectId),
  )
  const workspaceProjectId = projectAccessGranted ? effectiveProjectId : null

  useEffect(() => {
    setProjectAccessGranted(!projectId || isDemoProjectId(projectId))
  }, [projectId])

  const workspace = useWorkspaceBuffers(workspaceProjectId)
  const {
    displayFiles,
    activePath,
    activeContent,
    activeLanguage,
    openTabs,
    loading: filesLoading,
    saving: fileSaving,
    selectFile,
    closeTab,
    deleteFileByPath,
    createFile,
    renameFile,
    updateActiveContent,
    updateFileContent,
    applyOps,
    applyStreamFiles,
    streamSegments,
    flushSaves,
    persistAllDirty,
    persistNow,
    persistBeforeLeave,
    workspaceFilesForAi,
    buffers,
    refresh: refreshWorkspace,
    parseCleanStreamOpsFromAcc,
    parseModelStreamOpsFromAcc,
    streamOpsAlreadyApplied,
    reconcilePreviewBuffers,
    setBuffers,
  } = workspace

  const {
    code,
    setCode,
    replaceCode,
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorHistory('')

  const codeRef = useRef('')
  const buffersRef = useRef(buffers)
  const lastEditorContentRef = useRef('')
  const lastLoadedPathRef = useRef(null)
  const undoRedoRef = useRef(false)

  const handleUndo = useCallback(() => {
    undoRedoRef.current = true
    undo()
  }, [undo])

  const handleRedo = useCallback(() => {
    undoRedoRef.current = true
    redo()
  }, [redo])

  const handleDesignUndo = useCallback(() => {
    void designPanelRef.current?.undo()
  }, [])

  const handleDesignRedo = useCallback(() => {
    void designPanelRef.current?.redo()
  }, [])

  const handleDesignRefreshFiles = useCallback(() => refreshWorkspace(), [refreshWorkspace])

  const handleDesignHistoryChange = useCallback(({ canUndo, canRedo }) => {
    setDesignCanUndo(canUndo)
    setDesignCanRedo(canRedo)
  }, [])

  const [projectName, setProjectName] = useState('Studio')
  const [projectLoading, setProjectLoading] = useState(!!projectId)
  const [specContent, setSpecContent] = useState('')
  const [specDirty, setSpecDirty] = useState(false)
  const [sessionCost, setSessionCost] = useState(0)
  const [framework, setFramework] = useState('react')
  const [codeTemplate, setCodeTemplate] = useState(DEFAULT_CODE_TEMPLATE)
  const [selectedCodeTemplates, setSelectedCodeTemplates] = useState([DEFAULT_CODE_TEMPLATE])
  const [createCodeMenuOpen, setCreateCodeMenuOpen] = useState(false)
  const codeTemplateSaveTimerRef = useRef(null)

  useEffect(() => {
    const fw = consumeStudioFramework()
    if (fw) setFramework(fw)
  }, [])

  const [tab, setTab] = useState('design')
  const tabRef = useRef(tab)
  tabRef.current = tab
  const [mdPreview, setMdPreview] = useState(false)
  const [visualMode, setVisualMode] = useState('off')
  const [viewport, setViewport] = useState('lg')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('studio_viewport')
      if (saved === 'sm' || saved === 'md' || saved === 'lg') setViewport(saved)
    } catch {
      /* ignore */
    }
  }, [])
  const [iframeKey, setIframeKey] = useState(0)
  const [autoRunChat, setAutoRunChat] = useState(null)
  const [selectedElement, setSelectedElement] = useState(null)
  const [canvasPins, setCanvasPins] = useState([])
  const [publishLoading, setPublishLoading] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [deleteProjectBusy, setDeleteProjectBusy] = useState(false)
  const addDebugRef = useRef(() => {})
  const clearDebugRef = useRef(() => {})
  /** Evita ejecutar dos veces el mismo init de Studio (_studio / reentry). */
  const handledStudioInitRef = useRef(null)
  const addDebug = useCallback((type, message) => {
    addDebugRef.current(type, message)
  }, [])
  const [chatRestoreBusy, setChatRestoreBusy] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [deployedUrl, setDeployedUrl] = useState(null)
  const [designPhase, setDesignPhase] = useState('design')
  const [designSurfaceFromCanvas, setDesignSurfaceFromCanvas] = useState({
    designJson: null,
    paths: [],
  })
  const [designApprovedAt, setDesignApprovedAt] = useState(null)
  const [designBusy, setDesignBusy] = useState(false)
  const [designDevice, setDesignDevice] = useState(DEFAULT_DESIGN_DEVICE)
  const [designCanUndo, setDesignCanUndo] = useState(false)
  const [designCanRedo, setDesignCanRedo] = useState(false)
  /** @type {React.MutableRefObject<DesignWorkspaceHandle | null>} */
  const designPanelRef = useRef(null)
  const [mobileReadiness, setMobileReadiness] = useState(null)
  const [targetPlatforms, setTargetPlatforms] = useState(['web', 'ios', 'android'])
  const [fileNotice, setFileNotice] = useState(null)
  const { speechNotice, setSpeechNotice } = useSpeechNotice()
  const [, setCoverUrl] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const coverCapturedRef = useRef(false)
  const coverCaptureIframeRef = useRef(null)
  const [aiStreamActive, setAiStreamActive] = useState(false)
  const breakpoint = useBreakpoint()
  const studioCompact = breakpoint === 'sm' || breakpoint === 'md'
  const [mobilePanel, setMobilePanel] = useState('design')
  const {
    chatWidth,
    railWidth,
    filesOpen,
    chatOpen,
    toggleFilesOpen,
    toggleChatOpen,
    setChatOpen,
    setFilesOpen,
    setChatWidth,
    setRailWidth,
    persist,
  } = useEditorPanelWidths({ compact: studioCompact })

  useEffect(() => {
    if (!studioCompact) return
    if (mobilePanel === 'chat') {
      setChatOpen(true)
      setFilesOpen(false)
    } else if (mobilePanel === 'files') {
      setFilesOpen(true)
      setChatOpen(false)
    } else {
      setChatOpen(false)
      setFilesOpen(false)
      if (mobilePanel === 'design') setTab('design')
      if (mobilePanel === 'preview') setTab('preview')
    }
  }, [studioCompact, mobilePanel, setChatOpen, setFilesOpen])

  useEffect(() => {
    if (tab === 'design' && filesOpen) setFilesOpen(false)
  }, [tab, filesOpen, setFilesOpen])

  const dirtyPaths = new Set(
    Object.entries(buffers)
      .filter(([, b]) => b.dirty)
      .map(([p]) => p),
  )
  const activeBuffer = buffers[activePath]
  const activeBufContent = activeBuffer?.content ?? ''
  const hasDirtyFiles = dirtyPaths.size > 0
  const hasUnsavedEdits =
    hasDirtyFiles ||
    Boolean(activePath && activeBuffer && code !== activeBuffer.content)
  const activeOverride =
    activePath && code !== (activeBuffer?.content ?? '')
      ? { path: activePath, content: code }
      : null
  const meaningfulDraft = workspaceHasMeaningfulContent(
    buffers,
    activeOverride,
    specDirty ? specContent : undefined,
  )
  const canSaveFiles = Boolean((projectId || meaningfulDraft) && hasUnsavedEdits)

  const {
    mode: studioMode,
    resolveStudioProjectId,
    ensureProjectCommitted,
    recoverMissingStudioProject,
    clearJustCreated,
    isJustCreated,
    committedProjectIdRef,
  } = useStudioProjectLifecycle({
    projectId,
    draftProjectId,
    setDraftProjectId,
    studioLang,
    router,
    buffersRef,
    codeRef,
    activePath,
    specDirty,
    specContent,
    onProjectCreated: (project) => setProjectName(project.name),
  })

  const handleDesignBootstrapSubmit = useCallback(
    async (prompt, opts) => {
      const trimmed = prompt.trim()
      const hasImages = Boolean(
        opts?.images?.some((img) => Boolean(img.data?.trim() || img.url?.trim())),
      )
      if ((!trimmed && !hasImages) || designBootstrapBusy) return
      const text = trimmed || t('ed.design.promptFromImages')
      setDesignBootstrapBusy(true)
      try {
        pendingDesignPromptRef.current = {
          text,
          images: opts?.images,
          generateImages: opts?.generateImages,
          imageModelId: opts?.imageModelId,
        }
        const pid = await ensureProjectCommitted({
          initialSpec: `# Spec\n\n${text}\n`,
        })
        if (!pid) pendingDesignPromptRef.current = null
      } finally {
        setDesignBootstrapBusy(false)
      }
    },
    [designBootstrapBusy, ensureProjectCommitted, t],
  )

  useEffect(() => {
    if (!effectiveProjectId || !designWorkspaceReady) return
    const pending = pendingDesignPromptRef.current
    if (!pending) return
    pendingDesignPromptRef.current = null
    void designPanelRef.current?.generate(pending.text, {
      replaceDesign: consumeStudioReplaceDesign(),
      images: pending.images?.length ? pending.images : undefined,
      generateImages: pending.generateImages,
      imageModelId: pending.imageModelId,
    })
  }, [effectiveProjectId, designWorkspaceReady])

  const { triggerCoverCapture } = useStudioCoverCapture(buffersRef, coverCaptureIframeRef)
  const { triggerMemoryExtract } = useStudioMemoryExtract(isAuthenticated)

  const credits = profile?.credits ?? 0
  useEffect(() => {
    codeRef.current = code
  }, [code])

  useEffect(() => {
    buffersRef.current = buffers
  }, [buffers])

  const designJsonContent = useMemo(
    () =>
      designSurfaceFromCanvas.designJson ??
      displayFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ??
      buffers[DESIGN_SPEC_JSON]?.content ??
      null,
    [designSurfaceFromCanvas.designJson, displayFiles, buffers],
  )
  useEffect(() => {
    if (!designJsonContent) return
    try {
      const spec = JSON.parse(designJsonContent)
      const d = spec?.targetDevice
      if (d === 'desktop' || d === 'tablet' || d === 'mobile') {
        setDesignDevice(d)
      }
    } catch {
      /* ignore */
    }
  }, [designJsonContent])

  const pushDesignActivity = useCallback((message, status = 'done') => {
    designPanelRef.current?.pushActivity(message, status)
  }, [])

  const showEditorNotice = useCallback((type, message) => {
    if (tab === 'design') {
      if (type === 'error' || type === 'success') {
        pushDesignActivity(message, type === 'error' ? 'error' : 'done')
      }
      return
    }
    if (type === 'error' || type === 'success') {
      setFileNotice({ type, message })
    }
    if (type === 'error') addDebug('error', message)
    else if (type === 'success') addDebug('success', message)
    else addDebug('info', message)
  }, [addDebug, tab, pushDesignActivity])

  useEffect(() => {
    if (!fileNotice) return
    const timer = setTimeout(() => setFileNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [fileNotice])

  useEffect(() => {
    if (activePath !== lastLoadedPathRef.current) {
      lastLoadedPathRef.current = activePath
      replaceCode(activeContent)
      lastEditorContentRef.current = activeContent
      return
    }
    // Cambios externos (IA/stream): actualizar editor sin eco del buffer local.
    if (activeContent !== lastEditorContentRef.current) {
      replaceCode(activeContent)
      lastEditorContentRef.current = activeContent
    }
  }, [activePath, activeContent, replaceCode])

  // Deshacer/rehacer: sincronizar buffer cuando el código cambia sin venir del editor.
  useEffect(() => {
    if (!activePath || activeBufContent === code) return
    if (code === lastEditorContentRef.current) return
    lastEditorContentRef.current = code
    if (!aiStreamActiveRef.current && !compileFixActiveRef.current) {
      compileAutofixFromChatRef.current = false
    }
    updateActiveContent(code)
    if (undoRedoRef.current) {
      undoRedoRef.current = false
      void flushSaves()
    }
  }, [activePath, code, activeBufContent, updateActiveContent, flushSaves])

  useEffect(() => {
    if (projectId) return
    if (!isDemoActive() && !userLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [projectId, isAuthenticated, userLoading, navigate])

  useEffect(() => {
    if (
      projectId ||
      draftProjectId ||
      committedProjectIdRef.current ||
      aiStreamActiveRef.current ||
      tab === 'design'
    ) {
      return
    }
    const override = activePath
      ? { path: activePath, content: codeRef.current }
      : null
    if (
      !workspaceHasMeaningfulContent(
        buffersRef.current,
        override,
        specDirty ? specContent : undefined,
      )
    ) {
      return
    }
    void ensureProjectCommitted()
  }, [
    projectId,
    draftProjectId,
    buffers,
    code,
    activePath,
    specContent,
    specDirty,
    ensureProjectCommitted,
    tab,
  ])

  const saveWorkspaceFiles = useCallback(async () => {
    if (!canSaveFiles) return
    try {
      const existingPid = resolveStudioProjectId()
      if (!existingPid) {
        const pid = await ensureProjectCommitted()
        if (!pid) return
        showEditorNotice('success', t('ed.filesSaved'))
        void triggerCoverCapture(pid, setCoverUrl)
        return
      }
      const override =
        activePath && code !== (buffers[activePath]?.content ?? '')
          ? { path: activePath, content: code }
          : null
      await persistNow(override, existingPid)
      showEditorNotice('success', t('ed.filesSaved'))
      void triggerCoverCapture(existingPid, setCoverUrl)
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : t('ed.filesSaveError')
      showEditorNotice('error', msg)
    }
  }, [
    canSaveFiles,
    activePath,
    code,
    buffers,
    resolveStudioProjectId,
    persistNow,
    ensureProjectCommitted,
    triggerCoverCapture,
    showEditorNotice,
    t,
  ])

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 's') {
        e.preventDefault()
        if ((tab === 'code' || tab === 'split') && canSaveFiles) void saveWorkspaceFiles()
        return
      }
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, handleRedo, tab, canSaveFiles, saveWorkspaceFiles])

  useEffect(() => {
    const onBeforeUnload = () => {
      void persistBeforeLeave(
        activePath ? { path: activePath, content: codeRef.current } : null,
      )
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [activePath, persistBeforeLeave])

  // Al salir del Studio o cambiar de proyecto: guardar editor activo y buffers sucios.
  useEffect(() => {
    const path = activePath
    return () => {
      void persistBeforeLeave(path ? { path, content: codeRef.current } : null)
    }
  }, [projectId, activePath, persistBeforeLeave])

  const loadProject = useCallback(async () => {
    if (projectId && isJustCreated(projectId)) {
      clearJustCreated(projectId)
    }
    if (projectId) {
      consumeStudioProjectJustCreated()
    }
    if (!projectId) {
      setProjectAccessGranted(true)
      setProjectLoading(false)
      if (isDemoActive() || isAuthenticated) {
        const names = isDemoActive()
          ? loadDemoProjects().map((p) => p.name)
          : []
        setProjectName(nextGenericProjectName(names, studioLang))
        setFramework('react')
      }
      return
    }
    setProjectLoading(true)

    if (isDemoProjectId(projectId)) {
      const project = findDemoProject(projectId)
      if (!project) {
        setProjectAccessGranted(false)
        navigate('/studio')
        setProjectLoading(false)
        return
      }
      setProjectName(project.name)
      setFramework(project.framework || 'react')
      const tpl = project.codeTemplate ?? DEFAULT_CODE_TEMPLATE
      setCodeTemplate(tpl)
      setSelectedCodeTemplates([tpl])
      setDeployedUrl(project.deployedUrl ?? null)
      setDesignPhase(project.designPhase ?? 'design')
      setDesignApprovedAt(project.designApprovedAt ?? null)
      setMobileReadiness(project.mobileReadiness ?? null)
      setTargetPlatforms(project.targetPlatforms ?? ['web', 'ios', 'android'])
      setSpecContent(loadDemoProjectSpec(projectId) || '')
      setSpecDirty(false)
      setProjectAccessGranted(true)
      setProjectLoading(false)
      return
    }

    setProjectAccessGranted(false)

    try {
      const data = await apiFetch(`/api/projects/${projectId}`)
      const project = normalizeProject(data.project ?? data)
      if (!project) throw new Error('Proyecto no encontrado')
      setProjectName(project.name)
      setFramework(project.framework || 'react')
      const tpl = project.codeTemplate ?? DEFAULT_CODE_TEMPLATE
      setCodeTemplate(tpl)
      setSelectedCodeTemplates([tpl])
      setDeployedUrl(project.deployedUrl ?? null)
      setDesignPhase(project.designPhase ?? 'code')
      setDesignApprovedAt(project.designApprovedAt ?? null)
      setMobileReadiness(project.mobileReadiness ?? null)
      setTargetPlatforms(project.targetPlatforms ?? ['web', 'ios', 'android'])
      if (project.coverUrl) {
        setCoverUrl(project.coverUrl)
        coverCapturedRef.current = true
      }
      const { spec } = await apiFetch(`/api/projects/${projectId}/spec`)
      setSpecContent(spec?.content || '')
      setSpecDirty(false)
      setProjectAccessGranted(true)
    } catch {
      setProjectAccessGranted(false)
      setFileNotice({ type: 'error', message: t('ed.projectAccessDenied') })
      if (isDemoActive() || isAuthenticated) {
        router.replace('/studio')
      } else {
        navigate('/')
      }
    }
    setProjectLoading(false)
  }, [
    projectId,
    navigate,
    router,
    studioLang,
    isAuthenticated,
    isJustCreated,
    clearJustCreated,
    t,
  ])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  useEffect(() => {
    if (!projectId || !isDemoProjectId(projectId)) return
    const syncDemoPhase = () => {
      const p = findDemoProject(projectId)
      if (p?.designPhase) setDesignPhase(p.designPhase)
    }
    window.addEventListener(DEMO_EVENT, syncDemoPhase)
    return () => window.removeEventListener(DEMO_EVENT, syncDemoPhase)
  }, [projectId])

  const previewReconcileRef = useRef(null)
  const previewReconcileKey = effectiveProjectId ?? '__draft__'

  useEffect(() => {
    previewReconcileRef.current = null
  }, [previewReconcileKey])

  useEffect(() => {
    if (filesLoading || !projectAccessGranted || aiStreamActiveRef.current) return
    if (previewReconcileRef.current === previewReconcileKey) return
    const appContent = buffers['src/App.tsx']?.content ?? ''
    if (!isBlankStudioApp(appContent)) return
    const hasUiModules = displayFiles.some(
      (f) =>
        /^src\/(components|pages)\/[^/]+\.(tsx|jsx)$/i.test(f.path) &&
        /export\s+default/.test(f.content),
    )
    if (!hasUiModules) return
    previewReconcileRef.current = previewReconcileKey
    void (async () => {
      const result = await reconcilePreviewBuffers()
      if (result?.wiredApp || result?.fixedImportPaths?.length) {
        setIframeKey((k) => k + 1)
      }
    })()
  }, [
    filesLoading,
    projectAccessGranted,
    previewReconcileKey,
    displayFiles,
    buffers,
    reconcilePreviewBuffers,
  ])

  useEffect(() => {
    if (filesLoading || !projectId) return
    const specPath = SPEC_KIT_PATHS.spec
    const fromBuffer = buffers[specPath]?.content ?? ''
    if (fromBuffer.trim()) {
      if (!specDirty && specContent !== fromBuffer) {
        setSpecContent(fromBuffer)
      }
      return
    }
    if (specContent.trim()) {
      void createFile(specPath, specContent)
    }
  }, [projectId, filesLoading, buffers, specContent, specDirty, createFile])

  function handleCodeChange(next) {
    if (!compileFixActiveRef.current) {
      compileAutofixFromChatRef.current = false
    }
    lastEditorContentRef.current = next
    setCode(next)
    updateActiveContent(next)
    if (activePath === SPEC_KIT_PATHS.spec) {
      setSpecContent(next)
      setSpecDirty(true)
    }
  }

  function handleSelectFile(path, { fromPreviewNav = false } = {}) {
    if (path === activePath) return
    if (!fromPreviewNav) pushSnapshot()
    const next = buffers[path]?.content ?? ''
    lastEditorContentRef.current = next
    replaceCode(next)
    selectFile(path)
    setMdPreview(false)

    const files = Object.entries(buffersRef.current).map(([p, b]) => ({
      path: p,
      content: b?.content ?? '',
    }))
    const route = previewRouteForFile(path, files)
    if (route) {
      const norm = normRoute(route)
      previewRouteLockRef.current = norm
      if (!fromPreviewNav) {
        const iframe = findPreviewIframe()
        if (iframe) navigatePreviewToRoute(iframe, norm)
        if (tab === 'code') setTab('preview')
      }
    } else if (!fromPreviewNav) {
      previewRouteLockRef.current = null
    }
  }

  const handlePreviewRouteFromIframe = useCallback(
    (route) => {
      const r = normRoute(route)
      if (previewRouteLockRef.current === r) return
      previewRouteLockRef.current = r
      const files = Object.entries(buffersRef.current).map(([p, b]) => ({
        path: p,
        content: b?.content ?? '',
      }))
      const path = previewFileForRoute(r, files)
      if (!path || path === activePath) return
      handleSelectFile(path, { fromPreviewNav: true })
    },
    [activePath, replaceCode, selectFile, tab],
  )

  const persistWorkspaceNow = useCallback(async () => {
    if (!projectId) {
      await ensureProjectCommitted()
    }
    if (activePath && code !== (buffers[activePath]?.content ?? '')) {
      updateActiveContent(code)
    }
    await flushSaves()
    await persistAllDirty()
  }, [
    activePath,
    code,
    buffers,
    updateActiveContent,
    flushSaves,
    persistAllDirty,
    projectId,
    ensureProjectCommitted,
  ])

  async function applyStreamOpsFromText(acc, options = {}) {
    const knownPaths = Object.keys(buffersRef.current)
    let ops = parseFileOperationsFromStream(acc, {
      defaultPath: resolveStreamDefaultPath(activePath, knownPaths),
      existingPaths: knownPaths,
    })
    if (options.onlyPaths?.length) {
      ops = filterFileOpsToPaths(ops, options.onlyPaths)
    }
    if (!ops.length) return undefined

    const result = await applyOps(ops, { projectIdOverride: options.projectIdOverride ?? null })
    if (result.error) {
      showEditorNotice('error', result.error)
      return result
    }
    if (result.touched.length && !compileFixBusy) {
      setFileNotice({
        type: 'success',
        message: t('ed.filesApplied').replace('{n}', String(result.touched.length)),
      })
    }
    return result
  }

  function flushStreamPendingFiles() {
    streamFlushScheduledRef.current = false
    const batch = [...streamPendingFilesRef.current.values()]
    streamPendingFilesRef.current.clear()
    if (!batch.length) return streamApplyChainRef.current
    streamApplyChainRef.current = streamApplyChainRef.current
      .then(() => handleStreamFiles(batch))
      .catch(() => undefined)
    return streamApplyChainRef.current
  }

  function enqueueStreamFileApply(files) {
    if (!files?.length) return streamApplyChainRef.current
    for (const f of files) {
      if (f?.path) streamPendingFilesRef.current.set(f.path, f)
    }
    if (!streamFlushScheduledRef.current) {
      streamFlushScheduledRef.current = true
      queueMicrotask(flushStreamPendingFiles)
    }
    return streamApplyChainRef.current
  }

  function handleStreamFileOps(acc) {
    const defaultPath = resolveStreamDefaultPath(activePath, Object.keys(buffersRef.current))
    const parseOpts = {
      defaultPath,
      existingPaths: Object.keys(buffersRef.current),
    }
    const prevAcc = lastStreamAccRef.current
    lastStreamAccRef.current = acc

    const segments = parseAssistantSegments(acc)
    streamSegments(segments, defaultPath)

    const newOps = fileOpsFromNewlyCompletedSegments(prevAcc, acc, parseOpts)
    if (!newOps.length) return

    const files = newOps
      .filter((o) => o.type !== 'delete')
      .map((o) => ({ path: o.path, content: o.content }))
    enqueueStreamFileApply(files)
  }

  async function persistWorkspaceAfterStream(activeOverride) {
    if (!resolveStudioProjectId()) return
    try {
      await flushSaves()
      await persistAllDirty()
    } catch (err) {
      if (!isProjectNotFoundError(err)) throw err
      const newPid = await recoverMissingStudioProject()
      if (!newPid) throw err
      await saveWorkspaceToProject(
        newPid,
        buffersRef.current,
        activeOverride ?? null,
        specDirty ? specContent : undefined,
      )
      await refreshWorkspace()
      showEditorNotice(
        'info',
        'El proyecto de la URL ya no existe; se creó uno nuevo y se guardaron tus archivos.',
      )
    }
  }

  async function handleStreamDone(acc) {
    await streamApplyChainRef.current
    const activeOverride =
      activePath && code !== (buffers[activePath]?.content ?? '')
        ? { path: activePath, content: code }
        : null
    let pid = resolveStudioProjectId()
    const applied = await applyStreamOpsFromText(acc, { projectIdOverride: pid })
    if (applied?.error && isProjectNotFoundError({ message: applied.error })) {
      const newPid = await recoverMissingStudioProject()
      if (newPid) {
        pid = newPid
        await saveWorkspaceToProject(
          newPid,
          buffersRef.current,
          activeOverride,
          specDirty ? specContent : undefined,
        )
        await refreshWorkspace()
        showEditorNotice(
          'info',
          'El proyecto de la URL ya no existe; se creó uno nuevo y se guardaron tus archivos.',
        )
      }
    }
    const modelOps = parseModelStreamOpsFromAcc(acc)
    const updateOps = modelOps.filter((o) => o.type !== 'delete')
    const alreadyInBuffers = streamOpsAlreadyApplied(modelOps)
    const appliedPathCount = streamAppliedPathsRef.current.length
    const filesWereApplied = streamFilesWereApplied({
      streamFilesAppliedFlag: streamFilesAppliedRef.current,
      streamAppliedPathsCount: appliedPathCount,
      appliedTouchedCount: applied?.touched?.length ?? 0,
      alreadyInBuffers,
      updateOpsCount: updateOps.length,
    })

    if (!pid) {
      const spec = specDirty ? specContent : undefined
      const meaningful = workspaceHasMeaningfulContent(
        buffersRef.current,
        activeOverride,
        spec,
      )
      if (meaningful || filesWereApplied) {
        pid = await ensureProjectCommitted()
      }
    }

    if (
      (alreadyInBuffers || streamFilesAppliedRef.current || appliedPathCount > 0) &&
      !applied?.touched?.length &&
      !applied?.error &&
      updateOps.length > 0
    ) {
      const n = appliedPathCount > 0 ? appliedPathCount : updateOps.length
      addDebug('success', t('ed.filesApplied').replace('{n}', String(n)))
    } else if (acc?.trim() && !filesWereApplied && !applied?.error) {
      const hasFence = /```[\w-]*\s+\S/.test(acc) || /```[\w-]*\n/.test(acc)
      if (hasFence && updateOps.length > 0) {
        addDebug('error', t('ed.filesNotApplied'))
      }
    }
    streamFilesAppliedRef.current = false
    if (pid) await persistWorkspaceAfterStream(activeOverride)
    await applyMissingEntryFiles()
    const reconciled = await reconcilePreviewBuffers()
    if (reconciled?.wiredApp) {
      addDebug(
        'success',
        'App.tsx conectado al componente principal para que el preview muestre la UI generada.',
      )
      setIframeKey((k) => k + 1)
    } else if (reconciled?.fixedImportPaths?.length) {
      addDebug(
        'info',
        `Imports corregidos en: ${reconciled.fixedImportPaths.map((p) => p.split('/').pop()).join(', ')}`,
      )
      setIframeKey((k) => k + 1)
    }
    if (reconciled?.touched?.length) {
      streamAppliedPathsRef.current = [
        ...new Set([...streamAppliedPathsRef.current, ...reconciled.touched]),
      ]
    }
    const missingImports = detectMissingLocalImports(fileListFromBuffers(buffersRef.current))
    const deliveredForCheck = [
      ...new Set([
        ...(applied?.touched ?? []),
        ...streamAppliedPathsRef.current,
        ...updateOps.map((o) => o.path),
      ]),
    ]
    const undeliveredFromText = detectUndeliveredFilePaths(acc, deliveredForCheck)
    if (
      missingImports.length > 0 &&
      autofixEnabledRef.current &&
      compileAutofixFromChatRef.current &&
      !missingImportsFixRanRef.current
    ) {
      missingImportsFixRanRef.current = true
      runMissingImportsFixRef.current?.(missingImports)
    } else if (
      undeliveredFromText.length >= 1 &&
      autofixEnabledRef.current &&
      compileAutofixFromChatRef.current &&
      !undeliveredFilesFixRanRef.current
    ) {
      undeliveredFilesFixRanRef.current = true
      runUndeliveredFilesFixRef.current?.(undeliveredFromText)
    }
    setTab((cur) => (cur === 'code' ? cur : 'preview'))
    setIframeKey((k) => k + 1)
    const captureId = pid || projectId || draftProjectId
    if (captureId) void triggerCoverCapture(captureId, setCoverUrl)
    const memoryPid = resolveStudioProjectId() ?? pid
    if (memoryPid) {
      const lastUser = [...activeMessages].reverse().find((m) => m.role === 'user' && m.content?.trim())
      if (lastUser) void triggerMemoryExtract(memoryPid, lastUser.content, acc)
    }

    const touchedPaths = [
      ...new Set([
        ...(applied?.touched ?? []),
        ...streamAppliedPathsRef.current,
        ...updateOps.map((o) => o.path),
      ]),
    ]
    streamAppliedPathsRef.current = []
    const opsForSummary =
      updateOps.length > 0
        ? updateOps
        : touchedPaths.map((path) => ({
            type: pathsBeforeStreamRef.current.has(path) ? 'update' : 'create',
            path,
            content: buffersRef.current[path]?.content ?? '',
          }))
    const appliedFiles =
      opsForSummary.length > 0
        ? buildChatAppliedFiles(opsForSummary, {
            pathsBefore: pathsBeforeStreamRef.current,
            buffers: buffersRef.current,
          })
        : undefined
    return appliedFiles?.length ? { appliedFiles } : {}
  }

  async function persistSpecFromWorkspace(files, pid = projectId) {
    const specText = specContentFromFiles(files)
    if (!specText.trim() || !pid) return
    setSpecContent(specText)
    setSpecDirty(false)
    if (isDemoActive() && isDemoProjectId(pid)) {
      saveDemoProjectSpec(pid, specText)
    } else {
      await apiFetch(`/api/projects/${pid}/spec`, {
        method: 'PUT',
        body: JSON.stringify({ content: specText }),
      })
    }
  }

  async function handleStreamFiles(files) {
    if (!files?.length) return
    const merged = new Map()
    for (const f of files) {
      if (f?.path) merged.set(f.path, f)
    }
    const unique = [...merged.values()]
    const toApply = unique.filter((f) => {
      if (!streamPersistedPathsRef.current.has(f.path)) return true
      const cur = buffersRef.current[f.path]?.content
      return cur?.trimEnd() !== f.content.trimEnd()
    })
    if (!toApply.length) return
    addDebug('action', `Files received: ${toApply.map((f) => f.path).join(', ')}`)

    const hasIncomingContent = toApply.some((f) => (f.content ?? '').trim().length > 0)
    if (!hasIncomingContent) return

    let pid = resolveStudioProjectId()
    try {
      if (!pid) pid = await ensureProjectCommitted()
    } catch (e) {
      showEditorNotice(
        'error',
        e instanceof Error ? e.message : 'No se pudo crear el proyecto para guardar archivos',
      )
      return
    }
    if (!pid) {
      showEditorNotice('error', 'No hay proyecto activo para aplicar los archivos')
      return
    }
    const result = await applyStreamFiles(toApply)
    if (result?.error) {
      showEditorNotice('error', result.error)
      return
    }
    if (result?.touched?.length) {
      for (const p of result.touched) streamPersistedPathsRef.current.add(p)
      streamFilesAppliedRef.current = true
      streamAppliedPathsRef.current = [
        ...new Set([...streamAppliedPathsRef.current, ...result.touched]),
      ]
      setFileNotice({
        type: 'success',
        message: t('ed.filesApplied').replace('{n}', String(result.touched.length)),
      })
    }
    await applyMissingEntryFiles()
    setIframeKey((k) => k + 1)
    await persistSpecFromWorkspace(toApply, pid)
  }

  async function handleStreamImages(images) {
    if (!images?.length) return
    // Las imágenes se guardan como archivos con contenido base64 en public/images/
    const imageFiles = images.map((img) => ({
      path: img.path,
      content: img.content,
    }))
    await applyStreamFiles(imageFiles)
  }

  async function handlePublishGithub() {
    if (!projectId) return
    setPublishLoading(true)
    try {
      const res = await apiFetch(`/api/projects/${projectId}/publish/github`, { method: 'POST' })
      if (res.url) window.open(res.url, '_blank', 'noopener')
    } catch (err) {
      alert(err instanceof Error ? err.message : t('ed.publishGithubError'))
    }
    setPublishLoading(false)
  }

  async function runGithubImport() {
    if (!projectId || githubImportBusy) return
    if (!canUseGithubImport(user, profile)) return

    if (isDemoActive()) {
      discardPrimedGithubTab()
      setPendingGithubImport()
      navigate(
        `/auth/signup?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      )
      return
    }

    setGithubImportBusy(true)
    try {
      await ensureGithubConnected()
      setGithubImportOpen(true)
    } catch (err) {
      if (!(err instanceof Error)) return
      if (err.message === GITHUB_SIGN_IN_REQUIRED) {
        discardPrimedGithubTab()
        setPendingGithubImport()
        navigate(`/auth/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }
      if (err.message === GITHUB_OAUTH_NOT_CONFIGURED) {
        alert(t('ed.importGithub.oauthNotConfigured'))
        return
      }
      if (err.message.includes('cerrada antes')) return
      alert(err.message || t('ed.importGithub.connectError'))
    } finally {
      setGithubImportBusy(false)
    }
  }

  function handleGithubImport() {
    if (!canUseGithubImport(user, profile)) return
    if (!isDemoActive()) primeGithubOAuthTab()
    void runGithubImport()
  }

  const openDesignFigmaImport = useCallback(() => {
    void flushSaves()
    setTab('design')
    window.setTimeout(() => designPanelRef.current?.openFigmaImport?.(), 120)
  }, [flushSaves])

  const openDesignCanvaImport = useCallback(() => {
    void flushSaves()
    setTab('design')
    window.setTimeout(() => designPanelRef.current?.openCanvasImageUpload?.(), 120)
  }, [flushSaves])

  const openDesignStitchImport = useCallback(() => {
    void flushSaves()
    setTab('design')
    window.setTimeout(() => designPanelRef.current?.openStitchImport?.(), 120)
  }, [flushSaves])

  const designImportEnabled = Boolean(effectiveProjectId) && !designBusy

  const hasWorkspaceFiles = displayFiles.length > 0

  const newChatLabel = t('ed.chatTabNew')
  const {
    sessions: chatSessions,
    activeSession,
    activeId: activeChatSessionId,
    activeMessages,
    setActiveMessages,
    createSession: createChatSession,
    ensureActiveChatSession,
    selectSession: selectChatSession,
    closeSession: closeChatSession,
    chatLoading,
  } = useProjectChatSessions({
    projectId: projectAccessGranted ? (projectId ?? draftProjectId) : null,
    welcomeMessage: '',
    newChatLabel,
    serverPersist:
      projectAccessGranted &&
      isAuthenticated &&
      (projectId ?? draftProjectId) &&
      !isDemoProjectId(projectId ?? draftProjectId ?? ''),
  })

  const captureWorkspaceSnapshot = useCallback(() => {
    const pid = projectId
    if (!pid) return null
    const files = workspaceFilesForAi().map((f) => ({ ...f }))
    const path = activePath
    if (path) {
      const content = codeRef.current
      const idx = files.findIndex((f) => f.path === path)
      if (idx >= 0) files[idx] = { path, content }
      else if (content.trim()) files.push({ path, content })
    }
    const spec = specContentFromFiles(files).trim() || specContent
    return saveWorkspaceSnapshot(pid, { files, spec })
  }, [projectId, workspaceFilesForAi, activePath, specContent])

  const handleCaptureSnapshot = useCallback(async () => {
    const pid = projectId
    if (!pid || capturing) return
    setCapturing(true)
    try {
      const iframe = findPreviewIframe() ?? coverCaptureIframeRef.current
      const url = await captureCurrentPreview(pid, iframe, { visibleOnly: true })
      if (!url) {
        showEditorNotice('error', t('ed.captureFailed'))
        return
      }
      setCoverUrl(url)
      showEditorNotice('success', t('ed.captureSaved'))
    } catch {
      showEditorNotice('error', t('ed.captureFailed'))
    } finally {
      setCapturing(false)
    }
  }, [projectId, capturing, showEditorNotice, t])

  const handleRestoreToMessage = useCallback(
    async (messageIndex) => {
      if (!projectId || chatRestoreBusy || aiStreamActiveRef.current) return
      const msg = activeMessages[messageIndex]
      if (msg?.role !== 'user' || !msg.workspaceSnapshotId) return

      const snapshot = loadWorkspaceSnapshot(projectId, msg.workspaceSnapshotId)
      if (!snapshot) {
        setFileNotice({ type: 'error', message: t('ed.chatRestore.noSnapshot') })
        return
      }

      setChatRestoreBusy(true)
      try {
        await restoreWorkspaceToProject(projectId, snapshot)
        setActiveMessages((msgs) => {
          const removed = msgs.slice(messageIndex + 1)
          const orphanIds = removed
            .map((m) => m.workspaceSnapshotId)
            .filter((id) => Boolean(id))
          pruneWorkspaceSnapshots(projectId, orphanIds)
          return msgs.slice(0, messageIndex + 1)
        })
        setSpecContent(snapshot.spec)
        setSpecDirty(false)
        setIframeKey((k) => k + 1)
        await refreshWorkspace()
        setFileNotice({ type: 'success', message: t('ed.chatRestore.success') })
      } catch (err) {
        setFileNotice({
          type: 'error',
          message: err instanceof Error ? err.message : t('ed.filesSaveError'),
        })
      } finally {
        setChatRestoreBusy(false)
      }
    },
    [
      projectId,
      chatRestoreBusy,
      activeMessages,
      setActiveMessages,
      refreshWorkspace,
      t,
    ],
  )

  async function applyMissingEntryFiles() {
    return false
  }

  const pushStudioChatEvent = useCallback(
    /** @param {ChatStudioEvent} event */
    (event) => {
      setActiveMessages((prev) => appendStudioChatEvent(prev, event))
    },
    [setActiveMessages],
  )

  const {
    compileFixBusy,
    compileFixAttempt,
    previewFixGaveUp,
    handleCompileError: onPreviewCompileError,
    handleCompileOk: onPreviewCompileOk,
    resetCompileFixState,
    stopCompileFix,
    cancelCompileFixSilently,
    runMissingImportsFix,
    runUndeliveredFilesFix,
    triggerVercelBuildFix,
    compileFixRef,
  } = useStudioCompileAutofix({
    t,
    buffersRef,
    effectiveProjectId,
    projectName,
    modelChoice,
    categoryModels,
    framework,
    targetPlatforms,
    chatSessionId: activeSession?.id,
    geminiEnabled,
    aiStreamActiveRef,
    autofixFromChatRef: compileAutofixFromChatRef,
    autofixEnabledRef,
    pushSnapshot,
    setIframeKey,
    applyStreamOpsFromText,
    applyMissingEntryFiles,
    addDebug,
    onStudioChatEvent: pushStudioChatEvent,
  })

  const {
    entries: debugEntries,
    addDebug: addDebugImpl,
    startRun: startDebugRun,
    clear: clearDebug,
  } = useStudioDebugConsole({
    t,
    compileFixBusy,
    aiStreamActive,
    holdFinalize:
      autofixEnabled &&
      !!lastPreviewError &&
      !previewFixGaveUp &&
      (compileFixBusy || compileFixAttempt > 0),
  })
  clearDebugRef.current = clearDebug
  addDebugRef.current = (type, message) => {
    if (tabRef.current === 'design') {
      if (type === 'error' || type === 'success') {
        designPanelRef.current?.pushActivity(message, type === 'error' ? 'error' : 'done')
      }
      return
    }
    addDebugImpl(type, message)
  }

  useEffect(() => {
    const freshNonce = studioFreshNonce?.trim() || null

    if (freshNonce) {
      const initKey = `fresh:${freshNonce}`
      if (handledStudioInitRef.current === initKey) return
      handledStudioInitRef.current = initKey

      const params = new URLSearchParams(searchParams.toString())
      params.delete('_studio')
      params.delete('project')
      const q = params.toString()
      router.replace(`/studio${q ? `?${q}` : ''}`, { scroll: false })

      // Sesión nueva de Studio: limpiar siempre (aunque la URL aún lleve ?project= en este render).
      setDraftProjectId(null)
      committedProjectIdRef.current = null
      setBuffers({})
      buffersRef.current = {}
      setSpecContent('')
      setSpecDirty(false)
      setDesignPhase('design')
      setDesignApprovedAt(null)
      setCoverUrl(null)
      coverCapturedRef.current = false
      setDeployedUrl(null)
      setMobileReadiness(null)
      setTargetPlatforms(['web', 'ios', 'android'])
      setSessionCost(0)
      clearDebugRef.current()
      replaceCode('')
      lastEditorContentRef.current = ''
      setCanvasPins([])
      setDesignSurfaceFromCanvas({ designJson: null, paths: [] })
      setAutoRunChat(null)
      setSelectedElement(null)
      void loadProject()
      setIframeKey((k) => k + 1)
      return
    }

    const reentryToken = peekStudioReentryToken()
    if (!reentryToken) return

    const initKey = `reentry:${reentryToken}`
    if (handledStudioInitRef.current === initKey) return
    if (!consumeStudioReentry()) return
    handledStudioInitRef.current = initKey

    if (projectId) {
      void refreshWorkspace()
    } else {
      setDraftProjectId(null)
      committedProjectIdRef.current = null
      void loadProject()
    }
    setIframeKey((k) => k + 1)
  }, [studioFreshNonce, projectId, searchParams, router, loadProject, refreshWorkspace, replaceCode])

  const cfState = compileFixRef.current
  compileFixActiveRef.current = Boolean(
    cfState.running || cfState.fixing || cfState.attempts > 0,
  )

  useEffect(() => {
    if (previewFixGaveUp && autofixEnabledRef.current) {
      compileAutofixFromChatRef.current = false
    }
  }, [previewFixGaveUp])

  runMissingImportsFixRef.current = runMissingImportsFix
  runUndeliveredFilesFixRef.current = runUndeliveredFilesFix

  const handleAutofixEnabledChange = useCallback(
    (enabled) => {
      setAutofixEnabled(enabled)
      autofixEnabledRef.current = enabled
      try {
        localStorage.setItem(AUTOFIX_ENABLED_STORAGE, enabled ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (!enabled) {
        compileAutofixFromChatRef.current = false
        cancelCompileFixSilently()
        resetCompileFixState()
      }
    },
    [cancelCompileFixSilently, resetCompileFixState],
  )

  const logCompileErrorsToConsole = useCallback(
    (errorText) => {
      const lines = errorText.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length) {
        for (const line of lines) addDebug('error', line)
      } else {
        addDebug('error', errorText)
      }
    },
    [addDebug],
  )

  const handleCompileError = useCallback(
    (errorText) => {
      if (!errorText) return
      setLastPreviewError(errorText)
      logCompileErrorsToConsole(errorText)
      onPreviewCompileError(errorText)
    },
    [logCompileErrorsToConsole, onPreviewCompileError],
  )

  const handleCompileOk = useCallback(() => {
    setLastPreviewError(null)
    if (autofixEnabledRef.current) {
      compileAutofixFromChatRef.current = false
    }
    onPreviewCompileOk()
  }, [onPreviewCompileOk])

  const recordVisualEdit = useCallback(
    (summary) => {
      compileAutofixFromChatRef.current = false
      setActiveMessages((prev) => [
        ...prev,
        { role: 'user', content: summary },
        {
          role: 'assistant',
          content: t('ed.visualEditSaved'),
        },
      ])
    },
    [setActiveMessages, t],
  )

  useEffect(() => {
    if (projectLoading || gateLoading || !projectId || !projectAccessGranted) return
    if (pendingPromptHandledRef.current) return
    const pending = peekPendingEditorSession()
    if (!pending || (!pending.text && pending.images.length === 0)) return

    const isDesignFlow =
      tab === 'design' || (studioCompact && mobilePanel === 'design')
    const shouldAutoGenerate = pending.autoGenerate !== false

    if (isDesignFlow && shouldAutoGenerate) {
      if (!designWorkspaceReady || !designPanelRef.current) return
      pendingPromptHandledRef.current = true
      consumePendingEditorSession()
      const designImages = pending.images
        .map((img) => {
          if (img.url?.trim()) {
            return { mimeType: img.mimeType, url: img.url.trim() }
          }
          const data = img.dataUrl?.replace(/^data:[^;]+;base64,/, '').trim()
          if (!data || data.length <= 64) return null
          return { mimeType: img.mimeType, data }
        })
        .filter(Boolean)
      void designPanelRef.current.generate(pending.text, {
        planMode: pending.useSpecKit,
        images: designImages.length ? designImages : undefined,
        brief: pending.brief,
        generateImages: pending.generateImages,
        imageModelId: pending.imageModelId,
        replaceDesign: consumeStudioReplaceDesign(),
      })
      return
    }

    if (chatLoading || !activeChatSessionId) return
    pendingPromptHandledRef.current = true
    consumePendingEditorSession()

    setAutoRunChat({
      id: Date.now(),
      text: pending.text,
      images: pending.images,
      useSpecKit: pending.useSpecKit,
    })
  }, [
    projectLoading,
    gateLoading,
    chatLoading,
    projectId,
    projectAccessGranted,
    activeChatSessionId,
    tab,
    studioCompact,
    mobilePanel,
    designWorkspaceReady,
  ])

  /** Tras login desde la landing: crear proyecto y abrir Studio con el prompt pendiente. */
  useEffect(() => {
    if (userLoading || projectId || !isAuthenticated) return
    const pending = peekPendingEditorSession()
    if (!pending?.text) return

    let cancelled = false
    void (async () => {
      try {
        const spec = `# Spec\n\n${pending.text}\n`
        const name = pending.text.slice(0, 80)
        let project
        if (isDemoActive() || shouldUseDemoData(profile)) {
          project = createDemoProject(name, 'next')
          saveDemoProjectSpec(project.id, spec)
        } else {
          ({ project } = await apiFetch('/api/projects', {
            method: 'POST',
            body: JSON.stringify({
              name,
              framework: 'next',
              initialSpec: spec,
            }),
          }))
        }
        if (cancelled) return
        markStudioProjectJustCreated(project.id)
        navigate(`/studio?project=${encodeURIComponent(project.id)}`)
      } catch (err) {
        if (!cancelled) {
          setFileNotice({
            type: 'error',
            message: err instanceof Error ? err.message : t('projects.createError'),
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, projectId, isAuthenticated, navigate, t, profile])

  const persistCodeTemplate = useCallback(
    (template) => {
      if (!projectId) return
      if (isDemoActive() && isDemoProjectId(projectId)) {
        updateDemoProject(projectId, { codeTemplate: template })
        return
      }
      void apiFetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ codeTemplate: template }),
      }).catch(() => {})
    },
    [projectId],
  )

  const handleToggleCodeTemplate = useCallback(
    (template) => {
      let primary = template
      setSelectedCodeTemplates((prev) => {
        const has = prev.includes(template)
        let next = has ? prev.filter((t) => t !== template) : [...prev, template]
        if (!next.length) next = [template]
        primary = next[0] ?? template
        setCodeTemplate(primary)
        return next
      })
      if (codeTemplateSaveTimerRef.current) {
        clearTimeout(codeTemplateSaveTimerRef.current)
      }
      codeTemplateSaveTimerRef.current = setTimeout(() => {
        codeTemplateSaveTimerRef.current = null
        persistCodeTemplate(primary)
      }, 400)
    },
    [persistCodeTemplate],
  )

  useEffect(() => {
    return () => {
      if (codeTemplateSaveTimerRef.current) clearTimeout(codeTemplateSaveTimerRef.current)
    }
  }, [])

  async function handleRenameProject(name) {
    const prev = projectName
    setProjectName(name)
    if (!projectId) return
    try {
      if (isDemoActive() && isDemoProjectId(projectId)) {
        updateDemoProject(projectId, { name })
      } else {
        const data = await apiFetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          body: JSON.stringify({ name }),
        })
        const project = normalizeProject(data.project ?? data)
        if (project?.name) setProjectName(project.name)
      }
    } catch {
      setProjectName(prev)
    }
  }

  const hasPaidPlan = hasPaidSubscription(profile?.plan)
  const subscriptionTitle = t('ed.subscriptionRequired')
  const chromeActionsReady = hasWorkspaceFiles
  // Solo ocultar el preview mientras hay stream o autofix activo (no por error pasivo).
  const previewHold = aiStreamActive || compileFixBusy
  const toolbarSaving = fileSaving
  const toolbarCanSave = canSaveFiles

  function handleToolbarSave() {
    void saveWorkspaceFiles()
  }

  async function handleDownloadProject() {
    if (!projectId || !hasPaidPlan || downloadBusy) return
    setDownloadBusy(true)
    try {
      if (activePath && code !== (buffers[activePath]?.content ?? '')) {
        updateActiveContent(code)
      }
      await flushSaves()
      await persistAllDirty()
      const files = Object.entries(buffers).map(([path, b]) => ({
        path,
        content: b.content,
      }))
      await downloadWorkspaceZip(projectName, files, {
        projectId,
        codeTemplate: codeTemplate ?? selectedCodeTemplates[0] ?? 'html',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'no_files') {
        setFileNotice({ type: 'info', message: t('ed.downloadEmpty') })
      } else {
        setFileNotice({
          type: 'error',
          message: err instanceof Error ? err.message : t('ed.downloadError'),
        })
      }
    } finally {
      setDownloadBusy(false)
    }
  }

  async function handleConfirmDeleteProject() {
    const oldId = projectId
    setDeleteProjectBusy(true)
    try {
      if (oldId) {
        if (isDemoActive() && isDemoProjectId(oldId)) {
          removeDemoProject(oldId)
        } else {
          await apiFetch(`/api/projects/${oldId}`, { method: 'DELETE' })
        }
        cleanupProjectClientState(oldId)
      }

      committedProjectIdRef.current = null
      setDraftProjectId(null)
      setBuffers({})
      buffersRef.current = {}
      replaceCode('')
      lastEditorContentRef.current = ''
      setSpecContent('')
      setSpecDirty(false)
      setSessionCost(0)
      setDebugEntries([])
      setIframeKey((k) => k + 1)
      coverCapturedRef.current = false

      openStudio(router.replace, studioLang)
      setTab('design')
    } catch {
      setFileNotice({ type: 'error', message: t('ed.filesSaveError') })
    } finally {
      setDeleteProjectBusy(false)
      setDeleteProjectOpen(false)
    }
  }

  function handleDeployClick() {
    if (!projectId) return
    if (!hasPaidPlan) {
      navigate('/pricing')
      return
    }
    if (!isDemoActive() && !integrationsStatus?.vercel?.connected) {
      setVercelDeployModal(true)
      return
    }
    setPublishOpen(true)
  }

  const workspacePaths = displayFiles.map((f) => f.path)
  const designWorkspacePaths = useMemo(() => {
    const paths = new Set(workspacePaths.filter(isDesignCanvasFilePath))
    for (const p of designSurfaceFromCanvas.paths) {
      if (isDesignCanvasFilePath(p)) paths.add(p)
    }
    return [...paths]
  }, [workspacePaths, designSurfaceFromCanvas.paths])
  const hasAppCode = hasAppSourceFiles(workspacePaths)
  const hasDesignMockup =
    designWorkspacePaths.length > 0 ||
    Boolean(parseDesignSpec(designJsonContent)?.pages?.length) ||
    workspacePaths.some(
      (p) =>
        p === 'design/site/index.html' ||
        /^design\/pages\/[^/]+\/index\.html$/.test(p) ||
        /^design\/mockups\/[^/]+\.png$/.test(p),
    )
  const useVercelPreviewMode =
    designPhase === 'code' &&
    Boolean(integrationsStatus?.vercel?.connected) &&
    hasAppCode &&
    Boolean(effectiveProjectId)

  const vercelPreview = useVercelPreview(
    effectiveProjectId,
    useVercelPreviewMode,
  )

  const vercelAutofixRanRef = useRef(false)

  useEffect(() => {
    if (!hasAppCode && !filesLoading && !hasDesignMockup && tab === 'preview') setTab('design')
  }, [hasAppCode, filesLoading, hasDesignMockup, tab])

  useEffect(() => {
    if (!filesLoading && effectiveProjectId && !hasAppCode) setTab('design')
  }, [filesLoading, effectiveProjectId, hasAppCode])

  useEffect(() => {
    vercelAutofixRanRef.current = false
  }, [effectiveProjectId, vercelPreview.status])

  useEffect(() => {
    if (
      vercelPreview.status === 'error' &&
      vercelPreview.buildLog &&
      autofixEnabled &&
      !vercelAutofixRanRef.current
    ) {
      vercelAutofixRanRef.current = true
      compileAutofixFromChatRef.current = true
      triggerVercelBuildFix(vercelPreview.buildLog)
    }
  }, [
    vercelPreview.status,
    vercelPreview.buildLog,
    autofixEnabled,
    triggerVercelBuildFix,
  ])

  const handleOpenCreateCodeMenu = useCallback(() => {
    const canConvert = hasDesignMockup && designPhase !== 'code'
    if (designBusy || !canConvert) return
    setCreateCodeMenuOpen(true)
  }, [designBusy, hasDesignMockup, designPhase])

  const handleConfirmCreateCode = useCallback(() => {
    if (codeTemplateSaveTimerRef.current) {
      clearTimeout(codeTemplateSaveTimerRef.current)
      codeTemplateSaveTimerRef.current = null
    }
    persistCodeTemplate(codeTemplate)
    setCreateCodeMenuOpen(false)
    void designPanelRef.current?.convert()
  }, [codeTemplate, persistCodeTemplate])

  if (projectId && projectLoading) {
    return <div className="editor-loading">Cargando proyecto…</div>
  }

  const workspaceName = profile?.fullName
    ? t('ed.workspaceOf').replace('{name}', profile.fullName.split(' ')[0])
    : t('ed.workspace')

  const isMdFile = activePath?.endsWith('.md') ?? false
  const isImageFile = activePath ? isImageWorkspacePath(activePath) : false
  const activeImageSrc =
    isImageFile && activePath ? workspaceImageDataUrl(activePath, code) : ''

  const centerTabs = [
    { id: 'design', label: t('ed.design.tab') },
    { id: 'preview', label: t('ed.preview') },
    { id: 'split', label: t('ed.split') },
    { id: 'code', label: t('ed.code') },
  ]

  function handleViewCode(element) {
    if (element.source?.file && displayFiles.some((f) => f.path === element.source.file)) {
      handleSelectFile(element.source.file)
    }
    setTab('code')
  }

  const previewShared = {
    activePath,
    code,
    language: activeLanguage,
    onCodeChange: handleCodeChange,
    projectId: projectId ?? undefined,
    viewport,
    mode: visualMode,
    previewSrc:
      hasWorkspaceFiles || !projectId || isDemoProjectId(projectId)
        ? undefined
        : `/api/projects/${projectId}/preview`,
    workspaceFiles: hasWorkspaceFiles ? filesForStudioPreview(displayFiles) : undefined,
    onModeChange: setVisualMode,
    iframeKey,
    onVisualChatMessage: (text, meta) => {
      const sourceFile = meta?.sourceFile
      if (sourceFile && buffers[sourceFile]) {
        handleSelectFile(sourceFile)
      }
      setAutoRunChat({ id: Date.now(), text, visualEdit: meta?.visualEdit })
    },
    onSelectionChange: setSelectedElement,
    onViewCode: handleViewCode,
    onBeforePatch: pushSnapshot,
    onAfterPersist: persistWorkspaceNow,
    onRecordVisualEdit: recordVisualEdit,
    getCodeForPath: (path) => buffers[path]?.content ?? '',
    onCodeChangeForPath: (path, content) => {
      if (!aiStreamActiveRef.current && !compileFixActiveRef.current) {
        compileAutofixFromChatRef.current = false
      }
      if (path === activePath) {
        handleCodeChange(content)
      } else {
        updateFileContent(path, content, 0)
      }
    },
    onCompileError: handleCompileError,
    onCompileOk: handleCompileOk,
    onPreviewStubPackages: (pkgs) => {
      if (!pkgs.length) return
      addDebug('info', t('ed.previewStubBanner').replace('{pkgs}', pkgs.join(', ')))
    },
    canvasPins,
    onCanvasPinsChange: setCanvasPins,
    onPreviewRouteFromIframe: handlePreviewRouteFromIframe,
    useVercelPreview: useVercelPreviewMode,
    vercelPreviewStatus: vercelPreview.status,
    vercelPreviewUrl: vercelPreview.url,
    vercelBuildLog: vercelPreview.buildLog,
    vercelErrorMessage: vercelPreview.errorMessage,
    onVercelDeploy: () => void vercelPreview.deploy(),
    onVercelCleanup: () => void vercelPreview.cleanup(),
  }

  const isDesignTab =
    tab === 'design' || (studioCompact && mobilePanel === 'design')

  const previewChromeProps = {
    hideViewTabs: true,
    pageTitle: projectName,
    onPageTitleChange: handleRenameProject,
    viewport,
    onViewportChange: (vp) => {
      setViewport(vp)
      try { localStorage.setItem('studio_viewport', vp) } catch {}
    },
    onRefresh: () => {
      if (isDesignTab) {
        void designPanelRef.current?.refreshIframe()
        return
      }
      resetCompileFixState()
      setIframeKey((k) => k + 1)
      void refreshWorkspace()
    },
    canRefresh: isDesignTab ? Boolean(effectiveProjectId) : chromeActionsReady,
    onUndo: isDesignTab ? handleDesignUndo : handleUndo,
    onRedo: isDesignTab ? handleDesignRedo : handleRedo,
    canUndo: isDesignTab ? designCanUndo : canUndo,
    canRedo: isDesignTab ? designCanRedo : canRedo,
    onCapture: handleCaptureSnapshot,
    canCapture: Boolean(projectId && chromeActionsReady),
    canFocus: chromeActionsReady,
    capturing,
    focusMode,
    onToggleFocusMode: toggleFocusMode,
  }

  const chromeInToolbar = tab === 'preview' || tab === 'split' || tab === 'design'

  const showAssistantChat = chatOpen && !isDesignTab

  const canConvertDesign = hasDesignMockup && designPhase !== 'code'
  const canDeployProduction =
    designPhase === 'code' && hasAppCode && Boolean(projectId)

  const previewSpeechNoticeEl =
    speechDictationEnabled &&
    speechNotice &&
    (tab === 'preview' || tab === 'split' || tab === 'design') ? (
      <SpeechDictationNotice message={speechNotice} variant="preview" />
    ) : null

  const workspaceNoticeEl =
    fileNotice && !isDesignTab ? (
      <div className="editor-workspace-notice-host" aria-live="polite">
        <EditorWorkspaceNotice type={fileNotice.type} message={fileNotice.message} />
      </div>
    ) : null

  const workspaceActionButtons =
    tab === 'design' ? (
      <div className="editor-toolbar-workspace-actions editor-toolbar-workspace-actions--design">
        <CreateCodeMenu
          codeTemplates={selectedCodeTemplates}
          onToggleCodeTemplate={handleToggleCodeTemplate}
          onConfirm={handleConfirmCreateCode}
          open={createCodeMenuOpen}
          onOpenChange={setCreateCodeMenuOpen}
          disabled={designBusy}
          canConvert={canConvertDesign}
        />
        <button
          type="button"
          className="btn btn-sm editor-workspace-action-btn editor-workspace-action-btn--save"
          disabled={!chromeActionsReady || !toolbarCanSave || toolbarSaving}
          onClick={handleToolbarSave}
          title={
            !chromeActionsReady || !toolbarCanSave
              ? t('ed.filesSaveNothing')
              : t('ed.filesSave')
          }
        >
          <Icon.Save />
          <span className="editor-workspace-action-btn__label">
            {toolbarSaving ? t('ed.filesSaving') : t('ed.filesSave')}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-sm editor-workspace-action-btn editor-workspace-action-btn--download"
          disabled={!projectId || !hasPaidPlan || downloadBusy || !hasWorkspaceFiles}
          onClick={() => void handleDownloadProject()}
          title={hasPaidPlan ? t('ed.download') : subscriptionTitle}
        >
          <Icon.Download />
          <span className="editor-workspace-action-btn__label">
            {downloadBusy ? t('ed.downloading') : t('ed.download')}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-sm editor-workspace-action-btn editor-workspace-action-btn--deploy"
          disabled={!projectId || !hasPaidPlan || !canDeployProduction}
          onClick={handleDeployClick}
          title={
            !hasPaidPlan
              ? subscriptionTitle
              : !canDeployProduction
                ? t('ed.design.deployGate')
                : t('ed.publishBtn')
          }
        >
          <Icon.Rocket />
          <span className="editor-workspace-action-btn__label">{t('ed.publishBtn')}</span>
        </button>
      </div>
    ) : (
      <div className="editor-toolbar-workspace-actions">
        <button
          type="button"
          className="btn btn-sm editor-workspace-action-btn editor-workspace-action-btn--save"
          disabled={!chromeActionsReady || !toolbarCanSave || toolbarSaving}
          onClick={handleToolbarSave}
          title={
            !chromeActionsReady || !toolbarCanSave
              ? t('ed.filesSaveNothing')
              : t('ed.filesSave')
          }
        >
          <Icon.Save />
          <span className="editor-workspace-action-btn__label">
            {toolbarSaving ? t('ed.filesSaving') : t('ed.filesSave')}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-sm editor-workspace-action-btn editor-workspace-action-btn--download"
          disabled={!projectId || !hasPaidPlan || downloadBusy || !hasWorkspaceFiles}
          onClick={() => void handleDownloadProject()}
          title={hasPaidPlan ? t('ed.download') : subscriptionTitle}
        >
          <Icon.Download />
          <span className="editor-workspace-action-btn__label">
            {downloadBusy ? t('ed.downloading') : t('ed.download')}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-sm editor-workspace-action-btn editor-workspace-action-btn--deploy"
          disabled={!projectId || !hasPaidPlan || !canDeployProduction}
          onClick={handleDeployClick}
          title={
            !hasPaidPlan
              ? subscriptionTitle
              : !canDeployProduction
                ? t('ed.design.deployGate')
                : t('ed.publishBtn')
          }
        >
          <Icon.Rocket />
          <span className="editor-workspace-action-btn__label">{t('ed.publishBtn')}</span>
        </button>
      </div>
    )

  const previewChrome = (
    <EditorPreviewChrome
      {...previewChromeProps}
      variant={tab === 'design' ? 'design' : 'preview'}
      showPageTitle={false}
      placement={chromeInToolbar ? 'toolbar' : 'canvas'}
      designDeviceSlot={
        tab === 'design' ? (
          <WebStudioDeviceToggle
            value={designDevice}
            onChange={setDesignDevice}
            disabled={designBusy}
          />
        ) : undefined
      }
      actionsSlot={chromeInToolbar ? workspaceActionButtons : undefined}
    />
  )

  const coverCaptureFiles = hasWorkspaceFiles
    ? filesForCodePreview(displayFiles)
    : null

  return (
    <>
      <MonacoCancelGuard />
      {coverCaptureFiles?.length ? (
        <div className="editor-cover-capture-host" aria-hidden>
          <ProjectPreviewFrame
            ref={coverCaptureIframeRef}
            files={coverCaptureFiles}
            viewport="lg"
            quiet
          />
        </div>
      ) : null}
      <div className="editor-page-layout">
      <div
        className={`editor-studio editor-studio--lovable${studioCompact ? ' editor-studio--compact' : ''}${isDesignTab ? ' editor-studio--design-focus editor-studio--web-studio' : ''}`}
        data-mobile-panel={studioCompact ? mobilePanel : undefined}
      >
        {studioCompact ? (
          <EditorMobilePanelTabs active={mobilePanel} onChange={setMobilePanel} />
        ) : null}
        {showAssistantChat ? (
        <aside
          className="editor-chat"
          style={studioCompact ? { width: '100%', flexBasis: '100%' } : { width: chatWidth, flexBasis: chatWidth }}
        >
          <AIChatPanel
            projectId={effectiveProjectId ?? undefined}
            compileFixBusy={compileFixBusy}
            onStopCompileFix={stopCompileFix}
            autofixEnabled={autofixEnabled}
            onAutofixEnabledChange={handleAutofixEnabledChange}
            onSpeechNotice={speechDictationEnabled ? setSpeechNotice : undefined}
            onEnsureProject={(ctx) => {
              const prompt = ctx?.prompt?.trim()
              return ensureProjectCommitted(
                prompt ? { initialSpec: `# Spec\n\n${prompt}\n` } : {},
              )
            }}
            onEnsureChatSession={ensureActiveChatSession}
            chatReady={!chatLoading && Boolean(activeChatSessionId)}
            captureWorkspaceSnapshot={captureWorkspaceSnapshot}
            onRestoreToMessage={handleRestoreToMessage}
            restoreBusy={chatRestoreBusy}
            chatSessionId={activeSession?.id}
            messages={activeMessages}
            onMessagesChange={setActiveMessages}
            chatSessions={chatSessions}
            activeChatSessionId={activeChatSessionId}
            onSelectChatSession={selectChatSession}
            onCloseChatSession={closeChatSession}
            onNewChatSession={createChatSession}
            newChatLabel={newChatLabel}
            onGithubImport={handleGithubImport}
            githubImportEnabled={canUseGithubImport(user, profile)}
            githubImportBusy={githubImportBusy}
            onFigmaImport={effectiveProjectId ? openDesignFigmaImport : undefined}
            figmaImportEnabled={designImportEnabled}
            onCanvaImport={effectiveProjectId ? openDesignCanvaImport : undefined}
            canvaImportEnabled={designImportEnabled}
            onStitchImport={effectiveProjectId ? openDesignStitchImport : undefined}
            stitchImportEnabled={designImportEnabled}
            closeMode="project"
            onRequestDeleteProject={() => setDeleteProjectOpen(true)}
            onCloseChat={() => {
              if (projectId) setDeleteProjectOpen(true)
              else navigate('/projects')
            }}
            projectName={projectName}
            onProjectNameChange={handleRenameProject}
            hasWorkspaceFiles={hasWorkspaceFiles}
            workspaceName={workspaceName}
            activePath={activePath}
            activeCode={code}
            workspaceFiles={workspaceFilesForAi()}
            getWorkspaceFiles={workspaceFilesForAi}
            getActiveCode={() => codeRef.current}
            getActivePath={() => activePath}
            getChatHistory={() => activeMessages}
            autoRunPrompt={autoRunChat}
            canvasPins={canvasPins}
            onCanvasPinsChange={setCanvasPins}
            onComposerContextClear={() => {
              setSelectedElement(null)
              designPanelRef.current?.clearComposerMarkers?.()
            }}
            selectedElementLabel={
              selectedElement ? `${selectedElement.tagName} · ${selectedElement.skId}` : null
            }
            onCreditsUsed={() => {
              refreshUser()
              updateActiveContent(codeRef.current)
            }}
            designModeActive={isDesignTab}
            onDesignUpdated={async () => {
              setDesignBusy(false)
              await refreshWorkspace()
              designPanelRef.current?.refreshIframe()
            }}
            onStreamCost={(n) => setSessionCost((s) => s + n)}
            onStreamStart={() => {
              if (isDesignTab) setDesignBusy(true)
              streamFilesAppliedRef.current = false
              streamAppliedPathsRef.current = []
              lastStreamAccRef.current = ''
              streamPersistedPathsRef.current = new Set()
              streamPendingFilesRef.current.clear()
              streamFlushScheduledRef.current = false
              streamApplyChainRef.current = Promise.resolve()
              pathsBeforeStreamRef.current = new Set(Object.keys(buffersRef.current))
              missingImportsFixRanRef.current = false
              undeliveredFilesFixRanRef.current = false
              if (autofixEnabledRef.current) compileAutofixFromChatRef.current = true
              aiStreamActiveRef.current = true
              setAiStreamActive(true)
              resetCompileFixState()
              pushSnapshot()
              startDebugRun()
              addDebug('ai', `Generating with model ${modelChoice}…`)
            }}
            onStreamEnd={() => {
              if (isDesignTab) setDesignBusy(false)
              if (autofixEnabledRef.current) compileAutofixFromChatRef.current = true
              aiStreamActiveRef.current = false
              setAiStreamActive(false)
            }}
            onStreamError={(err) => {
              addDebug('error', `API error: ${err}`)
              setFileNotice({ type: 'error', message: err })
            }}
            onStreamFileOps={handleStreamFileOps}
            onStreamDone={async (acc) => {
              await handleStreamDone(acc)
              if (!acc?.length) {
                addDebug('error', 'Empty response — possible model error or quota exceeded')
              }
            }}
            onStreamFiles={(files) => {
              if (autofixEnabledRef.current) compileAutofixFromChatRef.current = true
              return enqueueStreamFileApply(files)
            }}
            onStreamImages={(images) => void handleStreamImages(images)}
            onOpenFileFromChat={handleSelectFile}
            getCurrentFileContent={(path) => buffers[path]?.content ?? ''}
            onApplyReviewFile={(path, content) => {
              updateFileContent(path, content, 0)
              if (path === activePath) handleCodeChange(content)
            }}
            modelChoice={modelChoice}
            modelOptions={modelOptions}
            onModelChoiceChange={setModelChoice}
            categoryChoices={categoryChoices}
            categoryModels={categoryModels}
            selectionMode={selectionMode}
            onCategoryModelChange={setCategoryModelChoice}
            framework={framework}
            targetPlatforms={targetPlatforms}
            geminiEnabled={geminiEnabled}
            availableCredits={profile ? credits : null}
            noCreditsMessage={t('ed.noCredits')}
          />
          <div className="editor-chat-footer">
            <TokenCostMeter
              sessionCost={sessionCost}
              credits={credits}
              modelLabel={modelSelectedLabel}
            />
          </div>
        </aside>
        ) : null}

        {!studioCompact && !isDesignTab ? (
        <div className="editor-panel-edge-stack editor-panel-edge-stack--chat">
          <EditorPanelCollapseHandle
            side="chat"
            open={chatOpen}
            onToggle={() => {
              toggleChatOpen()
              persist()
            }}
            title={chatOpen ? t('ed.chatHide') : t('ed.chatShow')}
            aria-label={chatOpen ? t('ed.chatHide') : t('ed.chatShow')}
          />
          {showAssistantChat ? (
            <EditorResizeHandle
              side="left"
              onResize={setChatWidth}
              onResizeEnd={persist}
              aria-label={t('ed.resizeAssistant')}
            />
          ) : null}
        </div>
        ) : null}

        <section className="editor-workspace">
          <div
            className={`editor-toolbar${chromeInToolbar ? ' editor-toolbar--merged' : ''}`}
          >
            {isDesignTab ? (
              <div className="editor-studio-toolbar-lead">
                <div className="editor-studio-toolbar-title">
                  {projectName ? (
                    <EditableProjectName
                      value={projectName}
                      onSave={handleRenameProject}
                      className="editor-studio-toolbar-title__project"
                      as="h2"
                    />
                  ) : null}
                </div>
                <DesignPhaseStepper
                  className="design-phase-stepper--toolbar"
                  designPhase={designPhase}
                  designApprovedAt={designApprovedAt}
                  hasMockup={hasDesignMockup}
                  hasAppCode={hasAppCode}
                  isPublished={Boolean(deployedUrl)}
                />
              </div>
            ) : (
              <div className="editor-tabs" role="tablist">
                {centerTabs.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === tb.id}
                    className={`editor-tab${tab === tb.id ? ' is-active' : ''}`}
                    onClick={() => { void flushSaves(); setTab(tb.id) }}
                  >
                    {tb.label}
                    {tb.id === 'code' && isMdFile && (
                      <span
                        className={`editor-tab-md-toggle${mdPreview ? ' is-active' : ''}`}
                        role="button"
                        aria-label={mdPreview ? t('ed.specViewSource') : t('ed.specViewPreview')}
                        title={mdPreview ? t('ed.specViewSource') : t('ed.specViewPreview')}
                        onClick={(e) => { e.stopPropagation(); setTab('code'); setMdPreview((v) => !v) }}
                      >
                        {mdPreview ? (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="2.5" />
                          </svg>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {chromeInToolbar ? (
              <div className="editor-toolbar-trailing">{previewChrome}</div>
            ) : (
            <div className="editor-toolbar-actions">
              {tab === 'code' ? (
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm editor-focus-toggle${focusMode ? ' is-active' : ''}${chromeActionsReady ? '' : ' is-disabled'}`}
                  onClick={toggleFocusMode}
                  disabled={!chromeActionsReady}
                  title={focusMode ? t('ed.focusMode.off') : t('ed.focusMode.on')}
                  aria-label={focusMode ? t('ed.focusMode.off') : t('ed.focusMode.on')}
                  aria-pressed={focusMode}
                >
                  {focusMode ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M9 3H5a2 2 0 0 0-2 2v4M21 15v4a2 2 0 0 1-2 2h-4M15 3h6v6M3 15v6h6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ) : null}
              {workspaceActionButtons}
            </div>
            )}
          </div>

          {(tab === 'split' || tab === 'code') && hasWorkspaceFiles ? (
            <EditorFileTabs
              tabs={openTabs}
              activePath={activePath}
              dirtyPaths={dirtyPaths}
              onSelect={handleSelectFile}
              onClose={closeTab}
            />
          ) : null}

          <div className="editor-workspace-body">
            {workspaceNoticeEl}
            {tab === 'design' ? (
              <div className="editor-preview-frame editor-preview-frame--design">
                {effectiveProjectId ? (
                <>
                <DesignWorkspace
                  key={effectiveProjectId}
                  ref={designPanelRef}
                  projectId={effectiveProjectId}
                  onReady={handleDesignWorkspaceReady}
                  projectName={projectName}
                  framework={framework}
                  codeTemplates={selectedCodeTemplates}
                  codeTemplate={codeTemplate}
                  designPaths={designWorkspacePaths}
                  designJson={designJsonContent}
                  designMd={
                    displayFiles.find((f) => f.path === DESIGN_SPEC_MD)?.content ??
                    buffers[DESIGN_SPEC_MD]?.content ??
                    null
                  }
                  hasMockup={hasDesignMockup}
                  designApprovedAt={designApprovedAt}
                  busy={designBusy}
                  onBusyChange={setDesignBusy}
                  onRefreshFiles={handleDesignRefreshFiles}
                  onApprove={(at) => setDesignApprovedAt(at)}
                  onConvertDone={() => {
                    setDesignPhase('code')
                  }}
                  onRequestConvert={handleOpenCreateCodeMenu}
                  modelChoice={codeModelChoice}
                  modelOptions={modelOptions}
                  onModelChoiceChange={setModelChoice}
                  categoryChoices={categoryChoices}
                  categoryModels={categoryModels}
                  selectionMode={selectionMode}
                  onCategoryModelChange={setCategoryModelChoice}
                  deviceBreakpoint={designDevice}
                  getWorkspaceFiles={workspaceFilesForAi}
                  onHistoryChange={handleDesignHistoryChange}
                  onDeviceChange={setDesignDevice}
                  onOpenWorkspaceFile={handleSelectFile}
                  onViewCode={handleOpenCreateCodeMenu}
                  onDownload={() => void handleDownloadProject()}
                  onSpeechNotice={speechDictationEnabled ? setSpeechNotice : undefined}
                  onGithubImport={handleGithubImport}
                  githubImportEnabled={canUseGithubImport(user, profile)}
                  onDesignSurfaceLoaded={(surface) => {
                    setDesignSurfaceFromCanvas(surface)
                    if (surface.paths.length > 0 || surface.designJson) {
                      setDesignPhase('design')
                      if (effectiveProjectId && isDemoProjectId(effectiveProjectId)) {
                        updateDemoProject(effectiveProjectId, { designPhase: 'design' })
                      }
                    }
                  }}
                />
                </>
                ) : (
                  <div className="web-studio-workspace design-workspace design-workspace--bootstrapping web-studio-workspace--activity web-studio-workspace--side-open">
                    <div className="web-studio-canvas design-canvas-main">
                      <WebStudioActivityPanel phases={[]} building={designBootstrapBusy} />
                      <div className="web-studio-canvas-area design-canvas-area" />
                      <div className="web-studio-prompt-host">
                        <WebStudioPromptBar
                          disabled={designBootstrapBusy}
                          generating={designBootstrapBusy}
                          projectId={effectiveProjectId ?? undefined}
                          modelChoice={codeModelChoice}
                          modelOptions={modelOptions}
                          onModelChoiceChange={setModelChoice}
                          categoryChoices={categoryChoices}
                          categoryModels={categoryModels}
                          selectionMode={selectionMode}
                          onCategoryModelChange={setCategoryModelChoice}
                          onSubmit={handleDesignBootstrapSubmit}
                          onGithubImport={handleGithubImport}
                          githubImportEnabled={canUseGithubImport(user, profile)}
                          onFigmaImport={effectiveProjectId ? openDesignFigmaImport : undefined}
                          figmaImportEnabled={designImportEnabled}
                          onCanvaImport={effectiveProjectId ? openDesignCanvaImport : undefined}
                          canvaImportEnabled={designImportEnabled}
                          placeholder={t('ed.design.promptPlaceholder')}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {tab === 'preview' && (
              <div className="editor-preview-frame">
                {previewSpeechNoticeEl}
                {!chromeInToolbar ? previewChrome : null}
                {previewHold && hasWorkspaceFiles ? (
                  <>
                    <div className="editor-sandbox-loading editor-preview-hold-message" role="status">
                      {previewFixGaveUp ? t('ed.previewWaitingFailed') : t('ed.previewCompiling')}
                    </div>
                    <div className="editor-preview-panel--hold" aria-hidden>
                      <VisualPreviewPanel key={iframeKey} {...previewShared} />
                    </div>
                  </>
                ) : (
                  <VisualPreviewPanel key={iframeKey} {...previewShared} />
                )}
              </div>
            )}
            {tab === 'split' && (
              <div className="editor-preview-frame">
                {previewSpeechNoticeEl}
                {!chromeInToolbar ? previewChrome : null}
                {previewHold && hasWorkspaceFiles ? (
                  <>
                    <div className="editor-sandbox-loading editor-preview-hold-message" role="status">
                      {previewFixGaveUp ? t('ed.previewWaitingFailed') : t('ed.previewCompiling')}
                    </div>
                    <div className="editor-preview-panel--hold" aria-hidden>
                      <EditorSplitView {...previewShared} />
                    </div>
                  </>
                ) : (
                  <EditorSplitView {...previewShared} />
                )}
              </div>
            )}
            {tab === 'code' && (
              <div className="editor-code-workspace">
                {hasWorkspaceFiles ? (
                  <>
                    <EditorCodePaneHead
                      fileName={activePath ? activePath.split('/').pop() ?? '' : ''}
                    />
                    <div className="editor-code-pane">
                      {isMdFile && mdPreview ? (
                        <div className="editor-spec-preview chat-markdown no-scrollbar" style={{ padding: '1.5rem 2rem', overflowY: 'auto', height: '100%' }}>
                          {code.trim() ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{code}</ReactMarkdown>
                          ) : (
                            <p className="editor-spec-preview-empty">{t('ed.specPlaceholder')}</p>
                          )}
                        </div>
                      ) : isImageFile ? (
                        <div className="editor-image-preview">
                          {activeImageSrc ? (
                            <img
                              src={activeImageSrc}
                              alt={activePath.split('/').pop() ?? ''}
                              draggable={false}
                            />
                          ) : (
                            <p className="editor-rail-empty">{t('ed.imageEmpty')}</p>
                          )}
                        </div>
                      ) : (
                        <CodeEditor
                          path={activePath}
                          value={code}
                          onChange={handleCodeChange}
                          language={activeLanguage}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <EditorWorkspaceEmpty variant="code" />
                )}
              </div>
            )}
          </div>
        </section>

        {!studioCompact && !isDesignTab ? (
        <div className="editor-panel-edge-stack editor-panel-edge-stack--files">
          {filesOpen ? (
            <EditorResizeHandle
              side="right"
              onResize={setRailWidth}
              onResizeEnd={persist}
              aria-label={t('ed.resizeFiles')}
            />
          ) : null}
          <EditorPanelCollapseHandle
            side="files"
            open={filesOpen}
            onToggle={() => {
              toggleFilesOpen()
              persist()
            }}
            title={filesOpen ? t('ed.filesHide') : t('ed.filesShow')}
            aria-label={filesOpen ? t('ed.filesHide') : t('ed.filesShow')}
          />
        </div>
        ) : null}

        {filesOpen && !isDesignTab ? (
        <aside
          className="editor-rail"
          style={studioCompact ? { width: '100%', flexBasis: '100%' } : { width: railWidth, flexBasis: railWidth }}
        >
          <div className="editor-rail-head">
            <div className="editor-rail-head__row">
              <EditableProjectName
                value={projectName}
                onSave={handleRenameProject}
                as="h1"
              />
            </div>
            <div className="editor-project-meta">
              <StudioSaveStatus
                mode={studioMode}
                fileSaving={fileSaving}
                hasUnsavedEdits={hasUnsavedEdits}
                projectId={projectId}
              />
              {activePath ? (
                <span className="editor-project-meta__file mono" title={activePath}>
                  {activePath.split('/').pop()}
                </span>
              ) : null}
            </div>
          </div>
          <div className="editor-rail-files no-scrollbar">
            <span className="editor-rail-label">{t('ed.files')}</span>
            {filesLoading ? (
              <p className="editor-rail-empty">{t('ed.loading')}</p>
            ) : (
              <FileTree
                files={displayFiles}
                activePath={activePath}
                dirtyPaths={dirtyPaths}
                emptyLabel={t('ed.noFiles')}
                onSelect={handleSelectFile}
                onDelete={(path) => {
                  if (isSpecWorkspacePath(path)) return
                  void deleteFileByPath(path)
                }}
                onRename={(oldPath, newPath) => {
                  if (isSpecWorkspacePath(oldPath)) return
                  void renameFile(oldPath, newPath)
                }}
                onCreateFile={(path, content = '') => void createFile(path, content)}
              />
            )}
          </div>
        </aside>
        ) : null}
      </div>
      {!isDesignTab ? (
        <DebugPanel entries={debugEntries} onClear={() => clearDebugRef.current()} />
      ) : null}
      </div>
      {projectId && (
        <GithubImportModal
          projectId={projectId}
          open={githubImportOpen}
          onClose={() => setGithubImportOpen(false)}
          onImported={() => void refreshWorkspace()}
        />
      )}
      {vercelDeployModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setVercelDeployModal(false)}>
          <div
            className="modal-panel"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">{t('ed.deployVercel.title')}</h2>
            <p className="modal-body">{t('ed.deployVercel.body')}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setVercelDeployModal(false)}>
                {t('ed.deployVercel.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setVercelDeployModal(false)
                  const returnTo = '/studio' + (projectId ? `?project=${projectId}` : '')
                  window.location.href = `/api/integrations/vercel/connect?returnTo=${encodeURIComponent(returnTo)}`
                }}
              >
                {t('ed.deployVercel.connect')}
              </button>
            </div>
          </div>
        </div>
      )}
      <PublishPanel
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        projectId={projectId}
        projectName={projectName}
        deployedUrl={deployedUrl}
        mobileReadiness={mobileReadiness}
        onDeployed={(url) => {
          setDeployedUrl(url)
          setIframeKey((k) => k + 1)
        }}
        onReadinessChange={setMobileReadiness}
        onApplyWithAi={(prompt) => setAutoRunChat({ id: Date.now(), text: prompt })}
        onPublishGithub={handlePublishGithub}
        publishGithubLoading={publishLoading}
        integrationsVercelConnected={integrationsStatus?.vercel?.connected}
        onConnectVercel={() => setVercelDeployModal(true)}
        onTriggerAutofix={triggerVercelBuildFix}
        codeTemplate={codeTemplate}
      />
      <ProjectDeleteConfirmDialog
        open={deleteProjectOpen}
        count={1}
        busy={deleteProjectBusy}
        onCancel={() => setDeleteProjectOpen(false)}
        onConfirm={() => void handleConfirmDeleteProject()}
      />
    </>
  )
}

function EditorPage() {
  return (
    <EditorShell>
      <EditorPageInner />
    </EditorShell>
  )
}

export { EditorPage }
