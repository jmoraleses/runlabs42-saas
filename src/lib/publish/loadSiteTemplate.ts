import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export type TemplateFile = { path: string; content: string }

const TEMPLATE_ROOT = join(process.cwd(), 'templates', 'site-next')

export function loadSiteNextTemplate(): TemplateFile[] {
  const files: TemplateFile[] = []
  function walk(dir: string, prefix = '') {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const rel = prefix ? `${prefix}/${name}` : name
      if (statSync(full).isDirectory()) {
        walk(full, rel)
      } else {
        files.push({ path: rel, content: readFileSync(full, 'utf8') })
      }
    }
  }
  walk(TEMPLATE_ROOT)
  return files
}
