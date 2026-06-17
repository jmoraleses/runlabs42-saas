import type { AICommand } from '@/types'
import type { SpecKitPhase } from '@/lib/ai/spec-kit/artifacts'

export const PIPELINE_PHASES_ALL: SpecKitPhase[] = [
  'constitution',
  'specify',
  'plan',
  'tasks',
  'implement',
]

/**
 * Fases Spec-Kit según el comando del stream.
 * `/plan` y planificación activa no deben ejecutar `implement` (generación de código).
 */
export function resolvePipelinePhases(command: AICommand['command']): SpecKitPhase[] {
  switch (command) {
    case '/plan':
      return ['constitution', 'specify', 'plan', 'tasks']
    case '/spec':
      return ['constitution', 'specify']
    case '/review':
      return ['constitution', 'specify', 'plan']
    default:
      return PIPELINE_PHASES_ALL
  }
}
