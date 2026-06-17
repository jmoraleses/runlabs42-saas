import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'
import {
  type DesignPreviewBreakpoint,
  parseDesignDevice,
} from '@/lib/design/breakpoints'
import type { VisualBriefInference } from '@/lib/design/visualBriefInference'

export type ReferenceFormFactor = DesignPreviewBreakpoint

/** Lee dimensiones de PNG o JPEG sin dependencias externas. */
export function readImageDimensionsFromBuffer(buf: Buffer): {
  width: number
  height: number
} | null {
  if (buf.length < 24) return null

  // PNG: IHDR width/height at 16–23
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    if (width > 0 && height > 0) return { width, height }
  }

  // JPEG: buscar SOF0 / SOF2
  let i = 2
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marker = buf[i + 1]
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(i + 5)
      const width = buf.readUInt16BE(i + 7)
      if (width > 0 && height > 0) return { width, height }
      return null
    }
    if (marker === 0xd8) {
      i += 2
      continue
    }
    if (marker === 0xd9) break
    const len = buf.readUInt16BE(i + 2)
    if (len < 2) break
    i += 2 + len
  }

  return null
}

export function inferFormFactorFromDimensions(
  width: number,
  height: number,
): ReferenceFormFactor {
  const ratio = height / Math.max(width, 1)
  const maxSide = Math.max(width, height)

  if (ratio >= 1.2 && maxSide <= 1200) return 'mobile'
  if (ratio >= 1.05 && width <= 520) return 'mobile'
  if (width >= 1024 && ratio < 1.15) return 'desktop'
  if (width >= 768 && width < 1024) return 'tablet'
  return ratio >= 1.1 ? 'mobile' : 'desktop'
}

export function inferFormFactorFromVertexImages(
  images: VertexImagePart[],
): ReferenceFormFactor | null {
  for (const img of images) {
    const data = img.data?.trim()
    if (!data) continue
    try {
      const dims = readImageDimensionsFromBuffer(Buffer.from(data, 'base64'))
      if (dims) return inferFormFactorFromDimensions(dims.width, dims.height)
    } catch {
      /* siguiente imagen */
    }
  }
  return null
}

export function resolveOrchestrationDevice(opts: {
  requestedDevice?: unknown
  visualProfile?: VisualBriefInference | null
  images?: VertexImagePart[]
}): DesignPreviewBreakpoint {
  const requested = parseDesignDevice(opts.requestedDevice)
  const fromProfile = opts.visualProfile?.referenceFormFactor
  if (fromProfile) return fromProfile

  const fromBytes = opts.images?.length
    ? inferFormFactorFromVertexImages(opts.images)
    : null
  if (fromBytes) return fromBytes

  if (
    opts.visualProfile?.layoutTopology === 'mobile-app-screen' ||
    opts.visualProfile?.layoutTopology === 'dashboard-app'
  ) {
    return 'mobile'
  }

  return requested
}
