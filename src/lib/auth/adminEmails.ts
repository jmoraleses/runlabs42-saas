import { DEMO_USER_EMAIL } from '@/lib/auth/demo-server'

const DEFAULT_ADMIN_EMAILS = [
  'javiermoralesestevez@gmail.com',
  'runlabs42@gmail.com',
]

/** Emails con acceso al panel de administración (prod + dev). */
export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean)
  const base = fromEnv?.length ? fromEnv : DEFAULT_ADMIN_EMAILS
  if (process.env.NODE_ENV === 'development') {
    return [...new Set([...base, DEMO_USER_EMAIL])]
  }
  return base
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && getAdminEmails().includes(email)
}
