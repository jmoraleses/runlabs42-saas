/** Proyecto ajeno que aparece en la lista con etiqueta «Compartido». */
export function isStitchSharedListItem(raw: string): boolean {
  return /compartido/i.test(raw)
}

/** Título legible desde el texto del ítem en la lista lateral de Stitch. */
export function parseStitchProjectListTitle(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return ''

  const byMonth = text.match(
    /^(.+?)(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|ene\.?|feb\.?|mar\.?|abr\.?|may\.?|jun\.?|jul\.?|ago\.?|sep\.?|oct\.?|nov\.?|dic\.?)\s*\d/i,
  )
  if (byMonth?.[1]) return byMonth[1].trim()

  const byDate = text.match(/^(.+?)\d{1,2},\s*\d{4}/)
  if (byDate?.[1]) return byDate[1].trim()

  const compartido = text.replace(/Compartido.*$/i, '').trim()
  return compartido || text
}
