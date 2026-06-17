import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import { runTemplateMonsterPublisher } from '@/lib/auto/marketplace/adapters/templateMonster'
import type { MarketplaceListing } from '@/lib/auto/marketplace/generateListingMetadata'

type Params = { params: Promise<{ projectId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    await requireStreamUser()
    const { projectId } = await params
    const body = await request.json()
    const variantId = String(body.variantId ?? '').trim()
    if (!variantId) throw new ApiError(400, 'variantId obligatorio')

    const ctx = await requireProjectFilesContext(projectId)
    const listingPath = `spec/marketplace-listings/${variantId}/listing.json`
    const listingFile = await ctx.store.get(listingPath)
    if (!listingFile) throw new ApiError(404, 'Listing no encontrado')

    const listing = JSON.parse(listingFile.content) as MarketplaceListing
    const packagePath = `spec/marketplace-listings/${variantId}/package.zip`
    const selectedPath = `spec/marketplace-listings/${variantId}/selected.json`
    const selectedFile = await ctx.store.get(selectedPath)
    const isSelected = selectedFile
      ? Boolean((JSON.parse(selectedFile.content) as Record<string, unknown>).selected)
      : false
    if (!isSelected) throw new ApiError(400, 'Marca la plantilla para subir antes de confirmar')

    const result = await runTemplateMonsterPublisher({
      listing,
      packagePath,
      publishMode: body.publishMode === 'auto' ? 'auto' : 'assist',
      variantId,
      send: () => {},
    })

    const logPath = `spec/marketplace-listings/${variantId}/submit-log.json`
    await ctx.store.put(
      logPath,
      JSON.stringify(
        {
          ...result,
          confirmedAt: new Date().toISOString(),
          userConfirmed: true,
        },
        null,
        2,
      ),
    )

    return NextResponse.json({ ok: true, result })
  } catch (e) {
    return jsonError(e)
  }
}
