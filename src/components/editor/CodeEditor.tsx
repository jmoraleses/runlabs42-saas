'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { loader } from '@monaco-editor/react'
import {
  configureStudioMonaco,
  isStudioMonacoSyntaxEnabled,
  monacoLanguageForPath,
} from '@/lib/editor/monacoSetup'
import type { OnMount } from '@monaco-editor/react'

loader.config({ paths: { vs: '/monaco/vs' } })

const Monaco = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
        background: 'var(--bg)',
        minHeight: 200,
      }}
    >
      Cargando editor…
    </div>
  ),
})

type CodeEditorProps = {
  value: string
  onChange: (value: string) => void
  language?: string
  readOnly?: boolean
  /** Fuerza remount al cambiar de archivo (Monaco no sincroniza bien el value externo). */
  path?: string
}

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  readOnly,
  path,
}: CodeEditorProps) {
  const modelPath = path || 'untitled'
  const displayPathRef = useRef(modelPath)
  const pendingPathRef = useRef<string | null>(null)
  const pathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorPath, setEditorPath] = useState(modelPath)

  useEffect(() => {
    if (modelPath === displayPathRef.current) return
    pendingPathRef.current = modelPath
    if (pathTimerRef.current) clearTimeout(pathTimerRef.current)
    pathTimerRef.current = setTimeout(() => {
      if (pendingPathRef.current) {
        displayPathRef.current = pendingPathRef.current
        setEditorPath(pendingPathRef.current)
        pendingPathRef.current = null
      }
    }, 120)
    return () => {
      if (pathTimerRef.current) clearTimeout(pathTimerRef.current)
    }
  }, [modelPath])

  const theme =
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
      ? 'light'
      : 'vs-dark'
  const monacoLanguage = monacoLanguageForPath(path, language)

  const handleMount: OnMount = (editorInstance, monaco) => {
    configureStudioMonaco(monaco, { syntaxValidation: isStudioMonacoSyntaxEnabled() })
    const dom = editorInstance.getDomNode()
    if (dom) {
      dom.setAttribute('spellcheck', 'false')
      dom.setAttribute('autocorrect', 'off')
      dom.setAttribute('autocapitalize', 'off')
    }
  }

  return (
    <Monaco
      path={editorPath}
      keepCurrentModel
      height="100%"
      className="editor-monaco"
      language={monacoLanguage}
      value={value}
      theme={theme}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        readOnly,
        padding: { top: 12 },
        scrollBeyondLastLine: false,
        renderValidationDecorations: isStudioMonacoSyntaxEnabled() ? 'on' : 'off',
      }}
      onMount={handleMount}
      onChange={(v) => onChange(v ?? '')}
    />
  )
}
