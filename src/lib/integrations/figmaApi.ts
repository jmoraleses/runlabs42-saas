import 'server-only'

const FIGMA_API = 'https://api.figma.com/v1'

export function parseFigmaFileKey(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
  if (match?.[1]) return match[1]
  if (/^[a-zA-Z0-9]{10,32}$/.test(trimmed)) return trimmed
  return null
}

export type FigmaFileResponse = {
  name?: string
  document?: FigmaNode
  components?: Record<string, unknown>
  styles?: Record<string, unknown>
}

export type FigmaNode = {
  id: string
  name: string
  type: string
  children?: FigmaNode[]
  characters?: string
  style?: Record<string, unknown>
  fills?: unknown[]
  layoutMode?: string
  itemSpacing?: number
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  paddingBottom?: number
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number }
  visible?: boolean
}

export async function fetchFigmaFile(
  accessToken: string,
  fileKey: string,
  depth = 4,
): Promise<FigmaFileResponse> {
  const url = `${FIGMA_API}/files/${fileKey}?depth=${depth}&geometry=paths`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Figma API ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as FigmaFileResponse
}

export async function fetchFigmaImageFills(
  accessToken: string,
  fileKey: string,
  nodeIds: string[],
): Promise<Record<string, string>> {
  if (!nodeIds.length) return {}
  const url = `${FIGMA_API}/images/${fileKey}?ids=${nodeIds.slice(0, 50).join(',')}&format=png`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) return {}
  const data = (await res.json()) as { images?: Record<string, string | null> }
  const out: Record<string, string> = {}
  for (const [id, img] of Object.entries(data.images ?? {})) {
    if (img) out[id] = img
  }
  return out
}
