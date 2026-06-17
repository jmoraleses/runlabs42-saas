import { createHash } from 'crypto'

export function hashProjectFiles(
  files: Array<{ path: string; content: string }>,
  opts?: { excludeDesign?: boolean },
): string {
  const sorted = [...files]
    .filter((f) => {
      if (!opts?.excludeDesign) return true
      return !f.path.startsWith('design/') && f.path !== 'spec/design.json' && f.path !== 'spec/design.md'
    })
    .sort((a, b) => a.path.localeCompare(b.path))
  const h = createHash('sha256')
  for (const f of sorted) {
    h.update(f.path)
    h.update('\0')
    h.update(f.content)
    h.update('\0')
  }
  return h.digest('hex').slice(0, 32)
}
