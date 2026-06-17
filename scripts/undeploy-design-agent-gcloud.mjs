#!/usr/bin/env node
/**
 * Elimina Reasoning Engines del orquestador de diseño y artefactos de staging en GCS.
 * Uso: node scripts/undeploy-design-agent-gcloud.mjs
 */
import { execSync } from 'child_process'

const project =
  process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() ||
  execSync('gcloud config get-value project', { encoding: 'utf8' }).trim()
const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1'
const displayName = 'spec-design-orchestrator'
const bucket = `${project}-agent-engine-staging`

function token() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
}

async function api(path, init = {}) {
  const res = await fetch(`https://${location}-aiplatform.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text, json: text ? JSON.parse(text) : {} }
}

async function listEngines() {
  const { ok, json } = await api(
    `projects/${project}/locations/${location}/reasoningEngines?pageSize=50`,
  )
  if (!ok) return []
  return (json.reasoningEngines ?? []).filter(
    (e) => e.displayName === displayName && e.name,
  )
}

async function deleteEngine(name) {
  console.log(`Eliminando ${name}…`)
  const { status, text } = await api(name, { method: 'DELETE' })
  if (status === 404) {
    console.log('  (ya no existe)')
    return
  }
  if (status !== 200 && status !== 204) {
    throw new Error(`DELETE ${name} → ${status}: ${text.slice(0, 400)}`)
  }
  console.log('  OK')
}

async function clearStaging() {
  try {
    execSync(`gsutil -m rm -r gs://${bucket}/agent_engine/** 2>/dev/null || true`, {
      stdio: 'inherit',
    })
  } catch {
  }
}

async function main() {
  console.log(`Proyecto: ${project} (${location})`)
  const engines = await listEngines()
  if (!engines.length) {
    console.log('No hay Reasoning Engines desplegados.')
  }
  for (const e of engines) {
    await deleteEngine(e.name)
  }

  const envEngine = process.env.DESIGN_AGENT_STUDIO_ENGINE?.trim()
  if (envEngine && !engines.some((e) => e.name === envEngine)) {
    await deleteEngine(envEngine.replace(/^https?:\/\/[^/]+\/v1\//, ''))
  }

  console.log(`Limpiando gs://${bucket}/agent_engine/…`)
  await clearStaging()
  console.log('Listo. Solo queda el uso de modelos Vertex (Gemini), no Agent Engine.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
