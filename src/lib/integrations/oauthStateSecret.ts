/** Secreto HMAC para firmar estado OAuth (CSRF). Obligatorio en producción. */
export function getOAuthStateSecret(providerClientSecret?: string): string {
  const key = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim()
  if (key && key.length >= 16) return key

  const client = providerClientSecret?.trim()
  if (client) return client

  if (process.env.NODE_ENV !== 'production') {
    return 'dev-oauth-state-signing-local-only'
  }

  throw new Error(
    'INTEGRATIONS_ENCRYPTION_KEY es obligatorio en producción para firmar el estado OAuth.',
  )
}
