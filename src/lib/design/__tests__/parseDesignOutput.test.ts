import { describe, it, expect } from 'vitest'
import { parseDesignGeneration } from '@/lib/design/parseDesignOutput'

describe('parseDesignGeneration', () => {
  it('parses design.json and html blocks', () => {
    const text = `
\`\`\`json spec/design.json
{"version":1,"title":"Test","summary":"s","tokens":{}}
\`\`\`

\`\`\`html design/site/index.html
<!DOCTYPE html><html><body><h1 data-sk-id="sk-1">Hi</h1></body></html>
\`\`\`
`
    const { files, spec } = parseDesignGeneration(text)
    expect(files.some((f) => f.path === 'design/site/index.html')).toBe(true)
    expect(spec?.title).toBe('Test')
  })
})
