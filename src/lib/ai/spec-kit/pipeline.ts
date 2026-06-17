import type { AICommand } from '@/types'
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/config'
import { shortModelLabel } from '@/lib/ai/catalog'
import type { PhasePlan } from '@/lib/ai/spec-kit/orchestrator'
import {
  streamGeminiAgent,
  type GeminiImagePart,
  type GeminiStreamContext,
  type GeminiStreamFile,
} from '@/lib/ai/geminiStream'
import { resolvePipelinePhases } from '@/lib/ai/spec-kit/phases'
import {
  artifactUpdatesForPhase,
  EMPTY_ARTIFACTS,
  type SpecKitArtifacts,
  type SpecKitPhase,
} from '@/lib/ai/spec-kit/artifacts'
import { phaseToStreamCommand } from '@/lib/ai/spec-kit/commands'
import { buildSpecKitPhasePrompt } from '@/lib/ai/spec-kit/prompts'
import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import type { SSESend } from '@/lib/ai/geminiStream'
import { generateImagesFromText } from '@/lib/ai/imageGen'
import { emptyTokenUsage, mergeTokenUsage, type TokenUsage } from '@/lib/billing/tokenCredits'

export type PipelineResult = {
  artifacts: SpecKitArtifacts
  fileUpdates: { path: string; content: string }[]
  imageUpdates: { path: string; content: string; mimeType: string }[]
  specContent: string
  lastText: string
  usage: TokenUsage
}

export async function runSpecKitPipeline(opts: {
  userPrompt: string
  projectName?: string
  framework?: string
  files?: GeminiStreamFile[]
  images?: GeminiImagePart[]
  send: SSESend
  modelId?: string
  modelPlan?: PhasePlan
  initialArtifacts?: Partial<SpecKitArtifacts>
  /** Comando resuelto del stream (`/plan`, `/build`, …) — define qué fases ejecutar. */
  streamCommand?: AICommand['command']
  memoryBlock?: string
  chatHistory?: GeminiStreamContext['chatHistory']
  targetPlatforms?: string[]
  thinkingLevel?: GeminiStreamContext['thinkingLevel']
}): Promise<PipelineResult> {
  const fallbackModelId = opts.modelId ?? DEFAULT_GEMINI_MODEL
  const artifacts: SpecKitArtifacts = { ...EMPTY_ARTIFACTS, ...opts.initialArtifacts }
  const fileUpdates: { path: string; content: string }[] = []
  const imageUpdates: { path: string; content: string; mimeType: string }[] = []
  let lastText = ''
  let usage = emptyTokenUsage()

  const phases = resolvePipelinePhases(opts.streamCommand ?? '/build')

  for (const phase of phases) {
    const phaseModelId = opts.modelPlan?.[phase] ?? fallbackModelId
    opts.send('phase', phase)
    opts.send('phase-model', JSON.stringify({ phase, modelId: phaseModelId, label: shortModelLabel(phaseModelId) }))

    const phasePrompt = buildSpecKitPhasePrompt(phase, opts.userPrompt, artifacts, {
      framework: opts.framework,
      projectName: opts.projectName,
    })

    const command: AICommand = {
      command: phaseToStreamCommand(phase),
      prompt: phasePrompt,
    }

    const { fullText, usage: phaseUsage } = await streamGeminiAgent(
      command,
      {
        projectName: opts.projectName,
        framework: opts.framework,
        files: opts.files,
        specKitArtifacts: artifacts,
        images: phase === 'specify' || phase === 'implement' ? opts.images : undefined,
        useSpecKit: true,
        memoryBlock: opts.memoryBlock,
        chatHistory: opts.chatHistory,
        targetPlatforms: opts.targetPlatforms,
        thinkingLevel: opts.thinkingLevel,
      },
      opts.send,
      phaseModelId,
    )

    lastText = fullText
    usage = mergeTokenUsage(usage, phaseUsage)

    if (phase === 'specify') {
      artifacts.spec = fullText
      fileUpdates.push(...artifactUpdatesForPhase('specify', fullText))
    } else if (phase === 'implement') {
      const ops = parseFileOperationsFromStream(fullText, {
        defaultPath: 'src/App.tsx',
        existingPaths: opts.files?.map((f) => f.path) ?? [],
      })
      for (const op of ops) {
        if (op.type !== 'delete') fileUpdates.push({ path: op.path, content: op.content })
      }

      // Generar imágenes con Nano Banana (Vertex AI Agent Platform)
      const images = await generateImagesFromText(fullText, opts.send)
      imageUpdates.push(...images)
    } else {
      const updates = artifactUpdatesForPhase(phase, fullText)
      fileUpdates.push(...updates)
      if (phase === 'constitution') artifacts.constitution = fullText
      if (phase === 'plan') artifacts.plan = fullText
      if (phase === 'tasks') artifacts.tasks = fullText
    }
  }

  return {
    artifacts,
    fileUpdates,
    imageUpdates,
    specContent: artifacts.spec,
    lastText,
    usage,
  }
}
