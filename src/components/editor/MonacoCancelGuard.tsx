'use client'

import { useEffect } from 'react'
import { isBenignMonacoCancelError } from '@/lib/editor/monacoErrors'

/** Evita el overlay de Next.js por cancelaciones benignas al desmontar Monaco. */
export function MonacoCancelGuard() {
  useEffect(() => {
    const swallow = (reason: unknown) => isBenignMonacoCancelError(reason)

    const onRejection = (e: PromiseRejectionEvent) => {
      if (swallow(e.reason)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    const onError = (e: ErrorEvent) => {
      if (swallow(e.error ?? e.message)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    window.addEventListener('unhandledrejection', onRejection, true)
    window.addEventListener('error', onError, true)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection, true)
      window.removeEventListener('error', onError, true)
    }
  }, [])

  return null
}
