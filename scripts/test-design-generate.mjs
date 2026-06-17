#!/usr/bin/env node
/**
 * Prueba E2E del pipeline de orquestación: POST design/generate (SSE) en localhost.
 * Uso: node scripts/test-design-generate.mjs [projectId] [prompt]
 */
import { config } from 'dotenv'
import { existsSync, readdirSync } from 'fs'
import { resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
config({ path: resolve(root, '.env.local') })

const baseUrl = process.env.TEST_BASE_URL?.trim() || 'http://localhost:3010'
const prompt =
  process.argv[3]?.trim() ||
  'Landing minimalista para app de finanzas, azul y blanco, 2 pantallas: inicio y precios'

function findDemoProjectId() {
  const arg = process.argv[2]?.trim()
  if (arg) return arg
  const dir = resolve(root, '.data/local-projects')
  if (!existsSync(dir)) return null
  const ids = readdirSync(dir).filter((d) => d.startsWith('demo-'))
  return ids[0] ?? null
}

const projectId = findDemoProjectId()
if (!projectId) {
  console.error('No hay projectId. Pásalo como argumento o crea un proyecto demo en el editor.')
  process.exit(1)
}

console.log(`POST ${baseUrl}/api/projects/${projectId}/design/generate`)
console.log(`Prompt: ${prompt}\n`)

const res = await fetch(`${baseUrl}/api/projects/${projectId}/design/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: 'runlabs_demo=1',
  },
  body: JSON.stringify({
    prompt,
    projectName: 'Test Finanzas',
    framework: 'react',
    device: 'desktop',
    stream: true,
    brief: {
      siteType: 'landing',
      brandTone: 'corporativo sofisticado',
      businessModel: 'fintech B2B',
      requiredSections: ['pricing'],
    },
  }),
})

if (!res.ok) {
  const err = await res.text()
  console.error(`HTTP ${res.status}:`, err.slice(0, 500))
  process.exit(1)
}

const reader = res.body?.getReader()
if (!reader) {
  console.error('Sin cuerpo SSE')
  process.exit(1)
}

const decoder = new TextDecoder()
let buffer = ''
let phases = []
let filesPayload = null
let errorMsg = null

while (true) {
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
        process.stdout.write(`  phase: ${data}\n`)
      }
      if (type === 'files') filesPayload = JSON.parse(data)
      if (type === 'error') errorMsg = data
    } catch {
      /* ignore */
    }
  }
}

if (errorMsg) {
  console.error('\nError:', errorMsg)
  process.exit(1)
}

const paths = filesPayload?.paths ?? []
const htmlPaths = paths.filter((p) => p.endsWith('.html') && p.startsWith('design/'))
const specPaths = paths.filter((p) => p === 'spec/design.json' || p.startsWith('spec/design-'))
console.log('\n--- Resultado ---')
console.log('Fases:', phases.join(' → '))
console.log('Archivos:', paths.length)
console.log('HTML lienzo:', htmlPaths.length, htmlPaths.slice(0, 5))
console.log('Spec/orquestación:', specPaths)
console.log('Páginas:', filesPayload?.pages?.length ?? 0)

const expectedPhases = ['visual-identity', 'layout-planning', 'content-generation']
const missingPhase = expectedPhases.find((p) => !phases.includes(p))
if (missingPhase) {
  console.warn(`\nAviso: no se vio la fase ${missingPhase} (¿Vertex desactivado o mock?)`)
}

if (htmlPaths.length === 0 && paths.length === 0) {
  console.error('\nFallo: no se generaron archivos de diseño')
  process.exit(1)
}

console.log('\nOK — orquestación completada (o mock parcial)')
