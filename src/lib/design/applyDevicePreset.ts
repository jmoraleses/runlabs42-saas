import {
  DESIGN_BREAKPOINT_PRESETS,
  type DesignPreviewBreakpoint,
} from '@/lib/design/breakpoints'
import { autoLayoutPages, mergePagesIntoSpec, resolveDesignPages } from '@/lib/design/pages'
import { DESIGN_SPEC_JSON, type DesignSpec } from '@/lib/design/types'

const DESKTOP_LAYOUT_GUARD = `<style data-runlabs42-device-guard="desktop">
html, body { width: 100%; max-width: none; margin: 0; }
body { min-height: 100vh; }
body > header, body > nav, body > main, body > footer,
body > .page, body > .app, body > #app, body > #root {
  width: 100%;
  max-width: min(1280px, 100%);
  margin-left: auto;
  margin-right: auto;
  box-sizing: border-box;
}
</style>`

/** Refuerza ancho completo en HTML desktop cuando el modelo dejó layout móvil estrecho. */
export function normalizeDesignHtmlForDevice(
  html: string,
  device: DesignPreviewBreakpoint,
): string {
  if (device !== 'desktop' || html.includes('data-runlabs42-device-guard')) {
    return html
  }
  if (html.includes('</head>')) {
    return html.replace('</head>', `${DESKTOP_LAYOUT_GUARD}</head>`)
  }
  if (html.includes('<body')) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${DESKTOP_LAYOUT_GUARD}`)
  }
  return html
}

/** Aplica dimensiones del dispositivo a páginas en spec/design.json tras generar. */
export function applyDevicePresetToDesignFiles(
  files: Array<{ path: string; content: string }>,
  device: DesignPreviewBreakpoint,
): Array<{ path: string; content: string }> {
  const { width } = DESIGN_BREAKPOINT_PRESETS[device]
  const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const pages = resolveDesignPages(files, specRaw).map((p) => {
    if (p.frameType === 'prototype' || p.frameType === 'designSystem') return p
    // Solo ancho del dispositivo; la altura queda por pantalla (contenido / plan).
    return { ...p, width }
  })
  const laidOut = autoLayoutPages(pages)
  let spec: DesignSpec | null = null
  if (specRaw) {
    try {
      spec = JSON.parse(specRaw) as DesignSpec
    } catch {
      spec = null
    }
  }
  const specContent = mergePagesIntoSpec(
    spec ? { ...spec, targetDevice: device } : null,
    laidOut,
  )
  return files.map((f) => {
    if (f.path === DESIGN_SPEC_JSON) return { ...f, content: specContent }
    if (f.path.endsWith('.html')) {
      return { ...f, content: normalizeDesignHtmlForDevice(f.content, device) }
    }
    return f
  })
}
