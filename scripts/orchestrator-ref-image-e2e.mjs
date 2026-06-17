#!/usr/bin/env node
import './preload-server-only.mjs'
/**
 * E2E: orquestador con imagen de referencia arbitraria (sin proyecto Stitch).
 *
 * Uso:
 *   npm run probe:ref -- uploads/cafe-raices-ref.png "Brief del sitio"
 *   npm run probe:ref -- uploads/cafe-raices-ref.png  # usa brief por defecto
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const args = process.argv.slice(2)
const refImagePath = args[0] ? resolve(root, args[0]) : null
const customBrief = args[1] ?? null

if (!refImagePath || !existsSync(refImagePath)) {
  console.error(`Uso: npm run probe:ref -- <ruta-imagen-ref> ["brief opcional"]`)
  console.error(`Ejemplo: npm run probe:ref -- uploads/cafe-raices-ref.png`)
  process.exit(1)
}

const MODEL_ID = process.env.DESIGN_GEN_MODEL ?? 'gemini-2.5-flash-lite'

const DEFAULT_BRIEF = `Landing page para 'Café Raíces': cafetería de especialidad en Barcelona.
Venta online de café de origen, suscripciones mensuales y cursos de barismo.
Estructura: nav (Shop, Subscriptions, Courses, About Us, carrito), hero full-width con imagen atmosférica,
sección catálogo de cafés de origen (grid 3 col con fotos de producto), sección suscripción split-layout,
academia de barismo (3 cursos con precio), cita/about editorial, galería fotos, footer completo.
Estilo editorial cálido: tipografía serif elegante para títulos, sans legible para cuerpo. Paleta tostados y cremas.
Micro-interacciones sutiles, fotos de café de alta calidad.`

const BRIEF = customBrief ?? DEFAULT_BRIEF

process.env.DESIGN_GEN_MODEL = MODEL_ID
process.env.TRIAL_DESIGN_GEN_MODEL = MODEL_ID
process.env.DESIGN_IMAGE_GENERATION_ENABLED = '1'
process.env.DESIGN_HTML_REVIEW = '1'
process.env.DESIGN_HTML_REVIEW_SCREENSHOT = '1'

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = resolve(root, 'uploads', `ref-image-e2e-${stamp}`)
mkdirSync(outDir, { recursive: true })
process.env.ORCHESTRATION_PROBE_DIR = outDir

function log(msg) { console.log(msg) }

async function capturePng(html, designMd, outPath, projectFiles = []) {
  try {
    const { chromium } = await import('playwright')
    const { prepareHtmlForReviewScreenshot } = await import(
      '../src/lib/design/prepareHtmlForReviewScreenshot.ts'
    )
    const prepared = prepareHtmlForReviewScreenshot(html, 'design/pages/home/index.html', designMd, projectFiles)
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

async function main() {
  log(`\n=== Ref Image E2E (${MODEL_ID}) ===`)
  log(`Salida: ${outDir}`)
  log(`Referencia: ${refImagePath}`)

  const { generateOrchestratedDesign } = await import('../src/lib/design/orchestration.ts')

  // Carga imagen de referencia como multimodal
  const refImageData = readFileSync(refImagePath).toString('base64')
  const ext = refImagePath.split('.').pop()?.toLowerCase()
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
  const referenceImages = [{ mimeType, data: refImageData }]

  // Copia imagen de referencia al outDir
  writeFileSync(resolve(outDir, 'reference.png'), readFileSync(refImagePath))
  log(`✓ reference.png copiada`)

  // Sin siteType fijo: la auditoría visual (fase visual-audit) infiere catálogo/landing desde la captura.
  const brief = {
    prompt: BRIEF,
    locale: 'es',
  }

  const phases = []
  log('Generando con orquestador + imagen de referencia…\n')
  const t0 = Date.now()

  const { files } = await generateOrchestratedDesign(BRIEF, {
    modelId: MODEL_ID,
    device: 'desktop',
    generateImages: true,
    brief,
    images: referenceImages,
    send: (type, data) => {
      if (type === 'phase') {
        phases.push(data)
        log(`  phase: ${data}`)
      }
    },
  })

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  log(`\nOrquestación ${elapsed}s — ${files.length} archivos`)

  const designMd = files.find((f) => f.path === 'spec/design.md')?.content ?? ''
  const homeHtml =
    files.find((f) => f.path === 'design/pages/home/index.html')?.content ??
    files.find((f) => /design\/pages\/.*\/index\.html$/.test(f.path))?.content ??
    files.find((f) => /design\/site\/index\.html$/.test(f.path))?.content ??
    files.find((f) => f.path.endsWith('.html'))?.content ??
    ''

  // Separar archivos de imagen (base64) de archivos de texto
  const imageFiles = files.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f.path) && f.content)
  const assetsDir = resolve(outDir, 'assets')
  if (imageFiles.length) {
    const { mkdirSync: mkdir } = await import('fs')
    mkdir(assetsDir, { recursive: true })
    for (const img of imageFiles) {
      const filename = img.path.split('/').pop()
      writeFileSync(resolve(assetsDir, filename), Buffer.from(img.content, 'base64'))
    }
    log(`✓ ${imageFiles.length} imágenes guardadas en assets/`)
  }

  if (designMd) writeFileSync(resolve(outDir, 'design.md'), designMd, 'utf8')
  if (homeHtml) writeFileSync(resolve(outDir, 'generated-page.html'), homeHtml, 'utf8')

  const htmlAfter = existsSync(resolve(outDir, 'page-after-review.html'))
    ? readFileSync(resolve(outDir, 'page-after-review.html'), 'utf8')
    : homeHtml
  if (htmlAfter) writeFileSync(resolve(outDir, 'page-after-review.html'), htmlAfter, 'utf8')

  const hasTailwind = /cdn\.tailwindcss\.com/i.test(htmlAfter)
  const hasPicsum = /picsum\.photos|unsplash\.com/i.test(htmlAfter)
  const hasExternalImages = /lh3\.googleusercontent\.com/i.test(htmlAfter)
  const imgSrcs = [...(htmlAfter.matchAll(/src="([^"]+)"/g))].map(m => m[1]).filter(s => !s.includes('cdn.') && !s.includes('fonts.'))

  log(hasTailwind ? '✓ Tailwind CDN' : '⚠ Sin Tailwind CDN')
  log(hasPicsum ? '❌ TIENE picsum/unsplash' : '✓ Sin picsum/unsplash')
  log(hasExternalImages ? '❌ TIENE URLs externas (lh3.google)' : '✓ Sin URLs externas')
  log(`  Imágenes referenciadas: ${imgSrcs.length > 0 ? imgSrcs.join(', ') : '(ninguna)'}`)

  // Pasar imageFiles como projectFiles para que se inline como data URLs en el screenshot
  const screenshotPath = resolve(outDir, 'generated-screenshot.png')
  if (htmlAfter) {
    const ok = await capturePng(htmlAfter, designMd, screenshotPath, imageFiles)
    log(ok ? '✓ generated-screenshot.png (con imágenes)' : '⚠ Sin captura (instala Playwright chromium)')
  }

  const ranVisualAudit = phases.includes('visual-audit')
  const ranVisualAuditReady = phases.includes('visual-audit-ready')
  const hasProductGridInHtml = /product-grid|catálogo|catalogo|Comida para Perros|PetVibe|Añadir/i.test(htmlAfter)
  const hasClassicAgencyLanding =
    /Nuestros Pilares|Marca Minimalista|Soluciones Web Minimalistas/i.test(htmlAfter)
  const primaryFromDesignMd = designMd.match(/primary:\s*['"]?(#[0-9a-fA-F]{6})/i)?.[1]?.toLowerCase()

  writeFileSync(resolve(outDir, 'meta.json'), JSON.stringify({
    model: MODEL_ID,
    refImage: refImagePath,
    phases,
    elapsedSec: Number(elapsed),
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
  }, null, 2))

  if (ranVisualAudit) log('✓ Fase visual-audit ejecutada')
  else log('⚠ Sin fase visual-audit (¿imagen no llegó a Vertex?)')
  if (hasClassicAgencyLanding) log('❌ Parece landing genérica de agencia (no fiel a la captura)')
  if (hasProductGridInHtml) log('✓ HTML sugiere catálogo / marca de la referencia')

  log(`\n=== Completado: ${outDir} ===`)
}

main().catch((e) => { console.error('❌ Error:', e); process.exit(1) })
