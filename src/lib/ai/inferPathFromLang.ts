/** Ruta por defecto cuando el bloque ``` no incluye path explícito. */
export function inferPathFromLang(
  lang: string,
  options: { defaultPath: string; knownPaths: string[] },
): string {
  const l = lang.toLowerCase()
  const known = options.knownPaths

  if (l === 'react' || l === 'tsx' || l === 'typescript' || l === 'jsx' || l === 'javascript') {
    return options.defaultPath
  }

  if (l === 'css') {
    return known.find((p) => p.endsWith('.css')) ?? 'src/styles/app.css'
  }
  if (l === 'json') {
    return known.find((p) => p.endsWith('.json') && !p.includes('tsconfig')) ?? 'package.json'
  }
  if (l === 'html') {
    return known.find((p) => p.endsWith('.html')) ?? 'index.html'
  }
  if (l === 'markdown' || l === 'md') {
    return known.find((p) => p.endsWith('.md')) ?? 'README.md'
  }

  return options.defaultPath
}

const DEFAULT_EXPORT_FN = /export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/
const NAMED_FN = /function\s+([A-Z][a-zA-Z0-9]*)\s*\(/

function extForLang(lang: string): string {
  const l = lang.toLowerCase()
  if (l === 'jsx' || l === 'javascript') return '.jsx'
  return '.tsx'
}

/** Infiere ruta a partir del contenido cuando el fence no trae path (evita pisar App.tsx). */
export function inferPathFromCodeBlock(
  lang: string,
  content: string,
  options: { defaultPath: string; knownPaths: string[] },
): string {
  const l = lang.toLowerCase()
  const isComponentLang =
    l === 'react' || l === 'tsx' || l === 'typescript' || l === 'jsx' || l === 'javascript'

  if (!isComponentLang) {
    return inferPathFromLang(lang, options)
  }

  const trimmed = content.trim()
  const exportFn = trimmed.match(DEFAULT_EXPORT_FN)?.[1]
  const namedFn = trimmed.match(NAMED_FN)?.[1]
  const componentName = exportFn ?? namedFn

  if (componentName && componentName !== 'App') {
    const ext = extForLang(lang)
    const pagesPath = `src/pages/${componentName}${ext}`
    const componentsPath = `src/components/${componentName}${ext}`

    if (options.knownPaths.includes(pagesPath)) return pagesPath
    if (options.knownPaths.includes(componentsPath)) return componentsPath

    if (/Page$/i.test(componentName) || /View$/i.test(componentName)) {
      return pagesPath
    }
    if (options.knownPaths.some((p) => p.startsWith('src/pages/'))) {
      return pagesPath
    }
    return componentsPath
  }

  return inferPathFromLang(lang, options)
}
