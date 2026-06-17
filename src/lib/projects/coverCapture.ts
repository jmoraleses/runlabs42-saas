/**
 * Captura screenshots de cada página/ruta de la app en el iframe de preview
 * y las sube como imágenes del proyecto.
 */
import { apiFetch } from '@/lib/api/client'
import { isDemoProjectId, updateDemoProject } from '@/lib/auth/demo'
import { VISUAL_EDIT_CHANNEL } from '@/lib/visual-edit/protocol'

/** Ancho de salida de la miniatura (la altura se calcula proporcional a la página). */
const COVER_W = 800
const MAX_PAGES = 5
/** Móvil, tablet y escritorio (null = ancho completo del canvas). */
export const COVER_VIEWPORT_WIDTHS: Array<number | null> = [390, 768, null]

const PREVIEW_IFRAME_SELECTOR = '.editor-preview-iframe, .editor-preview-iframe-el'

type WorkspaceFile = { path: string; content: string }

/** Infiere rutas de la app a partir de los archivos del workspace. */
export function detectRoutes(files?: WorkspaceFile[]): string[] {
  if (!files?.length) return ['/']

  const routes: string[] = []

  for (const { path: p, content } of files) {
    // Next.js / React pages router: (src/)pages/**/*.{jsx,tsx}
    const pagesMatch = p.match(/^(?:src\/)?pages\/(.+)\.[jt]sx?$/)
    if (pagesMatch) {
      const slug = pagesMatch[1] ?? ''
      if (slug === 'index') {
        routes.push('/')
        continue
      }
      if (slug.startsWith('_') || slug.startsWith('api/')) continue
      routes.push(`/${slug}`)
      continue
    }

    // Next.js app router: (src/)app/**/page.{tsx,jsx}
    const appMatch = p.match(/^(?:src\/)?app\/(.+\/)?page\.[jt]sx?$/)
    if (appMatch) {
      const dir = appMatch[1] ?? ''
      if (!dir) {
        routes.push('/')
        continue
      }
      const route = `/${dir.replace(/\/$/, '')}`
      if (!route.includes('(')) routes.push(route)
      continue
    }

    // React Router: <Route path="/about" />
    if (/\.(tsx|jsx|ts|js)$/.test(p)) {
      const routeRe = /<Route\b[^>]*\bpath=["']([^"']+)["']/g
      let m: RegExpExecArray | null
      while ((m = routeRe.exec(content)) !== null) {
        const raw = m[1]
        if (!raw || raw === '*') continue
        routes.push(raw.startsWith('/') ? raw : `/${raw}`)
      }
    }
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  for (const r of routes) {
    const norm = r === '/' ? '/' : `/${r.replace(/^\/+/, '').replace(/\/+$/, '')}`
    if (!seen.has(norm)) {
      seen.add(norm)
      deduped.push(norm)
    }
  }
  const withoutRoot = deduped.filter((r) => r !== '/')
  const result = deduped.includes('/')
    ? ['/', ...withoutRoot]
    : ['/', ...withoutRoot]
  return result.slice(0, MAX_PAGES)
}

/** Iframe oculto solo para captura en pestaña Código; no usar si hay preview visible. */
export function isCoverCaptureHostIframe(iframe: HTMLIFrameElement): boolean {
  return Boolean(iframe.closest('.editor-cover-capture-host'))
}

/**
 * Elige el mejor iframe de una lista (visible antes que host oculto).
 * Exportado para tests sin DOM.
 */
export function pickPreviewIframe(candidates: HTMLIFrameElement[]): HTMLIFrameElement | null {
  if (!candidates.length) return null

  const visible = candidates.filter((el) => !isCoverCaptureHostIframe(el))
  const list = visible.length ? visible : candidates

  for (let i = list.length - 1; i >= 0; i--) {
    const iframe = list[i]
    if (!iframe) continue
    const mount = iframe.contentDocument?.querySelector('#root')
    if (mount && mount.childElementCount > 0) return iframe
  }

  return list[list.length - 1] ?? null
}

/**
 * Devuelve el iframe de preview adecuado para captura.
 * Prioriza el preview visible del canvas; el host oculto queda como fallback.
 */
export function findPreviewIframe(root: ParentNode = document): HTMLIFrameElement | null {
  const all = [...root.querySelectorAll<HTMLIFrameElement>(PREVIEW_IFRAME_SELECTOR)]
  return pickPreviewIframe(all)
}

/**
 * Iframe para capturas que navegan rutas: prioriza el host oculto para no mover el preview visible.
 */
export function findCaptureWorkerIframe(
  preferredHidden?: HTMLIFrameElement | null,
  root: ParentNode = document,
): HTMLIFrameElement | null {
  if (preferredHidden) return preferredHidden
  const all = [...root.querySelectorAll<HTMLIFrameElement>(PREVIEW_IFRAME_SELECTOR)]
  const hidden = all.filter((el) => isCoverCaptureHostIframe(el))
  if (hidden.length) return pickPreviewIframe(hidden)
  const visible = all.filter((el) => !isCoverCaptureHostIframe(el))
  return pickPreviewIframe(visible)
}

/** Espera a que el preview tenga contenido renderizado en #root. */
export async function waitForPreviewReady(
  iframe: HTMLIFrameElement,
  maxMs = 20_000,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const root = iframe.contentDocument?.querySelector('#root')
    if (root && root.childElementCount > 0) return true
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}

/**
 * Escala la página completa al ancho COVER_W manteniendo la altura real.
 * La imagen resultante muestra la web entera; el CSS con object-fit:contain
 * la encaja en la tarjeta sin recortar nada.
 */
const MAX_COVER_OUTPUT_H = 2400

function compositePortraitCover(source: HTMLCanvasElement): string | null {
  const scale = COVER_W / source.width
  const dw = COVER_W
  const dh = Math.min(Math.round(source.height * scale), MAX_COVER_OUTPUT_H)

  const out = document.createElement('canvas')
  out.width = dw
  out.height = dh
  const ctx = out.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, dw, dh)
  const png = out.toDataURL('image/png')
  if (png.length <= 2_600_000) return png
  return out.toDataURL('image/jpeg', 0.86)
}

