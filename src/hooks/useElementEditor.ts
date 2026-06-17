'use client'

import { useCallback, useState } from 'react'
import { applyVisualPatchToSource } from '@/lib/visual-edit/applyVisualPatchToSource'
import { sourceFileForElement } from '@/lib/visual-edit/buildVisualEditPrompt'
import { insertNodeToSource } from '@/lib/visual-edit/insertNodeToSource'
import type { ElementDescriptor, InsertNodeKind, VisualPatch } from '@/lib/visual-edit/protocol'

export type ElementSyncStatus = 'idle' | 'applied' | 'preview-only'

type UseElementEditorOptions = {
  code: string
  activePath: string
  onCodeChange: (code: string) => void
  getCodeForPath?: (path: string) => string
  onCodeChangeForPath?: (path: string, content: string) => void
  onViewCode?: (element: ElementDescriptor) => void
  onBeforePatch?: () => void
  onAfterPersist?: () => void | Promise<void>
  onRecordEdit?: (summary: string) => void
  applyPatch: (patch: VisualPatch) => void
  clearSelection: () => void
}

const ALIGN_CYCLE = ['left', 'center', 'right'] as const

export function useElementEditor({
  code,
  activePath,
  onCodeChange,
  getCodeForPath,
  onCodeChangeForPath,
  onViewCode,
  onBeforePatch,
  onAfterPersist,
  onRecordEdit,
  applyPatch,
  clearSelection,
}: UseElementEditorOptions) {
  const [syncStatus, setSyncStatus] = useState<ElementSyncStatus>('idle')
  const [textEditOpen, setTextEditOpen] = useState(false)
  const [aiEditOpen, setAiEditOpen] = useState(false)
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [linkEditOpen, setLinkEditOpen] = useState(false)

  const commitPatch = useCallback(
    (patch: VisualPatch, element: ElementDescriptor, previousText?: string) => {
      onBeforePatch?.()
      applyPatch(patch)

      const targetPath = sourceFileForElement(element) ?? activePath
      const sourceCode = getCodeForPath?.(targetPath) ?? (targetPath === activePath ? code : '')
      const { code: next, applied } = applyVisualPatchToSource(
        sourceCode,
        patch,
        element,
        { previousText: previousText ?? element.text },
      )

      if (applied && next !== sourceCode) {
        if (onCodeChangeForPath) onCodeChangeForPath(targetPath, next)
        else if (targetPath === activePath) onCodeChange(next)
        setSyncStatus('applied')
        const summary = `[Edición visual · ${element.tagName} · ${element.skId}] ${patch.property} → "${patch.value}"`
        onRecordEdit?.(summary)
        void Promise.resolve(onAfterPersist?.())
      } else if (patch.property === 'text' || patch.property === 'className') {
        setSyncStatus('preview-only')
        onRecordEdit?.(
          `[Edición visual · preview] ${element.tagName} · ${element.skId}: ${patch.property} → "${patch.value}"`,
        )
      }
      window.setTimeout(() => setSyncStatus('idle'), 2400)
    },
    [
      activePath,
      applyPatch,
      code,
      getCodeForPath,
      onAfterPersist,
      onBeforePatch,
      onCodeChange,
      onCodeChangeForPath,
      onRecordEdit,
    ],
  )

  const editText = useCallback((_element: ElementDescriptor) => {
    setAiEditOpen(false)
    setStyleMenuOpen(false)
    setLinkEditOpen(false)
    setTextEditOpen(true)
  }, [])

  const openAiEdit = useCallback((_element: ElementDescriptor) => {
    setTextEditOpen(false)
    setStyleMenuOpen(false)
    setLinkEditOpen(false)
    setAiEditOpen(true)
  }, [])

  const closeInlineEdit = useCallback(() => {
    setTextEditOpen(false)
    setAiEditOpen(false)
    setLinkEditOpen(false)
  }, [])

  const commitText = useCallback(
    (element: ElementDescriptor, value: string) => {
      setTextEditOpen(false)
      const trimmed = value.trim()
      if (!trimmed || trimmed === (element.text ?? '').trim()) return
      commitPatch({ skId: element.skId, property: 'text', value: trimmed }, element, element.text)
    },
    [commitPatch],
  )

  const toggleItalic = useCallback(
    (element: ElementDescriptor) => {
      const isItalic = element.styles.fontStyle === 'italic'
      commitPatch(
        {
          skId: element.skId,
          property: 'fontStyle',
          value: isItalic ? 'normal' : 'italic',
        },
        element,
      )
    },
    [commitPatch],
  )

  const cycleAlign = useCallback(
    (element: ElementDescriptor) => {
      const current = element.styles.textAlign ?? 'left'
      const idx = ALIGN_CYCLE.indexOf(current as (typeof ALIGN_CYCLE)[number])
      const next = ALIGN_CYCLE[((idx < 0 ? 0 : idx) + 1) % ALIGN_CYCLE.length] ?? 'center'
      commitPatch({ skId: element.skId, property: 'textAlign', value: next }, element)
    },
    [commitPatch],
  )

  const setFontSize = useCallback(
    (element: ElementDescriptor, size: string) => {
      setStyleMenuOpen(false)
      commitPatch({ skId: element.skId, property: 'fontSize', value: size }, element)
    },
    [commitPatch],
  )

  const openLinkEdit = useCallback((_element: ElementDescriptor) => {
    setTextEditOpen(false)
    setAiEditOpen(false)
    setStyleMenuOpen(false)
    setLinkEditOpen(true)
  }, [])

  const commitLink = useCallback(
    (element: ElementDescriptor, url: string) => {
      setLinkEditOpen(false)
      const trimmed = url.trim()
      if (!trimmed) return
      commitPatch({ skId: element.skId, property: 'href', value: trimmed }, element)
    },
    [commitPatch],
  )

  const viewCode = useCallback(
    (element: ElementDescriptor) => {
      onViewCode?.(element)
    },
    [onViewCode],
  )

  const deleteElement = useCallback(
    (element: ElementDescriptor) => {
      commitPatch({ skId: element.skId, property: 'display', value: 'none' }, element)
      clearSelection()
    },
    [clearSelection, commitPatch],
  )

  const setColor = useCallback(
    (element: ElementDescriptor, property: 'color' | 'backgroundColor', value: string) => {
      commitPatch({ skId: element.skId, property, value }, element)
    },
    [commitPatch],
  )

  const insertNode = useCallback(
    (kind: InsertNodeKind, element: ElementDescriptor, parentSkId?: string) => {
      onBeforePatch?.()
      const skId = element.skId
      const payload = { kind, skId, parentSkId, text: element.text }
      const targetPath = sourceFileForElement(element) ?? activePath
      const sourceCode = getCodeForPath?.(targetPath) ?? (targetPath === activePath ? code : '')
      const { code: next, applied } = insertNodeToSource(sourceCode, payload, element)

      if (applied && next !== sourceCode) {
        if (onCodeChangeForPath) onCodeChangeForPath(targetPath, next)
        else if (targetPath === activePath) onCodeChange(next)
        setSyncStatus('applied')
        onRecordEdit?.(`[Inserción · ${kind} · ${skId}]`)
        void Promise.resolve(onAfterPersist?.())
      } else {
        setSyncStatus('preview-only')
        onRecordEdit?.(`[Inserción · preview] ${kind} · ${skId}`)
      }
      window.setTimeout(() => setSyncStatus('idle'), 2400)
      if (kind === 'text' || kind === 'heading' || kind === 'button') {
        setTextEditOpen(true)
      }
    },
    [
      activePath,
      code,
      getCodeForPath,
      onAfterPersist,
      onBeforePatch,
      onCodeChange,
      onCodeChangeForPath,
      onRecordEdit,
    ],
  )

  return {
    syncStatus,
    textEditOpen,
    setTextEditOpen,
    aiEditOpen,
    setAiEditOpen,
    openAiEdit,
    closeInlineEdit,
    styleMenuOpen,
    setStyleMenuOpen,
    linkEditOpen,
    setLinkEditOpen,
    commitPatch,
    editText,
    commitText,
    toggleItalic,
    cycleAlign,
    setFontSize,
    openLinkEdit,
    commitLink,
    viewCode,
    deleteElement,
    setColor,
    insertNode,
  }
}
