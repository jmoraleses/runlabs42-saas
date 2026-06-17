/** Mensaje `postMessage` desde el iframe de preview hacia el Studio. */
export const PREVIEW_RUNTIME_ERROR_TYPE = 'runlabs:preview-runtime-error' as const

export type PreviewRuntimeErrorMessage = {
  type: typeof PREVIEW_RUNTIME_ERROR_TYPE
  message: string
  stack?: string
}

export function isPreviewRuntimeErrorMessage(data: unknown): data is PreviewRuntimeErrorMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.type === PREVIEW_RUNTIME_ERROR_TYPE && typeof d.message === 'string'
}

/** Script inyectado en el srcDoc del preview para reportar errores al padre. */
export function buildPreviewRuntimeBridgeScript(): string {
  const type = PREVIEW_RUNTIME_ERROR_TYPE
  return `
(function () {
  var TYPE = ${JSON.stringify(type)};
  var seen = new Set();
  function report(msg, stack) {
    var text = String(msg || 'Error').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: TYPE, message: text, stack: stack ? String(stack) : '' }, '*');
      }
    } catch (_) {}
  }
  window.addEventListener('error', function (e) {
    report(e.message || e.error, e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    report(r && r.message ? r.message : r, r && r.stack);
  });
})();
`.replace(/<\/script>/gi, '<\\/script>')
}
