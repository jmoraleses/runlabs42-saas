#!/usr/bin/env node
/**
 * E2E Studio: POST design/generate con imagen (mismo contrato que el compositor).
 *
 * Uso:
 *   pnpm run probe:studio-ref -- [ruta-imagen]           # smoke (~3 min, corta tras HTML)
 *   pnpm run probe:studio-ref:full -- [ruta-imagen]       # completo hasta done + artefactos (tsx vía probe:ref)
 *
 * Requiere dev server en STUDIO_E2E_BASE (default http://localhost:3010).
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const BASE = process.env.STUDIO_E2E_BASE?.trim() || 'http://localhost:3010'
const cliArgs = process.argv.slice(2).filter((a) => a !== '--')

/** pnpm a veces fusiona `-- uploads/foo` en `--uploads/foo`. */
function normalizeImageArg(arg) {
  if (!arg || arg === '--full') return null
  if (arg.startsWith('--') && /[/\\.]/.test(arg.slice(2))) return arg.slice(2)
  if (arg.startsWith('--')) return null
  return arg
}

const full =
  cliArgs.includes('--full') ||
  process.env.STUDIO_REF_E2E_FULL === '1' ||
  process.env.STUDIO_REF_E2E_FULL === 'true'
const imageArg = cliArgs.map(normalizeImageArg).find(Boolean)
const refPath = resolve(root, imageArg ?? 'uploads/petvibe-ref.png')
const projectId = `demo-studio-ref-${Date.now()}`

const DEMO_COOKIE = 'runlabs_demo=1'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = full ? resolve(root, 'uploads', `studio-ref-e2e-${stamp}`) : null

const buf = readFileSync(refPath)
const base64 = buf.toString('base64')
const ext = refPath.split('.').pop()?.toLowerCase()
const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

const body = {
  prompt: 'Réplica fiel de la captura adjunta como catálogo PetVibe.',
  stream: true,
  replaceDesign: true,
  generateImages: full,
  images: [{ mimeType, data: base64 }],
}

function log(msg) {
  console.log(msg)
}

async function capturePng(html, designMd, outPath, projectFiles = []) {
  try {
    const { chromium } = await import('playwright')
    const { prepareHtmlForReviewScreenshot } = await import(
      '../src/lib/design/prepareHtmlForReviewScreenshot.ts'
    )
    const prepared = prepareHtmlForReviewScreenshot(
      html,
      'design/pages/home/index.html',
      designMd,
      projectFiles,
    )
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.setContent(prepared, { waitUntil: 'networkidle', timeout: 15000 })
      await page.screenshot({ path: outPath, fullPage: true })
      return true
    } finally {
      await browser.close()
    }
  } catch {
    return false
  }
}

function pickPageHtml(files) {
  return (
    files.find((f) => f.path === 'design/pages/home/index.html')?.content ??
    files.find((f) => /design\/pages\/.*\/index\.html$/.test(f.path))?.content ??
    files.find((f) => /design\/site\/index\.html$/.test(f.path))?.content ??
    files.find((f) => f.path.endsWith('.html'))?.content ??
    ''
  )
}

