import type { AICommand } from '@/types'
import { parseSpeckitCommand } from '@/lib/ai/spec-kit/commands'

const COMMANDS = ['/plan', '/spec', '/build', '/review', '/css', '/mobile-fix'] as const

export type ParsedCommand = AICommand & { raw: string }

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const speckit = parseSpeckitCommand(trimmed)
  if (speckit) {
    return {
      command: speckit.command,
      prompt: speckit.prompt,
      raw: trimmed,
    }
  }

  const [cmd, ...rest] = trimmed.split(/\s+/)
  if (!cmd) return null
  const command = cmd.toLowerCase() as ParsedCommand['command']
  if (!COMMANDS.includes(command)) return null

  return {
    command,
    prompt: rest.join(' ').trim(),
    raw: trimmed,
  }
}

export function isAICommand(input: string): boolean {
  return parseCommand(input) !== null
}
