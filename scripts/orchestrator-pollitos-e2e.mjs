#!/usr/bin/env node
import './preload-server-only.mjs'
/**
 * E2E: orquestador (paridad Stitch) vs referencia Pollitos Amarillos.
 *
 * Uso: npm run probe:pollitos
 */
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const MODEL_ID = process.env.DESIGN_GEN_MODEL ?? 'gemini-2.5-flash-lite'
const STITCH_PROJECT = '2510768920948183313'
const STITCH_SCREEN = 'c41095306a6146ed9bd54a0c72fc5b32'
const REF_DIR = resolve(root, 'uploads', 'stitch-reference', STITCH_PROJECT)

const POLLITOS_PROMPT = `Landing de una sola pantalla (id home) para "Tienda de Pollitos Amarillos": tienda online de pollitos amarillos para familias.
Tipografía Quicksand en todo el sitio. Paleta cálida Material 3: surface #fff8f0, primary-container dorado #ffd700, secondary naranja #855400, acentos suaves.
Estructura: nav sticky (logo Pollitos Amarillos, Newborns, Accessories, Care Kits, búsqueda, carrito), hero con badge "Welcome to the Chick Nest", titular "Bringing Sunshine to Your Home", CTAs Adopt Now / Our Care Guide, imagen hero de pollitos.
Sección bento "Why Families Trust Us" (Nurtured with Love, Premium Genetics, iconos Material Symbols).
Grid de productos pollitos, testimonios o newsletter, footer.
Micro-interacciones bouncy-hover y soft-shadow naranja suave.
Sin generación de imágenes por IA: usa placeholders con gradientes de la paleta primary-container/secondary-container (NO picsum).
Objetivo: equivalencia visual con el proyecto Stitch de referencia (Pollitos Amarillos - Inicio).`

process.env.DESIGN_GEN_MODEL = MODEL_ID
process.env.TRIAL_DESIGN_GEN_MODEL = MODEL_ID
process.env.DESIGN_IMAGE_GENERATION_ENABLED = '1'
process.env.DESIGN_HTML_REVIEW = '1'
process.env.DESIGN_HTML_REVIEW_SCREENSHOT = '1'
process.env.STITCH_REFERENCE_PROJECT = STITCH_PROJECT
process.env.STITCH_REFERENCE_SCREEN = STITCH_SCREEN

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = resolve(root, 'uploads', `pollitos-e2e-${stamp}`)
mkdirSync(outDir, { recursive: true })
process.env.ORCHESTRATION_PROBE_DIR = outDir

function log(msg) {
  console.log(msg)
}

async function capturePng(html, designMd, outPath) {
  try {
    const { chromium } = await import('playwright')
    const { prepareHtmlForReviewScreenshot } = await import(
      '../src/lib/design/prepareHtmlForReviewScreenshot.ts'
    )
    const prepared = prepareHtmlForReviewScreenshot(
      html,
      'design/pages/home/index.html',
      designMd,
      [],
    )
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await page.setContent(prepared, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(600)
      await page.screenshot({ path: outPath, type: 'png', fullPage: true })
    } finally {
      await browser.close()
    }
    return true
  } catch (err) {
    console.warn('[e2e] Playwright:', err instanceof Error ? err.message : err)
    return false
  }
}

