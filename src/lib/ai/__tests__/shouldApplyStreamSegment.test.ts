import { describe, expect, it } from 'vitest'
import { shouldApplyStreamSegment } from '@/lib/ai/shouldApplyStreamSegment'

describe('shouldApplyStreamSegment', () => {
  it('rechaza segmento incompleto si ya hay contenido', () => {
    expect(
      shouldApplyStreamSegment(
        { complete: false, content: 'export default' },
        { content: 'export default function App() { return <main /> }' },
      ),
    ).toBe(false)
  })

  it('acepta segmento incompleto en archivo vacío', () => {
    expect(shouldApplyStreamSegment({ complete: false, content: 'export' }, null)).toBe(true)
  })

  it('acepta segmento completo aunque haya contenido previo', () => {
    expect(
      shouldApplyStreamSegment(
        { complete: true, content: 'export default function App() {}' },
        { content: 'old' },
      ),
    ).toBe(true)
  })
})
