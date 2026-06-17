/**
 * In-memory rate limiter (dev/single-instance).
 * For production at scale, use Vercel KV / Upstash (T-027).
 */

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

export function rateLimitKey(userId: string | null, ip: string | null, route: string) {
  return `${route}:${userId ?? 'anon'}:${ip ?? 'unknown'}`
}
