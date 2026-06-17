'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { useVisualEdit } from '@/hooks/useVisualEdit'
import { useIframeOverlayRect } from '@/hooks/useIframeOverlayRect'
import { usePreviewRouteSync } from '@/hooks/usePreviewRouteSync'
import { useElementEditor } from '@/hooks/useElementEditor'
import { CanvasPinCommentDock } from './CanvasPinCommentDock'
import { CanvasPinMarkers } from './CanvasPinMarkers'
import { ElementTextEditOverlay } from './ElementTextEditOverlay'
import { ElementLinkPopover } from './ElementLinkPopover'
import { EditorWorkspaceEmpty } from '@/components/editor/EditorWorkspaceEmpty'
import { ProjectPreviewFrame } from './ProjectPreviewFrame'
import { VercelPreviewPanel } from './VercelPreviewPanel'
import type { VercelPreviewStatus } from '@/hooks/useVercelPreview'
import { sourceFileForElement } from '@/lib/visual-edit/buildVisualEditPrompt'
import {
  buildVisualEditMessage,
  type VisualEditMessageMeta,
} from '@/lib/visual-edit/visualEditMessage'
import { CanvasPinAreaCapture } from './CanvasPinAreaCapture'
import { formatPinAreaLabel, pinAreaCenter, type PinAreaPercent } from '@/lib/visual-edit/canvasPinArea'
import { createCanvasPinId, type CanvasPin } from '@/lib/visual-edit/canvasPins'
import { VisualCanvasToolbar, type VisualCanvasEngagedTool } from '@/components/editor/VisualCanvasToolbar'
import type { ElementDescriptor, VisualEditMode } from '@/lib/visual-edit/protocol'

type VisualPreviewPanelProps = {
  activePath: string
  code: string
  onCodeChange: (code: string) => void
  onVisualChatMessage?: (
    text: string,
    meta?: { sourceFile?: string | null; visualEdit?: VisualEditMessageMeta },
  ) => void
  onSelectionChange?: (element: ElementDescriptor | null) => void
  onViewCode?: (element: ElementDescriptor) => void
  onBeforePatch?: () => void
  onAfterPersist?: () => void | Promise<void>
  onRecordVisualEdit?: (summary: string) => void
  getCodeForPath?: (path: string) => string
  onCodeChangeForPath?: (path: string, content: string) => void
  projectId?: string
  viewport?: 'sm' | 'md' | 'lg'
  mode?: VisualEditMode
  onModeChange?: (mode: VisualEditMode) => void
  iframeKey?: number
  previewSrc?: string
  workspaceFiles?: Array<{ path: string; content: string }>
  onCompileError?: (error: string) => void
  onCompileOk?: () => void
  onPreviewStubPackages?: (packages: string[]) => void
  canvasPins?: CanvasPin[]
  onCanvasPinsChange?: (pins: CanvasPin[]) => void
  onPreviewRouteFromIframe?: (route: string) => void
  useVercelPreview?: boolean
  vercelPreviewStatus?: VercelPreviewStatus
  vercelPreviewUrl?: string | null
  vercelBuildLog?: string | null
  vercelErrorMessage?: string | null
  onVercelDeploy?: () => void
  onVercelCleanup?: () => void
}

type PinDraft = PinAreaPercent & {
  element: ElementDescriptor | null
}

