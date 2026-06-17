import 'server-only'

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { config as loadEnv } from 'dotenv'
import { createAdminClient } from '@/lib/supabase/admin'

export type GoogleCloudCredentials = {
  projectId: string
  clientEmail: string
  privateKey: string
  location: string
}

const GCP_ADMIN_SETTING_KEYS = [
  'google_cloud_credentials',
  'google_cloud',
  'gcp_service_account',
]

let envLoaded = false
let credentialsCache: GoogleCloudCredentials | null | undefined

function ensureEnv() {
  if (envLoaded || typeof window !== 'undefined') return
  envLoaded = true
  const localEnv = resolve(process.cwd(), '.env.local')
  if (existsSync(localEnv)) {
    loadEnv({ path: localEnv })
  }
}

export function parseServiceAccountJson(raw: string): Omit<GoogleCloudCredentials, 'location'> | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    const projectId = String(j.project_id ?? j.projectId ?? '').trim()
    const clientEmail = String(j.client_email ?? j.clientEmail ?? '').trim()
    const privateKey = String(j.private_key ?? j.privateKey ?? '')
      .trim()
      .replace(/\\n/g, '\n')
    if (!projectId || !clientEmail || !privateKey) return null
    return { projectId, clientEmail, privateKey }
  } catch {
    return null
  }
}

function parseServiceAccountFromObject(value: unknown): Omit<GoogleCloudCredentials, 'location'> | null {
  if (typeof value === 'string' && value.trim()) {
    return parseServiceAccountJson(value.trim())
  }
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.type === 'service_account' || row.private_key || row.privateKey) {
    return parseServiceAccountJson(JSON.stringify(row))
  }
  const projectId = String(row.projectId ?? row.project_id ?? '').trim()
  const clientEmail = String(row.clientEmail ?? row.client_email ?? '').trim()
  const privateKey = String(row.privateKey ?? row.private_key ?? '')
    .trim()
    .replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

function resolveLocation(value: unknown, fallback?: string): string {
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    const loc = String(row.location ?? row.region ?? '').trim()
    if (loc) return loc
  }
  return (
    fallback?.trim() ||
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
    process.env.VERTEX_LOCATION?.trim() ||
    'us-central1'
  )
}

/** Cuenta de servicio desde variables de entorno o ADC (sin Supabase). */
export function loadServiceAccountFromEnv(): Omit<GoogleCloudCredentials, 'location'> | null {
  ensureEnv()

  const inline =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ??
    process.env.GOOGLE_CREDENTIALS?.trim()
  if (inline) {
    const parsed = parseServiceAccountJson(inline)
    if (parsed) return parsed
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (credPath) {
    const resolvedPath = credPath.startsWith('/')
      ? credPath
      : resolve(process.cwd(), credPath)
    try {
      if (existsSync(resolvedPath)) {
        const parsed = parseServiceAccountJson(readFileSync(resolvedPath, 'utf8'))
        if (parsed) return parsed
      }
    } catch {
      /* ignore */
    }
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

async function loadServiceAccountFromDb(): Promise<GoogleCloudCredentials | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('admin_settings')
      .select('key, value')
      .in('key', GCP_ADMIN_SETTING_KEYS)
    if (error) throw error

    for (const key of GCP_ADMIN_SETTING_KEYS) {
      const row = (data ?? []).find((x) => String(x.key) === key)
      const sa = parseServiceAccountFromObject(row?.value)
      if (sa) {
        return {
          ...sa,
          location: resolveLocation(row?.value),
        }
      }
    }
  } catch {
    return null
  }
  return null
}

/** Credenciales GCP: primero Supabase (admin_settings), luego env local. */
export async function loadGoogleCloudCredentials(): Promise<GoogleCloudCredentials | null> {
  if (credentialsCache !== undefined) return credentialsCache

  const fromDb = await loadServiceAccountFromDb()
  const sa = fromDb ?? (() => {
    const envSa = loadServiceAccountFromEnv()
    if (!envSa) return null
    return {
      ...envSa,
      location: resolveLocation(undefined),
    }
  })()

  credentialsCache = sa
  return sa
}

export function getGoogleCloudCredentialsCached(): GoogleCloudCredentials | null {
  return credentialsCache ?? null
}

export function invalidateGoogleCloudCredentialsCache(): void {
  credentialsCache = undefined
}

export async function getGoogleCloudAccessToken(
  creds: Pick<GoogleCloudCredentials, 'clientEmail' | 'privateKey'>,
): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    credentials: {
      client_email: creds.clientEmail,
      private_key: creds.privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  const token = tokenResponse.token
  if (!token) throw new Error('No se pudo obtener token OAuth de Google Cloud')
  return token
}

export async function isGoogleCloudConfigured(): Promise<boolean> {
  const creds = await loadGoogleCloudCredentials()
  return creds != null
}
