import 'server-only'

import { getDesignGenModelId } from '@/lib/ai/config.server'
import { resolveVertexAgentTextModelId } from '@/lib/ai/vertexModelAllowlist'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import { ensureSkIds } from '@/lib/design/importDesignHtml'
import { pageHtmlPath } from '@/lib/design/pages'
import { designMockupHtmlFromImageInstruction } from '@/lib/design/prompts'
import type { GeneratedMockup } from '@/lib/design/generateDesignMockups'
import {
  pageMockupPath,
  type DesignPageMeta,
  type DesignPageRegion,
  type DesignSpec,
} from '@/lib/design/types'
import type { DesignPreviewBreakpoint } from '@/lib/design/breakpoints'
import {
  htmlEmbedsFullPageMockup,
  mockupRelPathForPage as mockupRelPath,
} from '@/lib/design/mockupHtmlQuality'

function tokenCss(spec: DesignSpec): string {
  const colors = spec.tokens?.colors ?? {}
  const fonts = spec.tokens?.fonts ?? {}
  const lines = Object.entries(colors).map(([k, v]) => `  --color-${k}: ${v};`)
  if (fonts.body) lines.push(`  --font-body: ${fonts.body}, system-ui, sans-serif;`)
  if (fonts.heading) lines.push(`  --font-heading: ${fonts.heading}, system-ui, sans-serif;`)
  if (!lines.length) return ''
  return `:root {\n${lines.join('\n')}\n}\nbody { font-family: var(--font-body, system-ui, sans-serif); color: var(--color-text, #111); background: var(--color-background, #fff); }\n`
}

/** Esqueleto DOM mínimo si Gemini falla — sin incrustar el PNG (no es el producto final). */
function fallbackHtmlFromMockup(
  page: DesignPageMeta,
  spec: DesignSpec,
  regions: DesignPageRegion[],
): string {
  const w = page.width ?? 1440
  const css = tokenCss(spec)
  const regionBlocks = regions.length
    ? regions
        .map(
          (r) =>
            `    <section data-sk-id="${r.id}" class="block" aria-label="${r.label}">
      <h2 data-sk-id="${r.id}-title">${r.label}</h2>
      <p data-sk-id="${r.id}-body">Contenido editable</p>
    </section>`,
        )
        .join('\n')
    : `    <header data-sk-id="sk-header" class="site-header">
      <span data-sk-id="sk-logo">${spec.title}</span>
      <nav data-sk-id="sk-nav" aria-label="Principal"><a href="#" data-sk-id="sk-nav-a">Inicio</a></nav>
    </header>
    <main data-sk-id="sk-main">
      <section data-sk-id="sk-hero" class="hero">
        <h1 data-sk-id="sk-hero-title">${page.name}</h1>
        <p data-sk-id="sk-hero-lead">Contenido editable — regenera el diseño si falta detalle.</p>
      </section>
    </main>
    <footer data-sk-id="sk-footer"><p data-sk-id="sk-footer-copy">© ${spec.title}</p></footer>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page.name}</title>
  <style>
${css}    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    .page { width: ${w}px; max-width: 100%; margin: 0 auto; padding: 0 24px; }
    .site-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid color-mix(in srgb, var(--color-text, #111) 12%, transparent); }
    .hero { padding: 48px 0; }
    .block { padding: 32px 0; border-top: 1px solid color-mix(in srgb, var(--color-text, #111) 8%, transparent); }
  </style>
</head>
<body>
  <div class="page" data-sk-id="sk-page">
${regionBlocks}
  </div>
</body>
</html>`
}