export function VisualPreviewPanel({
  activePath,
  code,
  onCodeChange,
  onVisualChatMessage,
  onSelectionChange,
  onViewCode,
  onBeforePatch,
  onAfterPersist,
  onRecordVisualEdit,
  getCodeForPath,
  onCodeChangeForPath,
  projectId: _projectId,
  viewport = 'lg',
  mode: modeProp,
  onModeChange,
  iframeKey = 0,
  previewSrc,
  workspaceFiles,
  onCompileError,
  onCompileOk,
  onPreviewStubPackages,
  canvasPins = [],
  onCanvasPinsChange,
  onPreviewRouteFromIframe,
  useVercelPreview = false,
  vercelPreviewStatus = 'idle',
  vercelPreviewUrl = null,
  vercelBuildLog = null,
  vercelErrorMessage = null,
  onVercelDeploy,
  onVercelCleanup,
}: VisualPreviewPanelProps) {
  const [localMode, setLocalMode] = useState<VisualEditMode>('off')
  const setEditMode = onModeChange ?? setLocalMode
  const mode = modeProp ?? localMode
  const { t } = useApp() as { t: (key: string) => string }
  const canvasRef = useRef<HTMLDivElement>(null)
  const [engagedTool, setEngagedTool] = useState<VisualCanvasEngagedTool>(null)
  const [pinDraftOpen, setPinDraftOpen] = useState(false)
  const [pinDraft, setPinDraft] = useState<PinDraft | null>(null)
  const lastAiOpenSkIdRef = useRef<string | null>(null)

  const {
    iframeRef,
    hovered,
    selected,
    handleIframeLoad,
    syncBridgeMode,
    applyPatch,
    clearSelection,
    cancelPlacement,
    pickAtPoint,
  } = useVisualEdit(mode, setEditMode)

  const { onPreviewIframeLoad } = usePreviewRouteSync({
    activePath,
    workspaceFiles,
    iframeRef,
    previewSrc,
    iframeKey,
    onPreviewRouteFromIframe,
  })

  const editor = useElementEditor({
    code,
    activePath,
    onCodeChange,
    getCodeForPath,
    onCodeChangeForPath,
    onViewCode,
    onBeforePatch,
    onAfterPersist,
    onRecordEdit: onRecordVisualEdit,
    applyPatch,
    clearSelection,
  })

  const overlayPos = useIframeOverlayRect(canvasRef, iframeRef, selected?.rect)
  const hoverTarget =
    mode === 'select' && hovered && (!selected || hovered.skId !== selected.skId) ? hovered : null
  const hoverOverlayPos = useIframeOverlayRect(canvasRef, iframeRef, hoverTarget?.rect)

  const blockAiOverlay = pinDraftOpen || engagedTool === 'pin'

  useEffect(() => {
    if (canvasPins.length > 0) return
    setPinDraftOpen(false)
    setPinDraft(null)
    if (engagedTool === 'pin') {
      setEngagedTool(null)
      cancelPlacement()
    }
  }, [canvasPins.length, engagedTool, cancelPlacement])

  useEffect(() => {
    onSelectionChange?.(selected)
    if (!selected) {
      if (!pinDraftOpen) editor.closeInlineEdit()
      lastAiOpenSkIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset UI al deseleccionar
  }, [selected, onSelectionChange, pinDraftOpen])

  useEffect(() => {
    if (!selected || blockAiOverlay || editor.linkEditOpen || editor.textEditOpen) return
    if (selected.skId === lastAiOpenSkIdRef.current) return
    lastAiOpenSkIdRef.current = selected.skId
    editor.openAiEdit(selected)
  }, [selected, blockAiOverlay, editor.linkEditOpen, editor.textEditOpen, editor])

  const handleVisualPrompt = useCallback(
    (userPrompt: string, selection: ElementDescriptor | null) => {
      if (!selection) {
        onVisualChatMessage?.(userPrompt)
        return
      }
      const { content, visualEdit } = buildVisualEditMessage(selection, userPrompt)
      onVisualChatMessage?.(content, {
        sourceFile: sourceFileForElement(selection),
        visualEdit,
      })
    },
    [onVisualChatMessage],
  )

  function deactivateTools() {
    setEngagedTool(null)
    cancelPlacement()
    setPinDraftOpen(false)
    setPinDraft(null)
    setEditMode('off')
    syncBridgeMode('off')
  }

  function activateSelect() {
    setEngagedTool('select')
    cancelPlacement()
    setPinDraftOpen(false)
    setPinDraft(null)
    editor.closeInlineEdit()
    setEditMode('select')
    syncBridgeMode('select')
  }

  function activatePinMode() {
    setEngagedTool('pin')
    setPinDraftOpen(false)
    setPinDraft(null)
    editor.closeInlineEdit()
    cancelPlacement()
    clearSelection()
    setEditMode('select')
    syncBridgeMode('select')
  }

  const handlePinAreaSelected = useCallback(
    async (area: PinAreaPercent) => {
      if (pinDraftOpen) return
      const canvas = canvasRef.current
      let element: ElementDescriptor | null = null
      const iframe = iframeRef.current
      if (canvas && iframe) {
        const canvasRect = canvas.getBoundingClientRect()
        const iframeRect = iframe.getBoundingClientRect()
        const center = pinAreaCenter(area)
        const clientX = canvasRect.left + (center.xPercent / 100) * canvasRect.width
        const clientY = canvasRect.top + (center.yPercent / 100) * canvasRect.height
        const ix = clientX - iframeRect.left
        const iy = clientY - iframeRect.top
        if (ix >= 0 && iy >= 0 && ix <= iframeRect.width && iy <= iframeRect.height) {
          element = await pickAtPoint(ix, iy)
        }
      }

      setPinDraft({ ...area, element })
      setPinDraftOpen(true)
      editor.closeInlineEdit()
    },
    [pinDraftOpen, pickAtPoint, editor],
  )

  function handlePinCommit(description: string) {
    if (!pinDraft) return
    const pin: CanvasPin = {
      id: createCanvasPinId(),
      xPercent: pinDraft.xPercent,
      yPercent: pinDraft.yPercent,
      widthPercent: pinDraft.widthPercent,
      heightPercent: pinDraft.heightPercent,
      description: description.trim(),
      elementSkId: pinDraft.element?.skId,
      elementTag: pinDraft.element?.tagName,
    }
    onCanvasPinsChange?.([...canvasPins, pin])
    setPinDraftOpen(false)
    setPinDraft(null)
  }

  function handlePinCancelDraft() {
    setPinDraftOpen(false)
    setPinDraft(null)
  }

  function handleRemovePin(id: string) {
    onCanvasPinsChange?.(canvasPins.filter((p) => p.id !== id))
  }

  function handlePinDockDone() {
    setPinDraftOpen(false)
    setPinDraft(null)
    deactivateTools()
  }

  const handleToolbarItalic = useCallback(() => {
    if (selected) editor.toggleItalic(selected)
  }, [selected, editor])

  const handleToolbarLink = useCallback(() => {
    if (selected) editor.openLinkEdit(selected)
  }, [selected, editor])

  const handleToolbarAlign = useCallback(() => {
    if (selected) editor.cycleAlign(selected)
  }, [selected, editor])

  const handleToolbarDelete = useCallback(() => {
    if (selected) editor.deleteElement(selected)
  }, [selected, editor])

  const handleToolbarClose = useCallback(() => {
    editor.closeInlineEdit()
    setPinDraftOpen(false)
    setPinDraft(null)
    clearSelection()
    deactivateTools()
  }, [editor, clearSelection])

  const handleSelectTool = useCallback(() => {
    if (engagedTool === 'select') deactivateTools()
    else activateSelect()
  }, [engagedTool])

  const handlePinTool = useCallback(() => {
    if (engagedTool === 'pin') deactivateTools()
    else activatePinMode()
  }, [engagedTool])

  const handleEditText = useCallback(() => {
    if (selected) {
      setPinDraftOpen(false)
      setPinDraft(null)
      editor.setAiEditOpen(false)
      editor.editText(selected)
    }
  }, [selected, editor])

  const isItalic = selected?.styles?.fontStyle === 'italic'
  const useSandbox = Boolean(workspaceFiles?.length) && !useVercelPreview
  const pinLabel = pinDraft
    ? [
        formatPinAreaLabel(pinDraft),
        pinDraft.element ? `<${pinDraft.element.tagName}> · ${pinDraft.element.skId}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <div className="editor-preview-root editor-preview-root--canvas">
      <div
        ref={canvasRef}
        className={`editor-preview-canvas${engagedTool === 'pin' ? ' editor-preview-canvas--pin-mode' : ''}`}
      >
        {engagedTool === 'pin' ? (
          <div className="editor-pin-mode-banner" role="status">
            {t('ed.pinModeActive')}
          </div>
        ) : null}
        <VisualCanvasToolbar
          boundsRef={canvasRef}
          engagedTool={engagedTool}
          hasSelection={Boolean(selected)}
          isItalic={isItalic}
          fontSizeOpen={editor.styleMenuOpen}
          currentFontSize={selected?.styles?.fontSize}
          onSelectTool={handleSelectTool}
          onPinTool={handlePinTool}
          onEditText={handleEditText}
          onFontSizeToggle={() => {
            if (selected) {
              editor.setAiEditOpen(false)
              editor.setStyleMenuOpen(!editor.styleMenuOpen)
            }
          }}
          onFontSizeSelect={(size) => {
            if (selected) editor.setFontSize(selected, size)
          }}
          onFontSizeClose={() => editor.setStyleMenuOpen(false)}
          onItalic={handleToolbarItalic}
          onLink={handleToolbarLink}
          onAlign={handleToolbarAlign}
          onDelete={handleToolbarDelete}
          onClose={handleToolbarClose}
        />
        <div className="editor-preview-frame-wrap">
          {useVercelPreview ? (
            <VercelPreviewPanel
              status={vercelPreviewStatus}
              url={vercelPreviewUrl}
              buildLog={vercelBuildLog}
              errorMessage={vercelErrorMessage}
              onDeploy={onVercelDeploy ?? (() => {})}
              onCleanup={onVercelCleanup}
              viewport={viewport}
            />
          ) : !useSandbox ? (
            <EditorWorkspaceEmpty variant="preview" />
          ) : (
            <ProjectPreviewFrame
              ref={iframeRef}
              files={workspaceFiles ?? []}
              viewport={viewport}
              onCompileError={onCompileError}
              onCompileOk={onCompileOk}
              onPreviewStubPackages={onPreviewStubPackages}
              onIframeLoad={() => {
                handleIframeLoad()
                onPreviewIframeLoad()
              }}
            />
          )}
        </div>

        {canvasPins.length > 0 || (engagedTool === 'pin' && pinDraft) ? (
          <CanvasPinMarkers
            pins={canvasPins}
            draft={
              pinDraft
                ? {
                    xPercent: pinDraft.xPercent,
                    yPercent: pinDraft.yPercent,
                    widthPercent: pinDraft.widthPercent,
                    heightPercent: pinDraft.heightPercent,
                  }
                : null
            }
            onRemovePin={engagedTool === 'pin' ? handleRemovePin : undefined}
          />
        ) : null}

        {engagedTool === 'pin' && !pinDraftOpen ? (
          <CanvasPinAreaCapture
            canvasRef={canvasRef}
            onAreaSelected={(area) => void handlePinAreaSelected(area)}
          />
        ) : null}

        {hoverTarget && hoverOverlayPos && (
          <div
            className="editor-selection-box editor-selection-box--hover"
            style={{
              top: hoverOverlayPos.top,
              left: hoverOverlayPos.left,
              width: hoverOverlayPos.width,
              height: hoverOverlayPos.height,
            }}
          />
        )}

        {selected && overlayPos && (
          <div
            className="editor-selection-box"
            style={{
              top: overlayPos.top,
              left: overlayPos.left,
              width: overlayPos.width,
              height: overlayPos.height,
            }}
          />
        )}

        {selected && editor.linkEditOpen && overlayPos && (
          <ElementLinkPopover
            position={overlayPos}
            initialUrl={selected.tagName === 'a' ? '' : 'https://'}
            onCommit={(url) => editor.commitLink(selected, url)}
            onCancel={() => editor.setLinkEditOpen(false)}
          />
        )}

        {selected && editor.textEditOpen && overlayPos && !blockAiOverlay && (
          <ElementTextEditOverlay
            variant="text"
            position={overlayPos}
            elementLabel={`${selected.tagName} · ${selected.skId}`}
            initialText={selected.text ?? ''}
            onCommit={(value) => editor.commitText(selected, value)}
            onCancel={() => editor.setTextEditOpen(false)}
          />
        )}

        {selected && editor.aiEditOpen && !blockAiOverlay && overlayPos && (
          <ElementTextEditOverlay
            variant="ai"
            position={overlayPos}
            elementLabel={`${selected.tagName} · ${selected.skId}`}
            initialText=""
            onCommit={(prompt) => {
              editor.closeInlineEdit()
              handleVisualPrompt(prompt, selected)
            }}
            onCancel={() => editor.setAiEditOpen(false)}
          />
        )}

        {engagedTool === 'pin' ? (
          <CanvasPinCommentDock
            pins={canvasPins}
            draftOpen={pinDraftOpen && Boolean(pinDraft)}
            draftIndex={canvasPins.length + 1}
            draftLocationLabel={pinLabel}
            onCommit={handlePinCommit}
            onCancelDraft={handlePinCancelDraft}
            onRemovePin={handleRemovePin}
            onDone={handlePinDockDone}
          />
        ) : null}

        {editor.syncStatus !== 'idle' && (
          <div
            className={`editor-sync-toast${editor.syncStatus === 'applied' ? ' editor-sync-toast--ok' : ''}`}
          >
            {editor.syncStatus === 'applied' ? t('ed.syncApplied') : t('ed.previewOnly')}
          </div>
        )}

        {engagedTool === 'pin' && !pinDraftOpen ? (
          <div className="editor-canvas-hint">{t('ed.tool.placeHintPin')}</div>
        ) : null}
        {engagedTool === 'select' && !selected && !pinDraftOpen ? (
          <div className="editor-canvas-hint">{t('ed.editHint')}</div>
        ) : null}
      </div>
    </div>
  )
}
