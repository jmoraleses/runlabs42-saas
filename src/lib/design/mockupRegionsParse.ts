import type { DesignPageRegion } from '@/lib/design/types'

function normalizeRegion(raw: DesignPageRegion): DesignPageRegion | null {
  const x = Number(raw.x)
  const y = Number(raw.y)
  const w = Number(raw.w)
  const h = Number(raw.h)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return null
  }
  if (w <= 0 || h <= 0) return null
  return {
    id: raw.id.trim(),
    label: raw.label.trim(),
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    w: Math.min(1, Math.max(0, w)),
    h: Math.min(1, Math.max(0, h)),
  }
}

function filterValidRegions(regions: unknown): DesignPageRegion[] {
  if (!Array.isArray(regions)) return []
  const out: DesignPageRegion[] = []
  for (const r of regions) {
    if (
      typeof r !== 'object' ||
      r == null ||
      typeof (r as DesignPageRegion).id !== 'string' ||
      typeof (r as DesignPageRegion).label !== 'string'
    ) {
      continue
    }
    const normalized = normalizeRegion(r as DesignPageRegion)
    if (normalized) out.push(normalized)
  }
  return out
}

function extractRegionsFromPartialJson(text: string): DesignPageRegion[] {
  const regions: DesignPageRegion[] = []
  const re =
    /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"([^"]+)"\s*,\s*"x"\s*:\s*([\d.eE+-]+)\s*,\s*"y"\s*:\s*([\d.eE+-]+)\s*,\s*"w"\s*:\s*([\d.eE+-]+)\s*,\s*"h"\s*:\s*([\d.eE+-]+)\s*\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const normalized = normalizeRegion({
      id: match[1]!,
      label: match[2]!,
      x: Number(match[3]),
      y: Number(match[4]),
      w: Number(match[5]),
      h: Number(match[6]),
    })
    if (normalized) regions.push(normalized)
  }
  return regions
}

function tryRepairTruncatedRegionsJson(text: string): DesignPageRegion[] {
  const start = text.indexOf('{')
  if (start < 0) return []
  let slice = text.slice(start).trim()
  slice = slice.replace(/,\s*\{[^}]*$/s, '')
  for (const suffix of ['}', ']}', ']}', 'null]}']) {
    try {
      const parsed = JSON.parse(slice + suffix) as { regions?: unknown }
      const regions = filterValidRegions(parsed.regions)
      if (regions.length) return regions
    } catch {
      /* try next suffix */
    }
  }
  return []
}

export function parseRegionsFromModelText(text: string): DesignPageRegion[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { regions?: unknown }
      const regions = filterValidRegions(parsed.regions)
      if (regions.length) return regions
    } catch {
      /* try next */
    }
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as { regions?: unknown }
      const regions = filterValidRegions(parsed.regions)
      if (regions.length) return regions
    } catch {
      /* fall through */
    }
  }

  const repaired = tryRepairTruncatedRegionsJson(trimmed)
  if (repaired.length) return repaired

  return extractRegionsFromPartialJson(trimmed)
}
