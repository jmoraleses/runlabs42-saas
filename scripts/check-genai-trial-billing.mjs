#!/usr/bin/env node
/**
 * Comprueba que la app está configurada para el crédito GenAI App Builder trial.
 */
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(root, '.env.local') })

const trial =
  ['1', 'true', 'yes'].includes(
    process.env.USE_GENAI_APP_BUILDER_TRIAL_CREDIT?.trim().toLowerCase() ?? '',
  )

console.log('=== Crédito GenAI App Builder (trial) ===\n')
console.log(`USE_GENAI_APP_BUILDER_TRIAL_CREDIT: ${trial ? 'activo' : 'inactivo'}`)

if (!trial) {
  console.log('\nPara usar el crédito trial, añade a .env.local:')
  console.log('  USE_GENAI_APP_BUILDER_TRIAL_CREDIT=1')
  console.log('\nVer docs/GENAI-APP-BUILDER-TRIAL.md')
  process.exit(0)
}

const checks = [
  {
    ok: Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()),
    label: 'GOOGLE_CLOUD_PROJECT_ID',
    fix: 'Proyecto GCP vinculado al crédito trial',
  },
  {
    ok: Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim(),
    ),
    label: 'Credenciales Vertex (ADC o JSON)',
    fix: 'GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_SERVICE_ACCOUNT_JSON',
  },
  {
    ok: process.env.AI_PROVIDER?.trim().toLowerCase() !== 'mock',
    label: 'AI_PROVIDER ≠ mock',
    fix: 'AI_PROVIDER=gemini',
  },
  {
    ok: !process.env.GEMINI_API_KEY?.trim() || process.env.ALLOW_GEMINI_API_KEY_FALLBACK !== '1',
    label: 'Sin facturación AI Studio (GEMINI_API_KEY)',
    fix: 'Quita GEMINI_API_KEY o ALLOW_GEMINI_API_KEY_FALLBACK=0',
  },
  {
    ok: !process.env.DESIGN_AGENT_STUDIO_ENGINE?.trim(),
    label: 'Sin Agent Engine desplegado (ahorra runtime)',
    fix: 'Comenta DESIGN_AGENT_STUDIO_ENGINE en modo trial',
  },
  {
    ok:
      process.env.DESIGN_IMAGE_GENERATION_ENABLED?.trim().toLowerCase() !== '1' &&
      process.env.DESIGN_IMAGE_GENERATION_ENABLED?.trim().toLowerCase() !== 'true',
    label: 'Imagen automática desactivada (recomendado)',
    fix: 'No definas DESIGN_IMAGE_GENERATION_ENABLED=1 salvo que necesites Imagen 4',
  },
]

let failed = 0
for (const c of checks) {
  const mark = c.ok ? '✓' : '✗'
  console.log(`${mark} ${c.label}`)
  if (!c.ok) {
    failed++
    console.log(`    → ${c.fix}`)
  }
}

const model =
  process.env.TRIAL_DESIGN_GEN_MODEL?.trim() ||
  process.env.DESIGN_GEN_MODEL?.trim() ||
  'gemini-2.5-flash-lite (por defecto en trial)'
console.log(`\nModelo diseño: ${model}`)

if (failed) {
  console.log(`\n${failed} comprobación(es) pendiente(s). Ajusta .env.local y vuelve a ejecutar.`)
  process.exit(1)
}

console.log('\nConfiguración alineada con el crédito trial. Verifica en GCP Billing que los SKUs son Vertex AI.')
process.exit(0)
