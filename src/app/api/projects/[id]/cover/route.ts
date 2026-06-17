import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { requireUser } from '@/lib/auth/requireUser'
import { jsonError, ApiError } from '@/lib/api/errors'
import { del, put } from '@vercel/blob'
import { blobToken, isBlobStorageEnabled } from '@/lib/storage/config'
import { coverBlobPath } from '@/lib/storage/blobPaths'

type Params = { params: Promise<{ id: string }> }

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB per image
const MAX_COVERS = 5

function decodeImage(imageData: string): { buffer: Buffer; mimeType: string; ext: string } | null {
  if (!imageData.startsWith('data:image/')) return null
  const [header, base64] = imageData.split(',')
  if (!header || !base64) return null
  const mimeMatch = header.match(/data:(image\/[a-z]+);base64/)
  const mimeType = mimeMatch?.[1] ?? 'image/jpeg'
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const buffer = Buffer.from(base64, 'base64')
  return { buffer, mimeType, ext }
}

async function uploadCoverToBlob(
  userId: string,
  projectId: string,
  index: number,
  buffer: Buffer,
  mimeType: string,
  ext: string,
): Promise<string> {
  if (!isBlobStorageEnabled()) throw new ApiError(500, 'Almacenamiento de archivos no configurado (BLOB_READ_WRITE_TOKEN)')
  const pathname = coverBlobPath(userId, projectId, index, ext)
  const blob = await put(pathname, buffer, {
    access: 'public',
    token: blobToken(),
    contentType: mimeType,
    addRandomSuffix: false,
  })
  return blob.url
}


export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (projectErr || !project) throw new ApiError(404, 'Proyecto no encontrado')

    const body = await request.json()

    // Normalize: accept { images: [{route, imageData}] } or legacy { imageData }
    const images: Array<{ route: string; imageData: string }> =
      Array.isArray(body.images)
        ? body.images
        : body.imageData
          ? [{ route: '/', imageData: body.imageData as string }]
          : []

    if (!images.length) throw new ApiError(400, 'No hay imágenes')

    const urls: string[] = []

    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      if (!img) continue
      const { imageData } = img
      const decoded = decodeImage(imageData)
      if (!decoded) continue
      const { buffer, mimeType, ext } = decoded
      if (buffer.byteLength > MAX_SIZE_BYTES) continue

      const url = await uploadCoverToBlob(user.id, id, i, buffer, mimeType, ext)
      urls.push(url)
    }

    if (!urls.length) throw new ApiError(500, 'No se pudo subir ninguna imagen')

    await supabase
      .from('projects')
      .update({
        cover_url: urls[0],
        cover_images: urls,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ url: urls[0], urls })
  } catch (e) {
    return jsonError(e)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { supabase, user } = await requireUser()
    const body = await request.json()

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, cover_images')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (projectErr || !project) throw new ApiError(404, 'Proyecto no encontrado')

    // Reorder or delete: replace full array (URLs already in Blob, just update metadata)
    if (Array.isArray(body.coverImages)) {
      const urls = (body.coverImages as unknown[])
        .map(String)
        .filter(Boolean)
        .slice(0, MAX_COVERS)

      const { error } = await supabase
        .from('projects')
        .update({
          cover_url: urls[0] ?? null,
          cover_images: urls.length ? urls : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw new ApiError(500, error.message)
      return NextResponse.json({ url: urls[0] ?? null, urls })
    }

    // Add one image (with optional circular-buffer overwrite)
    if (body.imageData) {
      const current = Array.isArray(project.cover_images)
        ? (project.cover_images as string[])
        : []
      const allowOverwrite = Boolean(body.allowOverwrite)

      if (!allowOverwrite && current.length >= MAX_COVERS) {
        throw new ApiError(400, `Máximo ${MAX_COVERS} imágenes por proyecto`)
      }

      const decoded = decodeImage(String(body.imageData))
      if (!decoded) throw new ApiError(400, 'Imagen inválida')

      const { buffer, mimeType, ext } = decoded
      if (buffer.byteLength > MAX_SIZE_BYTES) {
        throw new ApiError(400, 'La imagen supera 2 MB')
      }

      // Circular buffer: drop oldest blob and shift if at capacity
      let base = current
      if (allowOverwrite && current.length >= MAX_COVERS) {
        const oldest = current[0]
        if (oldest && isBlobStorageEnabled()) {
          await del(oldest, { token: blobToken() }).catch(() => undefined)
        }
        base = current.slice(1)
      }

      const url = await uploadCoverToBlob(user.id, id, base.length, buffer, mimeType, ext)
      const urls = [...base, url]

      await supabase
        .from('projects')
        .update({
          cover_url: urls[0],
          cover_images: urls,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)

      return NextResponse.json({ url: urls[0], urls })
    }

    throw new ApiError(400, 'Petición inválida')
  } catch (e) {
    return jsonError(e)
  }
}