async function main() {
  log(`\n=== Pollitos E2E (${MODEL_ID}) ===`)
  log(`Salida: ${outDir}\n`)

  const refPng = resolve(REF_DIR, `screen-${STITCH_SCREEN}.png`)
  const refHtml = resolve(REF_DIR, `screen-${STITCH_SCREEN}.html`)
  const refDesignMd = resolve(REF_DIR, 'design.md')
  if (!existsSync(refPng)) {
    log('⚠ Referencia local ausente; ejecuta: npm run stitch:sync')
  } else {
    copyFileSync(refPng, resolve(outDir, 'stitch-reference.png'))
    log('✓ stitch-reference.png (copia local)')
  }
  if (existsSync(refHtml)) copyFileSync(refHtml, resolve(outDir, 'stitch-reference.html'))
  if (existsSync(refDesignMd)) copyFileSync(refDesignMd, resolve(outDir, 'stitch-design.md'))

  const { generateOrchestratedDesign } = await import('../src/lib/design/orchestration.ts')
  const { generateAgentPlatformText } = await import('../src/lib/ai/vertexAgentPlatform.ts')
  const { mergeOrchestrationImageParts } = await import(
    '../src/lib/design/orchestrationVisualContext.ts'
  )
  const { loadStitchReference } = await import('../src/lib/design/stitchReference.ts')

  const stitchRef = loadStitchReference(STITCH_PROJECT, STITCH_SCREEN)
  const orchestrationImages = mergeOrchestrationImageParts(undefined, stitchRef)
  if (orchestrationImages.length) {
    log(`✓ ${orchestrationImages.length} imagen(es) multimodal (captura Stitch gold)`)
  }

  const brief = {
    prompt: POLLITOS_PROMPT,
    locale: 'es',
    siteType: 'landing',
    brandTone: 'cálido, alegre, familiar',
    businessModel: 'e-commerce pollitos',
    requiredSections: ['hero', 'beneficios', 'productos', 'footer'],
    stitchProjectId: STITCH_PROJECT,
    stitchScreenId: STITCH_SCREEN,
  }

  const phases = []
  log('Generando con orquestador + referencia Stitch…\n')
  const t0 = Date.now()

  const { files } = await generateOrchestratedDesign(POLLITOS_PROMPT, {
    modelId: MODEL_ID,
    device: 'desktop',
    generateImages: true,
    brief,
    images: orchestrationImages.length ? orchestrationImages : undefined,
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
    files.find((f) => /\.html$/.test(f.path))?.content ??
    ''

  if (designMd) writeFileSync(resolve(outDir, 'runlabs-design.md'), designMd, 'utf8')
  if (homeHtml) writeFileSync(resolve(outDir, 'runlabs-page.html'), homeHtml, 'utf8')

  const htmlAfter = existsSync(resolve(outDir, 'page-after-review.html'))
    ? readFileSync(resolve(outDir, 'page-after-review.html'), 'utf8')
    : homeHtml
  if (htmlAfter) writeFileSync(resolve(outDir, 'page-after-review.html'), htmlAfter, 'utf8')

  const hasTailwind = /cdn\.tailwindcss\.com/i.test(htmlAfter)
  log(hasTailwind ? '✓ HTML con Tailwind CDN (paridad Stitch)' : '⚠ HTML sin Tailwind CDN')

  const runlabsPng = resolve(outDir, 'runlabs-screenshot.png')
  if (htmlAfter) {
    const ok = await capturePng(htmlAfter, designMd, runlabsPng)
    log(ok ? '✓ runlabs-screenshot.png' : '⚠ Sin captura Runlabs (instala Playwright chromium)')
  }

  writeFileSync(
    resolve(outDir, 'meta.json'),
    JSON.stringify(
      {
        model: MODEL_ID,
        stitchProjectId: STITCH_PROJECT,
        phases,
        elapsedSec: Number(elapsed),
        hasTailwind,
        designMdChars: designMd.length,
        htmlChars: htmlAfter.length,
      },
      null,
      2,
    ),
  )

  log('\nAnálisis visual Stitch vs Runlabs…')

  const images = []
  const stitchRefPng = resolve(outDir, 'stitch-reference.png')
  if (existsSync(stitchRefPng)) {
    images.push({
      mimeType: 'image/png',
      data: readFileSync(stitchRefPng).toString('base64'),
    })
  }
  if (existsSync(runlabsPng)) {
    images.push({
      mimeType: 'image/png',
      data: readFileSync(runlabsPng).toString('base64'),
    })
  }

  const stitchDesign = existsSync(resolve(outDir, 'stitch-design.md'))
    ? readFileSync(resolve(outDir, 'stitch-design.md'), 'utf8')
    : ''

  const analysisPrompt = [
    'Comparas **Stitch (gold)** vs **Runlabs orquestador** para Tienda de Pollitos Amarillos (mismo brief).',
    images.length >= 2
      ? 'Imagen 1 = Stitch referencia. Imagen 2 = Runlabs tras html-review.'
      : images.length === 1
        ? 'Solo una captura disponible.'
        : 'Sin capturas PNG.',
    '',
    '## Fases orquestador',
    phases.join(' → '),
    '',
    '## design.md Stitch (referencia)',
    stitchDesign.slice(0, 8000) || '(no local)',
    '',
    '## design.md Runlabs',
    designMd.slice(0, 8000) || '(vacío)',
    '',
    '## HTML Runlabs (extracto)',
    htmlAfter.slice(0, 6000) || '(vacío)',
    '',
    '## Criterios de éxito (paridad Stitch)',
    '- Quicksand única familia tipográfica',
    '- Tailwind CDN + tailwind.config con hex M3 literales',
    '- Paleta amarillo/dorado (#ffd700, #fff8f0), no café/editorial',
    '- Misma jerarquía: nav, hero pollitos, bento beneficios',
    '',
    'Redacta informe Markdown en español:',
    '1. Puntuación 0-10 equivalencia visual',
    '2. Tabla gaps (color, tipo, layout, componentes, placeholders)',
    '3. ¿Cumple stack Stitch? (Tailwind monolito)',
    '4. P0 fixes si quedan (máx 5 bullets concretos en código)',
    'No devuelvas HTML.',
  ].join('\n')

  let analysis = await generateAgentPlatformText(analysisPrompt, {
    systemInstruction:
      'Eres lead de diseño. Comparas capturas Stitch vs orquestador interno. Solo Markdown en español. Informe completo: puntuación, tabla de gaps, stack Stitch, P0 fixes.',
    model: MODEL_ID,
    images: images.length ? images : undefined,
    preferRealtime: true,
    maxOutputTokens: 8192,
  })

  if (analysis.trim().length < 400) {
    log('⚠ Informe corto; reintento con prompt acotado…')
    analysis = await generateAgentPlatformText(
      [
        'Completa el informe E2E Pollitos (Markdown español, mínimo 800 palabras).',
        'Incluye: 1) Nota 0-10, 2) Tabla |Categoría|Stitch|Runlabs|Gap|, 3) Stack Tailwind sí/no, 4) 5 bullets P0 código.',
        `Fases: ${phases.join(' → ')}`,
        `Tailwind HTML: ${hasTailwind}`,
        `design.md chars: ${designMd.length}, HTML chars: ${htmlAfter.length}`,
      ].join('\n'),
      {
        systemInstruction: 'Lead de diseño. Solo Markdown en español, sin HTML.',
        model: MODEL_ID,
        images: images.length ? images : undefined,
        preferRealtime: true,
        maxOutputTokens: 8192,
      },
    )
  }

  const reportPath = resolve(outDir, 'POLLITOS-E2E-REPORT.md')
  const header = `# E2E Pollitos Amarillos — Stitch vs Runlabs

- **Fecha:** ${new Date().toISOString()}
- **Modelo:** ${MODEL_ID}
- **Stitch ref:** \`${REF_DIR}\`
- **Paridad Stitch:** activa por defecto (\`DESIGN_STITCH_PARITY=0\` para desactivar)
- **Tailwind en HTML:** ${hasTailwind ? 'sí' : 'no'}
- **Capturas:** \`stitch-reference.png\` · \`runlabs-screenshot.png\`
- **Fases:** ${phases.join(' → ')}

---

`
  writeFileSync(reportPath, header + analysis.trim() + '\n', 'utf8')
  log(`\n✓ Informe: ${reportPath}`)

  for (const p of [stitchRefPng, runlabsPng, reportPath].filter((f) => existsSync(f))) {
    try {
      execSync(`open "${p}"`, { stdio: 'ignore' })
    } catch {
      log(`Abre: ${p}`)
    }
  }

  log('\n=== E2E Pollitos completado ===\n')
}

main().catch((e) => {
  console.error('\n❌ E2E falló:', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
