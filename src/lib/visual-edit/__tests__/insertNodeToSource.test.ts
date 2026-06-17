import { describe, expect, it } from 'vitest'
import { insertNodeToSource } from '@/lib/visual-edit/insertNodeToSource'
import type { ElementDescriptor } from '@/lib/visual-edit/protocol'

const el: ElementDescriptor = {
  skId: 'sk-new1',
  tagName: 'p',
  rect: { top: 0, left: 0, width: 10, height: 10 },
  styles: {},
}

describe('insertNodeToSource', () => {
  it('inserta párrafo antes de </main> en JSX', () => {
    const code = `export default function App() {
  return (
    <main>
      <h1 data-sk-id="sk-h1">Hi</h1>
    </main>
  )
}`
    const { code: next, applied } = insertNodeToSource(
      code,
      { kind: 'text', skId: 'sk-new1', text: 'Nuevo texto' },
      el,
    )
    expect(applied).toBe(true)
    expect(next).toContain('<p data-sk-id="sk-new1">Nuevo texto</p>')
    expect(next.indexOf('sk-new1')).toBeLessThan(next.indexOf('</main>'))
  })

  it('inserta sección con style objeto JSX', () => {
    const code = `export default function App() {
  return (
    <main>
    </main>
  )
}`
    const { code: next } = insertNodeToSource(
      code,
      { kind: 'section', skId: 'sk-sec1' },
      { ...el, skId: 'sk-sec1', tagName: 'div' },
    )
    expect(next).toContain("style={{ minHeight: '48px', padding: '12px' }}")
    expect(next).not.toMatch(/style="[^"]*"/)
  })

  it('inserta hijo tras padre con data-sk-id', () => {
    const code = '<section data-sk-id="sk-sec"><p data-sk-id="sk-old">Old</p></section>'
    const { code: next, applied } = insertNodeToSource(
      code,
      { kind: 'text', skId: 'sk-new2', parentSkId: 'sk-sec' },
      { ...el, skId: 'sk-new2' },
    )
    expect(applied).toBe(true)
    expect(next).toMatch(/<section[^>]*data-sk-id="sk-sec"[^>]*>[\s\S]*<p data-sk-id="sk-new2"/)
  })
})
