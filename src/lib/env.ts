import type { NextRequest } from 'next/server'

/**
 * Origen de la petición actual (dominio donde el usuario navega).
 * Usar en rutas API/callback OAuth para no redirigir a otro host (p. ej. *.vercel.app).
 */
export function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost ?? request.headers.get('host')
  if (host) {
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https'
    return `${proto}://${host}`
  }
  return request.nextUrl.origin
}

/**
 * URL base de la app. En Vercel usa VERCEL_URL automáticamente.
 * En local, NEXT_PUBLIC_APP_URL o localhost:3000.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3010'
}

/** Preview URL para proyectos en modo demo (configurable vía env). */
export function getDemoPreviewUrl(projectId: string): string {
  const base = process.env.NEXT_PUBLIC_DEMO_PREVIEW_BASE_URL?.trim().replace(/\/$/, '')
  if (base) return `${base}/${projectId}`
  return `${getAppUrl()}/demo/${projectId}`
}

export function isVercel(): boolean {
  return process.env.VERCEL === '1'
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** Despliegue Vercel: production | preview | development */
export function getVercelEnv(): string {
  return process.env.VERCEL_ENV ?? 'development'
}

/** Solo true si explícitamente quieres indexación (lanzamiento público). */
export function isSitePublic(): boolean {
  return process.env.NEXT_PUBLIC_SITE_PUBLIC === 'true'
}

/** Preview/staging: no indexar, no tratar como producción pública. */
export function isStagingDeployment(): boolean {
  if (!isSitePublic()) return true
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return true
  return false
}