/** Oculta overlays del bridge antes de capturar. */
async function prepareIframeForCapture(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument
  const overlay = doc?.getElementById('sk-selection-overlay')
  if (overlay) overlay.style.display = 'none'

  const win = iframe.contentWindow
  if (win) {
    win.postMessage(
      { channel: VISUAL_EDIT_CHANNEL, type: 'set-mode', payload: { mode: 'off' } },
      '*',
    )
  }
  await new Promise((r) => setTimeout(r, 80))
}

export type CaptureIframeOptions = {
  /** Solo el viewport visible del iframe (lo que ve el usuario en Studio). */
  visibleOnly?: boolean
}

/** Captura el preview: página completa o solo el viewport visible. */
async function captureIframe(
  iframe: HTMLIFrameElement,
  viewportWidth?: number | null,
  options?: CaptureIframeOptions,
): Promise<string | null> {
  const doc = iframe.contentDocument
  const body = doc?.body
  if (!body) return null

  await prepareIframeForCapture(iframe)

  try {
    const { default: html2canvas } = await import('html2canvas')

    const mount = (doc.querySelector('#root') ?? body) as HTMLElement
    const root = doc.documentElement
    const win = iframe.contentWindow

    if (options?.visibleOnly && win) {
      win.scrollTo(0, 0)
      root.scrollTop = 0
      body.scrollTop = 0
    }

    const fullW = options?.visibleOnly
      ? Math.max(viewportWidth ?? win?.innerWidth ?? iframe.clientWidth, 1)
      : viewportWidth
        ? viewportWidth
        : Math.max(
            mount.scrollWidth,
            mount.offsetWidth,
            root.scrollWidth,
            body.scrollWidth,
            body.offsetWidth,
            320,
          )
    const fullH = options?.visibleOnly
      ? Math.max(win?.innerHeight ?? iframe.clientHeight, 1)
      : Math.max(
          mount.scrollHeight,
          mount.offsetHeight,
          root.scrollHeight,
          body.scrollHeight,
          body.offsetHeight,
          400,
        )
    const scale = Math.min(2, COVER_W / fullW)
    const bodyBg = win ? win.getComputedStyle(body).backgroundColor : ''
    const bg =
      bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent' ? bodyBg : '#ffffff'

    const canvas = await html2canvas(mount as HTMLElement, {
      useCORS: true,
      allowTaint: true,
      scale,
      width: fullW,
      height: fullH,
      windowWidth: fullW,
      windowHeight: options?.visibleOnly ? fullH : Math.min(fullH, 12_000),
      x: 0,
      y: 0,
      backgroundColor: bg,
      logging: false,
      ignoreElements: (el: Element) =>
        el.id === 'sk-selection-overlay' ||
        el.classList.contains('sk-bridge') ||
        el.classList.contains('sk-selection') ||
        el.id === 'sk-tagger',
    })

    return compositePortraitCover(canvas)
  } catch (err) {
    console.warn('[coverCapture] html2canvas error:', err)
    return null
  }
}

