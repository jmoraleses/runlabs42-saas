import type { MobileCheck, MobileReadiness } from '@/types/mobile'

type ScanInput = {
  deployedUrl: string | null
  files: { path: string; content: string }[]
  html?: string
  framework?: string
}

async function fetchDeployedHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Runlabs42-MobileScan/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function checkViewport(html: string): MobileCheck {
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html)
  return {
    id: 'viewport-meta',
    label: 'Meta viewport',
    status: hasViewport ? 'pass' : 'fail',
    message: hasViewport
      ? 'Viewport configurado para móvil'
      : 'Añade <meta name="viewport" content="width=device-width, initial-scale=1">',
    severity: hasViewport ? 'info' : 'critical',
  }
}

function checkHttps(url: string | null): MobileCheck {
  const ok = url?.startsWith('https://') ?? false
  return {
    id: 'https-deploy',
    label: 'URL HTTPS',
    status: ok ? 'pass' : 'fail',
    message: ok ? 'App publicada con HTTPS' : 'Publica la app web antes del scan móvil',
    severity: 'critical',
  }
}

function checkManifest(files: { path: string; content: string }[], html: string): MobileCheck {
  const hasFile = files.some((f) => f.path === 'public/manifest.json' || f.path === 'manifest.json')
  const linked = /manifest\.json/i.test(html) || /rel=["']manifest["']/i.test(html)
  const ok = hasFile && linked
  return {
    id: 'pwa-manifest',
    label: 'Web App Manifest',
    status: ok ? 'pass' : hasFile ? 'partial' : 'fail',
    message: ok
      ? 'manifest.json presente y enlazado'
      : hasFile
        ? 'Enlaza manifest.json en index.html'
        : 'Añade public/manifest.json y enlázalo en index.html',
    severity: ok ? 'info' : 'warning',
  }
}

function checkLegalPages(files: { path: string; content: string }[], html: string): MobileCheck {
  const privacy =
    files.some((f) => /privacy/i.test(f.path)) || /\/privacy|privacidad/i.test(html)
  const terms = files.some((f) => /terms/i.test(f.path)) || /\/terms|términos|terminos/i.test(html)
  const ok = privacy && terms
  return {
    id: 'legal-pages',
    label: 'Privacidad y términos',
    status: ok ? 'pass' : privacy || terms ? 'partial' : 'fail',
    message: ok
      ? 'Enlaces a privacidad y términos detectados'
      : 'Las tiendas requieren páginas de privacidad y términos accesibles',
    severity: ok ? 'info' : 'critical',
  }
}

function checkCanvasTouch(files: { path: string; content: string }[], framework?: string): MobileCheck {
  const canvasFrameworks = new Set(['canvas-app', 'canvas-game', 'p5', 'phaser', 'three'])
  if (!framework || !canvasFrameworks.has(framework)) {
    return {
      id: 'canvas-touch',
      label: 'Controles canvas táctiles',
      status: 'pass',
      message: 'No aplica (no es proyecto canvas)',
      severity: 'info',
    }
  }
  const js = files
    .filter((f) => /\.(js|ts)$/i.test(f.path))
    .map((f) => f.content)
    .join('\n')
  const hasTouch =
    /touchstart|touchmove|touchend|pointerdown|pointermove|addEventListener\s*\(\s*['"]touch/i.test(
      js,
    ) || /touchStarted|createCanvas/i.test(js)
  return {
    id: 'canvas-touch',
    label: 'Controles canvas táctiles',
    status: hasTouch ? 'pass' : 'partial',
    message: hasTouch
      ? 'Eventos táctiles o pointer detectados'
      : 'Añade touchstart/touchmove o pointer events para móvil',
    severity: hasTouch ? 'info' : 'warning',
  }
}

function checkCanvasOverflow(css: string): MobileCheck {
  const bad = /width:\s*\d{4,}px|min-width:\s*\d{4,}px/.test(css)
  const ok = !bad && /max-width:\s*100%|100dvh|100vw/.test(css)
  return {
    id: 'canvas-overflow',
    label: 'Canvas sin overflow horizontal',
    status: ok ? 'pass' : bad ? 'fail' : 'partial',
    message: ok
      ? 'Estilos responsive para viewport'
      : 'Evita anchos fijos grandes; usa max-width: 100% y unidades relativas',
    severity: ok ? 'info' : 'warning',
  }
}

function checkTouchTargets(html: string): MobileCheck {
  const hasMinHeight = /min-height:\s*4[4-9]px|min-height:\s*5\dpx/i.test(html)
  const hasTailwindTouch = /\b(min-h-(?:11|12|14)|h-11|h-12|py-3|p-3)\b/.test(html)
  const ok = hasMinHeight || hasTailwindTouch
  return {
    id: 'touch-targets',
    label: 'Objetivos táctiles',
    status: ok ? 'pass' : 'partial',
    message: ok
      ? 'Estilos compatibles con touch (≥44px)'
      : 'Usa botones/enlaces con altura mínima 44px en móvil',
    severity: 'warning',
  }
}

function checkAppleIcon(html: string, files: { path: string; content: string }[]): MobileCheck {
  const linked = /apple-touch-icon/i.test(html)
  const hasFile = files.some((f) => /icon|apple-touch/i.test(f.path))
  const ok = linked || hasFile
  return {
    id: 'apple-touch-icon',
    label: 'Icono iOS',
    status: ok ? 'pass' : 'partial',
    message: ok ? 'Icono para iOS configurado' : 'Añade apple-touch-icon en index.html',
    severity: 'warning',
  }
}

function scoreFromChecks(checks: MobileCheck[]): number {
  if (!checks.length) return 0
  let points = 0
  for (const c of checks) {
    if (c.status === 'pass') points += 100
    else if (c.status === 'partial') points += 50
  }
  return Math.round(points / checks.length)
}

export async function runMobileReadinessScan(input: ScanInput): Promise<MobileReadiness> {
  const html =
    input.html ??
    (input.deployedUrl ? await fetchDeployedHtml(input.deployedUrl) : null) ??
    input.files.find((f) => f.path === 'index.html')?.content ??
    ''

  const css = input.files
    .filter((f) => f.path.endsWith('.css'))
    .map((f) => f.content)
    .join('\n')

  const checks: MobileCheck[] = [
    checkHttps(input.deployedUrl),
    checkViewport(html),
    checkManifest(input.files, html),
    checkLegalPages(input.files, html),
    checkTouchTargets(html),
    checkAppleIcon(html, input.files),
    checkCanvasTouch(input.files, input.framework),
    checkCanvasOverflow(css + html),
  ]

  return {
    score: scoreFromChecks(checks),
    checks,
    scannedAt: new Date().toISOString(),
    targets: ['ios', 'android'],
  }
}

export function buildMobileFixPrompt(readiness: MobileReadiness): string {
  const failed = readiness.checks.filter((c) => c.status === 'fail' || c.status === 'partial')
  const lines = failed.map((c) => `- [${c.status}] ${c.label}: ${c.message}`)
  return `/build Corrige los problemas de preparación para App Store y Google Play:\n${lines.join('\n')}\n\nAsegura diseño mobile-first, manifest PWA y meta viewport. No añadas páginas legales salvo que el usuario lo pida.`
}
