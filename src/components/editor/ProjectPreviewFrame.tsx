'use client'

import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { useApp } from '@/components/app/shell'
import { previewExtraCdnScriptTags } from '@/lib/preview/previewCdn'
import { previewFilesKey } from '@/lib/preview/previewFilesKey'
import {
  buildPreviewRuntimeBridgeScript,
  isPreviewRuntimeErrorMessage,
} from '@/lib/preview/previewRuntimeBridge'
import { buildPublicAssetInjectionScript } from '@/lib/projects/workspaceMedia'
import { PREVIEW_LEGAL_STRIP_SCRIPT } from '@/lib/preview/stripLegalBoilerplate'
import { VISUAL_EDIT_BRIDGE_SCRIPT } from '@/lib/visual-edit/bridgeScript'

const RUNTIME_OK_DELAY_MS = 450

type ProjectPreviewFrameProps = {
  files: Array<{ path: string; content: string }>
  /** Se llama con el texto del error cuando la compilación falla. */
  onCompileError?: (error: string) => void
  /** Se llama cuando la compilación vuelve a ser correcta. */
  onCompileOk?: () => void
  /** Paquetes del preview sustituidos por stubs (avisar en consola, no en la vista). */
  onPreviewStubPackages?: (packages: string[]) => void
  /** Ancho simulado del dispositivo. */
  viewport?: 'sm' | 'md' | 'lg'
  onIframeLoad?: () => void
}

const VIEWPORT_WIDTH: Record<'sm' | 'md' | 'lg', number | null> = {
  sm: 390,
  md: 768,
  lg: null,
}

const SK_TAGGER_SCRIPT = `
(function () {
  var ATTR = 'data-sk-id';
  var counter = 0;
  var INTERACTIVE = { INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, A: 1, LABEL: 1 };
  function shouldTag(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id === 'sk-selection-overlay' || el.closest('#sk-selection-overlay')) return false;
    if (el.id === 'root') return false;
    if (el.getAttribute(ATTR)) return false;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'HEAD') return false;
    if (INTERACTIVE[tag]) return true;
    if (tag === 'INPUT' || tag === 'IMG') return true;
    var text = (el.textContent || '').trim();
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      var v = (el.value || el.getAttribute('placeholder') || '').trim();
      return v.length > 0 && v.length < 400;
    }
    if (!text || text.length > 800) return false;
    var kids = el.children;
    if (kids.length === 0) return true;
    if (kids.length <= 2 && el.childNodes.length <= 3) return true;
    return false;
  }
  function tagTree() {
    document.querySelectorAll('body *').forEach(function (el) {
      if (shouldTag(el)) el.setAttribute(ATTR, 'sk-' + (++counter));
    });
  }
  tagTree();
  var obs = new MutationObserver(function () { tagTree(); });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setInterval(tagTree, 800);
})();
`

function buildSrcDoc(
  js: string,
  css: string,
  files: Array<{ path: string; content: string }> = [],
): string {
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>')
  const safeBridge = VISUAL_EDIT_BRIDGE_SCRIPT.replace(/<\/script>/gi, '<\\/script>')
  const safeLegalStrip = PREVIEW_LEGAL_STRIP_SCRIPT.replace(/<\/script>/gi, '<\\/script>')
  const safeTagger = SK_TAGGER_SCRIPT.replace(/<\/script>/gi, '<\\/script>')
  const safeAssets = buildPublicAssetInjectionScript(files).replace(/<\/script>/gi, '<\\/script>')
  const safeRuntimeBridge = buildPreviewRuntimeBridgeScript()
  const extraCdn = previewExtraCdnScriptTags(files)
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;padding:0;font-family:system-ui,sans-serif}#root{min-height:100vh}</style>
    <style>${css}</style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
    ${extraCdn}
  </head>
  <body>
    <div id="root"></div>
    <script>
      if (!window.React?.createElement || !window.ReactDOM?.createRoot) {
        document.body.innerHTML = '<p style="padding:16px;color:#b91c1c;font:14px system-ui">No se pudo cargar React en el preview. Recarga la página o revisa la conexión.</p>';
        throw new Error('React CDN unavailable');
      }
    </script>
    <script>${safeRuntimeBridge}</script>
    <script>${safeAssets}</script>
    <script>${safeJs}</script>
    <script>${safeBridge}</script>
    <script>${safeTagger}</script>
    <script>${safeLegalStrip}</script>
  </body>
