'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'sk.editor.panels'

export const EDITOR_CHAT_DEFAULT = 360
export const EDITOR_RAIL_DEFAULT = 240
export const EDITOR_CHAT_MIN = 280
export const EDITOR_RAIL_MIN = 180

/** Chat: ~20% del viewport (panel asistente más estrecho, más espacio al lienzo). */
export const EDITOR_CHAT_MAX_VIEWPORT_RATIO = 0.22
export const EDITOR_CHAT_MAX = 420

/** Archivos: tope fijo según diseño de referencia (~374px). */
export const EDITOR_RAIL_MAX_VIEWPORT_RATIO = 0.2
export const EDITOR_RAIL_MAX = 374

export function editorChatWidthMax(viewportWidth: number): number {
  const byRatio = Math.floor(viewportWidth * EDITOR_CHAT_MAX_VIEWPORT_RATIO)
  return Math.max(EDITOR_CHAT_MIN, Math.min(EDITOR_CHAT_MAX, byRatio))
}

export function editorRailWidthMax(viewportWidth: number): number {
  const byRatio = Math.floor(viewportWidth * EDITOR_RAIL_MAX_VIEWPORT_RATIO)
  return Math.max(EDITOR_RAIL_MIN, Math.min(EDITOR_RAIL_MAX, byRatio))
}

type PanelWidths = { chat: number; rail: number; filesOpen?: boolean; chatOpen?: boolean }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function loadWidths(): Required<Pick<PanelWidths, 'chat' | 'rail'>> & {
  filesOpen: boolean
  chatOpen: boolean
} {
  if (typeof window === 'undefined') {
    return { chat: EDITOR_CHAT_DEFAULT, rail: EDITOR_RAIL_DEFAULT, filesOpen: false, chatOpen: true }
  }
  const vw = window.innerWidth
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { chat: EDITOR_CHAT_DEFAULT, rail: EDITOR_RAIL_DEFAULT, filesOpen: false, chatOpen: true }
    }
    const parsed = JSON.parse(raw) as Partial<PanelWidths>
    return {
      chat: clamp(
        Number(parsed.chat) || EDITOR_CHAT_DEFAULT,
        EDITOR_CHAT_MIN,
        editorChatWidthMax(vw),
      ),
      rail: clamp(
        Number(parsed.rail) || EDITOR_RAIL_DEFAULT,
        EDITOR_RAIL_MIN,
        editorRailWidthMax(vw),
      ),
      /** Panel de archivos siempre cerrado al abrir Studio (no se restaura desde localStorage). */
      filesOpen: false,
      chatOpen: parsed.chatOpen !== false,
    }
  } catch {
    return { chat: EDITOR_CHAT_DEFAULT, rail: EDITOR_RAIL_DEFAULT, filesOpen: false, chatOpen: true }
  }
}

function saveWidths(chat: number, rail: number, filesOpen: boolean, chatOpen: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ chat, rail, filesOpen, chatOpen }))
  } catch {
    /* ignore */
  }
}

type UseEditorPanelWidthsOpts = {
  /** Tablet/móvil: sin resize por arrastre */
  compact?: boolean
}

export function useEditorPanelWidths(opts?: UseEditorPanelWidthsOpts) {
  const compact = opts?.compact === true
  const [chatWidth, setChatWidthState] = useState(EDITOR_CHAT_DEFAULT)
  const [railWidth, setRailWidthState] = useState(EDITOR_RAIL_DEFAULT)
  const [filesOpen, setFilesOpenState] = useState(false)
  const [chatOpen, setChatOpenState] = useState(true)
  const widthsRef = useRef({
    chat: EDITOR_CHAT_DEFAULT,
    rail: EDITOR_RAIL_DEFAULT,
    filesOpen: false,
    chatOpen: true,
  })

  widthsRef.current = { chat: chatWidth, rail: railWidth, filesOpen, chatOpen }

  const chatMax = useCallback(() => {
    if (typeof window === 'undefined') return EDITOR_CHAT_DEFAULT
    return editorChatWidthMax(window.innerWidth)
  }, [])

  const railMax = useCallback(() => {
    if (typeof window === 'undefined') return EDITOR_RAIL_DEFAULT
    return editorRailWidthMax(window.innerWidth)
  }, [])

  useEffect(() => {
    const { chat, rail, filesOpen: open, chatOpen: chatOn } = loadWidths()
    setChatWidthState(chat)
    setRailWidthState(rail)
    setFilesOpenState(open)
    setChatOpenState(chatOn)
    widthsRef.current = { chat, rail, filesOpen: open, chatOpen: chatOn }
  }, [])

  const reclampPanels = useCallback(() => {
    setChatWidthState((prev) => clamp(prev, EDITOR_CHAT_MIN, chatMax()))
    setRailWidthState((prev) => clamp(prev, EDITOR_RAIL_MIN, railMax()))
  }, [chatMax, railMax])

  useEffect(() => {
    const onResize = () => reclampPanels()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [reclampPanels])

  const setChatWidth = useCallback(
    (delta: number) => {
      if (compact) return
      setChatWidthState((prev) => clamp(prev + delta, EDITOR_CHAT_MIN, chatMax()))
    },
    [chatMax, compact],
  )

  const setRailWidth = useCallback(
    (delta: number) => {
      if (compact) return
      setRailWidthState((prev) => clamp(prev + delta, EDITOR_RAIL_MIN, railMax()))
    },
    [railMax, compact],
  )

  const setFilesOpen = useCallback((open: boolean) => {
    setFilesOpenState(open)
    widthsRef.current = { ...widthsRef.current, filesOpen: open }
  }, [])

  const toggleFilesOpen = useCallback(() => {
    setFilesOpenState((prev) => {
      const next = !prev
      widthsRef.current = { ...widthsRef.current, filesOpen: next }
      return next
    })
  }, [])

  const setChatOpen = useCallback((open: boolean) => {
    setChatOpenState(open)
    widthsRef.current = { ...widthsRef.current, chatOpen: open }
  }, [])

  const toggleChatOpen = useCallback(() => {
    setChatOpenState((prev) => {
      const next = !prev
      widthsRef.current = { ...widthsRef.current, chatOpen: next }
      return next
    })
  }, [])

  const persist = useCallback(() => {
    saveWidths(
      widthsRef.current.chat,
      widthsRef.current.rail,
      widthsRef.current.filesOpen,
      widthsRef.current.chatOpen,
    )
  }, [])

  return {
    chatWidth,
    railWidth,
    filesOpen,
    chatOpen,
    setFilesOpen,
    toggleFilesOpen,
    setChatOpen,
    toggleChatOpen,
    setChatWidth,
    setRailWidth,
    persist,
  }
}
