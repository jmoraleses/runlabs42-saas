'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_HISTORY = 80
const DEBOUNCE_MS = 400

export function useEditorHistory(initial: string) {
  const [present, setPresent] = useState(initial)
  const [past, setPast] = useState<string[]>([])
  const [future, setFuture] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotRef = useRef(initial)
  const presentRef = useRef(initial)

  useEffect(() => {
    presentRef.current = present
  }, [present])

  const commitSnapshot = useCallback((nextPresent: string) => {
    const snap = snapshotRef.current
    if (snap !== nextPresent) {
      setPast((p) => [...p, snap].slice(-MAX_HISTORY))
      setFuture([])
      snapshotRef.current = nextPresent
    }
  }, [])

  const flushPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    commitSnapshot(presentRef.current)
  }, [commitSnapshot])

  const setCode = useCallback(
    (next: string | ((prev: string) => string)) => {
      setPresent((prev) => {
        const value = typeof next === 'function' ? next(prev) : next
        if (value === prev) return prev

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => commitSnapshot(value), DEBOUNCE_MS)

        return value
      })
    },
    [commitSnapshot],
  )

  const replaceCode = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    snapshotRef.current = value
    presentRef.current = value
    setPresent(value)
    setPast([])
    setFuture([])
  }, [])

  const pushSnapshot = useCallback(() => {
    flushPending()
  }, [flushPending])

  const undo = useCallback(() => {
    flushPending()
    const current = presentRef.current

    setPast((p) => {
      if (p.length > 0) {
        const previous = p[p.length - 1]!
        setFuture((f) => [current, ...f].slice(0, MAX_HISTORY))
        setPresent(previous)
        snapshotRef.current = previous
        presentRef.current = previous
        return p.slice(0, -1)
      }

      const snap = snapshotRef.current
      if (current !== snap) {
        setFuture((f) => [current, ...f].slice(0, MAX_HISTORY))
        setPresent(snap)
        presentRef.current = snap
      }
      return p
    })
  }, [flushPending])

  const redo = useCallback(() => {
    flushPending()

    setFuture((f) => {
      if (!f.length) return f
      const next = f[0]!
      const current = presentRef.current
      setPast((p) => [...p, current].slice(-MAX_HISTORY))
      setPresent(next)
      snapshotRef.current = next
      presentRef.current = next
      return f.slice(1)
    })
  }, [flushPending])

  const canUndo = past.length > 0 || present !== snapshotRef.current
  const canRedo = future.length > 0

  return {
    code: present,
    setCode,
    replaceCode,
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
