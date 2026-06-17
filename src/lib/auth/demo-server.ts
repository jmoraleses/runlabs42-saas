/** Constantes demo usables en API routes (sin 'use client'). */
export const DEMO_USER_ID = 'demo-user'
export const DEMO_USER_EMAIL = 'demo@runlabs42.com'

export function isDemoProjectId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('demo-')
}
