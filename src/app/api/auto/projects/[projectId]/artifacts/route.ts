import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireStreamUser()
    const { projectId } = await params
    const ctx = await requireProjectFilesContext(projectId)
    const files = await ctx.store.list()

    const runStateRaw = files.find((f) => f.path === 'spec/auto/run-state.json')?.content
    const runState = runStateRaw ? JSON.parse(runStateRaw) : null

    const variantsFromRun = Array.isArray(runState?.variants)
      ? (runState.variants as Array<Record<string, unknown>>)
      : []
    const listings = variantsFromRun.map((variant) => {
      const variantId = String(variant.id ?? '').trim()
      const listingPath = `spec/marketplace-listings/${variantId}/listing.json`
      const listingRaw = files.find((f) => f.path === listingPath)?.content
      let listing: Record<string, unknown> | null = null
      if (listingRaw) {
        try {
          listing = JSON.parse(listingRaw)
        } catch {
          listing = null
        }
      }
      const submitLogRaw = files.find(
        (x) => x.path === `spec/marketplace-listings/${variantId}/submit-log.json`,
      )?.content
      const selectedRaw = files.find(
        (x) => x.path === `spec/marketplace-listings/${variantId}/selected.json`,
      )?.content
      let selectedForMarketplace = false
      if (selectedRaw) {
        try {
          selectedForMarketplace = Boolean((JSON.parse(selectedRaw) as Record<string, unknown>).selected)
        } catch {
          selectedForMarketplace = false
        }
      }
      return {
        variantId,
        codeTemplate: String(variant.codeTemplate ?? ''),
        exportPrefix: String(variant.exportPrefix ?? ''),
        listing,
        submitLog: submitLogRaw ? JSON.parse(submitLogRaw) : null,
        coverUrl: listing?.coverImagePath
          ? `/api/auto/projects/${projectId}/asset/${listing.coverImagePath as string}`
          : null,
        packageUrl: `/api/auto/projects/${projectId}/asset/spec/marketplace-listings/${variantId}/package.zip`,
        selectedForMarketplace,
      }
    })

    const screens = files
      .filter((f) => f.path.startsWith('design/mockups/') && f.path.endsWith('.png'))
      .map((f) => ({
        pageId: f.path.replace('design/mockups/', '').replace(/\.png$/, ''),
        previewUrl: `/api/auto/projects/${projectId}/asset/${f.path}`,
      }))

    return NextResponse.json({
      projectId,
      runState,
      listings,
      screens,
      stitchRun: files.find((f) => f.path === 'spec/inspiration/stitch/run.json')?.content
        ? JSON.parse(files.find((f) => f.path === 'spec/inspiration/stitch/run.json')!.content)
        : null,
    })
  } catch (e) {
    return jsonError(e)
  }
}
