'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'sk.editor.split'
const DEFAULT_RATIO = 0.55
const MIN_RATIO = 0.25
const MAX_RATIO = 0.75

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function loadRatio(): number {
  if (typeof window === 'undefined') return DEFAULT_RATIO
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_RATIO
    const n = Number(JSON.parse(raw))
    return Number.isFinite(n) ? clamp(n, MIN_RATIO, MAX_RATIO) : DEFAULT_RATIO
  } catch {
    return DEFAULT_RATIO
  }
}

function saveRatio(ratio: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratio))
  } catch {
    /* ignore */
  }
}

export function useEditorSplitRatio() {
  const [ratio, setRatioState] = useState(DEFAULT_RATIO)
  const ratioRef = useRef(DEFAULT_RATIO)

  ratioRef.current = ratio

  useEffect(() => {
    const r = loadRatio()
    setRatioState(r)
    ratioRef.current = r
  }, [])

  const adjustRatio = useCallback((deltaPx: number, containerWidth: number) => {
    if (containerWidth <= 0) return
    setRatioState((prev) => {
      const next = clamp(prev + deltaPx / containerWidth, MIN_RATIO, MAX_RATIO)
      ratioRef.current = next
      return next
    })
  }, [])

  const persist = useCallback(() => {
    saveRatio(ratioRef.current)
  }, [])

  return { ratio, adjustRatio, persist }
}
