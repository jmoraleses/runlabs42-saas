'use client'

import React, { createContext, useContext } from 'react'
import { useEditorFocusMode } from '@/hooks/useEditorFocusMode'

type EditorFocusContextValue = ReturnType<typeof useEditorFocusMode>

const EditorFocusCtx = createContext<EditorFocusContextValue | null>(null)

export function EditorFocusProvider({ children }: { children: React.ReactNode }) {
  const value = useEditorFocusMode()
  return <EditorFocusCtx.Provider value={value}>{children}</EditorFocusCtx.Provider>
}

export function useEditorFocus() {
  const ctx = useContext(EditorFocusCtx)
  if (!ctx) throw new Error('useEditorFocus must be used within EditorFocusProvider')
  return ctx
}

/** Safe when outside provider (e.g. layout without editor). */
export function useEditorFocusOptional() {
  return useContext(EditorFocusCtx)
}