import {
  getPreviewRouteFromIframe,
  navigatePreviewToRoute,
} from '@/lib/preview/previewNavigation'

/** Navega el preview a una ruta y espera render. */
async function navigateIframeTo(iframe: HTMLIFrameElement, route: string): Promise<void> {
  navigatePreviewToRoute(iframe, route)
  await new Promise((r) => setTimeout(r, 900))
  await waitForPreviewReady(iframe, 5000)
}

/** Sube múltiples imágenes al servidor (o persiste en demo). */
async function uploadCovers(
  projectId: string,
  images: Array<{ route: string; imageData: string }>,
): Promise<string[]> {
  if (isDemoProjectId(projectId)) {
    const urls = images.map((img) => img.imageData)
    if (!urls.length) return []
    updateDemoProject(projectId, { coverUrl: urls[0], coverImages: urls })
    return urls
  }

  try {
    const res = await apiFetch<{ urls: string[] }>(`/api/projects/${projectId}/cover`, {
      method: 'PUT',
      body: JSON.stringify({ images }),
    })
    return res.urls ?? []
  } catch (err) {
    console.warn('[coverCapture] upload error:', err)
    return []
  }
}

export type CoverCaptureOptions = {
  /** Anchos a capturar (móvil / tablet / escritorio). */
  viewportWidths?: Array<number | null>
  /** Ruta visible actual; se restaura si la captura usa el iframe del canvas. */
  currentRoute?: string
  maxImages?: number
}

