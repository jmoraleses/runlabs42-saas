import { config as loadEnv } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'
import {
  getGoogleCloudCredentialsCached,
  loadGoogleCloudCredentials,
  loadServiceAccountFromEnv,
} from '@/lib/platform/googleCloudCredentials.server'
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_IMAGE_GEN_MODEL,
  IMAGEN3_GEN_MODEL,
  IMAGEN3_GEN_MODEL_FAST,
} from '@/lib/ai/constants'
import { AUTO_MODEL_ID, MAX_MODEL_ID } from '@/lib/ai/modelTypes'
import {
  resolveVertexAgentTextModelId,
  resolveVertexImageModelId,
} from '@/lib/ai/vertexModelAllowlist'
import { resolveOrchestratorImplementModel } from '@/lib/ai/spec-kit/orchestrator'
import {
  getTrialDesignTextModelId,
  trialBlocksAiStudioApiKeys,
  isGenAiAppBuilderTrialCreditEnabled,
} from '@/lib/ai/genaiAppBuilderTrial'

let aiEnvLoaded = false

function ensureAIEnv() {
  if (aiEnvLoaded || typeof window !== 'undefined') return
  aiEnvLoaded = true
  const localEnv = resolve(process.cwd(), '.env.local')
  if (existsSync(localEnv)) {
    loadEnv({ path: localEnv })
  }
}

/** Proveedor de IA: mock solo si no hay Vertex o AI_PROVIDER=mock. */
export function getAIProvider(): 'gemini' | 'mock' {
  ensureAIEnv()
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (explicit === 'mock') return 'mock'
  return isVertexAIConfigured() ? 'gemini' : 'mock'
}

export function isVertexAIConfigured(): boolean {
  if (getGoogleCloudCredentialsCached()) return true
  ensureAIEnv()
  return loadServiceAccountFromEnv() != null
}

export async function isVertexAIConfiguredAsync(): Promise<boolean> {
  const creds = await loadGoogleCloudCredentials()
  return creds != null
}

/** IA real = Vertex AI Agent Platform configurado (Google, Anthropic, OpenAI MaaS). */
export function isGeminiEnabled(): boolean {
  ensureAIEnv()
  if (process.env.AI_PROVIDER?.trim().toLowerCase() === 'mock') return false
  return isVertexAIConfigured()
}

export function getGeminiModelId(): string {
  ensureAIEnv()
  return resolveVertexAgentTextModelId(process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL)
}

/** Modelo Gemini para plan/HTML de diseño (solo ids GA en Vertex). */
export function getDesignGenModelId(): string {
  ensureAIEnv()
  if (isGenAiAppBuilderTrialCreditEnabled()) {
    return resolveVertexAgentTextModelId(getTrialDesignTextModelId(), DEFAULT_GEMINI_MODEL)
  }
  return resolveVertexAgentTextModelId(
    process.env.DESIGN_GEN_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    DEFAULT_GEMINI_MODEL,
  )
}

/** Modelo del compositor Studio: auto/max → DESIGN_GEN_MODEL; ids explícitos validados en Vertex. */
export function resolveDesignGenerateModelId(choice: string | undefined | null): string {
  ensureAIEnv()
  const raw = choice?.trim()
  if (!raw || raw === AUTO_MODEL_ID) {
    return getDesignGenModelId()
  }
  if (raw === MAX_MODEL_ID) {
    return resolveVertexAgentTextModelId(
      resolveOrchestratorImplementModel('', getDesignGenModelId()),
      getDesignGenModelId(),
    )
  }
  return resolveVertexAgentTextModelId(raw, getDesignGenModelId())
}

/** AI Studio — desactivado salvo ALLOW_GEMINI_API_KEY_FALLBACK=1 (el editor usa Vertex). */
export function getGeminiApiKey(): string | undefined {
  ensureAIEnv()
  if (trialBlocksAiStudioApiKeys()) return undefined
  if (process.env.ALLOW_GEMINI_API_KEY_FALLBACK !== '1') return undefined
  return process.env.GEMINI_API_KEY?.trim() || undefined
}

/**
 * API key solo para generación de imágenes (cuota AI Studio, distinta de Vertex texto).
 * Orden: IMAGE_GEN_GEMINI_API_KEY → GEMINI_API_KEY (si IMAGE_GEN_ALLOW_API_KEY=1 o fallback global).
 */
export function getImageGenApiKey(): string | undefined {
  ensureAIEnv()
  if (trialBlocksAiStudioApiKeys()) return undefined
  const dedicated = process.env.IMAGE_GEN_GEMINI_API_KEY?.trim()
  if (dedicated) return dedicated
  if (process.env.IMAGE_GEN_ALLOW_API_KEY === '0') return undefined
  if (process.env.ALLOW_GEMINI_API_KEY_FALLBACK === '1') {
    return process.env.GEMINI_API_KEY?.trim() || undefined
  }
  return process.env.GEMINI_API_KEY?.trim() || undefined
}