</html>`
}

export const ProjectPreviewFrame = forwardRef<HTMLIFrameElement, ProjectPreviewFrameProps>(
  function ProjectPreviewFrame(
    { files, onCompileError, onCompileOk, onPreviewStubPackages, viewport = 'lg', onIframeLoad },
    ref,
  ) {
    const { t } = useApp() as { t: (key: string) => string }
    const [doc, setDoc] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [stubPackages, setStubPackages] = useState<string[]>([])
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const runtimeOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const runtimeErrorPendingRef = useRef(false)
    const lastReportedErrorRef = useRef<string | null>(null)
    const lastStubKeyRef = useRef('')
    const cbRef = useRef({ onCompileError, onCompileOk, onPreviewStubPackages })
    cbRef.current = { onCompileError, onCompileOk, onPreviewStubPackages }

    function clearRuntimeOkTimer() {
      if (runtimeOkTimer.current) {
        clearTimeout(runtimeOkTimer.current)
        runtimeOkTimer.current = null
      }
    }

    function scheduleRuntimeOkCheck() {
      clearRuntimeOkTimer()
      runtimeErrorPendingRef.current = false
      runtimeOkTimer.current = setTimeout(() => {
        if (!runtimeErrorPendingRef.current) {
          cbRef.current.onCompileOk?.()
        }
      }, RUNTIME_OK_DELAY_MS)
    }

    function reportRuntimeError(message: string, stack?: string) {
      runtimeErrorPendingRef.current = true
      clearRuntimeOkTimer()
      const text = stack?.trim() ? `${message}\n${stack}` : message
      console.error('[Preview runtime error]', text)
      if (lastReportedErrorRef.current !== text) {
        lastReportedErrorRef.current = text
        cbRef.current.onCompileError?.(text)
      }
    }

    const filesKey = previewFilesKey(files)
    const filesRef = useRef(files)
    filesRef.current = files

    useEffect(() => {
      lastReportedErrorRef.current = null
      lastStubKeyRef.current = ''
      runtimeErrorPendingRef.current = false
      clearRuntimeOkTimer()
    }, [filesKey])

    useEffect(() => {
      const key = stubPackages.join(',')
      if (!key || key === lastStubKeyRef.current) return
      lastStubKeyRef.current = key
      cbRef.current.onPreviewStubPackages?.(stubPackages)
    }, [stubPackages])

    useEffect(() => {
      const onMessage = (event: MessageEvent) => {
        if (!isPreviewRuntimeErrorMessage(event.data)) return
        reportRuntimeError(event.data.message, event.data.stack)
      }
      window.addEventListener('message', onMessage)
      return () => window.removeEventListener('message', onMessage)
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reportRuntimeError estable vía refs
    }, [])

    useEffect(() => {
      const snapshot = filesRef.current
      if (!snapshot.length) {
        setDoc(null)
        setError(null)
        setLoading(false)
        return
      }
      const controller = new AbortController()
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        setLoading(true)
        let abortedByTimeout = false
        const bundleTimeout = window.setTimeout(() => {
          abortedByTimeout = true
          controller.abort()
        }, 90_000)
        try {
          const res = await fetch('/api/preview/bundle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: snapshot }),
            signal: controller.signal,
          })
          const data = (await res.json()) as {
            js: string
            css: string
            error: string | null
            html?: string
            stubPackages?: string[]
          }
          setStubPackages(data.stubPackages ?? [])
          if (!res.ok) {
            const msg = data?.error ?? 'No se pudo compilar el preview'
            setError(msg)
            if (lastReportedErrorRef.current !== msg) {
              lastReportedErrorRef.current = msg
              cbRef.current.onCompileError?.(msg)
            }
            setLoading(false)
            return
          }
          if (data.error) {
            setError(data.error)
            setDoc(data.css ? buildSrcDoc('', data.css, snapshot) : null)
            if (lastReportedErrorRef.current !== data.error) {
              lastReportedErrorRef.current = data.error
              cbRef.current.onCompileError?.(data.error)
            }
          } else {
            setError(null)
            lastReportedErrorRef.current = null
            runtimeErrorPendingRef.current = false
            clearRuntimeOkTimer()
            // HTML-first project (vanilla HTML / game): use the HTML directly
            setDoc(data.html ?? buildSrcDoc(data.js, data.css, snapshot))
          }
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') {
            if (!abortedByTimeout) return
            const msg = 'La compilación del preview tardó demasiado.'
            setError(msg)
            cbRef.current.onCompileError?.(msg)
            return
          }
          setError(e instanceof Error ? e.message : 'Error de red al compilar')
        } finally {
          window.clearTimeout(bundleTimeout)
          setLoading(false)
        }
      }, 600)
      return () => {
        controller.abort()
        if (timer.current) clearTimeout(timer.current)
        clearRuntimeOkTimer()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- filesKey resume el contenido; snapshot vía ref
    }, [filesKey])

    if (!files.length) return null

    const width = VIEWPORT_WIDTH[viewport]
    const framed = width != null

    return (
      <div
        className={`editor-sandbox-root${framed ? ' editor-sandbox-root--framed' : ''}`}
        data-files-key={filesKey}
      >
        {doc ? (
          <iframe
            ref={ref}
            className="editor-preview-iframe-el"
            title="Vista previa del proyecto"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            srcDoc={doc}
            onLoad={() => {
              scheduleRuntimeOkCheck()
              onIframeLoad?.()
            }}
            style={framed ? { width, maxWidth: '100%' } : undefined}
          />
        ) : (
          <div className="editor-sandbox-loading">
            {loading ? t('ed.previewCompiling') : t('ed.previewEmpty')}
          </div>
        )}
        {loading && doc ? (
          <div className="editor-preview-recompiling">{t('ed.previewUpdating')}</div>
        ) : null}
      </div>
    )
  },
)
