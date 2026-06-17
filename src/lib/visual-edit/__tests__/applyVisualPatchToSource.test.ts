import { describe, expect, it } from 'vitest'
import { applyVisualPatchToSource } from '@/lib/visual-edit/applyVisualPatchToSource'

describe('applyVisualPatchToSource', () => {
  it('reemplaza texto previo en HTML', () => {
    const code = '<label>Nombre</label><input placeholder="Tu nombre" />'
    const r = applyVisualPatchToSource(
      code,
      { skId: 'sk-1', property: 'text', value: 'Nombre completo' },
      { skId: 'sk-1', tagName: 'label', text: 'Nombre' },
    )
    expect(r.applied).toBe(true)
    expect(r.code).toContain('Nombre completo')
  })

  it('actualiza input con data-sk-id', () => {
    const code = '<input data-sk-id="sk-3" placeholder="Tu nombre" />'
    const r = applyVisualPatchToSource(
      code,
      { skId: 'sk-3', property: 'text', value: 'Javier' },
      { skId: 'sk-3', tagName: 'input', text: 'Tu nombre' },
    )
    expect(r.applied).toBe(true)
    expect(r.code).toContain('Javier')
  })
})
