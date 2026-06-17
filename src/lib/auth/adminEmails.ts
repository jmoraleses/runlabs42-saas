import { DEMO_USER_EMAIL } from '@/lib/auth/demo-server'

/** Emails con acceso al panel de administración (configurar en ADMIN_EMAILS). */
export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean) ?? []
  const emails = [...fromEnv]
  if (process.env.NODE_ENV === 'development') {
    emails.push(DEMO_USER_EMAIL)
  }
  return [...new Set(emails)]
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && getAdminEmails().includes(email)
}
