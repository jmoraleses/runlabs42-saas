import { describe, expect, it } from 'vitest'
import { appendTranscript } from '@/lib/speech/appendTranscript'

describe('appendTranscript', () => {
  it('returns chunk when current is empty', () => {
    expect(appendTranscript('', 'hola mundo')).toBe('hola mundo')
  })

  it('appends with space', () => {
    expect(appendTranscript('Hola', 'mundo')).toBe('Hola mundo')
  })

  it('does not add extra space when current ends with space', () => {
    expect(appendTranscript('Hola ', 'mundo')).toBe('Hola mundo')
  })
})
