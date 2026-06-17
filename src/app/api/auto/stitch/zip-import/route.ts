import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { requireUser } from '@/lib/auth/requireUser'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import {
  analyzeStitchZipsFolder,
  importStitchZipToProject,
} from '@/lib/auto/stitch/importStitchZipsFromFolder'

/**
 * GET ?folderPath=... → dry-run: lista los ZIPs de la carpeta con resumen.
 * POST { folderPath, zipNames? } → importa esos ZIPs (o todos) creando un proyecto por ZIP.
 */
export async function GET(request: Request) {
  try {
    await requireStreamUser()
    await requireUser()
    const { searchParams } = new URL(request.url)
    const folderPath = String(searchParams.get('folderPath') ?? '').trim()
    if (!folderPath) throw new ApiError(400, 'folderPath requerido')
    const analyses = await analyzeStitchZipsFolder(folderPath)
    return NextResponse.json({ folderPath, count: analyses.length, zips: analyses })
  } catch (e) {
    return jsonError(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireStreamUser()
    const { supabase, user } = await requireUser()
    const body = (await request.json().catch(() => ({}))) as {
      folderPath?: unknown
      zipNames?: unknown
    }
    const folderPath = String(body.folderPath ?? '').trim()
    if (!folderPath) throw new ApiError(400, 'folderPath requerido')
    const filter = Array.isArray(body.zipNames)
      ? new Set(body.zipNames.map((x) => String(x).trim()).filter(Boolean))
      : null

    const analyses = await analyzeStitchZipsFolder(folderPath)
    const targets = analyses.filter((a) => {
      if (a.error) return false
      if (!a.pages.length) return false
      if (filter && !filter.has(a.zipName)) return false
      return true
    })
    if (!targets.length) {
      throw new ApiError(
        400,
        filter
          ? 'Ninguno de los ZIPs seleccionados es importable.'
          : 'La carpeta no contiene ZIPs importables.',
      )
    }

    const results: Array<{
      zipName: string
      ok: boolean
      projectId?: string
      projectTitle?: string
      pageCount?: number
      assetCount?: number
      error?: string
    }> = []

    for (const a of targets) {
      try {
        const { data: created, error: createErr } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name: a.projectTitle,
            description: `Importado desde ZIP local "${a.zipName}".`,
            framework: 'html',
            status: 'draft',
            storage_provider: 'platform',
            target_platforms: ['web'],
            design_phase: 'design',
            code_template: 'html',
          })
          .select('id')
          .single()
        if (createErr || !created?.id) {
          throw new Error(createErr?.message ?? 'No se pudo crear el proyecto local')
        }
        const projectId = String(created.id)
        await supabase.from('specs').insert({
          project_id: projectId,
          content: '',
          created_by: user.id,
        })

        const ctx = await requireProjectFilesContext(projectId)
        const imported = await importStitchZipToProject({
          ctx,
          zipPath: a.zipPath,
          projectTitle: a.projectTitle,
        })

        results.push({
          zipName: a.zipName,
          ok: true,
          projectId,
          projectTitle: a.projectTitle,
          pageCount: imported.pages.length,
          assetCount: imported.assetCount,
        })
      } catch (e) {
        results.push({
          zipName: a.zipName,
          ok: false,
          error: e instanceof Error ? e.message : 'Error desconocido',
        })
      }
    }

    const okCount = results.filter((r) => r.ok).length
    return NextResponse.json({
      folderPath,
      okCount,
      failedCount: results.length - okCount,
      results,
    })
  } catch (e) {
    return jsonError(e)
  }
}
