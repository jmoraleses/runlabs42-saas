#!/usr/bin/env node
import './preload-server-only.mjs'
/**
 * Prueba rápida del orquestador con gemini-2.5-flash-lite:
 * - Sin imágenes de usuario ni generación Imagen
 * - Screenshot del render antes y después de html-review (ORCHESTRATION_PROBE_DIR)
 * - Informe .md con mejoras sugeridas para el orquestador
 *
 * Uso:
 *   node --import ./scripts/preload-server-only.mjs ./node_modules/tsx/dist/cli.mjs scripts/orchestrator-flash-lite-probe.mjs
 *   npm run probe:orchestrator
 */
import { config } from 'dotenv'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

process.env.DESIGN_GEN_MODEL = 'gemini-2.5-flash-lite'
process.env.TRIAL_DESIGN_GEN_MODEL = 'gemini-2.5-flash-lite'
process.env.DESIGN_IMAGE_GENERATION_ENABLED = 'false'
process.env.DESIGN_HTML_REVIEW_SCREENSHOT = '1'

const MODEL_ID = 'gemini-2.5-flash-lite'
const PROMPT =
  process.argv[2]?.trim() ||
  'Landing de una sola pantalla (id home) para una marca de café artesanal. Tipografía editorial, paleta tierra y crema, hero con CTA, grid de 3 productos y newsletter. Sin imágenes generadas por IA: usa placeholders CSS o divs con gradiente.'

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = resolve(root, 'uploads', `orchestrator-probe-${stamp}`)
mkdirSync(outDir, { recursive: true })
process.env.ORCHESTRATION_PROBE_DIR = outDir

const capture = { phases: [] }

function log(msg) {
  console.log(msg)
}

