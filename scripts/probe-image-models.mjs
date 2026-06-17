#!/usr/bin/env node
/**
 * Prueba modelos de imagen Vertex y lista cuáles responden.
 * Uso: node scripts/probe-image-models.mjs
 */
import { config } from 'dotenv'
import { resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
config({ path: resolve(root, '.env.local') })

const { probeVertexImageModel, DESIGN_ASSET_IMAGE_PROBE_CANDIDATES } = await import(
  '../src/lib/ai/vertexImageModelProbe.ts'
)

const preferred = process.env.DESIGN_ASSET_GEN_MODEL?.trim()
const order = preferred
  ? [preferred, ...DESIGN_ASSET_IMAGE_PROBE_CANDIDATES.filter((id) => id !== preferred)]
  : [...DESIGN_ASSET_IMAGE_PROBE_CANDIDATES]

console.log('Probando modelos de imagen Vertex (prompt mínimo)…\n')

const results = []
for (const modelId of order) {
  const t0 = Date.now()
  let ok = false
  let error = ''
  try {
    ok = await probeVertexImageModel(modelId)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  const ms = Date.now() - t0
  results.push({ modelId, ok, ms, error })
  console.log(`${ok ? '✓' : '✗'} ${modelId} (${ms}ms)${error ? ` — ${error.slice(0, 100)}` : ''}`)
}

const working = results.filter((r) => r.ok).map((r) => r.modelId)
console.log('\n---')
if (working.length) {
  console.log('Usar (en orden):', working.join(', '))
  console.log('\nSugerencia .env.local:')
  console.log(`DESIGN_ASSET_GEN_MODEL=${working[0]}`)
} else {
  console.log('Ningún modelo respondió. Revisa cuota Vertex y GOOGLE_APPLICATION_CREDENTIALS.')
  process.exitCode = 1
}
