#!/usr/bin/env node
/**
 * Despliega DesignOrchestratorAgent en Vertex AI Agent Engine.
 * Carga .env.local (mismo criterio que check-vertex-env.mjs).
 *
 * Uso:
 *   node scripts/deploy-design-agent-studio.mjs
 *   node scripts/deploy-design-agent-studio.mjs --write-env
 */
import { config } from 'dotenv'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const writeEnv = process.argv.includes('--write-env')
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()
const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() ?? 'us-central1'
const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()

if (!projectId) {
  console.error('Falta GOOGLE_CLOUD_PROJECT_ID en .env.local')
  process.exit(1)
}

const adcPath = adc ? (adc.startsWith('/') ? adc : resolve(root, adc)) : null
if (!adcPath || !existsSync(adcPath)) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS no apunta a un archivo válido.')
  process.exit(1)
}

const bucket =
  process.env.AGENT_ENGINE_STAGING_BUCKET?.trim() ??
  `gs://${projectId}-agent-engine-staging`

console.log(`Proyecto: ${projectId}`)
console.log(`Región:   ${location}`)
console.log(`Bucket:   ${bucket}`)
console.log(`ADC:      ${adcPath}`)

const trial =
  ['1', 'true', 'yes'].includes(
    process.env.USE_GENAI_APP_BUILDER_TRIAL_CREDIT?.trim().toLowerCase() ?? '',
  )
if (trial) {
  console.warn(
    '\nℹ USE_GENAI_APP_BUILDER_TRIAL_CREDIT=1: las llamadas Vertex del agente siguen el crédito trial.',
  )
  console.warn('  Tras el deploy, DESIGN_AGENT_STUDIO_ENGINE activa run_orchestration.\n')
}

const pip = spawnSync(
  'pip3',
  [
    'install',
    '-q',
    '-r',
    resolve(root, 'agents/design-orchestrator/requirements.txt'),
  ],
  { stdio: 'inherit', env: process.env },
)
if (pip.status !== 0) {
  console.error('pip install falló')
  process.exit(pip.status ?? 1)
}

const gsutil = spawnSync('gsutil', ['ls', bucket], { encoding: 'utf8' })
if (gsutil.status !== 0) {
  console.log(`Creando bucket ${bucket}…`)
  const mb = spawnSync('gsutil', ['mb', '-p', projectId, '-l', location, bucket], {
    stdio: 'inherit',
  })
  if (mb.status !== 0) {
    console.warn(
      'No se pudo crear el bucket automáticamente. Créalo manualmente o define AGENT_ENGINE_STAGING_BUCKET.',
    )
  }
}

console.log('\nDesplegando en Vertex Agent Engine (create o update in-place, 2–5 min)…\n')

const deploy = spawnSync(
  'python3',
  ['-u', resolve(root, 'agents/design-orchestrator/deploy.py')],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      GOOGLE_APPLICATION_CREDENTIALS: adcPath,
      GOOGLE_CLOUD_PROJECT_ID: projectId,
      GOOGLE_CLOUD_LOCATION: location,
      AGENT_ENGINE_STAGING_BUCKET: bucket,
    },
  },
)

if (deploy.status !== 0) {
  console.error('\nDespliegue falló (código', deploy.status, ')')
  console.error(
    'Revisa logs: https://console.cloud.google.com/logs/query?project=' + projectId,
  )
  process.exit(deploy.status ?? 1)
}

const deployLogPath = resolve(root, '.deploy-design-agent-last.log')
let deployLog = ''
try {
  deployLog = existsSync(deployLogPath) ? readFileSync(deployLogPath, 'utf8') : ''
} catch {
  /* opcional */
}

const resourceMatch = deployLog.match(/projects\/[^\s]+\/reasoningEngines\/[^\s]+/)
const resource = resourceMatch?.[0]
if (resource) {
  console.log('\n✓ Reasoning engine:', resource)
  console.log('\nAñade a .env.local:')
  console.log(`DESIGN_AGENT_STUDIO_ENGINE=${resource}`)

  if (writeEnv) {
    const envPath = resolve(root, '.env.local')
    let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
    if (/^DESIGN_AGENT_STUDIO_ENGINE=/m.test(content)) {
      content = content.replace(
        /^DESIGN_AGENT_STUDIO_ENGINE=.*$/m,
        `DESIGN_AGENT_STUDIO_ENGINE=${resource}`,
      )
    } else {
      content = `${content.trimEnd()}\nDESIGN_AGENT_STUDIO_ENGINE=${resource}\n`
    }
    writeFileSync(envPath, content)
    console.log('\n✓ Escrito en .env.local')
  }
}
