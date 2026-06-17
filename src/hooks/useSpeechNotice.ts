'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const AUTO_DISMISS_MS = 5000

/** Aviso de dictado con auto-ocultación tras unos segundos. */
export function useSpeechNotice() {
  const [notice, setNotice] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSpeechNotice = useCallback((message: string | null) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setNotice(message)
    if (message) {
      timerRef.current = setTimeout(() => {
        setNotice(null)
        timerRef.current = null
      }, AUTO_DISMISS_MS)
    }
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return { speechNotice: notice, setSpeechNotice }
}
