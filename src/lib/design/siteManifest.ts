import type { DesignSiteType } from '@/lib/design/designBrief'
import { designTextModel } from '@/lib/design/generateDesign'
import {
  DESIGN_LAYOUT_PATH,
  parseLayoutNavigationLinks,
  type AiNavigationLink,
} from '@/lib/design/orchestrationParse'
import { pageHtmlPath } from '@/lib/design/pages'
import { parseDesignSpec, resolveDesignPages } from '@/lib/design/pages'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import {
  DESIGN_PAGES_PREFIX,
  DESIGN_SPEC_JSON,
  type DesignPageMeta,
  type PrototypeLink,
} from '@/lib/design/types'

export const SITE_MANIFEST_PATH = 'spec/site-manifest.json'

export type FormIntent = 'contact' | 'newsletter' | 'checkout' | 'generic'

export type SiteManifestFormField = {
  name: string
  type: string
  required?: boolean
}

export type SiteManifestForm = {
  id: string
  pageId: string
  intent: FormIntent
  fields: SiteManifestFormField[]
}

export type SiteManifestPage = {
  id: string
  name: string
  route: string
  htmlPath: string
  designHref: string
}

export type SiteManifestInternalLink = {
  fromPageId: string
  toPageId: string
  href: string
}

export type SiteManifest = {
  version: 1
  siteType: DesignSiteType
  pages: SiteManifestPage[]
  forms: SiteManifestForm[]
  internalLinks: SiteManifestInternalLink[]
  requiresDatabase: boolean
  requiresAuth: boolean
  motion: boolean
  envRequired: string[]
}

const HOME_IDS = new Set(['home', 'index'])

/** Ruta pública Next.js para una pantalla de diseño. */
export function pageIdToRoute(pageId: string): string {
  if (HOME_IDS.has(pageId)) return '/'
  return `/${pageId.replace(/^\/+/, '')}`
}

/** href en HTML de diseño (preview multi-página). */
export function pageIdToDesignHref(pageId: string): string {
  if (HOME_IDS.has(pageId)) return '/'
  return `/pages/${pageId}`
}

function inferSiteType(
  explicit: DesignSiteType | undefined,
  layoutRaw: string | null,
  htmlBodies: string[],
): DesignSiteType {
  if (explicit) return explicit
  const layoutLower = (layoutRaw ?? '').toLowerCase()
  const htmlJoined = htmlBodies.join('\n').toLowerCase()
  if (/ecommerce|product|cart|checkout|tienda/.test(layoutLower + htmlJoined)) return 'ecommerce'
  if (/blog|post|artículo|article/.test(layoutLower + htmlJoined)) return 'blog'
  if (/dashboard|panel|admin/.test(layoutLower + htmlJoined)) return 'dashboard'
  if (/portfolio|proyecto|gallery/.test(layoutLower + htmlJoined)) return 'portfolio'
  if (/saas|pricing|subscription/.test(layoutLower + htmlJoined)) return 'saas'
  return 'landing'
}

function inferFormIntent(formHtml: string, fieldNames: string[]): FormIntent {
  const blob = `${formHtml} ${fieldNames.join(' ')}`.toLowerCase()
  if (/checkout|payment|card|billing/.test(blob)) return 'checkout'
  if (/newsletter|subscribe|suscri/.test(blob)) return 'newsletter'
  if (/contact|message|email|tel|asunto|mensaje/.test(blob)) return 'contact'
  return 'generic'
}

