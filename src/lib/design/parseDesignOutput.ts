import { parseFileOperationsFromStream } from '@/lib/ai/parseAssistantOutput'
import type { DesignSpec } from '@/lib/design/types'
import {
  DESIGN_MOCKUPS_PREFIX,
  DESIGN_PAGES_PREFIX,
  DESIGN_SPEC_JSON,
  DESIGN_SPEC_MD,
  DESIGN_SITE_INDEX,
} from '@/lib/design/types'

export type ParsedDesignOutput = {
  files: Array<{ path: string; content: string }>
  spec: DesignSpec | null
  pipeline: 'image' | 'html'
}

function isImagePipelineSpec(spec: DesignSpec | null): boolean {
  if (!spec?.pages?.length) return false
  if (spec.source === 'vertex-imagen') return true
  return spec.pages.some((p) => p.media === 'image' || p.path.endsWith('.png'))
}

function extractSpecJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*spec\/design\.json\s*\n([\s\S]*?)```/i)
  if (fenced?.[1]?.trim()) return fenced[1].trim()
  const loose = text.match(/\{[\s\S]*"pages"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
  return loose?.[0]?.trim() ?? null
}

/** Fase plan (solo spec + design.md); no exige archivos HTML todavía. */
export function parseDesignPlanOutput(text: string): ParsedDesignOutput {
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: DESIGN_SPEC_JSON,
    existingPaths: [DESIGN_SPEC_JSON, DESIGN_SPEC_MD],
  })
  const files = ops
    .filter((o) => o.type !== 'delete')
    .filter((o) => o.path === DESIGN_SPEC_JSON || o.path === DESIGN_SPEC_MD)
    .map((o) => ({ path: o.path, content: o.content }))

  let spec: DesignSpec | null = null
  let specFile = files.find((f) => f.path === DESIGN_SPEC_JSON)
  if (!specFile?.content) {
    const raw = extractSpecJsonBlock(text)
    if (raw) {
      specFile = { path: DESIGN_SPEC_JSON, content: raw }
      files.push(specFile)
    }
  }
  if (specFile?.content) {
    try {
      spec = JSON.parse(specFile.content) as DesignSpec
    } catch {
      spec = null
    }
  }

  if (!spec?.pages?.length) {
    throw new Error('El plan no generó spec/design.json con páginas')
  }
  if (isImagePipelineSpec(spec)) {
    throw new Error(
      'El plan devolvió mockups PNG (pipeline imagen). Regenera o usa DESIGN_PIPELINE=imagen.',
    )
  }

  return { files, spec, pipeline: 'html' }
}

export function parseDesignGeneration(text: string): ParsedDesignOutput {
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: DESIGN_SITE_INDEX,
    existingPaths: [DESIGN_SPEC_JSON, DESIGN_SPEC_MD, DESIGN_SITE_INDEX],
  })
  const files = ops
    .filter((o) => o.type !== 'delete')
    .filter(
      (o) =>
        o.path === DESIGN_SPEC_JSON ||
        o.path === DESIGN_SPEC_MD ||
        o.path === DESIGN_SITE_INDEX ||
        o.path.startsWith(DESIGN_PAGES_PREFIX) ||
        o.path.startsWith(DESIGN_MOCKUPS_PREFIX) ||
        o.path.startsWith('design/site/'),
    )
    .map((o) => ({ path: o.path, content: o.content }))

  let spec: DesignSpec | null = null
  const specFile = files.find((f) => f.path === DESIGN_SPEC_JSON)
  if (specFile?.content) {
    try {
      spec = JSON.parse(specFile.content) as DesignSpec
    } catch {
      spec = null
    }
  }

  const pipeline = isImagePipelineSpec(spec) ? 'image' : 'html'

  if (pipeline === 'image') {
    if (!spec?.pages?.length) {
      throw new Error('No se generó spec/design.json con páginas')
    }
    let specMutated = false
    for (const page of spec.pages) {
      if (page.media !== 'html' && !page.imagePrompt?.trim()) {
        page.imagePrompt = `High-fidelity flat UI mockup for the "${page.name || page.id}" screen.`
        specMutated = true
      }
    }
    if (specMutated && specFile) {
      specFile.content = JSON.stringify(spec, null, 2)
    }
    return { files, spec, pipeline }
  }

  const hasPage = files.some(
    (f) => f.path === DESIGN_SITE_INDEX || f.path.startsWith(DESIGN_PAGES_PREFIX),
  )
  if (!hasPage) {
    throw new Error('No se generaron páginas HTML de diseño')
  }

  return { files, spec, pipeline }
}

const VARIANT_PROMPT_PATH_RE = /^design\/variants\/([^/]+)\/prompt\.json$/
const VARIANT_HTML_PATH_RE = /^design\/variants\/([^/]+)\/(?:index\.html|[^/]+\.html)$/

function parseImageVariantPromptFromJson(
  content: string,
  variantId: string,
): { variantId: string; imagePrompt: string } | null {
  try {
    const parsed = JSON.parse(content) as { imagePrompt?: string }
    const imagePrompt = parsed.imagePrompt?.trim()
    if (!imagePrompt) return null
    return { variantId, imagePrompt }
  } catch {
    return null
  }
}

/** Fallback cuando el modelo no usa fences con ruta exacta. */
function parseImageVariantPromptsLoose(
  text: string,
): Array<{ variantId: string; imagePrompt: string }> {
  const out: Array<{ variantId: string; imagePrompt: string }> = []
  const seen = new Set<string>()

  const fenceRe =
    /```[^\n]*design\/variants\/([^/\s]+)\/prompt\.json[^\n]*\n([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text)) !== null) {
    const parsed = parseImageVariantPromptFromJson(m[2]!.trim(), m[1]!)
    if (parsed && !seen.has(parsed.variantId)) {
      seen.add(parsed.variantId)
      out.push(parsed)
    }
  }
  if (out.length) return out.slice(0, 4)

  let idx = 1
  const jsonFenceRe = /```(?:json)?[^\n]*\n([\s\S]*?)```/gi
  while ((m = jsonFenceRe.exec(text)) !== null) {
    const body = m[1]!.trim()
    if (!body.includes('imagePrompt')) continue
    try {
      const parsed = JSON.parse(body) as
        | { imagePrompt?: string }
        | Array<{ imagePrompt?: string }>
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const imagePrompt = item?.imagePrompt?.trim()
          if (!imagePrompt) continue
          const variantId = `v${idx++}`
          if (seen.has(variantId)) continue
          seen.add(variantId)
          out.push({ variantId, imagePrompt })
        }
      } else {
        const imagePrompt = parsed.imagePrompt?.trim()
        if (imagePrompt) {
          const variantId = `v${idx++}`
          if (!seen.has(variantId)) {
            seen.add(variantId)
            out.push({ variantId, imagePrompt })
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (out.length) return out.slice(0, 4)

  const promptRe = /"imagePrompt"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  while ((m = promptRe.exec(text)) !== null) {
    let imagePrompt: string
    try {
      imagePrompt = JSON.parse(`"${m[1]!.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`) as string
    } catch {
      imagePrompt = m[1]!.replace(/\\"/g, '"').replace(/\\n/g, '\n')
    }
    const variantId = `v${idx++}`
    if (seen.has(variantId)) continue
    seen.add(variantId)
    out.push({ variantId, imagePrompt: imagePrompt.trim() })
  }

  return out.slice(0, 4)
}

/** Fallback para bloques HTML sin ruta design/variants/ explícita. */
function parseDesignVariantsLoose(text: string): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = []
  const seen = new Set<string>()
  let autoIdx = 1

  const fenceRe =
    /```(?:html)?[^\n]*(?:design\/variants\/([^/\s]+)(?:\/index\.html)?)?[^\n]*\n([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text)) !== null) {
    const content = m[2]!.trim()
    if (!content.includes('<') || content.length < 40) continue
    const variantId = m[1] ?? `v${autoIdx++}`
    const path = `design/variants/${variantId}/index.html`
    if (seen.has(path)) continue
    seen.add(path)
    out.push({ path, content })
  }

  return out.slice(0, 4)
}

export function parseDesignVariants(text: string): Array<{ path: string; content: string }> {
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: 'design/variants/v1/index.html',
    existingPaths: [],
  })
  const strict = ops
    .filter(
      (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
        o.type !== 'delete' && o.path.startsWith('design/variants/'),
    )
    .map((o) => {
      const match = o.path.match(VARIANT_HTML_PATH_RE)
      const path = match
        ? `design/variants/${match[1]}/index.html`
        : o.path.endsWith('.html')
          ? o.path
          : `design/variants/${o.path.split('/')[2] ?? 'v1'}/index.html`
      return { path, content: o.content }
    })
  if (strict.length) return strict
  return parseDesignVariantsLoose(text)
}

export function parseImageVariantPrompts(
  text: string,
): Array<{ variantId: string; imagePrompt: string }> {
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: 'design/variants/v1/prompt.json',
    existingPaths: [],
  })
  const out: Array<{ variantId: string; imagePrompt: string }> = []
  for (const op of ops) {
    if (op.type === 'delete' || !op.path.startsWith('design/variants/')) continue
    const m = op.path.match(VARIANT_PROMPT_PATH_RE)
    const variantId = m?.[1] ?? op.path.match(/^design\/variants\/([^/]+)/)?.[1]
    if (!variantId) continue
    const parsed = parseImageVariantPromptFromJson(op.content, variantId)
    if (parsed) out.push(parsed)
  }
  if (out.length) return out
  return parseImageVariantPromptsLoose(text)
}

export function parsePageImagePromptUpdate(text: string): string | null {
  const ops = parseFileOperationsFromStream(text, {
    defaultPath: 'spec/design-page-update.json',
    existingPaths: ['spec/design-page-update.json'],
  })
  const file = ops.find(
    (o): o is Extract<(typeof ops)[number], { type: 'create' | 'update' }> =>
      o.type !== 'delete' && o.path === 'spec/design-page-update.json',
  )
  if (!file?.content) return null
  try {
    const parsed = JSON.parse(file.content) as { imagePrompt?: string }
    return parsed.imagePrompt?.trim() ?? null
  } catch {
    return null
  }
}
