'use client'

import type { User as AuthUser } from '@supabase/supabase-js'
import type { UserProfile } from '@/hooks/useUser'
import type { IntegrationStatus } from '@/lib/integrations/types'
import type { Project } from '@/types'
import { ensureDemoSeedData } from '@/lib/auth/demo-seed'
import {
  isSpecWorkspacePath,
  migrateLegacySpecPath,
  migrateSpecFiles,
} from '@/lib/projects/specPaths'

export const DEMO_STORAGE_KEY = 'runlabs_demo'
export const DEMO_PROFILE_STORAGE_KEY = 'runlabs_demo_profile'
export const DEMO_INTEGRATIONS_STORAGE_KEY = 'runlabs_demo_integrations'
export const DEMO_SPEC_STORAGE_KEY = 'runlabs_demo_spec'
export const DEMO_PROJECTS_STORAGE_KEY = 'runlabs_demo_projects'
export const DEMO_PROJECT_SPECS_STORAGE_KEY = 'runlabs_demo_project_specs'
export const DEMO_PROJECT_FILES_STORAGE_KEY = 'runlabs_demo_project_files'
export const DEMO_MARKETPLACE_STORAGE_KEY = 'runlabs_demo_marketplace'
export const DEMO_EVENT = 'runlabs:demo-change'

export type DemoProjectFile = {
  path: string
  content: string
  language?: string | null
}

export function isDemoProjectId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('demo-')
}

export type DemoIntegrationsPatch = {
  supabase?: boolean
  vercel?: boolean
}

export type DemoProfilePatch = {
  fullName?: string | null
  bio?: string | null
  avatarUrl?: string | null
  username?: string | null
  credits?: number
  plan?: string
  subscriptionStatus?: string | null
  subscriptionPeriodEnd?: string | null
  stripeSubscriptionId?: string | null
}

export function loadDemoProfilePatch(): DemoProfilePatch {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DEMO_PROFILE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DemoProfilePatch) : {}
  } catch {
    return {}
  }
}

export function saveDemoProfilePatch(patch: DemoProfilePatch) {
  if (typeof window === 'undefined') return
  const next = { ...loadDemoProfilePatch(), ...patch }
  writeJson(DEMO_PROFILE_STORAGE_KEY, next)
  window.dispatchEvent(new Event(DEMO_EVENT))
}

function demoSubscriptionPeriodEndDefault(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

/** Perfil demo con parches de localStorage (ajustes, cancelación simulada). */
export function resolveDemoProfile(): UserProfile {
  const patch = loadDemoProfilePatch()
  const plan = patch.plan === 'demo' ? 'starter' : (patch.plan ?? DEMO_PROFILE.plan)
  return {
    ...DEMO_PROFILE,
    fullName: patch.fullName ?? DEMO_PROFILE.fullName,
    bio: patch.bio ?? DEMO_PROFILE.bio,
    avatarUrl: patch.avatarUrl ?? DEMO_PROFILE.avatarUrl,
    username: patch.username ?? DEMO_PROFILE.username,
    credits: patch.credits ?? DEMO_PROFILE.credits,
    plan,
    subscriptionStatus:
      patch.subscriptionStatus ?? DEMO_PROFILE.subscriptionStatus ?? 'active',
    subscriptionPeriodEnd:
      patch.subscriptionPeriodEnd ??
      DEMO_PROFILE.subscriptionPeriodEnd ??
      demoSubscriptionPeriodEndDefault(),
    stripeSubscriptionId:
      patch.stripeSubscriptionId ?? DEMO_PROFILE.stripeSubscriptionId,
  }
}

export function loadDemoIntegrationsPatch(): DemoIntegrationsPatch {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DEMO_INTEGRATIONS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DemoIntegrationsPatch) : {}
  } catch {
    return {}
  }
}

export function loadDemoIntegrationStatus(): IntegrationStatus {
  const patch = loadDemoIntegrationsPatch()
  return {
    supabase: {
      connected: !!patch.supabase,
      projectRef: null,
      url: null,
      connectedAt: null,
    },
    github: {
      connected: false,
      login: null,
      connectedAt: null,
      oauthConfigured: false,
    },
    vercel: {
      connected: !!patch.vercel,
      teamId: null,
      connectedAt: null,
    },
    figma: {
      connected: false,
      userId: null,
      connectedAt: null,
      oauthConfigured: false,
    },
    ready: true,
  }
}

