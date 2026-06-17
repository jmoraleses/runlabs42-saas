import { NextResponse } from 'next/server'
import { z } from 'zod'
export { dynamic } from '@/lib/api/routeSegment'
import { ApiError, jsonError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { buildMailtoUrl, sendContactEmail } from '@/lib/contact/sendContactEmail'

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10).max(5000),
  topic: z.enum(['enterprise', 'general']).optional(),
})

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
    const rl = rateLimit(rateLimitKey(null, ip, 'contact'), 8, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes. Inténtalo más tarde.')

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      throw new ApiError(400, 'Revisa los campos del formulario', {
        issues: parsed.error.flatten(),
      })
    }

    const payload = {
      ...parsed.data,
      company: parsed.data.company || undefined,
      topic: parsed.data.topic ?? 'general',
    }

    const result = await sendContactEmail(payload)

    if (result.ok) {
      return NextResponse.json({ ok: true })
    }

    if (result.reason === 'not_configured') {
      return NextResponse.json({
        ok: true,
        mailtoFallback: true,
        mailtoUrl: buildMailtoUrl(payload),
      })
    }

    throw new ApiError(502, 'No se pudo enviar el mensaje. Inténtalo de nuevo.')
  } catch (e) {
    return jsonError(e)
  }
}
