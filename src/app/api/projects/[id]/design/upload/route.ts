import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { importCanvasImageToWorkspace } from '@/lib/design/importCanvasImage'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import { validateAndSanitizeImage } from '@/lib/storage/imageValidator'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-upload'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'Archivo requerido')

    const buffer = Buffer.from(await file.arrayBuffer())
    const validated = await validateAndSanitizeImage(buffer)

    const ctx = await requireDesignRouteContext(projectId)
    const result = await importCanvasImageToWorkspace(ctx, {
      buffer: validated.buffer,
      mimeType: validated.mimeType,
      fileName: file.name,
    })

    await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })

    return NextResponse.json({
      ok: true,
      pageId: result.pageId,
      path: result.path,
      pages: result.pages,
    })
  } catch (e) {
    return jsonError(e)
  }
}
