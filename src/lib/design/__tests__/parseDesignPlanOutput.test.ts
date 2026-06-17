import { describe, expect, it } from 'vitest'
import { parseDesignPlanOutput } from '@/lib/design/parseDesignOutput'

describe('parseDesignPlanOutput', () => {
  it('acepta plan sin HTML (solo spec + md)', () => {
    const text = `\`\`\`json spec/design.json
{
  "version": 2,
  "title": "Tienda",
  "summary": "Demo",
  "targetDevice": "desktop",
  "source": "vertex",
  "pages": [
    { "id": "home", "name": "Inicio", "path": "design/site/index.html", "width": 1280, "height": 1600, "media": "html" }
  ]
}
\`\`\`

\`\`\`markdown spec/design.md
# Tienda
\`\`\``
    const out = parseDesignPlanOutput(text)
    expect(out.pipeline).toBe('html')
    expect(out.spec?.pages).toHaveLength(1)
    expect(out.files.some((f) => f.path === 'design/site/index.html')).toBe(false)
  })

  it('rechaza plan sin páginas', () => {
    expect(() =>
      parseDesignPlanOutput('```json spec/design.json\n{"version":2,"pages":[]}\n```'),
    ).toThrow(/plan no generó/i)
  })
})
