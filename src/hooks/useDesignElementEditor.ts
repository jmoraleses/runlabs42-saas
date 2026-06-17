'use client'

import { useCallback, useState } from 'react'
import type { ElementDescriptor, VisualPatch } from '@/lib/visual-edit/protocol'

type UseDesignElementEditorOptions = {
  onPatchPersist: (
    patch: VisualPatch,
    element: ElementDescriptor,
    previousText?: string,
  ) => void | Promise<void>
  applyPatch: (patch: VisualPatch) => void
  clearSelection: () => void
  onVisualChatMessage?: (text: string, element: ElementDescriptor | null) => void
}

const ALIGN_CYCLE = ['left', 'center', 'right'] as const

export function useDesignElementEditor({
  onPatchPersist,
  applyPatch,
  clearSelection,
  onVisualChatMessage,
}: UseDesignElementEditorOptions) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'applied' | 'preview-only'>('idle')
  const [textEditOpen, setTextEditOpen] = useState(false)
  const [aiEditOpen, setAiEditOpen] = useState(false)
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [linkEditOpen, setLinkEditOpen] = useState(false)

  const commitPatch = useCallback(
    (patch: VisualPatch, element: ElementDescriptor, previousText?: string) => {
      applyPatch(patch)
      void Promise.resolve(onPatchPersist(patch, element, previousText)).then(() => {
        setSyncStatus('applied')
        window.setTimeout(() => setSyncStatus('idle'), 2400)
      })
    },
    [applyPatch, onPatchPersist],
  )

  const editText = useCallback(() => {
    setAiEditOpen(false)
    setStyleMenuOpen(false)
    setLinkEditOpen(false)
    setTextEditOpen(true)
  }, [])

  const openAiEdit = useCallback(() => {
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
        { skId: element.skId, property: 'fontStyle', value: isItalic ? 'normal' : 'italic' },
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
      commitPatch({ skId: element.skId, property: 'fontSize', value: size }, element)
      setStyleMenuOpen(false)
    },
    [commitPatch],
  )

  const openLinkEdit = useCallback(() => {
    setTextEditOpen(false)
    setAiEditOpen(false)
    setStyleMenuOpen(false)
    setLinkEditOpen(true)
  }, [])

  const commitLink = useCallback(
    (element: ElementDescriptor, url: string) => {
      setLinkEditOpen(false)
      commitPatch({ skId: element.skId, property: 'href', value: url.trim() }, element)
    },
    [commitPatch],
  )

  const deleteElement = useCallback(
    (element: ElementDescriptor) => {
      commitPatch({ skId: element.skId, property: 'display', value: 'none' }, element)
      clearSelection()
    },
    [commitPatch, clearSelection],
  )

  const submitAiEdit = useCallback(
    (element: ElementDescriptor, prompt: string) => {
      closeInlineEdit()
      onVisualChatMessage?.(prompt, element)
    },
    [closeInlineEdit, onVisualChatMessage],
  )

  const markApplied = useCallback(() => {
    setSyncStatus('applied')
    window.setTimeout(() => setSyncStatus('idle'), 2400)
  }, [])

  return {
    syncStatus,
    markApplied,
    textEditOpen,
    aiEditOpen,
    styleMenuOpen,
    linkEditOpen,
    setStyleMenuOpen,
    setLinkEditOpen,
    setAiEditOpen,
    editText,
    openAiEdit,
    closeInlineEdit,
    commitText,
    commitPatch,
    toggleItalic,
    cycleAlign,
    setFontSize,
    openLinkEdit,
    commitLink,
    deleteElement,
    submitAiEdit,
  }
}
