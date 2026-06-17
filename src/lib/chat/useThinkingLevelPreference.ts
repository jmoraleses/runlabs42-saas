'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_THINKING_LEVEL,
  THINKING_LEVELS,
  type ThinkingLevel,
} from '@/lib/ai/models'

export const THINKING_LEVEL_STORAGE = 'sk.editor.thinkingLevel'

const VALID_LEVELS = new Set(THINKING_LEVELS.map((l) => l.id))

function parseStoredLevel(raw: string | null): ThinkingLevel {
  if (raw && VALID_LEVELS.has(raw as ThinkingLevel)) {
    return raw as ThinkingLevel
  }
  return DEFAULT_THINKING_LEVEL
}

export function useThinkingLevelPreference() {
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL)

  useEffect(() => {
    try {
      setThinkingLevelState(parseStoredLevel(localStorage.getItem(THINKING_LEVEL_STORAGE)))
    } catch {
      /* ignore */
    }
  }, [])

  const setThinkingLevel = useCallback((level: ThinkingLevel) => {
    const next = VALID_LEVELS.has(level) ? level : DEFAULT_THINKING_LEVEL
    setThinkingLevelState(next)
    try {
      localStorage.setItem(THINKING_LEVEL_STORAGE, next)
    } catch {
      /* ignore */
    }
  }, [])

  return { thinkingLevel, setThinkingLevel }
}
