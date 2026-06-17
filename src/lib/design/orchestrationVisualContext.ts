import { readFileSync } from 'fs'
import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'
import type { StitchReferenceBundle } from '@/lib/design/stitchParity'

/** Carga la captura PNG sincronizada de Stitch como parte multimodal para Vertex. */
export function stitchReferenceScreenshotPart(
  ref: StitchReferenceBundle | null | undefined,
): VertexImagePart | null {
  const path = ref?.screenshotPath?.trim()
  if (!path) return null
  try {
    const buf = readFileSync(path)
    return {
      mimeType: 'image/png',
      data: buf.toString('base64'),
    }
  } catch {
    return null
  }
}

/**
 * Combina imágenes del usuario con la captura Stitch (gold) cuando hay referencia local.
 * La captura Stitch va al final para que el modelo la trate como referencia de equivalencia.
 */
export function mergeOrchestrationImageParts(
  userImages?: VertexImagePart[],
  stitchRef?: StitchReferenceBundle | null,
): VertexImagePart[] {
  const out: VertexImagePart[] = []
  const seen = new Set<string>()

  for (const img of userImages ?? []) {
    if (!img?.data?.trim()) continue
    const key = `${img.mimeType}:${img.data.slice(0, 64)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(img)
  }

  const stitchShot = stitchReferenceScreenshotPart(stitchRef)
  if (stitchShot) {
    const key = `${stitchShot.mimeType}:${stitchShot.data.slice(0, 64)}`
    if (!seen.has(key)) out.push(stitchShot)
  }

  return out
}

export function orchestrationHasVisualReference(
  images?: VertexImagePart[],
  stitchRef?: StitchReferenceBundle | null,
): boolean {
  return Boolean(images?.length || stitchReferenceScreenshotPart(stitchRef))
}
