import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import {
  fetchStitchScreenAssets,
  isStitchApiConfigured,
  listStitchScreens,
  normalizeStitchProjectId,
  normalizeStitchScreenId,
} from '@/lib/design/stitchMcpClient'

function safeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Construye un ZIP importable descargando HTML/PNG de cada pantalla vía API Stitch (MCP).
 * Fallback cuando la UI web bloquea la exportación (p. ej. «Thinking…» o menús modales).
 */
export async function exportStitchProjectZipViaMcp(opts: {
  stitchProjectId: string
  projectTitle?: string
}): Promise<{ zipPath: string; stitchProjectId: string }> {
  if (!(await isStitchApiConfigured())) {
    throw new Error('API Stitch no configurada')
  }

  const stitchProjectId = normalizeStitchProjectId(opts.stitchProjectId)
  const screens = await listStitchScreens(stitchProjectId)
  if (!screens.length) {
    throw new Error(`El proyecto Stitch ${stitchProjectId} no tiene pantallas`)
  }

  const zip = new JSZip()
  let index = 0
  for (const screen of screens) {
    const screenId = normalizeStitchScreenId(screen.name ?? '')
    const assets = await fetchStitchScreenAssets(stitchProjectId, screenId)
    const base = safeName(assets.title || `screen-${index + 1}`) || `screen-${index + 1}`
    const htmlName = index === 0 ? 'index.html' : `${base}.html`
    zip.file(htmlName, assets.html)
    zip.file(`${base}.png`, assets.png)
    index += 1
  }

  const downloadDir =
    process.env.STITCH_EXPORT_DOWNLOAD_DIR?.trim() ||
    path.join(process.cwd(), '.tmp', 'stitch-downloads')
  await fs.mkdir(downloadDir, { recursive: true })
  const label = safeName(opts.projectTitle || stitchProjectId)
  const outPath = path.join(downloadDir, `${Date.now()}-mcp-${label}.zip`)
  await fs.writeFile(outPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  return { zipPath: outPath, stitchProjectId }
}
