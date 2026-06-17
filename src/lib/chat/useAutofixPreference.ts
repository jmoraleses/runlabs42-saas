'use client'

import { useCallback, useEffect, useState } from 'react'

export const AUTOFIX_ENABLED_STORAGE = 'sk.editor.autofixEnabled'

export function useAutofixPreference() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTOFIX_ENABLED_STORAGE)
      if (stored === '0') setEnabled(false)
    } catch {
      /* ignore */
    }
  }, [])

  const setAutofixEnabled = useCallback((value: boolean) => {
    setEnabled(value)
    try {
      localStorage.setItem(AUTOFIX_ENABLED_STORAGE, value ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  return { autofixEnabled: enabled, setAutofixEnabled }
}
