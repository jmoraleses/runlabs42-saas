import { describe, expect, it } from 'vitest'
import { parseCommand, isAICommand } from '../commandParser'

describe('commandParser', () => {
  it.each(['/plan', '/spec', '/build', '/review', '/css'] as const)(
    'parses %s with prompt',
    (cmd) => {
      const r = parseCommand(`${cmd} do something`)
      expect(r?.command).toBe(cmd)
      expect(r?.prompt).toBe('do something')
      expect(r?.raw).toBe(`${cmd} do something`)
    },
  )

  it('trims input and allows empty prompt', () => {
    expect(parseCommand('  /build  ')?.prompt).toBe('')
    expect(isAICommand(' /plan x')).toBe(true)
  })

  it('rejects unknown or non-command input', () => {
    expect(parseCommand('/unknown x')).toBeNull()
    expect(parseCommand('hello')).toBeNull()
    expect(isAICommand('hello')).toBe(false)
  })
})
