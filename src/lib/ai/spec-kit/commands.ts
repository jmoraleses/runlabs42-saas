import type { AICommand } from '@/types'
import type { SpecKitPhase } from '@/lib/ai/spec-kit/artifacts'

const SPECKIT_COMMANDS = [
  '/speckit.constitution',
  '/speckit.specify',
  '/speckit.plan',
  '/speckit.tasks',
  '/speckit.implement',
  '/speckit.clarify',
] as const

export type SpeckitCommand = (typeof SPECKIT_COMMANDS)[number]

const PHASE_BY_COMMAND: Record<SpeckitCommand, SpecKitPhase | 'clarify'> = {
  '/speckit.constitution': 'constitution',
  '/speckit.specify': 'specify',
  '/speckit.plan': 'plan',
  '/speckit.tasks': 'tasks',
  '/speckit.implement': 'implement',
  '/speckit.clarify': 'clarify',
}

const LEGACY_TO_PHASE: Record<string, SpecKitPhase | 'clarify'> = {
  '/plan': 'plan',
  '/spec': 'specify',
  '/build': 'implement',
}

export function parseSpeckitCommand(input: string): {
  phase: SpecKitPhase | 'clarify'
  prompt: string
  command: AICommand['command']
} | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const [cmd, ...rest] = trimmed.split(/\s+/)
  if (!cmd) return null
  const lower = cmd.toLowerCase()
  const prompt = rest.join(' ').trim()

  if (SPECKIT_COMMANDS.includes(lower as SpeckitCommand)) {
    const phase = PHASE_BY_COMMAND[lower as SpeckitCommand]
    const command =
      phase === 'implement'
        ? '/build'
        : phase === 'specify'
          ? '/spec'
          : phase === 'plan'
            ? '/plan'
            : '/build'
    return { phase, prompt, command }
  }

  const legacy = LEGACY_TO_PHASE[lower]
  if (legacy) {
    return {
      phase: legacy,
      prompt,
      command: lower as AICommand['command'],
    }
  }

  return null
}

export function phaseToStreamCommand(phase: SpecKitPhase | 'clarify'): AICommand['command'] {
  if (phase === 'specify') return '/spec'
  if (phase === 'plan') return '/plan'
  if (phase === 'implement') return '/build'
  if (phase === 'clarify') return '/spec'
  return '/spec'
}

export function isSpeckitCommand(input: string): boolean {
  return parseSpeckitCommand(input) !== null
}
