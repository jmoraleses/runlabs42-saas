import 'server-only'

import type { SSESend } from '@/lib/ai/geminiStream'
import { runSpecKitPipeline } from '@/lib/ai/spec-kit/pipeline'
import {
  artifactsFromFiles,
  type SpecKitArtifacts,
} from '@/lib/ai/spec-kit/artifacts'
import { buildSpecKitFullContext } from '@/lib/ai/spec-kit/prompts'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import type { TokenUsage } from '@/lib/billing/tokenCredits'
import {
  DESIGN_BREAKPOINT_PRESETS,
  devicePromptContext,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'
import { DESIGN_PLAN_JSON, type DesignPlanFile } from '@/lib/design/designPlanTypes'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

import { designPlanScreensJsonInstruction } from '@/lib/design/prompts'

export type RunDesignPlanResult = {
  artifacts: SpecKitArtifacts
  fileUpdates: { path: string; content: string }[]
  designPlan: DesignPlanFile | null
  usage: TokenUsage
}

export async function runDesignSpecKitPlan(opts: {
  userPrompt: string
  projectName?: string
  framework?: string
  files?: ProjectFileRecord[]
  modelId?: string
  device?: DesignPreviewBreakpoint
  send?: SSESend
}): Promise<RunDesignPlanResult> {
  const send: SSESend = opts.send ?? (() => {})

  const result = await runSpecKitPipeline({
    userPrompt: opts.userPrompt,
    projectName: opts.projectName,
    framework: opts.framework,
    files: opts.files?.map((f) => ({ path: f.path, content: f.content })),
    send,
    modelId: opts.modelId,
    initialArtifacts: opts.files?.length ? artifactsFromFiles(opts.files) : undefined,
    streamCommand: '/plan',
  })

  const context = buildSpecKitFullContext(result.artifacts, {
    projectName: opts.projectName,
    framework: opts.framework,
  })

  let designPlan: DesignPlanFile | null = null
  try {
    const device = opts.device ?? 'desktop'
    const raw = await generateAgentPlatformText(
      `${opts.userPrompt}${devicePromptContext(device)}\n\n---\n${context}`,
      {
        systemInstruction: designPlanScreensJsonInstruction(device),
        temperature: 0.35,
        model: process.env.DESIGN_PLAN_MODEL?.trim() || 'gemini-2.5-flash',
      },
    )
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      designPlan = JSON.parse(jsonMatch[0]) as DesignPlanFile
      const { width, height } = DESIGN_BREAKPOINT_PRESETS[device]
      designPlan.screens = (designPlan.screens ?? []).map((s, i) => ({
        ...s,
        width: width,
        height: height,
        x: i * (width + 64),
        y: 0,
      }))
    }
  } catch {
    designPlan = null
  }

  const fileUpdates = [...result.fileUpdates]
  if (designPlan) {
    fileUpdates.push({
      path: DESIGN_PLAN_JSON,
      content: JSON.stringify(designPlan, null, 2),
    })
  }

  return {
    artifacts: result.artifacts,
    fileUpdates,
    designPlan,
    usage: result.usage,
  }
}