export async function generatePageHtml(
  page: DesignPageMeta,
  spec: DesignSpec,
  mockup: GeneratedMockup,
  device: DesignPreviewBreakpoint,
  modelId?: string,
): Promise<string> {
  const htmlPath = pageHtmlPath(page.id)
  const tokensJson = JSON.stringify(spec.tokens ?? {}, null, 2)
  const regionsJson = page.regions?.length ? JSON.stringify(page.regions, null, 2) : '[]'
  const prompt = `Pantalla: ${page.name} (${page.id})
Ruta de salida: ${htmlPath}
Producto: ${spec.title}
Resumen: ${spec.summary ?? ''}
Tokens:
${tokensJson}
Regiones detectadas (usa data-sk-id coincidentes cuando encaje):
${regionsJson}

El PNG adjunto es referencia visual únicamente (jerarquía, textos, colores, espaciado).
Reconstruye la pantalla con HTML semántico + CSS: secciones, nav, botones y tipografía editables en el DOM.
No incrustes el PNG ni uses ../mockups/${page.id}.png como sustituto del layout.
Mockup estático: visualmente completo, sin funcionalidad real (enlaces #, sin JS).`

  try {
    const text = await generateAgentPlatformText(prompt, {
      systemInstruction: designMockupHtmlFromImageInstruction(device),
      temperature: 0.35,
      model: resolveVertexAgentTextModelId(modelId, getDesignGenModelId()),
      images: [{ mimeType: mockup.mimeType, data: mockup.content }],
    })
    const ops = parseFileOperationsFromStream(text, {
      defaultPath: htmlPath,
      existingPaths: [htmlPath],
    })
    const file = ops.find(
      (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
        o.type !== 'delete' && o.path.endsWith('.html'),
    )
    if (file?.content?.trim()) {
      const html = ensureSkIds(file.content.trim())
      if (htmlEmbedsFullPageMockup(html, page.id)) {
        console.warn(
          `[mockupHtml] ${page.id}: HTML pegaba el PNG completo; se usa esqueleto estructural`,
        )
      } else {
        return html
      }
    }
  } catch (err) {
    console.warn(
      `[mockupHtml] Gemini falló para ${page.id}:`,
      err instanceof Error ? err.message : err,
    )
  }

  return ensureSkIds(fallbackHtmlFromMockup(page, spec, page.regions ?? []))
}

export async function generateHtmlFromMockups(
  spec: DesignSpec,
  pages: DesignPageMeta[],
  mockups: GeneratedMockup[],
  opts?: {
    device?: DesignPreviewBreakpoint
    modelId?: string
    send?: (type: string, data: string) => void
    onPageHtml?: (file: { path: string; content: string }, page: DesignPageMeta) => void | Promise<void>
  },
): Promise<{ files: Array<{ path: string; content: string }>; pages: DesignPageMeta[] }> {
  const device = opts?.device ?? spec.targetDevice ?? 'desktop'
  const mockupById = new Map(mockups.map((m) => [m.pageId, m]))
  const primaryPages = pages.filter(
    (p) =>
      p.frameType !== 'prototype' &&
      p.frameType !== 'designSystem' &&
      !/-alt-\d+$/.test(p.id),
  )

  const htmlFiles: Array<{ path: string; content: string }> = []
  const updatedPages = [...pages]

  for (let i = 0; i < primaryPages.length; i++) {
    const page = primaryPages[i]!
    const mockup = mockupById.get(page.id)
    if (!mockup) continue

    opts?.send?.('phase', `html:${page.id}:${i + 1}/${primaryPages.length}`)
    const htmlPath = pageHtmlPath(page.id)
    const content = await generatePageHtml(page, spec, mockup, device, opts?.modelId)
    const file = { path: htmlPath, content }
    htmlFiles.push(file)
    await opts?.onPageHtml?.(file, page)

    const mockupPath = page.path?.endsWith('.png') ? page.path : pageMockupPath(page.id)
    const nextMeta: DesignPageMeta = {
      ...page,
      path: htmlPath,
      mockupPath,
      media: 'html',
    }
    const idx = updatedPages.findIndex((p) => p.id === page.id)
    if (idx >= 0) updatedPages[idx] = nextMeta
  }

  return { files: htmlFiles, pages: updatedPages }
}
