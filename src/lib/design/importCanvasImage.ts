import 'server-only'

import sharp from 'sharp'
import {
  autoLayoutPages,
  mergePagesIntoSpec,
  nextPageId,
  parseDesignSpec,
  resolveDesignPages,
} from '@/lib/design/pages'
import { ensureDesignSystemPage } from '@/lib/design/prototypePages'
import {
  DESIGN_SPEC_JSON,
  pageMockupPath,
  type DesignPageMeta,
} from '@/lib/design/types'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

const MAX_CANVAS_IMAGE_EDGE = 2400

function baseNameFromFile(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim()
  return base || 'Imagen'
}

function storedImageContent(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

/** Añade una imagen subida como pantalla PNG en el lienzo (design/mockups/). */
export async function importCanvasImageToWorkspace(
  ctx: ProjectFilesContext,
  opts: { buffer: Buffer; mimeType: string; fileName: string },
): Promise<{ pageId: string; path: string; pages: DesignPageMeta[] }> {
  const meta = await sharp(opts.buffer).metadata()
  const naturalW = meta.width ?? 390
  const naturalH = meta.height ?? 844
  const scale = Math.min(1, MAX_CANVAS_IMAGE_EDGE / Math.max(naturalW, naturalH))
  const width = Math.max(120, Math.round(naturalW * scale))
  const height = Math.max(120, Math.round(naturalH * scale))

  const files = await ctx.store.list()
  const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const spec = parseDesignSpec(specRaw)
  const existing = resolveDesignPages(files, specRaw)
  const pageId = nextPageId(existing)
  const path = pageMockupPath(pageId)
  const pageName = baseNameFromFile(opts.fileName)

  const pageMeta: DesignPageMeta = {
    id: pageId,
    name: pageName,
    path,
    media: 'image',
    width,
    height,
  }

  let pages = autoLayoutPages([...existing, pageMeta])
  pages = ensureDesignSystemPage(pages, spec)
  const specContent = mergePagesIntoSpec(spec, pages, spec?.title)

  const content = storedImageContent(opts.buffer, opts.mimeType)
  await ctx.store.putMany([
    { path, content },
    { path: DESIGN_SPEC_JSON, content: specContent },
  ])

  return { pageId, path, pages }
}
