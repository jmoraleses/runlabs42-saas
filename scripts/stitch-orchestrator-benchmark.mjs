#!/usr/bin/env node
import './preload-server-only.mjs'
/**
 * Descarga referencia gold desde Google Stitch (MCP HTTP) y genera informe
 * de mejoras del orquestador vs salida flash-lite.
 *
 * Uso: npm run benchmark:stitch
 */
import { config } from 'dotenv'
import { execSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const MODEL_ID = process.env.BENCHMARK_MODEL ?? 'gemini-2.5-flash-lite'
const STITCH_PROJECT = process.env.STITCH_PROJECT_ID?.trim()
const STITCH_SCREEN = process.env.STITCH_SCREEN_ID?.trim()

function stitchApiKey() {
  const key = process.env.STITCH_API_KEY?.trim()
  if (!key) throw new Error('Falta STITCH_API_KEY en .env.local')
  return key
}

async function stitchTool(name, args) {
  const key = stitchApiKey()
  const res = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(JSON.stringify(json.error))
  const text = json.result?.content?.[0]?.text
  if (!text) throw new Error(`Stitch ${name}: sin contenido`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Stitch ${name}: JSON inválido — ${text.slice(0, 200)}`)
  }
}

async function downloadUrl(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download ${res.status}: ${url.slice(0, 80)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
  return dest
}

function latestProbeDir() {
  const uploads = resolve(root, 'uploads')
  const dirs = readdirSync(uploads)
    .filter((d) => d.startsWith('orchestrator-probe-'))
    .sort()
    .reverse()
  for (const d of dirs) {
    const p = resolve(uploads, d)
    if (existsSync(resolve(p, 'page-after-review.html'))) return p
  }
  return null
}

async function capturePng(html, designMd, outPath) {
  try {
    const { chromium } = await import('playwright')
    const { prepareHtmlForReviewScreenshot } = await import(
      '../src/lib/design/prepareHtmlForReviewScreenshot.ts'
    )
    const prepared = prepareHtmlForReviewScreenshot(
      html,
      'design/pages/home.html',
      designMd,
      [],
    )
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await page.setContent(prepared, { waitUntil: 'networkidle', timeout: 25_000 })
      await page.waitForTimeout(500)
      await page.screenshot({ path: outPath, type: 'png', fullPage: true })
    } finally {
      await browser.close()
    }
    return true
  } catch (err) {
    console.warn('[benchmark] Playwright no disponible:', err instanceof Error ? err.message : err)
    return false
  }
}

function log(msg) {
  console.log(msg)
}

async function main() {
  if (!STITCH_PROJECT || !STITCH_SCREEN) {
    throw new Error('Define STITCH_PROJECT_ID y STITCH_SCREEN_ID en .env.local')
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir = resolve(root, 'uploads', `stitch-benchmark-${stamp}`)
  mkdirSync(outDir, { recursive: true })

  log(`\n=== Stitch → Orquestador benchmark (${MODEL_ID}) ===`)
  log(`Salida: ${outDir}\n`)

  log('1) Descargando referencia Stitch (MCP)…')
  const projects = await stitchTool('list_projects', {})
  const project = (projects.projects ?? []).find((p) =>
    p.name?.includes(STITCH_PROJECT),
  )
  if (!project) throw new Error(`Proyecto ${STITCH_PROJECT} no encontrado en Stitch`)

  let designMd = project.designMd?.trim() ?? ''
  if (!designMd && project.designTheme) {
    const t = project.designTheme
    const nc = t.namedColors ?? {}
    designMd = [
      '---',
      `name: ${project.title ?? 'Stitch project'}`,
      'colors:',
      ...Object.entries(nc).map(([k, v]) => `  ${k.replace(/_/g, '-')}: '${v}'`),
      'typography:',
      `  headline-xl:`,
      `    fontFamily: ${t.headlineFont ?? t.font ?? 'Inter'}`,
      "    fontSize: 48px",
      "    fontWeight: '700'",
      '---',
      '',
      `# ${project.title ?? 'Design system'}`,
      '',
      '## Brand & Style',
      `Tipografía: ${t.headlineFont ?? t.font}. Redondez: ${t.roundness ?? 'default'}.`,
    ].join('\n')
    log('   (designMd sintetizado desde designTheme)')
  }

  const screenName = `projects/${STITCH_PROJECT}/screens/${STITCH_SCREEN}`
  const screenData = await stitchTool('get_screen', {
    name: screenName,
    projectId: STITCH_PROJECT,
    screenId: STITCH_SCREEN,
  })
  const screen = screenData.screen ?? screenData

  if (!designMd) throw new Error('Proyecto Stitch sin designMd ni designTheme')

  writeFileSync(resolve(outDir, 'stitch-design.md'), designMd, 'utf8')

  const htmlUrl = screen.htmlCode?.downloadUrl
  const pngUrl = screen.screenshot?.downloadUrl
  if (!htmlUrl || !pngUrl) throw new Error('Pantalla Stitch sin htmlCode o screenshot')

  await downloadUrl(htmlUrl, resolve(outDir, 'stitch-page.html'))
  await downloadUrl(pngUrl, resolve(outDir, 'stitch-screenshot.png'))
  log(`   ✓ ${screen.title ?? STITCH_SCREEN}`)
  log('   ✓ stitch-design.md, stitch-page.html, stitch-screenshot.png')

  log('\n2) Cargando salida del orquestador (probe local)…')
  const probeDir = latestProbeDir()
  let runlabsHtml = ''
  let runlabsDesignMd = ''
  if (probeDir) {
    runlabsHtml = readFileSync(resolve(probeDir, 'page-after-review.html'), 'utf8')
    runlabsDesignMd = existsSync(resolve(probeDir, 'design.md'))
      ? readFileSync(resolve(probeDir, 'design.md'), 'utf8')
      : ''
    writeFileSync(resolve(outDir, 'runlabs-page.html'), runlabsHtml, 'utf8')
    if (runlabsDesignMd) writeFileSync(resolve(outDir, 'runlabs-design.md'), runlabsDesignMd, 'utf8')
    log(`   ✓ Probe: ${probeDir}`)
  } else {
    log('   ⚠ Sin probe previo; solo análisis Stitch → reglas orquestador')
  }

  const runlabsPng = resolve(outDir, 'runlabs-screenshot.png')
  if (runlabsHtml) {
    const ok = await capturePng(runlabsHtml, runlabsDesignMd || designMd, runlabsPng)
    if (ok) log('   ✓ runlabs-screenshot.png (Playwright)')
  }

  log(`\n3) Análisis con ${MODEL_ID}…`)
  const { generateAgentPlatformText } = await import('../src/lib/ai/vertexAgentPlatform.ts')

  const images = []
  images.push({
    mimeType: 'image/png',
    data: readFileSync(resolve(outDir, 'stitch-screenshot.png')).toString('base64'),
  })
  if (existsSync(runlabsPng)) {
    images.push({
      mimeType: 'image/png',
      data: readFileSync(runlabsPng).toString('base64'),
    })
  }

  const stitchHtml = readFileSync(resolve(outDir, 'stitch-page.html'), 'utf8')

  const prompt = [
    'Comparas diseño web **Stitch (referencia gold)** vs **Runlabs orquestador (Gemini 2.5 Flash Lite)**.',
    '',
    '## Imágenes',
    images.length >= 2
      ? '1ª = Stitch (gold). 2ª = Runlabs orquestador.'
      : '1ª = Stitch gold.',
    '',
    '## spec/design.md Stitch (completo)',
    designMd.length > 14_000 ? `${designMd.slice(0, 14_000)}\n…` : designMd,
    '',
    '## HTML Stitch (extracto 6000 chars)',
    stitchHtml.slice(0, 6000),
    '',
    ...(runlabsHtml
      ? [
          '## spec/design.md Runlabs (extracto)',
          (runlabsDesignMd || '(igual brief)').slice(0, 6000),
          '',
          '## HTML Runlabs post-review (extracto 6000 chars)',
          runlabsHtml.slice(0, 6000),
        ]
      : []),
    '',
    '## Objetivo',
    'Documento en español para que el orquestador de Runlabs produzca resultados **visualmente equivalentes a Stitch** usando **gemini-2.5-flash-lite**, sin Imagen API.',
    '',
    'Incluye:',
    '1. Tabla comparativa (color, tipo, espaciado, componentes, jerarquía, placeholders)',
    '2. Qué hace bien Stitch que falla nuestro pipeline (design-md secuencial, layout, html parts, html-review)',
    '3. Cambios **concretos** en: `orchestrationPrompts.ts`, `designMd.ts`, `designMdSequential.ts`, `htmlPageSequential.ts`, `orchestrationHtmlReview.ts`, `orchestration.ts`',
    '4. Plantilla de system prompt recomendada para flash-lite (HTML monolítico vs secuencial)',
    '5. Checklist P0/P1/P2 implementable esta semana',
    'No devuelvas HTML; solo Markdown del informe.',
  ].join('\n')

  const analysis = await generateAgentPlatformText(prompt, {
    systemInstruction:
      'Eres lead de diseño de sistemas. Comparas Stitch vs orquestadores internos. Respuesta solo en Markdown.',
    model: MODEL_ID,
    images,
    preferRealtime: true,
  })

  const reportPath = resolve(outDir, 'ORCHESTRATOR-IMPROVEMENTS.md')
  const header = `# Benchmark Stitch vs Orquestador (${MODEL_ID})

- **Fecha:** ${new Date().toISOString()}
- **Stitch:** ${project.title ?? STITCH_PROJECT} / ${screen.title ?? STITCH_SCREEN}
- **Referencia:** \`stitch-screenshot.png\`, \`stitch-page.html\`, \`stitch-design.md\`
- **Runlabs:** ${probeDir ? `\`${probeDir}\`` : 'sin probe'} 
- **Capturas:** \`stitch-screenshot.png\`${existsSync(runlabsPng) ? ' · `runlabs-screenshot.png`' : ''}

---

`
  writeFileSync(reportPath, header + analysis.trim() + '\n', 'utf8')
  log(`\n✓ ${reportPath}`)

  for (const p of [
    resolve(outDir, 'stitch-screenshot.png'),
    runlabsPng,
    reportPath,
  ].filter((f) => existsSync(f))) {
    try {
      execSync(`open "${p}"`, { stdio: 'ignore' })
    } catch {
      log(`Abre: ${p}`)
    }
  }

  log('\n=== Benchmark completado ===\n')
}

main().catch((e) => {
  console.error('\n❌', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
