import type { VertexImagePart } from '@/lib/ai/vertexAgentPlatform'
import { designVisualReferencePrompt } from '@/lib/design/prompts'

export function appendVisualReferenceToPrompt(
  prompt: string,
  hasImages: boolean,
): string {
  if (!hasImages) return prompt
  return `${designVisualReferencePrompt()}\n\n${prompt}`
}

/** Bloque de prompt cuando el usuario adjuntó captura/mockup (prioridad sobre plantillas). */
export function visualReferenceUserPromptBlock(): string {
  return `## Referencia visual (PRIORIDAD MÁXIMA)
Las imágenes adjuntas (captura del usuario y/o gold Stitch) son la fuente de verdad visual — por encima de plantillas genéricas.
1. Audita cada imagen antes de tokens o layout: orden de secciones, columnas (p. ej. 65/35), bento, grids, summary boxes, footer.
2. Extrae hex, tipografías y componentes visibles; no sustituyas por paletas SaaS ni serif editorial si la referencia es otra identidad.
3. El layout JSON y el HTML deben replicar la misma topología (nav → hero → beneficios bento → productos → footer), no navigation → hero → 3 features planas.
4. Si el brief pide una sola pantalla, declara una sola page; no añadas pricing/catalog extra salvo que aparezcan en la referencia.
5. Copy legible de la captura: conserva o traduce al idioma del brief; no uses lorem ni otro sector (café, SaaS genérico).
6. Placeholders de imagen: gradientes de la paleta o proporciones aspect-[4/3] como en la referencia; evita picsum aleatorio.`
}

/** Hints de layout cuando hay captura (sustituye "variabilidad" anti-plantilla). */
export function visualReferenceLayoutHints(): string {
  return [
    '## Fidelidad a la captura adjunta (obligatorio)',
    'Replica la estructura visible en la imagen: orden de secciones, columnas, sidebar, bloques de resumen, CTAs y footer.',
    'section.type deben nombrar zonas observadas (site-header, hero-split, class-grid, testimonial-row, site-footer, etc.).',
    'Si la captura muestra una sola pantalla, declara una sola page en el JSON (id coherente: home, cart, checkout…).',
    'No fuerces composiciones "creativas" distintas a la referencia para evitar repetir plantillas.',
  ].join('\n')
}

function resolveFetchableImageUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) {
    const proto = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    return `${proto}:${trimmed}`
  }
  if (trimmed.startsWith('/')) {
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
      'http://localhost:3000'
    return `${base.replace(/\/$/, '')}${trimmed}`
  }
  return trimmed
}

export async function fetchImageAsVertexPart(url: string): Promise<VertexImagePart | null> {
  try {
    const resolved = resolveFetchableImageUrl(url)
    const res = await fetch(resolved, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
    if (!mimeType.startsWith('image/')) return null
    return { mimeType, data: buf.toString('base64') }
  } catch {
    return null
  }
}
