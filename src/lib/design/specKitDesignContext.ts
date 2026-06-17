import {
  artifactsFromFiles,
  type SpecKitArtifacts,
} from '@/lib/ai/spec-kit/artifacts'
import { buildSpecKitFullContext } from '@/lib/ai/spec-kit/prompts'
import { DESIGN_PLAN_JSON, type DesignPlanFile } from '@/lib/design/designPlanTypes'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'

export function loadSpecKitArtifacts(files: ProjectFileRecord[]): SpecKitArtifacts {
  return artifactsFromFiles(files)
}

export function loadDesignPlan(files: ProjectFileRecord[]): DesignPlanFile | null {
  const raw = files.find((f) => f.path === DESIGN_PLAN_JSON)?.content
  if (!raw?.trim()) return null
  try {
    return JSON.parse(raw) as DesignPlanFile
  } catch {
    return null
  }
}

export function buildDesignGenerateContext(
  files: ProjectFileRecord[],
  opts?: { projectName?: string; framework?: string; useSpecKit?: boolean },
): string {
  const useSpecKit = opts?.useSpecKit === true
  const parts: string[] = []
  if (useSpecKit) {
    const artifacts = loadSpecKitArtifacts(files)
    const hasSpecKit = Boolean(
      artifacts.constitution || artifacts.spec || artifacts.plan || artifacts.tasks,
    )
    if (hasSpecKit) {
      parts.push(buildSpecKitFullContext(artifacts, opts))
    }
    const plan = loadDesignPlan(files)
    if (plan?.screens?.length) {
      parts.push(
        `## Plan de pantallas (design-plan.json)\n${JSON.stringify(plan, null, 2)}`,
      )
    }
  }
  if (!parts.length) return ''
  return `\n\n--- Contexto Spec-Kit / plan de diseño ---\n${parts.join('\n\n')}\n--- Fin contexto ---\n`
}
