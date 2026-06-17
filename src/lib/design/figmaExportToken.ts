import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'

const TTL_MS = 60 * 60 * 1000

function secret(): string {
  return (
    process.env.INTEGRATIONS_ENCRYPTION_KEY ||
    process.env.FIGMA_OAUTH_CLIENT_SECRET ||
    'dev-figma-export-token'
  )
}

export function signFigmaExportToken(
  userId: string,
  projectId: string,
  exportId: string,
): string {
  const issuedAt = Date.now()
  const body = Buffer.from(
    JSON.stringify({ userId, projectId, exportId, issuedAt }),
    'utf8',
  ).toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyFigmaExportToken(
  token: string,
  projectId: string,
  exportId: string,
): { userId: string } | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      userId: string
      projectId: string
      exportId: string
      issuedAt: number
    }
    if (parsed.projectId !== projectId || parsed.exportId !== exportId) return null
    if (Date.now() - parsed.issuedAt > TTL_MS) return null
    return { userId: parsed.userId }
  } catch {
    return null
  }
}
