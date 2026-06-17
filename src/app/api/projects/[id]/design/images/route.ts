import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireUser } from '@/lib/auth/requireUser'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'
import {
  mergeReferenceImagesIntoSpec,
  parseDesignSpecJson,
} from '@/lib/design/mergeDesignSpec'
import { DESIGN_SPEC_JSON, type DesignReferenceImage } from '@/lib/design/types'
import { uploadDesignReferenceImage } from '@/lib/storage/designImages'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user } = await requireUser()
    const ctx = await requireDesignRouteContext(projectId)

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'Archivo requerido')

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileId = `dref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const ref = await uploadDesignReferenceImage({
      userId: user.id,
      projectId,
      fileId,
      buffer,
      name: file.name,
    })

    const designRef: DesignReferenceImage = {
      id: ref.id,
      blobUrl: ref.url,
      mimeType: ref.mimeType,
      name: ref.name,
      createdAt: new Date().toISOString(),
    }

    const existingFiles = await ctx.store.list()
    const specFile = existingFiles.find((f) => f.path === DESIGN_SPEC_JSON)
    const defaultSpec = { version: 2 as const, title: 'Diseño', summary: '', tokens: {} }
    const specContent = mergeReferenceImagesIntoSpec(
      specFile?.content ?? JSON.stringify(parseDesignSpecJson(null) ?? defaultSpec, null, 2),
      [designRef],
    )
    await ctx.store.put(DESIGN_SPEC_JSON, specContent, 'json')

    return NextResponse.json({ image: designRef })
  } catch (e) {
    return jsonError(e)
  }
}
