import 'server-only'

import sharp from 'sharp'
import type { StitchScreenWithBuffers } from '@/lib/auto/stitch/generateFullStitchSite'

/** Collage fallback cuando Vertex no está disponible. */
export async function composeCoverFallback(
  screens: StitchScreenWithBuffers[],
  opts?: { width?: number; height?: number },
): Promise<{ pngBase64: string; thumbBase64: string }> {
  const w = opts?.width ?? 1600
  const h = opts?.height ?? 900
  const picks = screens.filter((s) => s.pngBase64).slice(0, 4)
  if (!picks.length) {
    const blank = await sharp({
      create: { width: w, height: h, channels: 3, background: { r: 37, g: 99, b: 235 } },
    })
      .png()
      .toBuffer()
    return { pngBase64: blank.toString('base64'), thumbBase64: blank.toString('base64') }
  }

  const cellW = Math.floor(w / 2)
  const cellH = Math.floor(h / 2)
  const composites: sharp.OverlayOptions[] = []

  for (let i = 0; i < Math.min(4, picks.length); i++) {
    const buf = Buffer.from(picks[i]!.pngBase64, 'base64')
    const resized = await sharp(buf)
      .resize(cellW - 8, cellH - 8, { fit: 'cover' })
      .png()
      .toBuffer()
    const col = i % 2
    const row = Math.floor(i / 2)
    composites.push({
      input: resized,
      left: col * cellW + 4,
      top: row * cellH + 4,
    })
  }

  const base = sharp({
    create: { width: w, height: h, channels: 3, background: { r: 15, g: 23, b: 42 } },
  })
  const cover = await base.composite(composites).png().toBuffer()
  const thumb = await sharp(cover).resize(800, 450, { fit: 'cover' }).png().toBuffer()
  return { pngBase64: cover.toString('base64'), thumbBase64: thumb.toString('base64') }
}
