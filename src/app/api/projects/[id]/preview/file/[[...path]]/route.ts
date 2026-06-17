import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { requireProjectFilesStore } from '@/lib/storage/requireProjectFilesStore'
import { mimeForPath, wrapTsxModule } from '@/lib/mobile/previewServe'
import {
  decodeWorkspaceImageContent,
  isImageWorkspacePath,
} from '@/lib/projects/workspaceMedia'

type Params = { params: Promise<{ id: string; path?: string[] }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id, path: pathParts } = await params
    const filePath = decodeURIComponent((pathParts ?? []).join('/'))
    if (!filePath || filePath.includes('..')) throw new ApiError(400, 'Ruta no válida')

    const { supabase, user } = await requireUser()
    await requireProjectAccess(supabase, id, user.id)
    const store = requireProjectFilesStore(supabase, user.id, id)
    const file = await store.get(filePath)
    if (!file) throw new ApiError(404, 'Archivo no encontrado')

    let body: string | Uint8Array = file.content
    let contentType = mimeForPath(filePath)

    if (isImageWorkspacePath(filePath)) {
      body = decodeWorkspaceImageContent(file.content)
      return new NextResponse(body as BodyInit, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      body = wrapTsxModule(body, filePath)
      contentType = 'text/javascript; charset=utf-8'
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return jsonError(e)
  }
}
