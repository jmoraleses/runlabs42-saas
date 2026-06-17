import type { DesignBrief } from '@/lib/design/designBrief'
import { extractDesignMdSection } from '@/lib/design/designMdSections'

const DEFAULT_PHOTOGRAPHY_STYLE =
  'Cohesive editorial web photography: soft natural light, consistent color grading, clean neutral or warm-toned backgrounds, shallow depth of field, same photoshoot session look across all images'

const ECOMMERCE_ORGANIC_STYLE =
  'Editorial botanical product photography: soft window light, warm cream or muted forest-green seamless backgrounds, consistent muted color grading, shallow depth of field, catalog cohesion — all shots from the same session'

/** Estilo por defecto según brief cuando design.md no define fotografía. */
export function photographyStyleFromBrief(brief?: Partial<DesignBrief>): string {
  const tone = brief?.brandTone?.toLowerCase() ?? ''
  if (/organic|botanical|orgánico|editorial|verdant|garden|planta|botan/i.test(tone)) {
    return ECOMMERCE_ORGANIC_STYLE
  }
  if (brief?.siteType === 'ecommerce') {
    return `Consistent e-commerce product photography, ${tone || 'modern premium'} brand tone, uniform soft studio lighting, same background family and color grading for every product shot`
  }
  if (tone) {
    return `Cohesive ${tone} editorial photography, consistent lighting and color grading across all images`
  }
  return DEFAULT_PHOTOGRAPHY_STYLE
}

/** Extrae dirección de arte fotográfica desde spec/design.md. */
export function extractPhotographyStyleFromDesignMd(markdown: string): string | undefined {
  const md = markdown.trim()
  if (!md) return undefined

  for (const heading of ['## Photography & Imagery', '## Photography', '## Imagery']) {
    const section = extractDesignMdSection(md, heading)
    if (section.length > 40) {
      const body = section.replace(/^##[^\n]+\n?/, '').trim()
      if (body.length > 30) return body.slice(0, 500)
    }
  }

  const brand = extractDesignMdSection(md, '## Brand & Style')
  const photoLine = brand
    .split('\n')
    .find((line) => /fotograf|photography|imagery|photo style/i.test(line))
  if (photoLine && photoLine.length > 25) {
    return photoLine.replace(/^[-*]\s*/, '').trim().slice(0, 500)
  }

  return undefined
}

export function resolvePhotographyStyle(opts?: {
  designMd?: string
  brief?: Partial<DesignBrief>
}): string {
  const fromMd = opts?.designMd ? extractPhotographyStyleFromDesignMd(opts.designMd) : undefined
  if (fromMd) return fromMd
  return photographyStyleFromBrief(opts?.brief)
}

/** Bloque de prompt para generación HTML / assets. */
export function designMdPhotographyGuidanceBlock(
  markdown: string,
  brief?: Partial<DesignBrief>,
): string {
  const style = resolvePhotographyStyle({ designMd: markdown, brief })
  return [
    '## Photography — dirección de arte OBLIGATORIA (todas las imágenes)',
    `Estilo unificado del sitio: ${style}`,
    '- TODOS los tags [IMAGE:] y todos los prompts de producto/hero deben compartir la MISMA iluminación, fondo y gradación de color.',
    '- En cada prompt en inglés, empieza con el mismo prefijo de estilo (copia la frase de arriba) y luego describe solo el sujeto (producto, hero, etc.).',
    '- Prohibido mezclar estilos: no combines fotos de exterior con estudio oscuro, ni stock genérico con editorial premium en la misma página.',
    '- Los thumbnails de carrito, catálogo y upsell deben verse como el mismo catálogo fotográfico.',
  ].join('\n')
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Prefija el prompt de Imagen con la dirección de arte del sitio (sin duplicar). */
export function augmentDesignAssetPrompt(subjectPrompt: string, style: string): string {
  const subject = subjectPrompt.trim()
  const styleTrim = style.trim()
  if (!subject) return styleTrim
  if (!styleTrim) return subject

  const subjectNorm = normalizeForCompare(subject)
  const styleNorm = normalizeForCompare(styleTrim)
  if (subjectNorm.startsWith(styleNorm.slice(0, Math.min(48, styleNorm.length)))) {
    return subject
  }
  if (subjectNorm.includes('same photoshoot') && subjectNorm.includes('consistent')) {
    return subject
  }

  const noText = 'No text, no logos, no UI elements, no overlays, no watermarks.'
  return `${styleTrim}. ${subject}. ${noText}`
}
