import { describe, expect, it } from 'vitest'
import { assistantErrorContent, formatStreamErrorMessage } from '@/lib/ai/streamErrors'

describe('streamErrors', () => {
  it('formatea 402 como créditos', () => {
    expect(formatStreamErrorMessage(402)).toContain('créditos')
  })

  it('prefija mensajes de asistente', () => {
    expect(assistantErrorContent('falló')).toBe('⚠️ falló')
    expect(assistantErrorContent('⚠️ ya')).toBe('⚠️ ya')
  })
})