async function main() {
  log(`\n=== Orquestador probe (${MODEL_ID}) ===`)
  log(`Salida: ${outDir}\n`)

  const { generateOrchestratedDesign } = await import('../src/lib/design/orchestration.ts')
  const { generateAgentPlatformText } = await import('../src/lib/ai/vertexAgentPlatform.ts')

  const brief = {
    prompt: PROMPT,
    siteType: 'landing',
    brandTone: 'artesanal cálido',
    businessModel: 'e-commerce café',
    requiredSections: ['hero', 'productos', 'newsletter'],
  }

  log('Generando diseño orquestado (sin imágenes)…\n')
  const t0 = Date.now()

  const { files } = await generateOrchestratedDesign(PROMPT, {
    modelId: MODEL_ID,
    device: 'desktop',
    generateImages: false,
    images: undefined,
    brief,
    send: (type, data) => {
      if (type === 'phase') {
        capture.phases.push(data)
        log(`  phase: ${data}`)
      }
    },
  })

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  log(`\nOrquestación en ${elapsed}s — ${files.length} archivos`)

  const designMdFile = files.find((f) => f.path === 'spec/design.md')
  const tokensFile = files.find((f) => f.path === 'spec/design-tokens.json')
  const designMd = designMdFile?.content ?? ''
  if (designMdFile) writeFileSync(resolve(outDir, 'design.md'), designMd, 'utf8')
  if (tokensFile) writeFileSync(resolve(outDir, 'design-tokens.json'), tokensFile.content, 'utf8')

  const htmlBefore = existsSync(resolve(outDir, 'page-before-review.html'))
    ? readFileSync(resolve(outDir, 'page-before-review.html'), 'utf8')
    : ''
  const htmlAfter = existsSync(resolve(outDir, 'page-after-review.html'))
    ? readFileSync(resolve(outDir, 'page-after-review.html'), 'utf8')
    : ''

  writeFileSync(
    resolve(outDir, 'phases.json'),
    JSON.stringify({ model: MODEL_ID, phases: capture.phases, elapsedSec: Number(elapsed) }, null, 2),
  )

  const firstPng = resolve(outDir, 'screenshot-first.png')
  const lastPng = resolve(outDir, 'screenshot-last.png')
  if (existsSync(firstPng)) log('✓ screenshot-first.png')
  else log('⚠ Sin screenshot-first.png')
  if (existsSync(lastPng)) log('✓ screenshot-last.png')
  else log('⚠ Sin screenshot-last.png')

  log('\nAnalizando resultados con el mismo modelo…')

  const { htmlVisualReviewSystemInstruction } = await import(
    '../src/lib/design/orchestrationPrompts.ts'
  )

  const analysisImages = []
  if (existsSync(firstPng)) {
    analysisImages.push({
      mimeType: 'image/png',
      data: readFileSync(firstPng).toString('base64'),
    })
  }
  if (existsSync(lastPng)) {
    analysisImages.push({
      mimeType: 'image/png',
      data: readFileSync(lastPng).toString('base64'),
    })
  }

  const analysisPrompt = [
    'Eres un arquitecto de producto para el orquestador de diseño web de Runlabs Studio.',
    'Acabas de observar una generación con gemini-2.5-flash-lite (sin imágenes Imagen).',
    '',
    '## Imágenes adjuntas',
    analysisImages.length >= 2
      ? '1ª imagen = render ANTES de html-review. 2ª imagen = render DESPUÉS de html-review.'
      : analysisImages.length === 1
        ? '1 imagen = render disponible.'
        : 'Sin capturas (Playwright no disponible).',
    '',
    '## Fases ejecutadas',
    capture.phases.join(' → '),
    '',
    '## spec/design.md',
    designMd.length > 12_000 ? `${designMd.slice(0, 12_000)}\n…[truncado]` : designMd || '(vacío)',
    '',
    '## HTML antes de revisión (primeros 8000 chars)',
    htmlBefore.slice(0, 8000) || '(no capturado)',
    '',
    '## HTML después de revisión (primeros 8000 chars)',
    htmlAfter.slice(0, 8000) || '(no capturado)',
    '',
    '## Tarea',
    'Redacta un informe en español en Markdown con:',
    '1. Resumen ejecutivo (3-5 líneas) de calidad visual y fidelidad a design.md',
    '2. Tabla de gaps detectados (tipografía, color, espaciado, componentes, responsive)',
    '3. Cambios concretos recomendados en: prompts del orquestador, orden de fases, html-review, design.md sequential, layout planning',
    '4. Qué debe hacer flash-lite vs qué delegar a flash/pro',
    '5. Checklist priorizada (P0/P1/P2) para implementar en código',
    'Sé específico: cita archivos como orchestrationPrompts.ts, orchestrationHtmlReview.ts, orchestration.ts.',
  ].join('\n')

  const analysisMd = await generateAgentPlatformText(analysisPrompt, {
    systemInstruction: `${htmlVisualReviewSystemInstruction('desktop', analysisImages.length > 0)}\n\nModo: INFORME DE MEJORA DEL ORQUESTADOR (no devuelvas HTML).`,
    model: MODEL_ID,
    images: analysisImages.length ? analysisImages : undefined,
    preferRealtime: true,
  })

  const reportPath = resolve(outDir, 'ORCHESTRATOR-IMPROVEMENTS.md')
  const header = `# Mejoras del orquestador (probe ${MODEL_ID})

- **Fecha:** ${new Date().toISOString()}
- **Modelo:** ${MODEL_ID}
- **Prompt:** ${PROMPT.replace(/\n/g, ' ')}
- **Screenshots:** \`screenshot-first.png\` (pre-review) · \`screenshot-last.png\` (post-review)
- **Fases:** ${capture.phases.join(' → ')}

---

`
  writeFileSync(reportPath, header + analysisMd.trim() + '\n', 'utf8')
  log(`\n✓ Informe: ${reportPath}`)

  for (const p of [firstPng, lastPng, reportPath].filter((f) => existsSync(f))) {
    try {
      execSync(`open "${p}"`, { stdio: 'ignore' })
    } catch {
      log(`(abre manualmente: ${p})`)
    }
  }

  log('\n=== Probe completado ===\n')
}

main().catch((e) => {
  console.error('\n❌ Probe falló:', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