export function loadDemoSpec(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(DEMO_SPEC_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveDemoSpec(content: string) {
  if (typeof window === 'undefined') return
  if (!trySetItem(DEMO_SPEC_STORAGE_KEY, content)) {
    evictProjectFiles()
    trySetItem(DEMO_SPEC_STORAGE_KEY, content)
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function trySetItem(key: string, serialized: string): boolean {
  try {
    window.localStorage.setItem(key, serialized)
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') return false
    return false
  }
}

function evictProjectFiles(keepProjectId?: string) {
  try {
    const all = readJson<Record<string, DemoProjectFile[]>>(DEMO_PROJECT_FILES_STORAGE_KEY, {})
    const keys = Object.keys(all).filter((id) => id !== keepProjectId)
    if (keys.length === 0) {
      // No other projects to evict — truncate large files in current project
      if (keepProjectId && all[keepProjectId]) {
        all[keepProjectId] = all[keepProjectId]!.map((f) =>
          f.content.length > 2000 ? { ...f, content: f.content.slice(0, 2000) } : f,
        )
      }
    } else {
      // Remove oldest half of other projects
      keys.slice(0, Math.max(1, Math.ceil(keys.length / 2))).forEach((id) => {
        delete all[id]
      })
    }
    const serialized = JSON.stringify(all)
    if (!trySetItem(DEMO_PROJECT_FILES_STORAGE_KEY, serialized)) {
      try { window.localStorage.removeItem(DEMO_PROJECT_FILES_STORAGE_KEY) } catch { /* ignore */ }
    }
  } catch {
    try { window.localStorage.removeItem(DEMO_PROJECT_FILES_STORAGE_KEY) } catch { /* ignore */ }
  }
}

/** Quita data URLs y entradas antiguas del marketplace demo para liberar cuota. */
function evictMarketplaceStorage(keepProductId?: string) {
  try {
    type MpRow = {
      id: string
      previewUrl?: string | null
      coverImages?: string[] | null
    }
    const mp = readJson<MpRow[]>(DEMO_MARKETPLACE_STORAGE_KEY, [])
    const slim = (p: MpRow): MpRow => ({
      ...p,
      previewUrl: p.previewUrl?.startsWith('data:') ? null : p.previewUrl ?? null,
      coverImages:
        p.coverImages
          ?.filter((u) => typeof u === 'string' && !u.startsWith('data:') && u.length < 2048)
          .slice(0, 1) ?? null,
    })
    const seed = mp.filter((p) => p.id.startsWith('demo-mp-')).map(slim)
    const user = mp.filter((p) => !p.id.startsWith('demo-mp-')).map(slim)
    const kept = keepProductId ? user.filter((p) => p.id === keepProductId) : []
    const rest = user.filter((p) => p.id !== keepProductId)
    const dropCount = Math.max(0, Math.ceil(rest.length / 2))
    const next = [...seed, ...kept, ...rest.slice(dropCount)]
    const serialized = JSON.stringify(next)
    if (!trySetItem(DEMO_MARKETPLACE_STORAGE_KEY, serialized)) {
      try { window.localStorage.removeItem(DEMO_MARKETPLACE_STORAGE_KEY) } catch { /* ignore */ }
    }
  } catch {
    try { window.localStorage.removeItem(DEMO_MARKETPLACE_STORAGE_KEY) } catch { /* ignore */ }
  }
}

function evictDemoStorage(keepProjectId?: string, keepMarketplaceId?: string) {
  evictProjectFiles(keepProjectId)
  evictMarketplaceStorage(keepMarketplaceId)
}

function writeJson(
  key: string,
  value: unknown,
  evictHintProjectId?: string,
  evictHintMarketplaceId?: string,
): boolean {
  if (typeof window === 'undefined') return true
  const serialized = JSON.stringify(value)
  if (!trySetItem(key, serialized)) {
    evictDemoStorage(evictHintProjectId, evictHintMarketplaceId)
    if (!trySetItem(key, serialized)) return false
  }
  window.dispatchEvent(new Event(DEMO_EVENT))
  return true
}

export function writeDemoJson(
  key: string,
  value: unknown,
  evictHintProjectId?: string,
  evictHintMarketplaceId?: string,
): boolean {
  return writeJson(key, value, evictHintProjectId, evictHintMarketplaceId)
}

/** No guardar data URLs en marketplace demo (capturas base64 saturan localStorage). */
export function slimDemoMarketplaceMedia(
  previewUrl?: string | null,
  coverImages?: string[] | null,
): { previewUrl: string | null; coverImages: string[] | null } {
  const candidates = [
    ...(coverImages ?? []),
    ...(previewUrl ? [previewUrl] : []),
  ].filter(
    (u): u is string =>
      typeof u === 'string' && u.length > 0 && !u.startsWith('data:') && u.length < 2048,
  )
  const unique = [...new Set(candidates)].slice(0, 3)
  if (!unique.length) return { previewUrl: null, coverImages: null }
  return { previewUrl: unique[0] ?? null, coverImages: unique }
}

export function loadDemoProjects(): Project[] {
  return readJson<Project[]>(DEMO_PROJECTS_STORAGE_KEY, [])
}

export function findDemoProject(id: string): Project | null {
  return loadDemoProjects().find((p) => p.id === id) ?? null
}

export function loadDemoProjectFiles(projectId: string): DemoProjectFile[] {
  const all = readJson<Record<string, DemoProjectFile[]>>(DEMO_PROJECT_FILES_STORAGE_KEY, {})
  return migrateSpecFiles(all[projectId] ?? [])
}

export function saveDemoProjectFiles(projectId: string, files: DemoProjectFile[]) {
  const all = readJson<Record<string, DemoProjectFile[]>>(DEMO_PROJECT_FILES_STORAGE_KEY, {})
  all[projectId] = files
  writeJson(DEMO_PROJECT_FILES_STORAGE_KEY, all, projectId)
}

export function upsertDemoProjectFile(projectId: string, path: string, content: string) {
  const normalizedPath = migrateLegacySpecPath(path)
  const files = loadDemoProjectFiles(projectId)
  const idx = files.findIndex((f) => f.path === normalizedPath)
  const next = {
    path: normalizedPath,
    content,
    language: path.endsWith('.tsx') ? 'typescript' : 'plaintext',
  }
  if (idx >= 0) files[idx] = { ...files[idx], ...next }
  else files.push(next)
  saveDemoProjectFiles(projectId, files)
}

export function removeDemoProjectFile(projectId: string, path: string) {
  if (isSpecWorkspacePath(path)) return
  saveDemoProjectFiles(
    projectId,
    loadDemoProjectFiles(projectId).filter((f) => f.path !== path),
  )
}

/** Primer proyecto demo en localStorage, sin efectos secundarios. */
export function getDefaultDemoProject(): Project | null {
  const existing = loadDemoProjects()
  return existing[0] ?? null
}

/** Crea un proyecto demo solo cuando el usuario lo pide explícitamente (landing, probar demo). */
export function getOrCreateDefaultDemoProject(name = 'Proyecto demo'): Project {
  const existing = loadDemoProjects()
  if (existing.length > 0 && name === 'Proyecto demo') return existing[0]!
  return createDemoProject(name)
}

/** Ruta del editor con proyecto demo (query `project`). No crea proyectos. */
export function demoEditorPath(projectId?: string): string {
  if (projectId && isDemoProjectId(projectId) && findDemoProject(projectId)) {
    return `/studio?project=${encodeURIComponent(projectId)}`
  }
  const fallback = getDefaultDemoProject()
  if (fallback) return `/studio?project=${encodeURIComponent(fallback.id)}`
  return '/studio'
}

export function createDemoProject(name: string, framework = 'react'): Project {
  const now = new Date().toISOString()
  const project: Project = {
    id: `demo-${crypto.randomUUID()}`,
    userId: DEMO_USER.id,
    name: name.trim() || 'Nuevo proyecto',
    description: null,
    framework,
    status: 'draft',
    public: false,
    createdAt: now,
    updatedAt: now,
    targetPlatforms: ['web', 'ios', 'android'],
    mobileConfig: null,
    mobileReadiness: null,
    deployedUrl: null,
    designPhase: 'design',
    codeTemplate: 'html',
  }
  writeJson(DEMO_PROJECTS_STORAGE_KEY, [project, ...loadDemoProjects()])
  saveDemoProjectFiles(project.id, [])
  return project
}

/** Registra un proyecto demo con id fijo (p. ej. demo-auto-xxx tras corrida /auto). */
export function registerDemoAutoProject(
  id: string,
  name: string,
  framework = 'html',
): Project {
  if (!isDemoProjectId(id)) {
    throw new Error('El id debe empezar por demo-')
  }
  const trimmedName = name.trim() || 'Auto Store'
  const existing = findDemoProject(id)
  if (existing) {
    return (
      updateDemoProject(id, {
        name: trimmedName,
        framework,
        designPhase: 'design',
        codeTemplate: 'html',
      }) ?? existing
    )
  }
  const now = new Date().toISOString()
  const project: Project = {
    id,
    userId: DEMO_USER.id,
    name: trimmedName,
    description: 'Generado por Auto (Stitch → importación local)',
    framework,
    status: 'draft',
    public: false,
    createdAt: now,
    updatedAt: now,
    targetPlatforms: ['web'],
    mobileConfig: null,
    mobileReadiness: null,
    deployedUrl: null,
    designPhase: 'design',
    codeTemplate: 'html',
  }
  writeJson(DEMO_PROJECTS_STORAGE_KEY, [
    project,
    ...loadDemoProjects().filter((p) => p.id !== id),
  ])
  return project
}

export function updateDemoProject(
  id: string,
  patch: Partial<
    Pick<
      Project,
      | 'name'
      | 'description'
      | 'framework'
      | 'deployedUrl'
      | 'coverUrl'
      | 'coverImages'
      | 'marketplaceListed'
      | 'targetPlatforms'
      | 'mobileConfig'
      | 'mobileReadiness'
      | 'lastMobileBuildAt'
      | 'designPhase'
      | 'designApprovedAt'
      | 'codeTemplate'
    >
  >,
): Project | null {
  const projects = loadDemoProjects()
  let updated: Project | null = null
  const next = projects.map((p) => {
    if (p.id !== id) return p
    updated = {
      ...p,
      ...patch,
      name: patch.name != null ? String(patch.name).trim() || p.name : p.name,
      updatedAt: new Date().toISOString(),
    }
    return updated
  })
  if (!updated) return null
  writeJson(DEMO_PROJECTS_STORAGE_KEY, next)
  window.dispatchEvent(new Event(DEMO_EVENT))
  return updated
}

export function removeDemoProject(id: string) {
  writeJson(
    DEMO_PROJECTS_STORAGE_KEY,
    loadDemoProjects().filter((p) => p.id !== id),
  )
  const specs = readJson<Record<string, string>>(DEMO_PROJECT_SPECS_STORAGE_KEY, {})
  if (specs[id]) {
    delete specs[id]
    writeJson(DEMO_PROJECT_SPECS_STORAGE_KEY, specs)
  }
  const allFiles = readJson<Record<string, DemoProjectFile[]>>(DEMO_PROJECT_FILES_STORAGE_KEY, {})
  if (allFiles[id]) {
    delete allFiles[id]
    writeJson(DEMO_PROJECT_FILES_STORAGE_KEY, allFiles)
  }
  if (typeof window !== 'undefined') {
    void fetch(`/api/projects/${encodeURIComponent(id)}/files?purge=1`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => undefined)
  }
}

export function loadDemoProjectSpec(projectId: string): string {
  const specs = readJson<Record<string, string>>(DEMO_PROJECT_SPECS_STORAGE_KEY, {})
  return specs[projectId] ?? ''
}

export function saveDemoProjectSpec(projectId: string, content: string) {
  const specs = readJson<Record<string, string>>(DEMO_PROJECT_SPECS_STORAGE_KEY, {})
  specs[projectId] = content
  writeJson(DEMO_PROJECT_SPECS_STORAGE_KEY, specs)
}

export function saveDemoIntegrationsPatch(patch: DemoIntegrationsPatch) {
  if (typeof window === 'undefined') return
  const next = { ...loadDemoIntegrationsPatch(), ...patch }
  writeJson(DEMO_INTEGRATIONS_STORAGE_KEY, next)
}

/** Activo en localStorage/cookie; desactivar con NEXT_PUBLIC_DEMO_DISABLED=1. */
export function isDemoActive(): boolean {
  if (typeof window === 'undefined') return false
  if (process.env.NEXT_PUBLIC_DEMO_DISABLED === '1') return false
  if (window.localStorage.getItem(DEMO_STORAGE_KEY) === '1') return true
  return document.cookie.split(';').some((c) => c.trim() === `${DEMO_STORAGE_KEY}=1`)
}

/** Modo demo en rutas API (lee cookie enviada por el navegador). */
export function isDemoActiveFromRequest(cookieHeader: string | null | undefined): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_DISABLED === '1') return false
  if (!cookieHeader) return false
  return cookieHeader.split(';').some((part) => {
    const trimmed = part.trim()
    return trimmed === `${DEMO_STORAGE_KEY}=1` || trimmed.startsWith(`${DEMO_STORAGE_KEY}=1;`)
  })
}

/** Auto-activar cuenta demo en `npm run dev` (localhost). */
export function shouldAutoEnableLocalDemo(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_DISABLED === '1') return false
  if (process.env.NEXT_PUBLIC_AUTO_DEMO === '0') return false
  return process.env.NODE_ENV === 'development'
}

/** Sesión Supabase en caché aún válida (misma lógica que useUser.readCachedUser). */
function hasCachedSupabaseAuth(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const ref = url.replace('https://', '').split('.')[0]
    if (!ref) return false
    for (const key of [`sb-${ref}-auth-token`, `sb-${ref}-auth-token-code-verifier`]) {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as { user?: unknown; expires_at?: number } | null
        if (!parsed?.user) continue
        if (parsed.expires_at && Date.now() / 1000 > parsed.expires_at) continue
        return true
      } catch {
        continue
      }
    }
    return false
  } catch {
    return false
  }
}

