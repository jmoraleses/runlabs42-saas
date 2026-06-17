import type { CodeTemplate } from '@/lib/codeTemplates'
import { buildVercelJson } from '@/lib/publish/vercelConfig'

/** Archivos subidos a Vercel (excluye export/ pesado de CMS). */
export function filterDeployableFiles(
  files: Array<{ path: string; content: string }>,
  codeTemplate: CodeTemplate,
): Array<{ path: string; content: string }> {
  const out = files.filter((f) => {
    const p = f.path.replace(/^\/+/, '')
    if (p.startsWith('design/')) return false
    if (p === 'spec/design.md') return false
    if (p.startsWith('export/')) return false
    if (p.startsWith('spec/design') && p !== 'spec/design.json') return false
    return true
  })

  const hasVercel = out.some((f) => f.path === 'vercel.json')
  if (!hasVercel) {
    out.push({ path: 'vercel.json', content: buildVercelJson(codeTemplate) })
  }

  return out
}
