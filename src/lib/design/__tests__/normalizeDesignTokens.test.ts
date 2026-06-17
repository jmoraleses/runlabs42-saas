import { describe, expect, it } from 'vitest'
import { applyThemeToHtml } from '@/lib/design/applyThemeToHtml'
import {
  envelopeFromModelJson,
  envelopeToTokensJson,
  mergeOrchestrationEnvelopes,
  normalizeOrchestrationTokens,
  orchestrationEnvelopeHasContent,
  specTokensFromEnvelope,
} from '@/lib/design/normalizeDesignTokens'
import type { DesignSpec } from '@/lib/design/types'

describe('normalizeDesignTokens', () => {
  it('maps accent to tertiary and typography to fonts', () => {
    const raw = {
      brand: { concept: 'Botanical Minimal', tone: 'orgánico' },
      tokens: {
        colors: {
          primary: '#2d5016',
          accent: '#c4a574',
          background: '#faf8f5',
          text: '#1a1a1a',
        },
        typography: { heading: 'Playfair Display', body: 'Montserrat' },
        ui: { borderRadius: '16px', spacingUnit: '8px' },
      },
    }

    const tokens = normalizeOrchestrationTokens(raw)
    expect(tokens.colors?.tertiary).toBe('#c4a574')
    expect(tokens.colors?.accent).toBeUndefined()
    expect(tokens.fonts?.heading).toContain('Playfair Display')
    expect(tokens.fonts?.body).toContain('Montserrat')
    expect(tokens.radius).toBe('16px')
  })

  it('merges phased envelopes into canonical JSON', () => {
    const merged = mergeOrchestrationEnvelopes(
      {
        brand: { concept: 'Cactus Haven' },
        tokens: { colors: { primary: '#2d5016', tertiary: '#c4a574' } },
      },
      {
        tokens: {
          typography: { heading: 'Syne', body: 'Inter' },
          ui: { borderRadius: '12px' },
        },
      },
    )
    const json = envelopeToTokensJson(merged)
    expect(json).toContain('Cactus Haven')
    expect(json).toContain('Syne')
    expect(specTokensFromEnvelope(merged).colors?.primary).toBe('#2d5016')
  })

  it('feeds applyThemeToHtml with tertiary CSS variable', () => {
    const envelope = mergeOrchestrationEnvelopes(
      { tokens: { colors: { primary: '#2d5016', tertiary: '#c4a574', text: '#111', background: '#fff' } } },
      { tokens: { typography: { heading: 'Syne', body: 'Inter' } } },
    )
    const spec: DesignSpec = {
      version: 2,
      title: 'Test',
      summary: '',
      targetDevice: 'desktop',
      tokens: specTokensFromEnvelope(envelope),
      pages: [],
    }
    const html = applyThemeToHtml('<html><head></head><body></body></html>', spec)
    expect(html).toContain('--color-tertiary: #c4a574')
    expect(html).toContain('--color-primary: #2d5016')
  })

  it('parsea JSON en bloques markdown para envelopeFromModelJson', () => {
    const text = '```json\n{"brand":{"concept":"Test"},"tokens":{"colors":{"primary":"#111111"}}}\n```'
    const envelope = envelopeFromModelJson(text)
    expect(orchestrationEnvelopeHasContent(envelope)).toBe(true)
    expect(envelope.brand?.concept).toBe('Test')
  })

  it('orchestrationEnvelopeHasContent acepta parches parciales de tipografía', () => {
    expect(
      orchestrationEnvelopeHasContent({
        tokens: { typography: { heading: 'Syne', body: 'Inter' } },
      }),
    ).toBe(true)
  })
})