export function extractFormsFromHtml(html: string, pageId: string): SiteManifestForm[] {
  const forms: SiteManifestForm[] = []
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi
  let m: RegExpExecArray | null
  let idx = 0
  while ((m = formRe.exec(html)) !== null) {
    const attrs = m[1] ?? ''
    const inner = m[2] ?? ''
    const dataId = attrs.match(/\bdata-form-id=["']([^"']+)["']/i)?.[1]
    const id = dataId?.trim() || `form-${pageId}-${idx}`
    const fields: SiteManifestFormField[] = []
    const inputRe =
      /<(input|textarea|select)\b([^>]*)\/?>/gi
    let im: RegExpExecArray | null
    while ((im = inputRe.exec(inner)) !== null) {
      const tag = im[1]?.toLowerCase() ?? 'input'
      const iattrs = im[2] ?? ''
      const type = iattrs.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? (tag === 'textarea' ? 'textarea' : 'text')
      if (type === 'hidden' || type === 'submit' || type === 'button') continue
      const name =
        iattrs.match(/\bname=["']([^"']+)["']/i)?.[1]?.trim() ||
        iattrs.match(/\bid=["']([^"']+)["']/i)?.[1]?.trim()
      if (!name) continue
      const required = /\brequired\b/i.test(iattrs) || /\baria-required=["']true["']/i.test(iattrs)
      fields.push({ name, type, required: required || undefined })
    }
    if (fields.length > 0) {
      forms.push({
        id,
        pageId,
        intent: inferFormIntent(`${attrs} ${inner}`, fields.map((f) => f.name)),
        fields,
      })
    }
    idx += 1
  }
  return forms
}

export function detectMotionInHtml(html: string): boolean {
  if (/@keyframes\b/i.test(html)) return true
  if (/\banimate-[\w-]+/i.test(html)) return true
  if (/\bdata-aos\b/i.test(html)) return true
  if (/\btransition(-|:|\s)/i.test(html) && /\banimation(-|:|\s)/i.test(html)) return true
  if (/\bbouncy-hover\b/i.test(html)) return true
  return false
}

function linksFromPrototype(
  prototypeLinks: PrototypeLink[],
  pages: SiteManifestPage[],
): SiteManifestInternalLink[] {
  const pageIds = new Set(pages.map((p) => p.id))
  return prototypeLinks
    .filter((l) => pageIds.has(l.fromPageId) && pageIds.has(l.toPageId))
    .map((l) => ({
      fromPageId: l.fromPageId,
      toPageId: l.toPageId,
      href: pageIdToDesignHref(l.toPageId),
    }))
}

export function resolvePageIdFromHref(hrefRaw: string, pages: SiteManifestPage[]): string | null {
  const href = (hrefRaw ?? '').trim()
  if (!href) return null
  if (href === '#' || href.startsWith('javascript:')) return null
  if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return null

  const home = pages.find((p) => HOME_IDS.has(p.id))?.id
  if (href === '/' && home) return home

  const clean = href.replace(/\/index\.html$/i, '').replace(/\.html$/i, '')
  const m = clean.match(/^\/pages\/([^/]+)$/i)
  const candidate = (m?.[1] ?? clean.replace(/^\/+/, '')).trim()

  if (!candidate) return null
  return pages.find((p) => p.id === candidate)?.id ?? null
}

function linksFromHtmlAnchors(
  html: string,
  fromPageId: string,
  pages: SiteManifestPage[],
): SiteManifestInternalLink[] {
  const out: SiteManifestInternalLink[] = []
  const seen = new Set<string>()
  const pageIds = new Set(pages.map((p) => p.id))

  // Detect anchors; candidates solo para inferir navegación interna para el manifiesto.
  const anchorRe = /<a\b([^>]*)\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    const attrs = m[1] ?? ''
    const href = m[2] ?? ''
    const textRaw = m[3] ?? ''
    const toPageId = resolvePageIdFromHref(href, pages)
    if (!toPageId || toPageId === fromPageId || !pageIds.has(toPageId)) continue

    const key = `${fromPageId}->${toPageId}`
    if (seen.has(key)) continue
    seen.add(key)

    // href canónico para la app final.
    out.push({
      fromPageId,
      toPageId,
      href: pageIdToDesignHref(toPageId),
    })
  }

  // Evitar retornar enlaces vacíos solo por ruido.
  return out.filter(Boolean)
}