function normCaptureRoute(route: string): string {
  if (!route || route === '/') return '/'
  return `/${route.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

function orderRoutesForCapture(routes: string[], currentRoute: string): string[] {
  const cur = normCaptureRoute(currentRoute)
  const rest = routes.filter((r) => normCaptureRoute(r) !== cur)
  return [cur, ...rest]
}

/**
 * Captura screenshots de cada página de la app y las guarda en el proyecto.
 * Usa el iframe oculto cuando existe para no cambiar la vista del usuario.
 */
export async function captureAndSaveAllPages(
  projectId: string,
  workspaceFiles?: WorkspaceFile[],
  iframeOverride?: HTMLIFrameElement | null,
  optionsOrViewport?: CoverCaptureOptions | number | null,
): Promise<string[]> {
  const options: CoverCaptureOptions =
    typeof optionsOrViewport === 'number' || optionsOrViewport === null
      ? { viewportWidths: [optionsOrViewport] }
      : (optionsOrViewport ?? {})

  const viewportWidths = options.viewportWidths ?? COVER_VIEWPORT_WIDTHS
  const maxImages = options.maxImages ?? 5

  await new Promise((r) => setTimeout(r, 400))

  const visibleIframe = findPreviewIframe()
  const workerIframe = findCaptureWorkerIframe(iframeOverride ?? null)
  if (!workerIframe) return []

  const ready = await waitForPreviewReady(workerIframe)
  if (!ready) return []

  const savedRoute =
    options.currentRoute ??
    (visibleIframe ? getPreviewRouteFromIframe(visibleIframe) : '/')
  const mustRestoreVisible =
    Boolean(visibleIframe) &&
    workerIframe === visibleIframe &&
    !isCoverCaptureHostIframe(visibleIframe)

  const routes = orderRoutesForCapture(detectRoutes(workspaceFiles), savedRoute)
  const captured: Array<{ route: string; imageData: string }> = []

  for (const route of routes) {
    await navigateIframeTo(workerIframe, route)
    for (const vpWidth of viewportWidths) {
      if (captured.length >= maxImages) break
      const dataUrl = await captureIframe(workerIframe, vpWidth)
      if (dataUrl) captured.push({ route, imageData: dataUrl })
    }
    if (captured.length >= maxImages) break
  }

  if (mustRestoreVisible && visibleIframe) {
    await navigateIframeTo(visibleIframe, savedRoute)
  }

  if (!captured.length) return []
  return uploadCovers(projectId, captured)
}

export type CaptureCurrentPreviewOptions = {
  viewportWidths?: Array<number | null>
  /** Solo la página/ruta y viewport visibles en el panel de preview. */
  visibleOnly?: boolean
}

function normalizeCaptureCurrentOptions(
  options?: CaptureCurrentPreviewOptions | number | null | Array<number | null>,
): CaptureCurrentPreviewOptions {
  if (typeof options === 'number' || options === null) {
    return { viewportWidths: [options] }
  }
  if (Array.isArray(options)) return { viewportWidths: options }
  return options ?? {}
}

/**
 * Captura la vista actual del preview (sin navegar).
 * Con `visibleOnly`, guarda una sola miniatura de lo que se ve en el canvas.
 */
export async function captureCurrentPreview(
  projectId: string,
  iframeOverride?: HTMLIFrameElement | null,
  options?: CaptureCurrentPreviewOptions | number | null | Array<number | null>,
): Promise<string | null> {
  const { captureAndAppendCover } = await import('@/lib/projects/manageCovers')
  const opts = normalizeCaptureCurrentOptions(options)

  await new Promise((r) => setTimeout(r, 300))
  const iframe = iframeOverride ?? findPreviewIframe()
  if (!iframe) return null

  await waitForPreviewReady(iframe, 8000)

  if (opts.visibleOnly) {
    const dataUrl = await captureIframe(iframe, null, { visibleOnly: true })
    if (!dataUrl) return null
    const urls = await captureAndAppendCover(projectId, dataUrl)
    return urls[urls.length - 1] ?? null
  }

  const widths = opts.viewportWidths ?? COVER_VIEWPORT_WIDTHS
  let lastUrl: string | null = null
  for (const vpWidth of widths) {
    const dataUrl = await captureIframe(iframe, vpWidth)
    if (!dataUrl) continue
    const urls = await captureAndAppendCover(projectId, dataUrl)
    lastUrl = urls[urls.length - 1] ?? lastUrl
  }

  return lastUrl
}

/** Compat: captura solo la página actual y retorna la primera URL. */
export async function captureAndSaveCover(
  projectId: string,
  workspaceFiles?: WorkspaceFile[],
  iframeOverride?: HTMLIFrameElement | null,
  viewportWidth?: number | null,
): Promise<string | null> {
  const urls = await captureAndSaveAllPages(projectId, workspaceFiles, iframeOverride, viewportWidth)
  return urls[0] ?? null
}
