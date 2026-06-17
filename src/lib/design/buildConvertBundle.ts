import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import { designMdCssRootVariableHints } from '@/lib/design/designMd'
import { SPEC_KIT_PATHS } from '@/lib/projects/specPaths'
import {
  DESIGN_SPEC_JSON,
  DESIGN_SPEC_MD,
  isCanvasImagePage,
  resolvePageMockupPath,
  type DesignSpec,
} from '@/lib/design/types'
import { parseDesignSpec, resolveDesignPages } from '@/lib/design/pages'
import {
  buildSiteManifest,
  SITE_MANIFEST_PATH,
  siteManifestToJson,
} from '@/lib/design/siteManifest'
import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'

export function buildConvertBundle(
  designFiles: ProjectFileRecord[],
  selectedPageIds: string[],
): { bundle: string; pageIds: string[]; linksJson: string; imageParts: VertexImagePart[] } {
  const specRaw = designFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const spec = parseDesignSpec(specRaw)
  const allPages = resolveDesignPages(designFiles, specRaw)
  const selected =
    selectedPageIds.length > 0
      ? allPages.filter(
          (p) =>
            selectedPageIds.includes(p.id) &&
            p.frameType !== 'prototype' &&
            p.frameType !== 'designSystem',
        )
      : allPages.filter(
          (p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem',
        )

  const pageIdSet = new Set(selected.map((p) => p.id))
  const links =
    spec?.prototypeLinks?.filter(
      (l) => pageIdSet.has(l.fromPageId) && pageIdSet.has(l.toPageId),
    ) ?? []

  const parts: string[] = []
  const imageParts: VertexImagePart[] = []
  const manifest = buildSiteManifest({ designFiles })
  const specPaths = [
    DESIGN_SPEC_JSON,
    DESIGN_SPEC_MD,
    SITE_MANIFEST_PATH,
    SPEC_KIT_PATHS.constitution,
    SPEC_KIT_PATHS.spec,
    SPEC_KIT_PATHS.plan,
    SPEC_KIT_PATHS.tasks,
  ]
  for (const p of specPaths) {
    const f = designFiles.find((x) => x.path === p)
    if (f?.content) parts.push(`--- ${p} ---\n${f.content}`)
  }
  if (!designFiles.find((x) => x.path === SITE_MANIFEST_PATH)?.content) {
    parts.push(`--- ${SITE_MANIFEST_PATH} ---\n${siteManifestToJson(manifest)}`)
  }

  const designMdFile = designFiles.find((x) => x.path === DESIGN_SPEC_MD)
  const cssRootHints = designMdFile?.content
    ? designMdCssRootVariableHints(designMdFile.content)
    : ''
  if (cssRootHints) {
    parts.push(
      `--- Tokens CSS (desde spec/design.md — obligatorio en estilos globales de la app) ---\n${cssRootHints}`,
    )
  }

  if (links.length) {
    parts.push(`--- prototypeLinks ---\n${JSON.stringify(links, null, 2)}`)
  }

  for (const page of selected) {
    const htmlFile = designFiles.find((x) => x.path === page.path)
    const mockupPath = resolvePageMockupPath(page)
    const mockupFile = designFiles.find((x) => x.path === mockupPath)

    if (htmlFile?.content && page.path.endsWith('.html')) {
      parts.push(
        `--- Vista: ${page.name} (${page.id}) — mockup HTML ${page.path} ---\n${htmlFile.content}`,
      )
      if (mockupFile?.content) {
        parts.push(
          `--- Vista: ${page.name} (${page.id}) — referencia PNG ${mockupPath} ---\n(image attached)`,
        )
        imageParts.push({ mimeType: 'image/png', data: mockupFile.content })
      }
      continue
    }

    const f = htmlFile ?? mockupFile ?? designFiles.find((x) => x.path === page.path)
    if (!f?.content) continue
    if (isCanvasImagePage(page) || page.path.endsWith('.png')) {
      parts.push(
        `--- Vista: ${page.name} (${page.id}) — mockup PNG ${page.path} ---\n(image attached)`,
      )
      imageParts.push({ mimeType: 'image/png', data: f.content })
    } else {
      parts.push(
        `--- Vista: ${page.name} (${page.id}) — ${page.path} ---\n${f.content}`,
      )
    }
  }

  return {
    bundle: parts.join('\n\n'),
    pageIds: selected.map((p) => p.id),
    linksJson: JSON.stringify(links),
    imageParts,
  }
}

export function assertSelectedPages(
  designFiles: ProjectFileRecord[],
  selectedPageIds: string[],
): DesignSpec | null {
  const spec = parseDesignSpec(
    designFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content,
  )
  const pages = resolveDesignPages(designFiles, spec ? JSON.stringify(spec) : null)
  if (!pages.length) throw new Error('No hay pantallas de diseño')
  if (selectedPageIds.length === 0) throw new Error('Selecciona al menos una vista')
  const ids = new Set(pages.map((p) => p.id))
  for (const id of selectedPageIds) {
    if (!ids.has(id)) throw new Error(`Vista desconocida: ${id}`)
  }
  return spec
}
