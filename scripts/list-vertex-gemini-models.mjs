#!/usr/bin/env node
/**
 * Lista modelos Gemini publicados en Vertex AI para el proyecto/región configurados.
 * Uso: node scripts/list-vertex-gemini-models.mjs
 */
import { config } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
config({ path: resolve(root, '.env.local') })

function loadCreds() {
  const inline =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ??
    process.env.GOOGLE_CREDENTIALS?.trim()
  if (inline) {
    const j = JSON.parse(inline)
    return {
      projectId: String(j.project_id ?? j.projectId ?? '').trim(),
      clientEmail: String(j.client_email ?? j.clientEmail ?? '').trim(),
      privateKey: String(j.private_key ?? j.privateKey ?? '').replace(/\\n/g, '\n'),
    }
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (credPath) {
    const abs = credPath.startsWith('/') ? credPath : resolve(root, credPath)
    if (existsSync(abs)) {
      const j = JSON.parse(readFileSync(abs, 'utf8'))
      return {
        projectId: String(j.project_id ?? '').trim(),
        clientEmail: String(j.client_email ?? '').trim(),
        privateKey: String(j.private_key ?? '').replace(/\\n/g, '\n'),
      }
    }
  }
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n')
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey }
  }
  return null
}

async function main() {
  const creds = loadCreds()
  if (!creds?.projectId) {
    console.error('No hay credenciales Vertex en .env.local')
    process.exit(1)
  }
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'us-central1'
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    credentials: {
      client_email: creds.clientEmail,
      private_key: creds.privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) {
    console.error('No se pudo obtener token OAuth')
    process.exit(1)
  }

  const base = `https://${location}-aiplatform.googleapis.com/v1`
  const parent = `projects/${creds.projectId}/locations/${location}/publishers/google`
  const url = `${base}/${parent}/models?pageSize=100`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('Error', res.status, JSON.stringify(data, null, 2))
    process.exit(1)
  }

  const models = (data.models ?? [])
    .map((m) => m.name?.split('/').pop() ?? '')
    .filter((id) => id.includes('gemini'))
    .sort()

  console.log(`Proyecto: ${creds.projectId}`)
  console.log(`Región: ${location}`)
  console.log(`Modelos Gemini (${models.length}):\n`)
  for (const id of models) console.log(`  - ${id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
