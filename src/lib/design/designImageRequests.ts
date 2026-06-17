import 'server-only'

import { parseImageRequests, type ImageRequest } from '@/lib/ai/imageGen'
import type { DesignBrief } from '@/lib/design/designBrief'
import {
  enrichDesignImagePrompt,
} from '@/lib/design/designImageBriefContext'
import { extractElementHtmlBySkId } from '@/lib/design/extractSiteChrome'
import { normalizeDesignImagePath } from '@/lib/design/designImagePaths'
import { buildFallbackAssetPlan } from '@/lib/design/orchestrationAssetsParse'

export { normalizeDesignImagePath, parseDesignImagePathsFromHtml } from '@/lib/design/designImagePaths'

const MAX_DESIGN_IMAGES = 8
const SKIP_IMG_SRC =
  /^(?:https?:|\/\/|data:|#|javascript:|mailto:|tel:|\/api\/|via\.placeholder|picsum\.photos|placehold\.co|placeholder\.com)/i

function resolveImgSrcToProjectPath(src: string, pageHtmlPath: string): string {
  const trimmed = src.trim()
  if (trimmed.startsWith('design/')) return normalizeDesignImagePath(trimmed)
  const entryDir = pageHtmlPath.includes('/')
    ? pageHtmlPath.slice(0, pageHtmlPath.lastIndexOf('/') + 1)
    : ''
  if (trimmed.startsWith('/')) {
    return normalizeDesignImagePath(`design/site${trimmed}`)
  }
  return normalizeDesignImagePath(`${entryDir}${trimmed}`)
}

function inferPromptFromFilename(filename: string, brief?: Partial<DesignBrief>): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  const lower = base.toLowerCase()
  let prompt: string
  if (/hero|banner|background/.test(lower)) {
    prompt = `Wide hero banner photograph for the website subject, ${base}, high quality, clean composition, no text overlay`
  } else if (/product|placeholder|catalog|item/.test(lower)) {
    prompt = `Product photography on neutral background matching the brand, ${base}, catalog style, sharp focus`
  } else if (/avatar|profile|team|user/.test(lower)) {
    prompt = `Portrait photo for the website brand, ${base}, friendly, natural lighting`
  } else if (/related|thumbnail|thumb/.test(lower)) {
    prompt = `Product thumbnail photo, ${base}, clean background, same photoshoot as hero`
  } else {
    prompt = `Editorial web photography for the website subject, ${base}, high quality, cohesive brand aesthetic`
  }
  return enrichDesignImagePrompt(prompt, brief)
}

function inferAspectFromPath(path: string): string {
  const lower = path.toLowerCase()
  if (/hero|banner|background|wide/.test(lower)) return '16:9'
  if (/avatar|profile|product|placeholder|thumb|square/.test(lower)) return '1:1'
  return '4:3'
}

