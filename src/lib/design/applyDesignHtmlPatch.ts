import type { VisualPatch } from '@/lib/visual-edit/protocol'

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const STYLE_PROPS: Record<string, string> = {
  color: 'color',
  backgroundColor: 'background-color',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  fontStyle: 'font-style',
  textAlign: 'text-align',
  padding: 'padding',
  margin: 'margin',
  borderRadius: 'border-radius',
  borderWidth: 'border-width',
  borderColor: 'border-color',
  opacity: 'opacity',
  display: 'display',
  textDecoration: 'text-decoration',
}

function elementOpenTagRe(skId: string): RegExp {
  const sk = escapeRe(skId)
  return new RegExp(
    `(<[a-z][a-z0-9]*[^>]*data-sk-id=["']${sk}["'][^>]*)(style=["']([^"']*)["'])?([^>]*>)`,
    'i',
  )
}

function upsertStyleOnTag(
  openTag: string,
  cssProp: string,
  value: string,
): string {
  const m = openTag.match(/style=["']([^"']*)["']/i)
  const style = m?.[1] ?? ''
  const cleaned = style.replace(new RegExp(`${escapeRe(cssProp)}\\s*:[^;]+;?`, 'gi'), '').trim()
  const sep = cleaned && !cleaned.endsWith(';') ? ';' : ''
  const nextStyle = `${cleaned}${sep}${cssProp}:${value};`
  if (m) {
    return openTag.replace(/style=["'][^"']*["']/i, `style="${nextStyle}"`)
  }
  return openTag.replace(/>$/, ` style="${nextStyle}">`)
}

function patchStyleProperty(
  html: string,
  skId: string,
  property: keyof typeof STYLE_PROPS,
  value: string,
): { html: string; applied: boolean } {
  const cssProp = STYLE_PROPS[property]
  if (!cssProp) return { html, applied: false }
  const re = elementOpenTagRe(skId)
  const m = html.match(re)
  if (!m?.[1]) return { html, applied: false }
  const openTag = m[1] + (m[2] ?? '') + (m[4] ?? '')
  const nextTag = upsertStyleOnTag(openTag, cssProp, value)
  const full = m[0]
  const next = full.replace(openTag, nextTag)
  if (next === full) return { html, applied: false }
  return { html: html.replace(full, next), applied: true }
}

function patchHref(html: string, skId: string, value: string): { html: string; applied: boolean } {
  const sk = escapeRe(skId)
  const withHref = new RegExp(
    `(<[a-z][a-z0-9]*[^>]*data-sk-id=["']${sk}["'][^>]*href=["'])([^"']*)(["'])`,
    'i',
  )
  if (withHref.test(html)) {
    const next = html.replace(withHref, `$1${value}$3`)
    return { html: next, applied: next !== html }
  }
  const openRe = new RegExp(`(<[a-z][a-z0-9]*[^>]*data-sk-id=["']${sk}["'][^>]*)(>)`, 'i')
  const m = html.match(openRe)
  if (!m?.[1]) return { html, applied: false }
  const next = html.replace(openRe, `$1 href="${value}"$2`)
  return { html: next, applied: next !== html }
}

function patchImgSrc(html: string, skId: string, value: string): { html: string; applied: boolean } {
  const sk = escapeRe(skId)
  const tagRe = new RegExp(`<img\\b[^>]*data-sk-id=["']${sk}["'][^>]*\\/?>`, 'i')
  const match = html.match(tagRe)
  if (!match?.[0]) return { html, applied: false }

  let tag = match[0]
  if (/\bsrc=(["'])/i.test(tag)) {
    tag = tag.replace(/\bsrc=(["'])([^"']*)\1/i, (_full, quote: string) => `src=${quote}${value}${quote}`)
  } else {
    tag = tag.replace(/\/?>$/, (end) => {
      const trimmed = end.trim()
      if (trimmed === '/>') return ` src="${value}" />`
      return ` src="${value}">`
    })
  }

  if (tag === match[0]) return { html, applied: false }
  return { html: html.replace(match[0], tag), applied: true }
}

function patchClassName(html: string, skId: string, value: string): { html: string; applied: boolean } {
  const sk = escapeRe(skId)
  const re = new RegExp(
    `(<[a-z][a-z0-9]*[^>]*data-sk-id=["']${sk}["'][^>]*class=["'])([^"']*)(["'])`,
    'i',
  )
  if (re.test(html)) {
    const next = html.replace(re, `$1${value}$3`)
    return { html: next, applied: next !== html }
  }
  const openRe = new RegExp(`(<[a-z][a-z0-9]*[^>]*data-sk-id=["']${sk}["'][^>]*)(>)`, 'i')
  const m = html.match(openRe)
  if (!m?.[1]) return { html, applied: false }
  const next = html.replace(openRe, `$1 class="${value}"$2`)
  return { html: next, applied: next !== html }
}

function patchText(
  html: string,
  skId: string,
  value: string,
  element: { tagName: string; text?: string },
  previousText?: string,
): { html: string; applied: boolean } {
  const prev = (previousText ?? element.text)?.trim()
  if (prev && html.includes(prev)) {
    const idx = html.indexOf(prev)
    return {
      html: html.slice(0, idx) + value + html.slice(idx + prev.length),
      applied: true,
    }
  }
  const sk = escapeRe(skId)
  const blockRe = new RegExp(
    `<([a-z][a-z0-9]*)[^>]*data-sk-id=["']${sk}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  )
  const m = html.match(blockRe)
  if (m?.[0]) {
    const full = m[0]
    const openEnd = full.indexOf('>') + 1
    const closeStart = full.lastIndexOf('<')
    const next = full.slice(0, openEnd) + value + full.slice(closeStart)
    return { html: html.replace(full, next), applied: true }
  }
  return { html, applied: false }
}

function removeElement(html: string, skId: string): { html: string; applied: boolean } {
  const sk = escapeRe(skId)
  const blockRe = new RegExp(
    `<[a-z][a-z0-9]*[^>]*data-sk-id=["']${sk}["'][^>]*>[\\s\\S]*?<\\/[a-z][a-z0-9]*>`,
    'i',
  )
  if (blockRe.test(html)) {
    const next = html.replace(blockRe, '')
    return { html: next, applied: next !== html }
  }
  return patchStyleProperty(html, skId, 'display', 'none')
}

/** Parches visuales directos en HTML del mockup (sin IA). */
export function applyDesignHtmlPatch(
  html: string,
  patch: VisualPatch,
  element: { skId: string; tagName: string; text?: string },
  options?: { previousText?: string },
): { html: string; applied: boolean } {
  const skId = patch.skId

  if (patch.property === 'text') {
    return patchText(html, skId, patch.value, element, options?.previousText)
  }

  if (patch.property === 'className') {
    return patchClassName(html, skId, patch.value)
  }

  if (patch.property === 'href') {
    return patchHref(html, skId, patch.value)
  }

  if (patch.property === 'src') {
    return patchImgSrc(html, skId, patch.value)
  }

  if (patch.property === 'display' && patch.value === 'none') {
    return removeElement(html, skId)
  }

  if (patch.property in STYLE_PROPS) {
    return patchStyleProperty(
      html,
      skId,
      patch.property as keyof typeof STYLE_PROPS,
      patch.value,
    )
  }

  return { html, applied: false }
}
