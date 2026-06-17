import { describe, expect, it } from 'vitest'
import { simplifyMarkdownTablesForChat } from '@/lib/chat/simplifyMarkdownTables'

describe('simplifyMarkdownTablesForChat', () => {
  it('converts wide plan tables to vertical cards', () => {
    const input = `
## Plan

| ID | Task | Dependencies | Effort | File |
| --- | --- | --- | --- | --- |
| 5 | Asegurar botones | 1, 2 | Small | src/components/CTA.tsx |
| 6 | Testing visual | 1, 2, 4, 5 | Medium | N/A |
`.trim()

    const out = simplifyMarkdownTablesForChat(input)
    expect(out).not.toContain('| --- |')
    expect(out).toContain('##### 5 — Asegurar botones')
    expect(out).toContain('**Dependencies:** 1, 2')
    expect(out).toContain('##### 6 — Testing visual')
  })

  it('leaves non-table markdown unchanged', () => {
    const text = 'Hola **mundo**\n\n- item uno'
    expect(simplifyMarkdownTablesForChat(text)).toBe(text)
  })
})
