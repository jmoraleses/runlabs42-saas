import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import { normalizeStitchProjectId } from '@/lib/design/stitchMcpClient'
import { importStitchZipToProject } from '@/lib/auto/stitch/importStitchZipsFromFolder'
import { exportStitchProjectZipViaPlaywright } from '@/lib/auto/stitch/exportStitchProjectZipViaPlaywright'

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
      stitchProjectId?: unknown
      projectTitle?: unknown
    }
    const stitchProjectIdRaw = String(body.stitchProjectId ?? '').trim()
    const projectTitleInput = String(body.projectTitle ?? '').trim()
    if (!stitchProjectIdRaw && !projectTitleInput) {
      throw new ApiError(400, 'stitchProjectId o projectTitle requerido')
    }
    const stitchProjectId = stitchProjectIdRaw
      ? normalizeStitchProjectId(stitchProjectIdRaw)
      : ''

    const projectTitle =
      projectTitleInput || (stitchProjectId ? `Stitch ${stitchProjectId}` : 'Stitch')
    let projectId = ''
    let demo = false
    if (authContext) {
      const { data: created, error: createError } = await authContext.supabase
        .from('projects')
        .insert({
          user_id: authContext.user.id,
          name: `${projectTitle} (Stitch)`,
          description: `Importado desde Stitch (${stitchProjectId || projectTitle}) vía Playwright.`,
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
        throw new ApiError(500, createError?.message ?? 'No se pudo crear proyecto local')
      }
      projectId = String(created.id)
      await authContext.supabase.from('specs').insert({
        project_id: projectId,
        content: '',
        created_by: authContext.user.id,
      })
    } else {
      demo = true
      projectId = `demo-stitch-${Date.now().toString(36)}`
    }

    let zipPath: string
    let resolvedStitchProjectId = stitchProjectId
    try {
      const exported = await exportStitchProjectZipViaPlaywright({
        ...(stitchProjectId ? { stitchProjectId } : {}),
        projectTitle,
      })
      zipPath = exported.zipPath
      resolvedStitchProjectId = exported.stitchProjectId
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      const friendly =
        /descargar|download|exportar|export|timeout|locator/i.test(raw)
          ? raw
          : `No se pudo exportar el ZIP desde Stitch: ${raw}`
      throw new ApiError(502, friendly)
    }
    const ctx = await requireProjectFilesContext(projectId)
    const imported = await importStitchZipToProject({
      ctx,
      zipPath,
      projectTitle,
    })

    return NextResponse.json({
      ok: true,
      projectId,
      projectTitle,
      demo,
      stitchProjectId: resolvedStitchProjectId,
      importedPages: imported.pages.length,
      mode: 'playwright',
    })
  } catch (e) {
    return jsonError(e)
  }
}