/** Activa demo en dev si no hay sesión Supabase real. */
export function bootstrapLocalDemoIfNeeded(): void {
  if (typeof window === 'undefined') return
  if (!shouldAutoEnableLocalDemo()) return
  if (hasCachedSupabaseAuth()) return
  if (!isDemoActive()) enableDemo()
}

/** Importar desde GitHub: cuenta real o modo demo local. */
export function canUseGithubImport(
  user: { id?: string } | null | undefined,
  profile?: { id?: string; plan?: string } | null,
): boolean {
  return hasRealAccount(user, profile) || shouldUseDemoData(profile)
}

/** Sesión Supabase real (no cuenta demo local). */
export function hasRealAccount(
  user: { id?: string } | null | undefined,
  profile?: { id?: string; plan?: string } | null,
): boolean {
  if (!user?.id) return false
  if (isDemoActive()) return false
  if (user.id === DEMO_USER.id || profile?.id === DEMO_USER.id) return false
  return true
}

/** Cuenta demo local: no llamar APIs que requieren sesión Supabase real. */
export function shouldUseDemoData(profile?: { id?: string; plan?: string } | null): boolean {
  if (isDemoActive()) return true
  if (profile?.id === DEMO_USER.id) return true
  if (profile?.plan === 'demo') return true
  return false
}

export function enableDemo() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DEMO_STORAGE_KEY, '1')
  document.cookie = `${DEMO_STORAGE_KEY}=1; path=/; max-age=86400; samesite=lax`
  ensureDemoSeedData()
  window.dispatchEvent(new Event(DEMO_EVENT))
}

export function disableDemo() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DEMO_STORAGE_KEY)
  document.cookie = `${DEMO_STORAGE_KEY}=; path=/; max-age=0; samesite=lax`
  window.dispatchEvent(new Event(DEMO_EVENT))
}

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@example.com',
  app_metadata: { provider: 'demo', providers: ['demo'] },
  user_metadata: { full_name: 'Usuario Demo' },
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
} as unknown as AuthUser

export const DEMO_PROFILE: UserProfile = {
  id: 'demo-user',
  email: 'demo@example.com',
  fullName: 'Usuario Demo',
  avatarUrl: null,
  bio: 'Cuenta de demostración local.',
  username: 'demo',
  plan: 'starter',
  credits: 100,
  creditsRenewedAt: null,
  settings: {},
  subscriptionStatus: 'active',
  subscriptionPeriodEnd: demoSubscriptionPeriodEndDefault(),
  stripeSubscriptionId: 'demo_sub_local',
  hasStripeCustomer: false,
}
