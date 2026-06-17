import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { bundleProject, type PreviewFile } from '@/lib/preview/bundleProject'

export const runtime = 'nodejs'

const MAX_BYTES = 2_000_000

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(null, ip, 'preview-bundle'), 60)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas compilaciones; espera un momento')

    const body = (await request.json().catch(() => null)) as
      | { files?: PreviewFile[] }
      | null
    const files = body?.files
    if (!Array.isArray(files) || files.length === 0) {
      throw new ApiError(400, 'Se requieren archivos del proyecto')
    }

    let total = 0
    for (const f of files) {
      if (typeof f?.path !== 'string' || typeof f?.content !== 'string') {
        throw new ApiError(400, 'Formato de archivo inválido')
      }
      total += f.content.length
      if (total > MAX_BYTES) throw new ApiError(413, 'Proyecto demasiado grande para el preview')
    }

    const result = await bundleProject(files)
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return jsonError(error)
  }
}
