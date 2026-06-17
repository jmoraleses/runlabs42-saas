import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { createStitchProjectViaPlaywright } from '@/lib/auto/stitch/createStitchProjectViaPlaywright'
import { getOrchestratorPlatform } from '@/lib/auto/orchestrator/platforms'
import { clampTopicMaxScreens, enrichTopicPromptForStitch } from '@/lib/auto/topicStitchPrompt'

type BatchItemInput = {
  id?: string
  title?: string
  prompt?: string
  platformIds?: string[]
}

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const body = (await request.json().catch(() => ({}))) as {
      items?: BatchItemInput[]
      maxScreens?: unknown
    }
    const items = Array.isArray(body.items) ? body.items : []
    if (!items.length) throw new ApiError(400, 'items requerido')
    const maxScreens = clampTopicMaxScreens(body.maxScreens)

    const results: Array<{
      itemId: string
      title: string
      platformId: string
      platformLabel: string
      stitchProjectId?: string
      projectUrl?: string
      ok: boolean
      error?: string
    }> = []

    for (const item of items) {
      const itemId = String(item.id ?? '').trim() || `item-${Date.now().toString(36)}`
      const title = String(item.title ?? '').trim()
      const prompt = String(item.prompt ?? '').trim()
      if (!title || !prompt) {
        throw new ApiError(400, `Item inválido (${itemId}): title y prompt son requeridos`)
      }
      const platformIds = Array.isArray(item.platformIds)
        ? item.platformIds.map((x) => String(x).trim()).filter(Boolean)
        : []
      if (!platformIds.length) {
        throw new ApiError(400, `Item ${itemId} sin plataformas`)
      }

      for (const platformId of platformIds) {
        const platform = getOrchestratorPlatform(platformId)
        if (!platform) {
          results.push({
            itemId,
            title,
            platformId,
            platformLabel: platformId,
            ok: false,
            error: 'Plataforma no soportada',
          })
          continue
        }
        try {
          const platformPrompt = enrichTopicPromptForStitch({
            prompt: `${prompt}\n\nObjetivo de plataforma: ${platform.label}.`,
            maxScreens,
            designType: platform.stitchDesignType,
          })
          const created = await createStitchProjectViaPlaywright({
            projectTitle: `${title} · ${platform.label}`,
            prompt: platformPrompt,
            maxScreens,
            designType: platform.stitchDesignType,
          })
          results.push({
            itemId,
            title,
            platformId: platform.id,
            platformLabel: platform.label,
            stitchProjectId: created.stitchProjectId,
            projectUrl: created.projectUrl,
            ok: true,
          })
        } catch (e) {
          results.push({
            itemId,
            title,
            platformId: platform.id,
            platformLabel: platform.label,
            ok: false,
            error: e instanceof Error ? e.message : 'Error creando en Stitch',
          })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      total: results.length,
      success: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    })
  } catch (e) {
    return jsonError(e)
  }
}
