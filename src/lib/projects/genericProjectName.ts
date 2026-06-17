export type StudioLang = 'es' | 'en'

/** Nombre incremental "Proyecto 1", "Proyecto 2", … según proyectos existentes. */
export function nextGenericProjectName(
  existingNames: Iterable<string>,
  lang: StudioLang = 'es',
): string {
  const base = lang === 'en' ? 'Project' : 'Proyecto'
  const re = new RegExp(`^${base}\\s+(\\d+)$`, 'i')
  const used = new Set<number>()

  for (const raw of existingNames) {
    const match = String(raw).trim().match(re)
    if (!match) continue
    const n = parseInt(match[1]!, 10)
    if (Number.isFinite(n) && n > 0) used.add(n)
  }

  let next = 1
  while (used.has(next)) next += 1
  return `${base} ${next}`
}
