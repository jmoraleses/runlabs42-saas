#!/usr/bin/env node
import { config } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
config({ path: resolve(root, '.env.local') })

const keys = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CLOUD_PROJECT_ID',
  'GOOGLE_CLOUD_CLIENT_EMAIL',
  'GOOGLE_CLOUD_PRIVATE_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_CREDENTIALS',
  'GOOGLE_CLOUD_LOCATION',
  'VERTEX_LOCATION',
  'DESIGN_GEN_MODEL',
  'MOCKUP_GEN_MODEL',
  'MOCKUP_GEN_MODEL_FAST',
  'IMAGE_GEN_PROVIDER',
  'IMAGE_GEN_ALLOW_API_KEY',
  'ALLOW_GEMINI_API_KEY_FALLBACK',
  'AI_PROVIDER',
]

for (const k of keys) {
  const v = process.env[k]?.trim()
  if (!v) {
    console.log(`${k}: (no definida)`)
    continue
  }
  if (k.includes('KEY') || k.includes('JSON') || k.includes('CREDENTIALS') || k === 'GOOGLE_CREDENTIALS') {
    console.log(`${k}: definida (${v.length} caracteres)`)
  } else {
    console.log(`${k}: ${v}`)
  }
}

const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
if (adc) {
  const abs = adc.startsWith('/') ? adc : resolve(root, adc)
  console.log(`ADC ruta resuelta: ${abs}`)
  console.log(`ADC archivo existe: ${existsSync(abs)}`)
}

function loadServiceAccount() {
  const inline =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ??
    process.env.GOOGLE_CREDENTIALS?.trim()
  if (inline) {
    try {
      return JSON.parse(inline)
    } catch {
      return null
    }
  }
  if (adc) {
    const abs = adc.startsWith('/') ? adc : resolve(root, adc)
    if (existsSync(abs)) {
      try {
        return JSON.parse(readFileSync(abs, 'utf8'))
      } catch {
        return null
      }
    }
  }
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n')
  if (projectId && clientEmail && privateKey) {
    return { project_id: projectId, client_email: clientEmail, private_key: privateKey }
  }
  return null
}

async function smokeTestImagen4() {
  const sa = loadServiceAccount()
  if (!sa) {
    console.log('\nImagen 4 smoke test: omitido (sin credenciales GCP)')
    return
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() || sa.project_id
  const location =
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ??
    process.env.VERTEX_LOCATION?.trim() ??
    'us-central1'
  const model = process.env.MOCKUP_GEN_MODEL?.trim() || 'imagen-4.0-generate-001'

  if (process.argv.includes('--skip-imagen-smoke')) {
    console.log('\nImagen 4 smoke test: omitido (--skip-imagen-smoke)')
    return
  }

  try {
    const { GoogleAuth } = await import('google-auth-library')
    const auth = new GoogleAuth({
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const client = await auth.getClient()
    const tokenResponse = await client.getAccessToken()
    const token = tokenResponse.token
    if (!token) {
      console.log('\nImagen 4 smoke test: falló (sin bearer token)')
      return
    }

    const host =
      location === 'global'
        ? 'aiplatform.googleapis.com'
        : `${location}-aiplatform.googleapis.com`
    const url = `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt: 'Minimal blue and white finance app landing page UI mockup' }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.log(`\nImagen 4 smoke test: error ${res.status}`, data.error?.message ?? JSON.stringify(data).slice(0, 200))
      return
    }
    const hasImage = Boolean(data.predictions?.[0]?.bytesBase64Encoded)
    console.log(`\nImagen 4 smoke test (${model}): ${hasImage ? 'OK' : 'sin imagen en respuesta'}`)
  } catch (err) {
    console.log('\nImagen 4 smoke test: excepción', err instanceof Error ? err.message : err)
  }
}

await smokeTestImagen4()
