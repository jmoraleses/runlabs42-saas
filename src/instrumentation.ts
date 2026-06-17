import { registerBenignSocketErrorHandlers } from '@/lib/server/benignSocketErrors'

export async function register() {
  registerBenignSocketErrorHandlers()

  if (process.env.NODE_ENV === 'development') return
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.server.config')
  }
}