function linksFromAiNavigation(
  aiLinks: AiNavigationLink[],
  pages: SiteManifestPage[],
): SiteManifestInternalLink[] {
  const pageIds = new Set(pages.map((p) => p.id))
  const seen = new Set<string>()
  const out: SiteManifestInternalLink[] = []
  for (const l of aiLinks) {
    if (!pageIds.has(l.fromPageId) || !pageIds.has(l.toPageId)) continue
    const key = `${l.fromPageId}->${l.toPageId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      fromPageId: l.fromPageId,
      toPageId: l.toPageId,
      href: pageIdToDesignHref(l.toPageId),
    })
  }
  return out
}

/** Bloque de prompt: enlaces declarados por la IA en spec/design-layout.json. */
export function designNavigationLinksPromptBlock(layoutJson: string | null | undefined): string {
  const links = parseLayoutNavigationLinks(layoutJson ?? '{}')
  if (!links.length) {
    return `
## Enlaces entre pantallas (IA — layout)
Aún no hay navigationLinks en spec/design-layout.json. Si esta pantalla tiene nav o CTAs a otras vistas, usa href="/" (home) o href="/pages/{pageId}" y data-sk-id único (sk-nav-{destino}).`.trim()
  }

  const byFrom = new Map<string, AiNavigationLink[]>()
  for (const l of links) {
    const list = byFrom.get(l.fromPageId) ?? []
    list.push(l)
    byFrom.set(l.fromPageId, list)
  }

  const lines: string[] = [
    '## Enlaces entre pantallas (declarados por la IA en spec/design-layout.json)',
    'Usa EXACTAMENTE estos destinos. NO uses href="#".',
  ]
  for (const [fromId, items] of byFrom) {
    lines.push(`\nDesde pantalla **${fromId}**:`)
    for (const l of items) {
      const sk = l.anchorSkId ?? `sk-nav-${l.toPageId}`
      const label = l.label ? ` "${l.label}"` : ''
      lines.push(
        `- <a href="${pageIdToDesignHref(l.toPageId)}" data-sk-id="${sk}">${label || l.toPageId}</a> → ${l.toPageId}`,
      )
    }
  }
  return lines.join('\n')
}

/** Inferencia posterior (post-HTML): usa el HTML generado de cada página para determinar navegación interna para el manifiesto. */
export async function inferNavigationLinksWithAi(params: {
  pages: SiteManifestPage[]
  htmlByPage: Record<string, string>
  siteType?: DesignSiteType
  briefPrompt?: string
  modelId?: string
}): Promise<AiNavigationLink[]> {
  if (params.pages.length < 2) return []

  const pagesList = params.pages
    .map((p) => `- ${p.id} (${p.name}): ${p.designHref}`)
    .join('\n')

  const candidatesByPage = params.pages
    .map((p) => {
      const html = params.htmlByPage[p.id] ?? ''
      const candidates: Array<{ href: string; label: string; anchorSkId?: string }> = []
      const anchorRe = /<a\b([^>]*)\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
      let m: RegExpExecArray | null
      const seen = new Set<string>()
      while ((m = anchorRe.exec(html)) !== null) {
        const attrs = m[1] ?? ''
        const href = (m[2] ?? '').trim()
        const inner = m[3] ?? ''
        if (!href || href === '#' || href.startsWith('javascript:')) continue
        if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) continue

        const sk = attrs.match(/\bdata-sk-id=["']([^"']+)["']/i)?.[1]?.trim()
        const label = inner
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60)
        const key = `${href}|${sk ?? ''}|${label}`
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push({ href, label, anchorSkId: sk || undefined })
        if (candidates.length >= 24) break
      }

      const list = candidates.length
        ? candidates
            .map(
              (c) =>
                `- href="${c.href}"${c.label ? ` label="${c.label}"` : ''}${
                  c.anchorSkId ? ` sk="${c.anchorSkId}"` : ''
                }`,
            )
            .join('\n')
        : '(sin anchors detectados)'

      return `Página ${p.id} (${p.name}):\n${list}`
    })
    .join('\n\n')

  const { generateAgentPlatformText } = await import('@/lib/ai/vertexAgentPlatform')

  const text = await generateAgentPlatformText(
    `Brief: ${params.briefPrompt ?? 'Sitio web'}\nTipo: ${params.siteType ?? 'landing'}\n\nPáginas permitidas:\n${pagesList}\n\nCandidatos de anchors (extraídos del HTML generado):\n${candidatesByPage}\n\nTarea: selecciona solo los enlaces internos que navegan entre estas páginas permitidas.\nEntrega navigationLinks con fromPageId/toPageId/label/anchorSkId.\nRegla: toPageId debe ser uno de los ids permitidos; si un enlace no corresponde a ninguna página, descártalo.`,
    {
      systemInstruction:
        'Responde SOLO JSON válido con esta forma: { "navigationLinks": [ { "fromPageId": "...", "toPageId": "...", "label": "...", "anchorSkId": "..." } ] }. Sin markdown.',
      model: designTextModel(params.modelId),
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  )

  return parseLayoutNavigationLinks(text)
}

export function buildSiteManifest(params: {
  designFiles: ProjectFileRecord[]
  siteType?: DesignSiteType
}): SiteManifest {
  const specRaw = params.designFiles.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  const spec = parseDesignSpec(specRaw)
  const layoutRaw = params.designFiles.find((f) => f.path === DESIGN_LAYOUT_PATH)?.content ?? null
  const screenPages = resolveDesignPages(params.designFiles, specRaw).filter(
    (p) => p.frameType !== 'prototype' && p.frameType !== 'designSystem',
  )

  const pages: SiteManifestPage[] = screenPages.map((p: DesignPageMeta) => {
    const htmlPath = p.path?.endsWith('.html') ? p.path : pageHtmlPath(p.id)
    return {
      id: p.id,
      name: p.name,
      route: pageIdToRoute(p.id),
      htmlPath,
      designHref: pageIdToDesignHref(p.id),
    }
  })

  const htmlByPage = new Map<string, string>()
  for (const page of pages) {
    const file = params.designFiles.find((f) => f.path === page.htmlPath)
    if (file?.content) htmlByPage.set(page.id, file.content)
  }

  const htmlBodies = [...htmlByPage.values()]
  const resolvedSiteType = inferSiteType(params.siteType, layoutRaw, htmlBodies)

  const forms: SiteManifestForm[] = []
  let motion = false
  for (const page of pages) {
    const html = htmlByPage.get(page.id)
    if (!html) continue
    forms.push(...extractFormsFromHtml(html, page.id))
    if (detectMotionInHtml(html)) motion = true
  }

  // Links internos para el manifiesto: (1) prototypeLinks del spec (si existe) + (2) anchors reales en HTML.
  // La fase posterior (persistSiteManifest) puede reemplazarlo con inferencia IA sobre el HTML.
  let internalLinks = linksFromPrototype(spec?.prototypeLinks ?? [], pages)

  const anchorLinks: SiteManifestInternalLink[] = []
  for (const page of pages) {
    const html = htmlByPage.get(page.id)
    if (!html) continue
    anchorLinks.push(...linksFromHtmlAnchors(html, page.id, pages))
  }

  const allLinks = [...internalLinks, ...anchorLinks]
  const seen = new Set<string>()
  internalLinks = []
  for (const l of allLinks) {
    const key = `${l.fromPageId}->${l.toPageId}`
    if (seen.has(key)) continue
    seen.add(key)
    internalLinks.push(l)
  }

  const requiresDatabase =
    forms.length > 0 ||
    resolvedSiteType === 'ecommerce' ||
    resolvedSiteType === 'blog' ||
    resolvedSiteType === 'saas'
  const requiresAuth = resolvedSiteType === 'dashboard' || resolvedSiteType === 'saas'

  const envRequired: string[] = []
  if (requiresDatabase) envRequired.push('POSTGRES_URL')
  if (forms.some((f) => f.intent === 'contact')) {
    envRequired.push('RESEND_API_KEY', 'CONTACT_TO_EMAIL')
  }

  return {
    version: 1,
    siteType: resolvedSiteType,
    pages,
    forms,
    internalLinks,
    requiresDatabase,
    requiresAuth,
    motion,
    envRequired: [...new Set(envRequired)],
  }
}

export function parseSiteManifest(raw: string | null | undefined): SiteManifest | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as SiteManifest
    if (parsed?.version !== 1 || !Array.isArray(parsed.pages)) return null
    return parsed
  } catch {
    return null
  }
}

export function siteManifestToJson(manifest: SiteManifest): string {
  return JSON.stringify(manifest, null, 2)
}

/** Convierte enlaces del manifiesto + HTML en prototypeLinks para Studio (modo Play). */
export function buildPrototypeLinksFromManifest(
  manifest: SiteManifest,
  htmlByPageId: Map<string, string>,
): PrototypeLink[] {
  const pageIds = new Set(manifest.pages.map((p) => p.id))
  const links: PrototypeLink[] = []
  const seen = new Set<string>()

  for (const l of manifest.internalLinks) {
    if (!pageIds.has(l.fromPageId) || !pageIds.has(l.toPageId)) continue
    const key = `${l.fromPageId}->${l.toPageId}`
    if (seen.has(key)) continue
    seen.add(key)

    const html = htmlByPageId.get(l.fromPageId) ?? ''
    let fromSkId = `sk-nav-${l.toPageId}`
    const anchorRe = /<a\b([^>]*)\bhref=["']([^"']+)["'][^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = anchorRe.exec(html)) !== null) {
      const attrs = m[1] ?? ''
      const href = m[2] ?? ''
      const toPageId = resolvePageIdFromHref(href, manifest.pages)
      if (toPageId !== l.toPageId) continue
      const sk = attrs.match(/\bdata-sk-id=["']([^"']+)["']/i)?.[1]?.trim()
      if (sk) {
        fromSkId = sk
        break
      }
    }

    links.push({
      id: `link-${l.fromPageId}-${l.toPageId}`,
      fromPageId: l.fromPageId,
      fromSkId,
      toPageId: l.toPageId,
    })
  }

  return links
}

/** Bloque de prompt para HTML con navegación real entre páginas. */
export function designNavigationManifestBlock(manifest: SiteManifest | null): string {
  if (!manifest?.pages.length) return ''
  const pageLines = manifest.pages
    .map((p) => `- ${p.name} (${p.id}): href="${p.designHref}" → ruta app ${p.route}`)
    .join('\n')
  const linkLines = manifest.internalLinks.length
    ? manifest.internalLinks
        .map((l) => `- desde ${l.fromPageId} → ${l.toPageId}: href="${l.href}" (inferido para el manifiesto)`)
        .join('\n')
    : 'Se infieren enlaces internos desde el HTML generado (y/o por IA si está disponible).'
  const formLines = manifest.forms.length
    ? manifest.forms
        .map(
          (f) =>
            `- formulario data-form-id="${f.id}" en página ${f.pageId} (${f.intent}): campos ${f.fields.map((x) => x.name).join(', ')}`,
        )
        .join('\n')
    : 'Sin formularios detectados aún.'

  return `
## Navegación y formularios (manifiesto del sitio)
Páginas del sitio:
${pageLines}

Enlaces internos obligatorios (usa estos href, NO href="#"):
${linkLines}

Formularios:
${formLines}
- Cada <form> debe tener data-form-id único y campos con atributo name.
- Sin action ni method; sin JavaScript en el mockup.
- Conserva @keyframes, clases animate-* y data-aos si existen en design.md o referencia.
`.trim()
}

export async function persistSiteManifest(
  store: { putMany: (files: Array<{ path: string; content: string; language?: string }>) => Promise<void> },
  designFiles: ProjectFileRecord[],
  siteType?: DesignSiteType,
  opts?: { inferLinksIfMissing?: boolean; briefPrompt?: string; modelId?: string },
): Promise<SiteManifest> {
  let manifest = buildSiteManifest({ designFiles, siteType })

  if (opts?.inferLinksIfMissing !== false && manifest.pages.length > 1) {
    try {
      const htmlByPage: Record<string, string> = {}
      for (const p of manifest.pages) {
        const f = designFiles.find((x) => x.path === p.htmlPath)
        if (f?.content) htmlByPage[p.id] = f.content
      }

      const inferred = await inferNavigationLinksWithAi({
        pages: manifest.pages,
        htmlByPage,
        siteType: manifest.siteType,
        briefPrompt: opts?.briefPrompt,
        modelId: opts?.modelId,
      })

      if (inferred.length) {
        manifest = {
          ...manifest,
          internalLinks: linksFromAiNavigation(inferred, manifest.pages),
        }
      }
    } catch (aiErr) {
      // Si no hay IA disponible (o falla), mantenemos heurísticas de buildSiteManifest.
      console.warn('[siteManifest] inferNavigationLinksWithAi failed', aiErr)
    }
  }

  await store.putMany([
    {
      path: SITE_MANIFEST_PATH,
      content: siteManifestToJson(manifest),
      language: 'json',
    },
  ])
  return manifest
}
