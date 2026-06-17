#!/usr/bin/env node
import './preload-server-only.mjs'
/**
 * Genera el mismo prompt en Stitch (MCP) y en el orquestador Runlabs;
 * guarda ambos resultados para comparar.
 *
 * Uso:
 *   npm run stitch:dual -- "Landing para tienda de café, desktop"
 *   npm run stitch:dual -- "..." --project=2510768920948183313
 *   npm run stitch:dual -- "..." --stitch-only
 *   npm run stitch:dual -- "..." --runlabs-only
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const prompt = args.find((a) => !a.startsWith('--'))?.trim()
const projectFlag = flags.find((f) => f.startsWith('--project='))
const stitchOnly = flags.includes('--stitch-only')
const runlabsOnly = flags.includes('--runlabs-only')
const existingProject = projectFlag?.split('=')[1]?.trim()

if (!prompt) {
  console.error(
    'Uso: npm run stitch:dual -- "<prompt>" [--project=<stitchProjectId>] [--stitch-only|--runlabs-only]',
  )
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = resolve(root, 'uploads', `dual-run-${stamp}`)
mkdirSync(outDir, { recursive: true })

function log(msg) {
  console.log(msg)
}

async function main() {
  const {
    createStitchProject,
    generateStitchScreen,
    listStitchScreens,
    waitForNewStitchScreen,
    fetchStitchScreenAssets,
    screenIdsFromList,
    normalizeStitchScreenId,
  } = await import('../src/lib/design/stitchMcpClient.ts')

  writeFileSync(resolve(outDir, 'prompt.txt'), prompt, 'utf8')
  const manifest = {
    prompt,
    startedAt: new Date().toISOString(),
    stitch: null,
    runlabs: null,
  }

  if (!runlabsOnly) {
    log('\n=== 1) Stitch (generate_screen_from_text) ===')
    let projectId = existingProject
    if (!projectId) {
      projectId = await createStitchProject(`Runlabs dual ${stamp}`)
      log(`   Proyecto nuevo: ${projectId}`)
    } else {
      log(`   Proyecto: ${projectId}`)
    }

    const before = await listStitchScreens(projectId)
    const known = screenIdsFromList(before)
    log(`   Pantallas antes: ${before.length}`)

    log('   Generando (puede tardar ~1–2 min)…')
    const gen = await generateStitchScreen(projectId, prompt, {
      deviceType: 'DESKTOP',
      modelId: 'GEMINI_3_FLASH',
    })

    writeFileSync(
      resolve(outDir, 'stitch-generate-response.json'),
      JSON.stringify(gen.raw, null, 2),
    )

    const novel = await waitForNewStitchScreen(projectId, known, {
      timeoutMs: 180_000,
      intervalMs: 5_000,
    })
    const screenId = normalizeStitchScreenId(novel.name)
    log(`   Pantalla nueva: ${novel.title ?? screenId}`)

    const assets = await fetchStitchScreenAssets(projectId, screenId)
    writeFileSync(resolve(outDir, 'stitch-page.html'), assets.html, 'utf8')
    writeFileSync(resolve(outDir, 'stitch-screenshot.png'), assets.png)

    const refDir = resolve(root, 'uploads', 'stitch-reference', projectId)
    mkdirSync(refDir, { recursive: true })
    writeFileSync(resolve(refDir, 'prompt.txt'), prompt, 'utf8')
    writeFileSync(
      resolve(refDir, 'meta.json'),
      JSON.stringify(
        {
          projectId,
          screenId,
          title: novel.title,
          syncedAt: new Date().toISOString(),
          source: 'stitch-dual-generate',
        },
        null,
        2,
      ),
    )
    writeFileSync(resolve(refDir, `screen-${screenId}.html`), assets.html, 'utf8')
    writeFileSync(resolve(refDir, `screen-${screenId}.png`), assets.png)

    manifest.stitch = {
      projectId,
      screenId,
      title: assets.title,
      sessionId: gen.sessionId,
      designSystemId: gen.designSystemId,
    }
    log('   ✓ stitch-page.html, stitch-screenshot.png')
  }

  if (!stitchOnly) {
    log('\n=== 2) Runlabs orquestador (flash-lite) ===')
    process.env.ORCHESTRATION_PROBE_DIR = outDir
    const stitchProjectId = manifest.stitch?.projectId ?? existingProject
    if (stitchProjectId) {
      process.env.STITCH_REFERENCE_PROJECT = stitchProjectId
      process.env.STITCH_REFERENCE_SCREEN = manifest.stitch?.screenId ?? ''
    }

    const { generateOrchestratedDesign } = await import('../src/lib/design/orchestration.ts')
    const t0 = Date.now()
    const { files } = await generateOrchestratedDesign(prompt, {
      modelId: 'gemini-2.5-flash-lite',
      device: 'desktop',
      generateImages: false,
      brief: {
        prompt,
        stitchProjectId: stitchProjectId ?? undefined,
        stitchScreenId: manifest.stitch?.screenId,
      },
      send: (type, data) => {
        if (type === 'phase') log(`   phase: ${data}`)
      },
    })
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    const html =
      files.find((f) => f.path.endsWith('.html') && f.path.includes('pages')) ??
      files.find((f) => f.path.endsWith('.html'))
    const designMd = files.find((f) => f.path === 'spec/design.md')
    if (html) writeFileSync(resolve(outDir, 'runlabs-page.html'), html.content, 'utf8')
    if (designMd) writeFileSync(resolve(outDir, 'runlabs-design.md'), designMd.content, 'utf8')

    manifest.runlabs = {
      elapsedSec: Number(elapsed),
      htmlPath: html?.path,
      fileCount: files.length,
    }
    log(`   ✓ ${files.length} archivos en ${elapsed}s`)
  }

  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  log(`\n=== Listo: ${outDir} ===\n`)
}

main().catch((e) => {
  console.error('\n❌', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
