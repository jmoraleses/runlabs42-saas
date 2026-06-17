import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'
import { clampTopicMaxScreens } from '@/lib/auto/topicStitchPrompt'
import { createStitchProjectViaPlaywright } from '@/lib/auto/stitch/createStitchProjectViaPlaywright'
import { parseStitchDesignType } from '@/lib/auto/stitch/stitchDesignType'

/**
 * Crea proyecto en Stitch solo con Playwright (sin API).
 */
export async function POST(request: Request) {
  try {
    await requireStreamUser()
    let authContext: Awaited<ReturnType<typeof requireUser>> | null = null
    try {
      authContext = await requireUser()
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e
    }

    const body = (await request.json().catch(() => ({}))) as {
      itemId?: unknown
      topic?: unknown
      prompt?: unknown
      maxScreens?: unknown
      designType?: unknown
    }
    const itemId = String(body.itemId ?? '').trim()
    const fallbackTopic = String(body.topic ?? '').trim()
    const fallbackPrompt = String(body.prompt ?? '').trim()
    if (!itemId && !fallbackTopic) throw new ApiError(400, 'itemId o topic requerido')
    const maxScreens = clampTopicMaxScreens(body.maxScreens)
    const designType = parseStitchDesignType(body.designType)

    let topic = fallbackTopic
    let promptForStitch = fallbackPrompt || fallbackTopic
    let projectTitle = fallbackTopic || `Topic ${itemId.slice(0, 6)}`

    if (authContext) {
      const { supabase, user } = authContext
      const { data: topicRow, error: topicErr } = await supabase
        .from('auto_topic_items')
        .select('id, topic, prompt, status')
        .eq('user_id', user.id)
        .eq('id', itemId)
        .single()
      if (topicErr || !topicRow) {
        throw new ApiError(404, topicErr?.message ?? 'Topic no encontrado')
      }
      if (topicRow.status === 'done') {
        throw new ApiError(409, 'Este topic ya fue procesado')
      }
      topic = String(topicRow.topic ?? '').trim()
      promptForStitch = String(topicRow.prompt ?? '').trim() || topic
      projectTitle = topic || `Topic ${itemId.slice(0, 6)}`
    } else if (!topic) {
      throw new ApiError(400, 'En modo demo debes enviar topic y prompt')
    }

    const { stitchProjectId } = await createStitchProjectViaPlaywright({
      projectTitle,
      prompt: promptForStitch,
      maxScreens,
      designType,
    })

    if (authContext && itemId) {
      await authContext.supabase
        .from('auto_topic_items')
        .update({ status: 'done', done_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('user_id', authContext.user.id)
    }

    return NextResponse.json({
      ok: true,
      projectTitle,
      stitchProjectId,
      screenCount: maxScreens,
      mode: 'playwright',
      designType,
    })
  } catch (e) {
    return jsonError(e)
  }
}
