import type { DesignBrief } from '@/lib/design/designBrief'

const STORAGE_KEY = 'sk.pendingEditorSession'

export type PendingImage = {
  id: string
  mimeType: string
  dataUrl: string
  /** URL en servidor (Blob) cuando la captura no cabe en sessionStorage. */
  url?: string
  name?: string
}

export type PendingDesignBrief = Omit<DesignBrief, 'prompt'>

export type PendingEditorSession = {
  text: string
  images: PendingImage[]
  useSpecKit: boolean
  autoGenerate?: boolean
  generateImages?: boolean
  imageModelId?: string
  brief?: PendingDesignBrief
}

export function setPendingEditorSession(session: PendingEditorSession) {
  if (typeof window === 'undefined') return
  const trimmed = session.text.trim()
  if (!trimmed && !session.images.length) return
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...session,
      text: trimmed,
      useSpecKit: session.useSpecKit === true,
    }),
  )
}

/** @deprecated use setPendingEditorSession */
export function setPendingEditorPrompt(text: string) {
  setPendingEditorSession({ text, images: [], useSpecKit: false })
}

function parsePendingEditorSession(raw: string): PendingEditorSession | null {
  try {
    const parsed = JSON.parse(raw) as PendingEditorSession
    if (typeof parsed === 'string') {
      return { text: parsed, images: [], useSpecKit: false, autoGenerate: true }
    }
    const text = String(parsed.text ?? '').trim()
    const images = Array.isArray(parsed.images) ? parsed.images : []
    if (!text && images.length === 0) return null
    const brief =
      parsed.brief && typeof parsed.brief === 'object' && !Array.isArray(parsed.brief)
        ? (parsed.brief as PendingDesignBrief)
        : undefined
    return {
      text,
      images,
      useSpecKit: parsed.useSpecKit === true,
      autoGenerate: parsed.autoGenerate !== false,
      generateImages: parsed.generateImages === true,
      imageModelId:
        typeof parsed.imageModelId === 'string' && parsed.imageModelId.trim()
          ? parsed.imageModelId.trim()
          : undefined,
      brief,
    }
  } catch {
    const text = raw.trim()
    if (!text) return null
    return { text, images: [], useSpecKit: false, autoGenerate: true }
  }
}

/** Lee el prompt pendiente sin borrarlo (para esperar a que Studio esté listo). */
export function peekPendingEditorSession(): PendingEditorSession | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  return parsePendingEditorSession(raw)
}

export function clearPendingEditorSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}

export function consumePendingEditorSession(): PendingEditorSession | null {
  if (typeof window === 'undefined') return null
  const pending = peekPendingEditorSession()
  if (!pending) return null
  clearPendingEditorSession()
  return pending
}

/** @deprecated use consumePendingEditorSession */
export function consumePendingEditorPrompt(): string | null {
  const s = consumePendingEditorSession()
  return s?.text || null
}
