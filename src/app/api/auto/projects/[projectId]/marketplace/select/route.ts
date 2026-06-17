import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

type Params = { params: Promise<{ projectId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    await requireStreamUser()
    const { projectId } = await params
    const body = (await request.json()) as Record<string, unknown>
    const variantId = String(body.variantId ?? '').trim()
    if (!variantId) throw new ApiError(400, 'variantId obligatorio')
    const selected = body.selected !== false

    const ctx = await requireProjectFilesContext(projectId)
    await ctx.store.put(
      `spec/marketplace-listings/${variantId}/selected.json`,
      JSON.stringify(
        {
          variantId,
          selected,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    )

    return NextResponse.json({ ok: true, variantId, selected })
  } catch (e) {
    return jsonError(e)
  }
}
