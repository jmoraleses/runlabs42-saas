import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireDesignRouteContext, updateProjectDesignMeta } from '@/lib/design/requireDesignRoute'
import {
  fetchStitchScreenAssets,
  listStitchScreens,
  normalizeStitchScreenId,
  normalizeStitchProjectId,
  type StitchScreenSummary,
} from '@/lib/design/stitchMcpClient'
import { importStitchSiteToProject } from '@/lib/auto/stitch/importStitchSiteToProject'

type Params = { params: Promise<{ id: string }> }

function toPageId(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return base || `page-${Math.random().toString(36).slice(2, 7)}`
}

function pickScreens(
  allScreens: StitchScreenSummary[],
  requestedIds: Set<string> | null,
): StitchScreenSummary[] {
  if (!requestedIds || requestedIds.size === 0) return allScreens
  return allScreens.filter((s) => requestedIds.has(normalizeStitchScreenId(s.name ?? '')))
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'design-stitch-import'), 20, 60_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    const body = await request.json().catch(() => ({}))
    const stitchProjectIdRaw = String(body.stitchProjectId ?? '').trim()
    if (!stitchProjectIdRaw) throw new ApiError(400, 'stitchProjectId requerido')
    const stitchProjectId = normalizeStitchProjectId(stitchProjectIdRaw)
    const selectedScreenIds = Array.isArray(body.screenIds)
      ? body.screenIds.map((x: unknown) => normalizeStitchScreenId(String(x ?? '').trim())).filter(Boolean)
      : []
    const requestedIds = selectedScreenIds.length ? new Set(selectedScreenIds) : null

    const allScreens = await listStitchScreens(stitchProjectId)
    if (!allScreens.length) throw new ApiError(404, 'El proyecto Stitch no tiene pantallas')
    const chosen = pickScreens(allScreens, requestedIds)
    if (!chosen.length) throw new ApiError(404, 'No se encontraron pantallas para importar')

    const screens = await Promise.all(
      chosen.map(async (s, idx) => {
        const screenId = normalizeStitchScreenId(s.name ?? '')
        const assets = await fetchStitchScreenAssets(stitchProjectId, screenId)
        const title = (assets.title || s.title || `Page ${idx + 1}`).trim()
        const pageId = toPageId(title)
        return {
          pageId,
          screenId,
          title,
          htmlPath: `spec/inspiration/stitch/screens/${screenId}/screen.html`,
          pngPath: `spec/inspiration/stitch/screens/${screenId}/screen.png`,
          html: assets.html,
          pngBase64: assets.png.toString('base64'),
        }
      }),
    )

    const ctx = await requireDesignRouteContext(projectId)
    const imported = await importStitchSiteToProject({
      ctx,
      projectTitle: String(body.projectTitle ?? '').trim() || 'Stitch import',
      stitchProjectId,
      screens,
      send: () => {},
    })
    await updateProjectDesignMeta(ctx, projectId, { designPhase: 'design' })

    return NextResponse.json({
      ok: true,
      stitchProjectId,
      count: screens.length,
      pageIds: imported.pages.map((p) => p.id),
    })
  } catch (e) {
    return jsonError(e)
  }
}
