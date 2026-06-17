import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { parseAutoRunBody, runAutoPipeline } from '@/lib/auto/pipeline/runAutoPipeline'
import { isStitchConfigured } from '@/lib/auto/stitch/stitchStatus'
import type { AutoRunConfig } from '@/lib/auto/types'

async function resolveAutoProject(config: AutoRunConfig): Promise<AutoRunConfig> {
  const requestedProjectId = config.projectId.trim()
  try {
    const { supabase, user } = await requireUser()
    if (requestedProjectId) {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('id', requestedProjectId)
        .eq('user_id', user.id)
        .neq('status', 'deleted')
        .maybeSingle()
      if (data?.id) return config
    }

    const { data: created, error: createError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: `${config.niche.slice(0, 64) || 'Auto Store'} (Auto)`,
        description: 'Generado desde Auto (Stitch -> importacion -> templates).',
        framework: 'html',
        status: 'draft',
        storage_provider: 'platform',
        target_platforms: ['web'],
        design_phase: 'design',
        code_template: 'html',
      })
      .select('id')
      .single()
    if (createError || !created?.id) {
      throw new ApiError(500, 'No se pudo crear proyecto para Auto')
    }

    await supabase.from('specs').insert({
      project_id: created.id,
      content: '',
      created_by: user.id,
    })

    return { ...config, projectId: String(created.id) }
  } catch {
    if (requestedProjectId) return config
    return { ...config, projectId: `demo-auto-${Date.now().toString(36)}` }
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireStreamUser()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
    const rl = rateLimit(rateLimitKey(user.id, ip, 'auto-runs'), 4, 120_000)
    if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')

    if (!(await isStitchConfigured())) {
      throw new ApiError(503, 'Stitch no configurado (falta STITCH_API_KEY)')
    }

    const body = (await request.json()) as Record<string, unknown>
    const parsedConfig = parseAutoRunBody(body)
    const config = await resolveAutoProject(parsedConfig)
    const streamRequested = body.stream !== false

    if (!streamRequested) {
      const events: unknown[] = []
      const state = await runAutoPipeline(config, (ev) => events.push(ev))
      return NextResponse.json({ state, events })
    }

    const encoder = new TextEncoder()
    const responseStream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }
        try {
          const state = await runAutoPipeline(config, (ev) => send(ev as Record<string, unknown>))
          send({ phase: 'done', state })
        } catch (e) {
          send({
            phase: 'error',
            message: e instanceof Error ? e.message : 'Error en corrida auto',
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}
