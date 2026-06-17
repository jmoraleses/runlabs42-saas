/**
 * Convierte tablas GFM anchas (p. ej. planes /plan) en bloques verticales que caben en el chat.
 */

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return []
  const parts = trimmed.split('|')
  return parts.slice(1, parts.length - 1).map((c) => c.trim())
}

function isTableRow(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length >= 2
}

function isSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line)
  if (cells.length < 2) return false
  return cells.every((c) => /^:?-{3,}:?$/.test(c))
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickTitle(headers: string[], cells: string[]): { id: string; title: string } {
  const idIdx = headers.findIndex((h) => /^(id|#|tarea|task|paso|step)$/i.test(h))
  const titleIdx = headers.findIndex((h) =>
    /^(tarea|task|nombre|name|descripcion|description|titulo|title)$/i.test(normalizeHeader(h)),
  )
  const id = (idIdx >= 0 ? cells[idIdx] : cells[0])?.trim() || ''
  let title =
    (titleIdx >= 0 ? cells[titleIdx] : cells[1] ?? cells[0])?.trim() || id || 'Tarea'
  if (title === id && cells[1]?.trim() && cells[1] !== id) title = cells[1].trim()
  return { id, title }
}

function formatRowAsCard(headers: string[], cells: string[]): string {
  const { id, title } = pickTitle(headers, cells)
  const heading = id && title && id !== title ? `${id} — ${title}` : title || id
  const lines: string[] = [`##### ${heading}`]
  const skip = new Set<number>()

  headers.forEach((h, i) => {
    if (/^(id|#)$/i.test(h.trim())) skip.add(i)
    const nh = normalizeHeader(h)
    if (/(tarea|task|nombre|name|titulo|title)/.test(nh) && cells[i] === title) skip.add(i)
  })

  for (let i = 0; i < headers.length; i++) {
    if (skip.has(i)) continue
    const label = headers[i]?.trim()
    const value = cells[i]?.trim()
    if (!label || !value) continue
    lines.push(`- **${label}:** ${value}`)
  }

  return lines.join('\n')
}

export type ParsedTable = {
  headers: string[]
  rows: string[][]
  endIndex: number
}

export function parseGfmTable(lines: string[], start: number): ParsedTable | null {
  if (!isTableRow(lines[start] ?? '')) return null
  if (!isSeparatorRow(lines[start + 1] ?? '')) return null

  const headers = splitTableRow(lines[start]!)
  const rows: string[][] = []
  let i = start + 2
  while (i < lines.length && isTableRow(lines[i]!) && !isSeparatorRow(lines[i]!)) {
    rows.push(splitTableRow(lines[i]!))
    i++
  }
  if (!rows.length) return null
  return { headers, rows, endIndex: i }
}

/** Sustituye tablas markdown por listas/tarjetas compactas. */
export function simplifyMarkdownTablesForChat(text: string): string {
  if (!text.includes('|')) return text
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const table = parseGfmTable(lines, i)
    if (table) {
      if (out.length && out[out.length - 1]?.trim()) out.push('')
      const cards = table.rows.map((row) => formatRowAsCard(table.headers, row))
      out.push(cards.join('\n\n'))
      i = table.endIndex
      continue
    }
    out.push(lines[i] ?? '')
    i++
  }

  return out.join('\n')
}
