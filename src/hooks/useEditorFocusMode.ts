'use client'

import { useCallback, useEffect, useState } from 'react'

export const EDITOR_FOCUS_STORAGE_KEY = 'sk.editor.focusMode'

function readStored(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(EDITOR_FOCUS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function useEditorFocusMode() {
  const [focusMode, setFocusModeState] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setFocusModeState(readStored())
    setHydrated(true)
  }, [])

  const setFocusMode = useCallback((next: boolean) => {
    setFocusModeState(next)
    try {
      if (next) window.localStorage.setItem(EDITOR_FOCUS_STORAGE_KEY, '1')
      else window.localStorage.removeItem(EDITOR_FOCUS_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleFocusMode = useCallback(() => {
    setFocusModeState((prev) => {
      const next = !prev
      try {
        if (next) window.localStorage.setItem(EDITOR_FOCUS_STORAGE_KEY, '1')
        else window.localStorage.removeItem(EDITOR_FOCUS_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { focusMode, setFocusMode, toggleFocusMode, hydrated }
}
