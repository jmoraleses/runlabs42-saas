/** HTML persistido listo para mostrar en el lienzo (no aurora ni borrador genérico). */
export function hasPersistedDesignPageHtml(content: string | null | undefined): boolean {
  const trimmed = content?.trim()
  if (!trimmed) return false
  return !isDesignPreviewPlaceholderHtml(trimmed)
}

/** Aurora / documento de carga mínimo — no es HTML de producto. */
export function isDesignPreviewPlaceholderHtml(html: string): boolean {
  const trimmed = html.trim()
  if (!trimmed) return false
  if (/\brl42-blue-aurora\b/.test(trimmed)) {
    const hasProductMarkup = /<main[\s>]/i.test(trimmed) || /<section[\s>]/i.test(trimmed)
    if (!hasProductMarkup && trimmed.length < 2000) return true
  }
  const titleOnly =
    /<title>\s*(Diseñando|Designing)\s*<\/title>/i.test(trimmed) &&
    !/<main[\s>]/i.test(trimmed) &&
    trimmed.length < 2000
  return titleOnly
}
