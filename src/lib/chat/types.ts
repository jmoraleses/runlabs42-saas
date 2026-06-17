import type { CanvasPin } from '@/lib/visual-edit/canvasPins'
import type { VisualEditMessageMeta } from '@/lib/visual-edit/visualEditMessage'
import type { ChatInsightPayload } from '@/lib/ai/chatInsight'
import type { ChatStudioEvent } from '@/lib/chat/studioEvents'

export type ChatAppliedFile = {
  path: string
  action: 'create' | 'update'
  lines?: number
  sizeBytes?: number
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  images?: { previewUrl: string; name: string }[]
  /** Vista compacta en el chat; `content` sigue siendo el prompt completo para la IA. */
  visualEdit?: VisualEditMessageMeta
  /** Avisos del studio (compilación, autofix) sin texto largo en el bubble. */
  studioEvent?: ChatStudioEvent
  /** Clasificación de tipología y resumen (modelo auxiliar flash-lite). */
  chatInsight?: ChatInsightPayload
  /** Estado del workspace justo antes de enviar este mensaje (solo mensajes user). */
  workspaceSnapshotId?: string
  /** Archivos creados o modificados en esta respuesta del asistente. */
  appliedFiles?: ChatAppliedFile[]
  /** Archivos del workspace adjuntos con @ en el mensaje del usuario. */
  contextPaths?: string[]
  /** Marcadores de ubicación en el preview (herramienta + del canvas). */
  canvasPins?: CanvasPin[]
}

export type ProjectChatSession = {
  id: string
  projectId: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}
