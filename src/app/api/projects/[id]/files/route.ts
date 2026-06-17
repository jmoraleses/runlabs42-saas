import { NextResponse } from 'next/server'
import { jsonError, ApiError } from '@/lib/api/errors'
import { rateLimit, rateLimitKey } from '@/lib/rateLimit'
import { inferLanguage } from '@/lib/projects/access'
import { parseRequestJson } from '@/lib/api/parseRequestJson'
import { requireProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function mapFile(f: {
  id: string
  projectId: string
  path: string
  content: string
  language: string | null
  updatedAt: string
}) {
  return {
    id: f.id,
    projectId: f.projectId,
    path: f.path,
    content: f.content,
    language: f.language,
    updatedAt: f.updatedAt,
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await requireProjectFilesContext(id)

    if (ctx.mode === 'db') {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null
      const rl = rateLimit(rateLimitKey(ctx.user.id, ip, 'project-files'), 120)
      if (!rl.ok) throw new ApiError(429, 'Demasiadas solicitudes')
    }

    const { searchParams } = new URL(request.url)
    const singlePath = searchParams.get('path')?.trim()
    if (singlePath) {
      const file = await ctx.store.get(singlePath)
      if (!file) throw new ApiError(404, 'Archivo no encontrado')
      return NextResponse.json({ file: mapFile(file) })
    }

    const meta = searchParams.get('meta') === '1'
    const store = ctx.store as { listMeta?: () => Promise<{ path: string; content: string; language: string | null; updatedAt: string; id: string; projectId: string }[]> }
    const files = meta && typeof store.listMeta === 'function' ? await store.listMeta() : await ctx.store.list()
    return NextResponse.json({ files: files.map(mapFile) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await requireProjectFilesContext(id)

    type FileInput = { path?: string; content?: string; language?: string }
    const body = await parseRequestJson<{ files?: FileInput[]; path?: string; content?: string; language?: string }>(
      request,
    )
    const files: FileInput[] = Array.isArray(body.files) ? body.files : [body]

    const batch = files
      .map((f) => ({
        path: String(f.path ?? '').trim(),
        content: String(f.content ?? ''),
        language: f.language ?? inferLanguage(String(f.path ?? '')),
      }))
      .filter((f) => f.path)

    const upserted = batch.length ? await ctx.store.putMany(batch) : []

    if (ctx.mode === 'db') {
      await ctx.supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    return NextResponse.json({ files: upserted.map(mapFile) })
  } catch (e) {
    return jsonError(e)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await requireProjectFilesContext(id)
    const { searchParams } = new URL(request.url)

    if (searchParams.get('purge') === '1' && ctx.mode === 'demo') {
      const { deleteDemoProjectStorage } = await import('@/lib/storage/demoProjectFilesStore')
      const { deleteLocalProjectMemories } = await import('@/lib/studio/localMemoryStore')
      await deleteDemoProjectStorage(id)
      await deleteLocalProjectMemories(id)
      return NextResponse.json({ ok: true })
    }

    const path = searchParams.get('path')
    if (!path) throw new ApiError(400, 'Se requiere path')
    const { isSpecWorkspacePath } = await import('@/lib/projects/specPaths')
    if (isSpecWorkspacePath(path)) {
      throw new ApiError(403, 'Los archivos de planificación no se pueden eliminar')
    }

    await ctx.store.delete(path)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}
