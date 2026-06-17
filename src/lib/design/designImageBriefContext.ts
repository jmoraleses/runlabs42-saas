import type { DesignBrief } from '@/lib/design/designBrief'

/** Contexto de producto/marca para prompts de Imagen (evita stock genérico). */
export function briefImageSubjectContext(brief?: Partial<DesignBrief>): string {
  const prompt = brief?.prompt?.trim().slice(0, 220) ?? ''
  const tone = brief?.brandTone?.trim() ?? ''
  const site = brief?.siteType?.trim() ?? ''
  const sections = brief?.requiredSections?.filter(Boolean).join(', ') ?? ''
  return [prompt, tone && `brand: ${tone}`, site && `type: ${site}`, sections && `sections: ${sections}`]
    .filter(Boolean)
    .join(' · ')
}

/** Bloque de prompt para que el HTML declare [IMAGE:] alineados al brief. */
export function designBriefImageInstructionsBlock(
  brief: DesignBrief,
  generateImages: boolean,
): string {
  if (!generateImages) return ''
  const subject = briefImageSubjectContext(brief)
  return [
    '## Imágenes generadas — OBLIGATORIO (coherentes con el brief)',
    subject ? `Producto / servicio del usuario: **${subject}**` : '',
    '- Cada foto debe ilustrar ESE producto o servicio (no paisajes, oficinas ni stock de otro sector).',
    '- Declara 2–4 líneas `[IMAGE: assets/archivo.jpg | prompt en inglés | 16:9]` **fuera** del bloque ```html (una por asset).',
    '- El prompt en inglés: primero el estilo de ## Photography & Imagery en design.md, luego el sujeto concreto del brief (nombres, categoría, ambiente).',
    '- En `<img src="assets/...">` usa la **misma ruta** que en `[IMAGE:]`; `alt` describe el sujeto del brief.',
    '- PROHIBIDO: picsum.photos, placehold.co, gradientes como sustituto de fotos cuando la generación está activada.',
  ]
    .filter(Boolean)
    .join('\n')
}

const GENERIC_PROMPT_RE =
  /professional (wide hero banner|web photography|product photography on neutral|portrait photo|product thumbnail)/i

/** Enriquece prompts inferidos o vagos con el contexto del brief. */
export function enrichDesignImagePrompt(prompt: string, brief?: Partial<DesignBrief>): string {
  const subject = briefImageSubjectContext(brief)
  const trimmed = prompt.trim()
  if (!trimmed || !subject) return trimmed

  const subjectKey = subject.slice(0, 48).toLowerCase()
  if (trimmed.toLowerCase().includes(subjectKey.slice(0, 24))) return trimmed

  if (GENERIC_PROMPT_RE.test(trimmed)) {
    return `Website subject: ${subject}. ${trimmed.replace(/^Professional /i, 'Specific ')}`
  }

  return `Website subject: ${subject}. ${trimmed}`
}
