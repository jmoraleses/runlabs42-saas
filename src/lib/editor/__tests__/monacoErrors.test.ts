import { describe, expect, it } from 'vitest'
import { isBenignMonacoCancelError } from '@/lib/editor/monacoErrors'

describe('isBenignMonacoCancelError', () => {
  it('detecta Canceled de Monaco', () => {
    expect(isBenignMonacoCancelError(new Error('Canceled'))).toBe(true)
    expect(isBenignMonacoCancelError(new Error('Canceled: Canceled'))).toBe(true)
    expect(isBenignMonacoCancelError('Canceled')).toBe(true)
  })

  it('ignora otros errores', () => {
    expect(isBenignMonacoCancelError(new Error('Network failed'))).toBe(false)
    expect(isBenignMonacoCancelError(null)).toBe(false)
  })
})
