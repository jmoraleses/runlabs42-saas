import type { CategoryModelChoices } from '@/lib/ai/chatModelChoices'
import { resolveModelId } from '@/lib/ai/models'
import { isMaxModelChoice } from '@/lib/ai/spec-kit/orchestrator'
import { AUTO_MODEL_ID } from '@/lib/ai/modelTypes'

export type ResolvedCategoryStreamModels = {
  code: string
  image: string
}

export type StreamModelTask = 'code' | 'ocr'

export function classifyStreamModelTask(opts: {
  command: string
  hasImages: boolean
  inferredBuild?: boolean
}): StreamModelTask {
  if (opts.hasImages) return 'ocr'
  const cmd = opts.command.trim().toLowerCase()
  if (cmd === '/build' || cmd === '/mobile-fix') return 'code'
  if (opts.inferredBuild) return 'code'
  return 'code'
}

function readCategoryModels(categoryModels: CategoryModelChoices): {
  codeRaw: string
  imageRaw: string
} {
  const legacy = categoryModels as CategoryModelChoices & { text?: string }
  return {
    codeRaw: (categoryModels.code || legacy.text || '').trim(),
    imageRaw: (categoryModels.image || '').trim(),
  }
}

/** Resuelve modelos Código y OCR del menú (ids de catálogo → ids Vertex). */
export function resolveCategoryStreamModels(
  modelChoice: string,
  categoryModels: CategoryModelChoices | undefined,
  geminiEnabled: boolean,
): ResolvedCategoryStreamModels | null {
  if (!categoryModels) return null
  const { codeRaw, imageRaw } = readCategoryModels(categoryModels)
  if (!codeRaw && !imageRaw) return null

  const resolve = (id: string) => resolveModelId(id, { geminiEnabled })
  const fallbackRaw = codeRaw || imageRaw || modelChoice

  return {
    code: resolve(codeRaw || fallbackRaw),
    image: resolve(imageRaw || codeRaw || fallbackRaw),
  }
}

export function shouldRunOcrThenCodePipeline(
  hasImages: boolean,
  resolved: ResolvedCategoryStreamModels | null,
): boolean {
  if (!hasImages || !resolved?.code || !resolved?.image) return false
  return resolved.code !== resolved.image
}

export function pickStreamModelForTask(
  task: StreamModelTask,
  resolved: ResolvedCategoryStreamModels,
  fallbackModelId: string,
): string {
  if (task === 'ocr' && resolved.image) return resolved.image
  if (resolved.code) return resolved.code
  return fallbackModelId
}

export type ResolveStreamModelResult = {
  modelId: string
  task: StreamModelTask
  resolvedCategories: ResolvedCategoryStreamModels | null
  usesCategoryRouting: boolean
  ocrThenCode: boolean
}

/**
 * Elige el modelo según la tarea cuando el usuario configuró Código / OCR por separado.
 * Con imágenes y ambos modelos distintos, el stream principal usa Código (OCR corre antes en geminiStream).
 */
export function resolveStreamModelForRequest(opts: {
  modelChoice: string
  categoryModels?: CategoryModelChoices
  geminiEnabled: boolean
  command: string
  hasImages: boolean
  inferredBuild?: boolean
}): ResolveStreamModelResult {
  const task = classifyStreamModelTask(opts)
  const fallbackModelId = resolveModelId(opts.modelChoice, { geminiEnabled: opts.geminiEnabled })

  const globalMode =
    isMaxModelChoice(opts.modelChoice) ||
    (opts.modelChoice?.trim() || AUTO_MODEL_ID).toLowerCase() === AUTO_MODEL_ID

  const resolved = resolveCategoryStreamModels(
    opts.modelChoice,
    opts.categoryModels,
    opts.geminiEnabled,
  )

  const ocrThenCode = shouldRunOcrThenCodePipeline(opts.hasImages, resolved)

  if (!resolved) {
    return {
      modelId: fallbackModelId,
      task,
      resolvedCategories: null,
      usesCategoryRouting: false,
      ocrThenCode: false,
    }
  }

  if (globalMode && opts.hasImages) {
    if (ocrThenCode) {
      return {
        modelId: resolved.code,
        task: 'code',
        resolvedCategories: resolved,
        usesCategoryRouting: true,
        ocrThenCode: true,
      }
    }
    return {
      modelId: pickStreamModelForTask('ocr', resolved, fallbackModelId),
      task: 'ocr',
      resolvedCategories: resolved,
      usesCategoryRouting: true,
      ocrThenCode: false,
    }
  }

  if (globalMode) {
    return {
      modelId: fallbackModelId,
      task,
      resolvedCategories: resolved,
      usesCategoryRouting: false,
      ocrThenCode: false,
    }
  }

  if (ocrThenCode) {
    return {
      modelId: resolved.code,
      task: 'code',
      resolvedCategories: resolved,
      usesCategoryRouting: true,
      ocrThenCode: true,
    }
  }

  return {
    modelId: pickStreamModelForTask(task, resolved, fallbackModelId),
    task,
    resolvedCategories: resolved,
    usesCategoryRouting: true,
    ocrThenCode: false,
  }
}

export function pickCategoryModelForImprove(
  modelChoice: string,
  categoryModels: CategoryModelChoices | undefined,
  geminiEnabled: boolean,
): string {
  const resolved = resolveCategoryStreamModels(modelChoice, categoryModels, geminiEnabled)
  if (resolved?.code) return resolved.code
  return resolveModelId(modelChoice, { geminiEnabled })
}

export function pickCategoryModelForCodeGeneration(
  modelChoice: string,
  categoryModels: CategoryModelChoices | undefined,
  geminiEnabled: boolean,
): string {
  const resolved = resolveCategoryStreamModels(modelChoice, categoryModels, geminiEnabled)
  if (resolved?.code) return resolved.code
  if (resolved) return pickStreamModelForTask('code', resolved, resolveModelId(modelChoice, { geminiEnabled }))
  return resolveModelId(modelChoice, { geminiEnabled })
}
