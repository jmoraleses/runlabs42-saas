'use client'

import React, { useRef } from 'react'
import { useApp } from '@/components/app/shell'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { EditorCodePaneHead } from '@/components/editor/EditorCodePaneHead'
import { EditorResizeHandle } from '@/components/editor/EditorResizeHandle'
import { VisualPreviewPanel } from '@/components/editor/VisualPreviewPanel'
import { useEditorSplitRatio } from '@/hooks/useEditorSplitRatio'
import type { CanvasPin } from '@/lib/visual-edit/canvasPins'
import type { ElementDescriptor, VisualEditMode } from '@/lib/visual-edit/protocol'

type EditorSplitViewProps = {
  activePath: string
  code: string
  language?: string
  onCodeChange: (code: string) => void
  projectId?: string
  onVisualChatMessage?: (text: string, meta?: { sourceFile?: string | null }) => void
  fileLabel?: string
  viewport?: 'sm' | 'md' | 'lg'
  mode?: VisualEditMode
  onModeChange?: (mode: VisualEditMode) => void
  iframeKey?: number
  onSelectionChange?: (element: ElementDescriptor | null) => void
  onViewCode?: (element: ElementDescriptor) => void
  onBeforePatch?: () => void
  onAfterPersist?: () => void | Promise<void>
  onRecordVisualEdit?: (summary: string) => void
  getCodeForPath?: (path: string) => string
  onCodeChangeForPath?: (path: string, content: string) => void
  previewSrc?: string
  workspaceFiles?: Array<{ path: string; content: string }>
  sandboxRevision?: string
  onCompileError?: (error: string) => void
  onCompileOk?: () => void
  onPreviewStubPackages?: (packages: string[]) => void
  canvasPins?: CanvasPin[]
  onCanvasPinsChange?: (pins: CanvasPin[]) => void
  onPreviewRouteFromIframe?: (route: string) => void
}

export function EditorSplitView({
  activePath,
  code,
  language = 'typescript',
  onCodeChange,
  projectId,
  onVisualChatMessage,
  fileLabel,
  viewport,
  mode,
  onModeChange,
  iframeKey,
  onSelectionChange,
  onViewCode,
  onBeforePatch,
  onAfterPersist,
  onRecordVisualEdit,
  getCodeForPath,
  onCodeChangeForPath,
  previewSrc,
  workspaceFiles,
  sandboxRevision: _sandboxRevision,
  onCompileError,
  onCompileOk,
  onPreviewStubPackages,
  canvasPins,
  onCanvasPinsChange,
  onPreviewRouteFromIframe,
}: EditorSplitViewProps) {
  const { t } = useApp() as { t: (key: string) => string }
  const splitRef = useRef<HTMLDivElement>(null)
  const { ratio, adjustRatio, persist } = useEditorSplitRatio()

  function handleResize(delta: number) {
    const w = splitRef.current?.getBoundingClientRect().width ?? 0
    adjustRatio(delta, w)
  }

  const displayName = fileLabel ?? activePath.split('/').pop() ?? activePath

  return (
    <div ref={splitRef} className="editor-workspace-split">
      <div className="editor-split-pane editor-split-pane--preview" style={{ width: `${ratio * 100}%` }}>
        <VisualPreviewPanel
          activePath={activePath}
          code={code}
          onCodeChange={onCodeChange}
          projectId={projectId}
          onVisualChatMessage={onVisualChatMessage}
          viewport={viewport}
          mode={mode}
          onModeChange={onModeChange}
          iframeKey={iframeKey}
          onSelectionChange={onSelectionChange}
          onViewCode={onViewCode}
          onBeforePatch={onBeforePatch}
          onAfterPersist={onAfterPersist}
          onRecordVisualEdit={onRecordVisualEdit}
          getCodeForPath={getCodeForPath}
          onCodeChangeForPath={onCodeChangeForPath}
          previewSrc={previewSrc}
          workspaceFiles={workspaceFiles}
          onCompileError={onCompileError}
          onCompileOk={onCompileOk}
          onPreviewStubPackages={onPreviewStubPackages}
          canvasPins={canvasPins}
          onCanvasPinsChange={onCanvasPinsChange}
          onPreviewRouteFromIframe={onPreviewRouteFromIframe}
        />
      </div>
      <EditorResizeHandle
        side="left"
        onResize={handleResize}
        onResizeEnd={persist}
        aria-label={t('ed.resizePreviewCode')}
      />
      <div className="editor-split-pane editor-split-pane--code">
        <EditorCodePaneHead fileName={displayName} />
        <div className="editor-code-pane">
          <CodeEditor path={activePath} value={code} onChange={onCodeChange} language={language} />
        </div>
      </div>
    </div>
  )
}