async function fetchProjectFiles() {
  const res = await fetch(`${BASE}/api/projects/${encodeURIComponent(projectId)}/files`, {
    headers: { Cookie: DEMO_COOKIE },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET files HTTP ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = await res.json()
  return Array.isArray(data.files) ? data.files : []
}

async function saveArtifacts({ phases, elapsedSec, sawDone }) {
  if (!outDir) return
  mkdirSync(outDir, { recursive: true })
  log(`\nGuardando artefactos en ${outDir}…`)

  const refExt = basename(refPath).match(/\.(png|jpe?g|webp)$/i)?.[0] ?? '.png'
  writeFileSync(resolve(outDir, `reference${refExt}`), buf)
  log(`✓ reference${refExt}`)

  const files = await fetchProjectFiles()
  log(`✓ ${files.length} archivos del proyecto demo`)

  const designMd = files.find((f) => f.path === 'spec/design.md')?.content ?? ''
  const homeHtml = pickPageHtml(files)

  const imageFiles = files.filter(
    (f) => /\.(jpg|jpeg|png|webp)$/i.test(f.path) && f.content && !f.path.endsWith('.html'),
  )
  if (imageFiles.length) {
    const assetsDir = resolve(outDir, 'assets')
    mkdirSync(assetsDir, { recursive: true })
    for (const img of imageFiles) {
      const filename = img.path.split('/').pop()
      writeFileSync(resolve(assetsDir, filename), Buffer.from(img.content, 'base64'))
    }
    log(`✓ ${imageFiles.length} imágenes en assets/`)
  }

  if (designMd) writeFileSync(resolve(outDir, 'design.md'), designMd, 'utf8')
  if (homeHtml) writeFileSync(resolve(outDir, 'generated-page.html'), homeHtml, 'utf8')

  const htmlAfter = existsSync(resolve(outDir, 'page-after-review.html'))
    ? readFileSync(resolve(outDir, 'page-after-review.html'), 'utf8')
    : homeHtml
  if (htmlAfter && !existsSync(resolve(outDir, 'page-after-review.html'))) {
    writeFileSync(resolve(outDir, 'page-after-review.html'), htmlAfter, 'utf8')
  }

  const hasTailwind = /cdn\.tailwindcss\.com/i.test(htmlAfter)
  const hasPicsum = /picsum\.photos|unsplash\.com/i.test(htmlAfter)
  const hasExternalImages = /lh3\.googleusercontent\.com/i.test(htmlAfter)
  const imgSrcs = [...(htmlAfter.matchAll(/src="([^"]+)"/g))]
    .map((m) => m[1])
    .filter((s) => !s.includes('cdn.') && !s.includes('fonts.'))

  if (htmlAfter) {
    const screenshotPath = resolve(outDir, 'generated-screenshot.png')
    const ok = await capturePng(htmlAfter, designMd, screenshotPath, imageFiles)
    log(ok ? '✓ generated-screenshot.png' : '⚠ Sin captura (instala Playwright chromium)')
  }

  const ranVisualAudit = phases.includes('visual-audit')
  const ranVisualAuditReady = phases.includes('visual-audit-ready')
  const hasProductGridInHtml = /product-grid|catálogo|catalogo|PetVibe|Añadir/i.test(htmlAfter)
  const hasClassicAgencyLanding =
    /Nuestros Pilares|Marca Minimalista|Soluciones Web Minimalistas/i.test(htmlAfter)
  const primaryFromDesignMd = designMd.match(/primary:\s*['"]?(#[0-9a-fA-F]{6})/i)?.[1]?.toLowerCase()

  writeFileSync(
    resolve(outDir, 'meta.json'),
    JSON.stringify(
      {
        mode: 'studio-api',
        base: BASE,
        projectId,
        refImage: refPath,
        phases,
        elapsedSec,
        sawDone,
        hasTailwind,
        hasPicsum,
        hasExternalImages,
        imageSrcs: imgSrcs,
        htmlChars: htmlAfter.length,
        ranVisualAudit,
        ranVisualAuditReady,
        hasProductGridInHtml,
        hasClassicAgencyLanding,
        primaryFromDesignMd,
      },
      null,
      2,
    ),
  )

  if (ranVisualAudit) log('✓ Fase visual-audit en stream')
  if (hasClassicAgencyLanding) log('❌ Parece landing genérica de agencia')
  if (hasProductGridInHtml) log('✓ HTML sugiere catálogo / marca de referencia')
  log(`\n=== Completado: ${outDir} ===`)
}

async function main() {
  log(`\n=== Studio design/generate E2E${full ? ' (completo)' : ''} ===`)
  log(`Base: ${BASE}`)
  log(`Proyecto: ${projectId}`)
  log(`Imagen: ${refPath} (${buf.length} bytes, base64 ${base64.length} chars)`)
  if (full) log(`Salida: ${outDir}`)

  const health = await fetch(`${BASE}/api/platform/features`, {
    headers: { Cookie: DEMO_COOKIE },
  }).catch(() => null)
  if (!health?.ok) {
    console.error(`❌ No responde ${BASE} — ejecuta: pnpm run dev:clean`)
    process.exit(1)
  }

  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/projects/${encodeURIComponent(projectId)}/design/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: DEMO_COOKIE,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`❌ HTTP ${res.status}:`, errText.slice(0, 800))
    process.exit(1)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    console.error('❌ Sin cuerpo SSE')
    process.exit(1)
  }

  const decoder = new TextDecoder()
  let buffer = ''
  const phases = []
  let streamError = null
  let sawDone = false

  const deadline = Date.now() + (full ? 600_000 : 240_000)

  while (Date.now() < deadline) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const { type, data } = JSON.parse(line.slice(6))
        if (type === 'phase') {
          phases.push(data)
          log(`  phase: ${data}`)
        }
        if (type === 'error') streamError = data
        if (type === 'done') sawDone = true
      } catch {
        /* ignore */
      }
    }
    if (
      !full &&
      phases.includes('visual-audit-ready') &&
      phases.some((p) => p.startsWith('page:') && p.includes(':html'))
    ) {
      log('✓ Fases clave OK; cortando stream temprano')
      reader.cancel().catch(() => {})
      break
    }
    if (streamError) break
    if (sawDone) break
  }

  const elapsedSec = Number(((Date.now() - t0) / 1000).toFixed(1))
  log(`\nTiempo: ${elapsedSec}s — ${phases.length} fases`)

  if (streamError) {
    console.error(`❌ Error en stream: ${streamError}`)
    process.exit(1)
  }
  if (!phases.includes('visual-audit')) {
    console.error('❌ Falta fase visual-audit (imagen no procesada por el orquestador)')
    process.exit(1)
  }
  if (!phases.includes('visual-audit-ready')) {
    console.error('❌ Falta fase visual-audit-ready')
    process.exit(1)
  }

  if (full) {
    if (!sawDone) {
      console.error('❌ Modo completo: el stream no emitió done (timeout o corte prematuro)')
      process.exit(1)
    }
    await saveArtifacts({ phases, elapsedSec, sawDone })
    log('✅ Studio API — E2E completo con artefactos')
    return
  }

  log('✅ Studio API con referencia visual OK')
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