/** Proveedor de imágenes: auto | vertex | api_key */
export function getImageGenProvider(): 'auto' | 'vertex' | 'api_key' {
  ensureAIEnv()
  const v = process.env.IMAGE_GEN_PROVIDER?.trim().toLowerCase()
  if (v === 'vertex' || v === 'api_key') return v
  if (isVertexAIConfigured()) return 'vertex'
  return 'auto'
}

/** Modelo Imagen por defecto (IMAGE_GEN_MODEL en env → Imagen 3 Fast). */
export function getImageGenModelId(): string {
  ensureAIEnv()
  return resolveVertexImageModelId(
    process.env.IMAGE_GEN_MODEL?.trim(),
    DEFAULT_IMAGE_GEN_MODEL,
  )
}

/** Candidatos Vertex: Imagen 3/4 fast → standard (solo GA). */
export function getImageGenVertexModelCandidates(): readonly string[] {
  return getMockupGenModelCandidates()
}

export function imageGenAllowsApiKeyFallback(): boolean {
  ensureAIEnv()
  if (trialBlocksAiStudioApiKeys()) return false
  return process.env.IMAGE_GEN_ALLOW_API_KEY === '1'
}

/** Imagen estándar para mockups de pantalla (MOCKUP_GEN_MODEL → Imagen 3 Standard). */
export function getMockupGenModelId(): string {
  ensureAIEnv()
  return resolveVertexImageModelId(process.env.MOCKUP_GEN_MODEL?.trim(), IMAGEN3_GEN_MODEL)
}

/** Imagen rápida para iterate/reimagine (MOCKUP_GEN_MODEL_FAST → Imagen 3 Fast). */
export function getMockupGenFastModelId(): string {
  ensureAIEnv()
  return resolveVertexImageModelId(process.env.MOCKUP_GEN_MODEL_FAST?.trim(), IMAGEN3_GEN_MODEL_FAST)
}

/** Candidatos Imagen (standard → fast), solo ids GA. */
export function getMockupGenModelCandidates(): readonly string[] {
  ensureAIEnv()
  const primary = getMockupGenModelId()
  const fast = getMockupGenFastModelId()
  if (primary === fast) return [primary]
  return [primary, fast]
}

/** Modelo de imagen para assets HTML de diseño (panel admin + sonda Vertex). */
export async function getDesignAssetGenModelCandidates(
  preferredModelId?: string | null,
): Promise<readonly string[]> {
  ensureAIEnv()
  const { isDesignImageGenerationEnabled } = await import(
    '@/lib/platform/designImageGenerationSetting.server'
  )
  if (!(await isDesignImageGenerationEnabled())) return []

  const { getDesignAssetImageModelId } = await import(
    '@/lib/platform/designImageModelSetting.server'
  )
  const rawPreferred = preferredModelId?.trim()
  const preferred = rawPreferred
    ? resolveVertexImageModelId(rawPreferred)
    : resolveVertexImageModelId(await getDesignAssetImageModelId())

  if (!isVertexAIConfigured()) {
    return preferred ? [preferred] : []
  }

  const { getProbedVertexImageModelIds } = await import('@/lib/ai/vertexImageModelProbe')
  const probed = await getProbedVertexImageModelIds([preferred])
  if (probed.length) return probed

  console.warn(
    '[designImageGen] Ningún modelo de imagen Vertex pasó la sonda; no se generarán assets [IMAGE:].',
  )
  return []
}

/** Pipeline de diseño: solo Vertex, sin AI Studio. */
export function designPipelineRequiresVertex(): boolean {
  return true
}

export function getVertexAICredentials(): {
  projectId: string
  location: string
  clientEmail: string
  privateKey: string
} | null {
  ensureAIEnv()
  const cached = getGoogleCloudCredentialsCached()
  const sa = cached ?? loadServiceAccountFromEnv()
  if (!sa) return null

  const location =
    cached?.location ??
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ??
    process.env.VERTEX_LOCATION?.trim() ??
    'us-central1'

  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() || sa.projectId,
    location,
    clientEmail: sa.clientEmail,
    privateKey: sa.privateKey,
  }
}

export async function getVertexAICredentialsAsync(): Promise<{
  projectId: string
  location: string
  clientEmail: string
  privateKey: string
} | null> {
  const creds = await loadGoogleCloudCredentials()
  if (!creds) return null
  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() || creds.projectId,
    location: creds.location,
    clientEmail: creds.clientEmail,
    privateKey: creds.privateKey,
  }
}
