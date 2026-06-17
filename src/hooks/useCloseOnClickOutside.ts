'use client'

import { useEffect, useRef, type RefObject } from 'react'

export function useCloseOnClickOutside(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      const el = ref.current
      if (el && !el.contains(e.target as Node)) onCloseRef.current()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('mousedown', onPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref])
}
