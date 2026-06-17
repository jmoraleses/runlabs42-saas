import type { Monaco } from '@monaco-editor/react'

const SYNTAX_PREF_KEY = 'studio_monaco_syntax'
let configured = false

export function isStudioMonacoSyntaxEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(SYNTAX_PREF_KEY) !== '0'
  } catch {
    return true
  }
}

export function setStudioMonacoSyntaxEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SYNTAX_PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Configura Monaco en Studio; validación sintáctica opcional (semántica desactivada). */
export function configureStudioMonaco(
  monaco: Monaco,
  opts?: { syntaxValidation?: boolean },
): void {
  if (configured) return
  configured = true

  const syntaxOn = opts?.syntaxValidation ?? isStudioMonacoSyntaxEnabled()

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.React,
    allowNonTsExtensions: true,
    allowJs: true,
    target: monaco.languages.typescript.ScriptTarget.Latest,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  })
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: !syntaxOn,
  })
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: !syntaxOn,
  })
}

export function monacoLanguageForPath(path?: string, fallback = 'typescript'): string {
  if (!path) return fallback
  const lower = path.toLowerCase()
  if (lower.endsWith('.tsx') || lower.endsWith('.ts')) return 'typescript'
  if (lower.endsWith('.jsx') || lower.endsWith('.js') || lower.endsWith('.mjs')) return 'javascript'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.html')) return 'html'
  return fallback
}
