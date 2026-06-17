/**
 * Reexportaciones seguras para cliente — sin Vertex.
 * En API routes usar `@/lib/ai/chatInsight.server`.
 */
export {
  CHAT_AUX_MODEL,
  TYPOLOGY_CATALOG,
  detectLanguageHint,
  getTypologyMeta,
  heuristicInsight,
  parseInsightJson,
  type BuildChatInsightInput,
  type ChatInsightPayload,
  type ProjectTypologyId,
  type TypologyMeta,
} from '@/lib/ai/chatInsight.shared'