/** Extrae peticiones de imagen desde etiquetas <img> cuando el modelo no emitió [IMAGE:]. */
export function parseImageRequestsFromHtml(
  html: string,
  pageHtmlPath: string,
  brief?: Partial<DesignBrief>,
): ImageRequest[] {
  const requests: ImageRequest[] = []
  const imgRe = /<img\b[^>]*?\bsrc=(["'])([^"']+)\1[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = imgRe.exec(html)) !== null) {
    const src = match[2]?.trim() ?? ''
    if (!src || SKIP_IMG_SRC.test(src) || src.endsWith('.svg')) continue

    const tag = match[0]
    const altMatch = tag.match(/\balt=(["'])(.*?)\1/i)
    const alt = altMatch?.[2]?.trim() ?? ''
    const path = resolveImgSrcToProjectPath(src, pageHtmlPath)
    const filename = path.split('/').pop() ?? path
    const prompt = enrichDesignImagePrompt(
      alt.length > 2 ? alt : inferPromptFromFilename(filename, brief),
      brief,
    )

    requests.push({
      path,
      prompt,
      aspect: inferAspectFromPath(path),
    })
  }

  return requests
}

function subtreeImagePaths(
  html: string,
  pageHtmlPath: string,
  skId: string,
  brief?: Partial<DesignBrief>,
): Set<string> {
  const subtree = extractElementHtmlBySkId(html, skId)
  if (!subtree) return new Set()
  return new Set(
    parseImageRequestsFromHtml(subtree, pageHtmlPath, brief).map((r) =>
      normalizeDesignImagePath(r.path),
    ),
  )
}

function applyBriefAndAssetPlan(
  requests: ImageRequest[],
  brief?: Partial<DesignBrief>,
): ImageRequest[] {
  if (!brief?.prompt?.trim()) {
    return requests.map((r) => ({
      ...r,
      prompt: enrichDesignImagePrompt(r.prompt, brief),
    }))
  }

  const plan = buildFallbackAssetPlan(brief as DesignBrief)
  const planByBase = new Map(
    plan.assets.map((a) => {
      const base = a.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? a.path
      return [base.toLowerCase(), a]
    }),
  )

  return requests.map((req) => {
    const fileBase =
      req.path.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase() ?? ''
    const planned = planByBase.get(fileBase)
    const fromPlan =
      planned &&
      (/^website subject:/i.test(req.prompt) ||
        /professional |editorial web photography for the website/i.test(req.prompt))
        ? planned.prompt
        : req.prompt
    return {
      ...req,
      prompt: enrichDesignImagePrompt(fromPlan, brief),
      aspect: req.aspect ?? planned?.aspect,
    }
  })
}

function dedupeImageRequests(requests: ImageRequest[]): ImageRequest[] {
  const seen = new Set<string>()
  const out: ImageRequest[] = []
  for (const req of requests) {
    const path = normalizeDesignImagePath(req.path)
    if (seen.has(path)) continue
    seen.add(path)
    out.push({ ...req, path })
  }
  return out.slice(0, MAX_DESIGN_IMAGES)
}

export function collectDesignImageRequests(
  sources: string[],
  opts?: {
    pageHtmlPath?: string
    htmlFiles?: Array<{ path: string; content: string }>
    brief?: Partial<DesignBrief>
    /** Con marcador de elemento: solo imágenes dentro de ese data-sk-id. */
    elementSkId?: string
    elementSkIds?: string[]
  },
): ImageRequest[] {
  const combined = sources.filter(Boolean).join('\n')
  const brief = opts?.brief
  const requests = parseImageRequests(combined).map((r) => ({
    ...r,
    prompt: enrichDesignImagePrompt(r.prompt, brief),
  }))

  const htmlSources: Array<{ path: string; content: string }> = []
  if (opts?.htmlFiles?.length) {
    htmlSources.push(...opts.htmlFiles)
  }
  if (opts?.pageHtmlPath) {
    for (const src of sources) {
      if (src.includes('<img')) {
        htmlSources.push({ path: opts.pageHtmlPath, content: src })
      }
    }
  }

  for (const { path, content } of htmlSources) {
    const skIds =
      opts?.elementSkIds?.length
        ? opts.elementSkIds
        : opts?.elementSkId
          ? [opts.elementSkId]
          : []
    if (skIds.length) {
      for (const skId of skIds) {
        const subtree = extractElementHtmlBySkId(content, skId)
        if (subtree) {
          requests.push(...parseImageRequestsFromHtml(subtree, path, brief))
        }
      }
      continue
    }
    requests.push(...parseImageRequestsFromHtml(content, path, brief))
  }

  let deduped = dedupeImageRequests(applyBriefAndAssetPlan(requests, brief))

  const filterSkIds =
    opts?.elementSkIds?.length
      ? opts.elementSkIds
      : opts?.elementSkId
        ? [opts.elementSkId]
        : []
  const htmlFiles = opts?.htmlFiles
  if (filterSkIds.length && htmlFiles?.length) {
    const allowed = new Set<string>()
    for (const { path, content } of htmlFiles) {
      for (const skId of filterSkIds) {
        for (const p of subtreeImagePaths(content, path, skId, opts?.brief)) {
          allowed.add(p)
        }
      }
    }
    if (allowed.size) {
      deduped = deduped.filter((r) => allowed.has(normalizeDesignImagePath(r.path)))
    }
  }

  return deduped
}
