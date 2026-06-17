import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getSupabaseProjectRef } from '@/lib/supabase/project'
import { extractSupabaseProjectRef, validateUserSupabase } from './userSupabase'

const MANAGEMENT_API = 'https://api.supabase.com/v1'

export type ProvisionedSupabase = {
  projectRef: string
  url: string
  anonKey: string
  serviceRoleKey: string
  mode: 'provisioned' | 'platform'
}

type ManagementProject = {
  ref: string
  status: string
}

type ApiKeyRow = {
  name?: string
  type?: string
  api_key?: string
}

function managementToken(): string | null {
  return process.env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN ?? null
}

function orgSlug(): string | null {
  return process.env.SUPABASE_ORG_SLUG ?? null
}

function platformRegion(): string {
  return process.env.SUPABASE_PROVISION_REGION ?? 'eu-west-1'
}

async function managementFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = managementToken()
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN no configurado')

  const res = await fetch(`${MANAGEMENT_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase Management API (${res.status}): ${body || res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function userProjectSchemaSql(): string {
  const path = join(process.cwd(), 'supabase', 'user-project-schema.sql')
  return readFileSync(path, 'utf8')
}

function randomDbPassword(): string {
  return randomBytes(24).toString('base64url')
}

function projectName(userId: string): string {
  return `runlabs42-${userId.replace(/-/g, '').slice(0, 12)}`
}

async function waitForProjectReady(ref: string, maxMs = 300_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    const project = await managementFetch<ManagementProject>(`/projects/${ref}`)
    const status = project.status?.toUpperCase() ?? ''
    if (status.includes('ACTIVE') && !status.includes('INACTIVE')) return
    if (status.includes('FAILED') || status.includes('ERROR')) {
      throw new Error(`El proyecto Supabase no se pudo activar (${project.status})`)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('Tiempo de espera agotado al crear el proyecto Supabase')
}

async function fetchProjectApiKeys(ref: string): Promise<{ anonKey: string; serviceRoleKey: string }> {
  const keys = await managementFetch<ApiKeyRow[]>(`/projects/${ref}/api-keys?reveal=true`)
  const anonKey = keys.find((k) => k.name === 'anon' || k.type === 'anon')?.api_key
  const serviceRoleKey = keys.find((k) => k.name === 'service_role' || k.type === 'service_role')?.api_key

  if (!anonKey || !serviceRoleKey) {
    throw new Error('No se pudieron obtener las API keys del proyecto Supabase')
  }

  return { anonKey, serviceRoleKey }
}

async function applyUserSchema(ref: string): Promise<void> {
  const sql = userProjectSchemaSql()
  await managementFetch(`/projects/${ref}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  })
}

async function provisionDedicatedProject(userId: string): Promise<ProvisionedSupabase> {
  const slug = orgSlug()
  if (!slug) throw new Error('SUPABASE_ORG_SLUG no configurado')

  const created = await managementFetch<{ ref: string }>('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: projectName(userId),
      organization_slug: slug,
      db_pass: randomDbPassword(),
      region_selection: { type: 'specific', code: platformRegion() },
    }),
  })

  const ref = created.ref
  await waitForProjectReady(ref)
  await applyUserSchema(ref)

  const { anonKey, serviceRoleKey } = await fetchProjectApiKeys(ref)
  const url = `https://${ref}.supabase.co`

  const check = await validateUserSupabase(url, serviceRoleKey)
  if (!check.ok) throw new Error(check.message ?? 'No se pudo validar el proyecto Supabase')

  return { projectRef: ref, url, anonKey, serviceRoleKey, mode: 'provisioned' }
}

function provisionPlatformProject(): ProvisionedSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Supabase no está configurado en el servidor. Añade SUPABASE_ACCESS_TOKEN y SUPABASE_ORG_SLUG para provisionar proyectos, o las variables de la plataforma.',
    )
  }

  const projectRef = extractSupabaseProjectRef(url) ?? getSupabaseProjectRef()
  if (!projectRef) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida de Supabase (*.supabase.co) en modo plataforma.',
    )
  }
  return { projectRef, url, anonKey, serviceRoleKey, mode: 'platform' }
}

/** Crea o reutiliza un proyecto Supabase para el usuario y devuelve credenciales listas para guardar. */
export async function provisionUserSupabase(userId: string): Promise<ProvisionedSupabase> {
  if (managementToken() && orgSlug()) {
    try {
      return await provisionDedicatedProject(userId)
    } catch (e) {
      if (process.env.NODE_ENV === 'production') throw e
      console.warn('[supabaseProvision] provision dedicado falló, usando plataforma:', e)
    }
  }

  const platform = provisionPlatformProject()
  const check = await validateUserSupabase(platform.url, platform.serviceRoleKey)
  if (!check.ok) throw new Error(check.message ?? 'No se pudo validar Supabase de la plataforma')
  return platform
}
