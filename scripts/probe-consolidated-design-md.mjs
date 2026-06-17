#!/usr/bin/env node
import './preload-server-only.mjs'
/**
 * Compara design.md secuencial (13 pasos UI) vs monolítico (1 llamada)
 * con imagen de referencia, en modelos Gemini 3.x de Vertex Agent Platform.
 *
 * Uso:
 *   npm run probe:consolidated -- uploads/cafe-raices-ref.png
 *   npm run probe:consolidated -- uploads/cafe-raices-ref.png gemini-3.1-flash-lite
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const refArg = process.argv[2]
const modelOverride = process.argv[3]?.trim()
const refImagePath = refArg ? resolve(root, refArg) : resolve(root, 'uploads/cafe-raices-ref.png')

if (!existsSync(refImagePath)) {
  console.error('Imagen no encontrada:', refImagePath)
  console.error('Uso: npm run probe:consolidated -- <imagen-ref> [modelo]')
  process.exit(1)
}

const MODELS_TO_TRY = modelOverride
  ? [modelOverride]
  : ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite']

const BRIEF_PROMPT = `Landing page para 'Café Raíces': cafetería de especialidad.
Venta online de café de origen y suscripciones. Nav, hero, grid productos, suscripción, footer.
Estilo editorial cálido, serif en títulos, sans en cuerpo, paleta tostados y cremas.`

function log(msg) {
  console.log(msg)
}

async function listVertexGeminiModels() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (!credPath) return []
  const j = JSON.parse(readFileSync(credPath.startsWith('/') ? credPath : resolve(root, credPath), 'utf8'))
  const projectId = j.project_id
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1'
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    credentials: { client_email: j.client_email, private_key: j.private_key },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) return []
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models?pageSize=100`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    log(`  (list models: respuesta no JSON, status ${res.status})`)
    return []
  }
  if (!res.ok) return []
  return (data.models ?? [])
    .map((m) => m.name?.split('/').pop() ?? '')
    .filter((id) => id.includes('gemini'))
    .sort()
}

function scoreDesignMd(designMd, designMdIsRichEnough, REQUIRED_DESIGN_MD_SECTIONS) {
  const sectionHits = REQUIRED_DESIGN_MD_SECTIONS.filter((h) =>
    designMd.toLowerCase().includes(h.toLowerCase()),
  ).length
  const colorMatches = (designMd.match(/#[0-9a-fA-F]{3,8}/g) ?? []).length
  return {
    chars: designMd.length,
    richEnough: designMdIsRichEnough(designMd),
    sectionHits,
    sectionsTotal: REQUIRED_DESIGN_MD_SECTIONS.length,
    hexCount: colorMatches,
  }
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir = resolve(root, 'uploads', `consolidated-probe-${stamp}`)
  mkdirSync(outDir, { recursive: true })

  log('\n=== Vertex Agent Platform — modelos Gemini ===\n')
  const vertexModels = await listVertexGeminiModels()
  const interesting = vertexModels.filter(
    (id) =>
      id.includes('3.1') ||
      id.includes('3.5') ||
      id.includes('2.5-flash'),
  )
  for (const id of interesting) log(`  ${id}`)
  log(`\n(${vertexModels.length} modelos Gemini en ${process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1'})\n`)

  const refB64 = readFileSync(refImagePath).toString('base64')
  const ext = refImagePath.split('.').pop()?.toLowerCase()
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
  const images = [{ mimeType, data: refB64 }]

  const { generateAgentPlatformText } = await import('../src/lib/ai/vertexAgentPlatform.ts')
  const { inferDesignBriefFromPrompt } = await import('../src/lib/design/designBrief.ts')
  const { composeOrchestrationUserPrompt } = await import('../src/lib/design/designBrief.ts')
  const {
    runMonolithicDesignMdBuild,
    runSequentialDesignMdBuild,
    DESIGN_MD_BUILD_STEPS,
  } = await import('../src/lib/design/designMdSequential.ts')
  const { designMdIsRichEnough, REQUIRED_DESIGN_MD_SECTIONS } = await import(
    '../src/lib/design/designMd.ts'
  )
  const { inferVisualBriefFromImages } = await import('../src/lib/design/visualBriefInference.ts')

  const brief = inferDesignBriefFromPrompt(BRIEF_PROMPT)
  const baseUserPrompt = composeOrchestrationUserPrompt(brief)

  const report = {
    refImage: refImagePath,
    sequentialStepsInUi: 1 + DESIGN_MD_BUILD_STEPS.length,
    note: 'Por defecto orchestration usa runMonolithicDesignMdBuild (DESIGN_MD_SEQUENTIAL=1 para 13 pasos).',
    models: {},
  }

  log('=== Referencia ===')
  log(refImagePath)
  log(`Pasos UI solo design.md: ${report.sequentialStepsInUi} (design-md + ${DESIGN_MD_BUILD_STEPS.length} sub-pasos)\n`)

  for (const modelId of MODELS_TO_TRY) {
    if (vertexModels.length && !vertexModels.some((id) => id === modelId || id.startsWith(modelId))) {
      log(`⊘ ${modelId} — no listado en Vertex para esta región, omitiendo`)
      report.models[modelId] = { skipped: true, reason: 'not_in_vertex_list' }
      continue
    }

    log(`\n--- ${modelId} ---`)

    let visualAuditCalls = 0
    let visualMs = 0
    const tVisual = Date.now()
    try {
      visualAuditCalls = 1
      await inferVisualBriefFromImages({
        images,
        prompt: BRIEF_PROMPT,
        modelId,
      })
      visualMs = Date.now() - tVisual
      log(`  visual-audit: OK (${(visualMs / 1000).toFixed(1)}s)`)
    } catch (e) {
      visualMs = Date.now() - tVisual
      log(`  visual-audit: FALLÓ — ${e instanceof Error ? e.message : e}`)
      report.models[modelId] = { error: String(e) }
      continue
    }

    const callText = async (prompt, opts) => {
      return generateAgentPlatformText(prompt, {
        systemInstruction: opts.systemInstruction,
        model: opts.modelId,
        images: opts.images,
        signal: opts.signal,
        preferRealtime: true,
      })
    }

    const buildOpts = {
      brief,
      baseUserPrompt,
      modelId,
      images,
      callText,
    }

    let seqCalls = 0
    const phases = []
    const tSeq = Date.now()
    let seqResolved
    try {
      seqResolved = await runSequentialDesignMdBuild({
        ...buildOpts,
        send: (_t, phase) => phases.push(phase),
        callText: async (...args) => {
          seqCalls++
          return callText(...args)
        },
      })
    } catch (e) {
      log(`  secuencial: ERROR — ${e instanceof Error ? e.message : e}`)
      report.models[modelId] = { visualAuditMs: visualMs, sequentialError: String(e) }
      continue
    }
    const seqMs = Date.now() - tSeq
    const seqScore = scoreDesignMd(seqResolved.designMd, designMdIsRichEnough, REQUIRED_DESIGN_MD_SECTIONS)
    writeFileSync(resolve(outDir, `${modelId}-sequential-design.md`), seqResolved.designMd, 'utf8')

    let monoCalls = 0
    const tMono = Date.now()
    let monoResolved
    try {
      monoResolved = await runMonolithicDesignMdBuild({
        ...buildOpts,
        callText: async (...args) => {
          monoCalls++
          return callText(...args)
        },
      })
    } catch (e) {
      log(`  monolítico: ERROR — ${e instanceof Error ? e.message : e}`)
      report.models[modelId] = {
        visualAuditMs: visualMs,
        sequential: { calls: seqCalls, ms: seqMs, phases: phases.length, ...seqScore },
        monolithicError: String(e),
      }
      continue
    }
    const monoMs = Date.now() - tMono
    const monoScore = scoreDesignMd(monoResolved.designMd, designMdIsRichEnough, REQUIRED_DESIGN_MD_SECTIONS)
    writeFileSync(resolve(outDir, `${modelId}-monolithic-design.md`), monoResolved.designMd, 'utf8')

    const reduction =
      seqCalls > 0 ? `${Math.round((1 - monoCalls / seqCalls) * 100)}% menos llamadas` : 'n/a'

    log(`  secuencial: ${seqCalls} llamadas, ${(seqMs / 1000).toFixed(1)}s, rich=${seqScore.richEnough}, secciones=${seqScore.sectionHits}/${seqScore.sectionsTotal}`)
    log(`  monolítico: ${monoCalls} llamada(s), ${(monoMs / 1000).toFixed(1)}s, rich=${monoScore.richEnough}, secciones=${monoScore.sectionHits}/${monoScore.sectionsTotal}`)
    log(`  → ${reduction}; tiempo monolítico ${monoMs < seqMs ? 'menor' : 'mayor'} que secuencial`)

    report.models[modelId] = {
      visualAuditMs: visualMs,
      sequential: {
        llmCalls: seqCalls,
        uiPhases: phases.length,
        ms: seqMs,
        source: seqResolved.source,
        ...seqScore,
      },
      monolithic: {
        llmCalls: monoCalls,
        ms: monoMs,
        source: monoResolved.source,
        ...monoScore,
      },
      callReduction: seqCalls - monoCalls,
      timeRatio: seqMs > 0 ? Number((monoMs / seqMs).toFixed(2)) : null,
    }
  }

  writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')

  log('\n=== Resumen ===')
  log(`Informe: ${outDir}/report.json`)
  log('\nModelos Google Cloud (mayo 2026):')
  log('  • gemini-3.1-flash-lite — GA 7 may; más rápido y barato de la serie 3; contexto 1M')
  log('  • gemini-3.5-flash — GA 19 may; ~4× más rápido que frontier; contexto 1M; más caro')
  log('  • No existe "gemini-3.1-flash" sin -lite en catálogo; el Flash 3.1 es Flash-Lite')
  log('\nPipeline web actual con imagen: ~25 fases UI ≈ visual-audit + 13 design-md + layout + HTML + assets')
  log('design.md solo: consolidable de 14 fases UI → 1 llamada si se usa runMonolithicDesignMdBuild')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
