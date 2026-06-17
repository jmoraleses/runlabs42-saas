import path from 'node:path'

/** Nombre del componente esperado a partir de `src/pages/Landing.tsx` → `Landing`. */
export function previewComponentName(filePath: string): string | null {
  const base = path.basename(filePath, path.extname(filePath))
  if (base === 'index' || !/^[A-Z]/.test(base)) return null
  return base
}

export function hasDefaultExport(source: string): boolean {
  return /export\s+default\b/.test(source)
}

export function hasNamedComponentExport(source: string, name: string): boolean {
  return (
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`).test(source) ||
    new RegExp(`export\\s+class\\s+${name}\\b`).test(source) ||
    new RegExp(`export\\s+const\\s+${name}\\s*=`).test(source)
  )
}

/** `function App()` sin export (común en código generado por IA). */
export function hasComponentDeclaration(source: string, name: string): boolean {
  if (hasNamedComponentExport(source, name)) return true
  return (
    new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?function\\s+${name}\\s*\\(`).test(source) ||
    new RegExp(`(?:^|\\n)\\s*const\\s+${name}\\s*=`).test(source) ||
    new RegExp(`(?:^|\\n)\\s*class\\s+${name}\\b`).test(source)
  )
}

/** Quita `createRoot(...)` embebido en App.tsx cuando existe `main.tsx` aparte. */
export function stripEmbeddedAppMount(source: string, filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath))
  if (base !== 'App') return source
  const idx = source.search(
    /(?:^|\n)\s*(?:const|let)\s+container\s*=\s*document\.getElementById\s*\(\s*['"]root['"]\s*\)/m,
  )
  if (idx < 0) return source
  return source.slice(0, idx).trimEnd()
}

function cssDeclsToJsxObjectLiteral(css: string): string {
  const parts = css
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const colon = decl.indexOf(':')
      if (colon < 0) return null
      const rawProp = decl.slice(0, colon).trim()
      const rawVal = decl.slice(colon + 1).trim()
      if (!rawProp || !rawVal) return null
      const key = rawProp.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      const val = /^\d+(\.\d+)?$/.test(rawVal)
        ? rawVal
        : `'${rawVal.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
      return `${key}: ${val}`
    })
    .filter((x): x is string => Boolean(x))
  return parts.join(', ')
}

/** Convierte `style="padding: 1rem"` (HTML) a `style={{ padding: '1rem' }}` (React). */
export function normalizeJsxStringStyleAttrs(content: string): string {
  return content.replace(
    /\bstyle\s*=\s*(["'])([^"']*)\1/g,
    (_, _q, css) => `style={{ ${cssDeclsToJsxObjectLiteral(css)} }}`,
  )
}

/**
 * Añade `export default Component` cuando la IA exporta solo el nombre del archivo
 * (`export function Landing`) y App importa `import Landing from './pages/Landing'`.
 */
export function normalizePreviewModuleSource(content: string, filePath: string): string {
  const ext = path.extname(filePath)
  if (!['.tsx', '.ts', '.jsx', '.js'].includes(ext)) return content

  let next = ['.tsx', '.jsx'].includes(ext) ? normalizeJsxStringStyleAttrs(content) : content
  next = stripEmbeddedAppMount(next, filePath)

  const name = previewComponentName(filePath)
  if (!name || hasDefaultExport(next)) return next
  if (!hasComponentDeclaration(next, name)) return next
  return `${next.trimEnd()}\nexport default ${name}\n`
}
