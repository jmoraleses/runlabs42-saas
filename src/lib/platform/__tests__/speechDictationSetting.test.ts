import { describe, expect, it } from 'vitest'
import { parseSpeechDictationEnabled } from '@/lib/platform/speechDictationSetting'

describe('parseSpeechDictationEnabled', () => {
  it('defaults to enabled when value is missing', () => {
    expect(parseSpeechDictationEnabled(undefined)).toBe(true)
    expect(parseSpeechDictationEnabled(null)).toBe(true)
  })

  it('accepts legacy boolean and string values', () => {
    expect(parseSpeechDictationEnabled(true)).toBe(true)
    expect(parseSpeechDictationEnabled(false)).toBe(false)
    expect(parseSpeechDictationEnabled('true')).toBe(true)
    expect(parseSpeechDictationEnabled('false')).toBe(false)
  })

  it('respects enabled flag', () => {
    expect(parseSpeechDictationEnabled({ enabled: true })).toBe(true)
    expect(parseSpeechDictationEnabled({ enabled: false })).toBe(false)
  })
})
