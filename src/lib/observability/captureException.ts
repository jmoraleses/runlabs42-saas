/** Captura en Sentry solo en producción con DSN (sin tocar OpenTelemetry de Next en dev). */
export async function captureException(error: unknown): Promise<void> {
  if (process.env.NODE_ENV === 'development') return
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureException(error)
}
