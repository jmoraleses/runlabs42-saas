import 'server-only'

import type { FigmaNode } from '@/lib/integrations/figmaApi'

const SKIP_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE'])

export type SimplifiedFigmaNode = {
  id: string
  name: string
  type: string
  text?: string
  w?: number
  h?: number
  layout?: string
  fills?: string[]
  children?: SimplifiedFigmaNode[]
}

function simplifyColor(fills: unknown[] | undefined): string[] {
  if (!fills?.length) return []
  const colors: string[] = []
  for (const f of fills) {
    if (f && typeof f === 'object' && 'color' in f) {
      const c = (f as { color?: { r: number; g: number; b: number; a?: number } }).color
      if (c) {
        const a = c.a ?? 1
        colors.push(
          `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a.toFixed(2)})`,
        )
      }
    }
  }
  return colors.slice(0, 3)
}

export function simplifyFigmaNode(
  node: FigmaNode,
  depth = 0,
  maxDepth = 6,
): SimplifiedFigmaNode | null {
  if (node.visible === false) return null
  if (SKIP_TYPES.has(node.type) && depth > 2) return null

  const box = node.absoluteBoundingBox
  const simplified: SimplifiedFigmaNode = {
    id: node.id,
    name: node.name?.slice(0, 80) ?? node.type,
    type: node.type,
  }

  if (node.characters?.trim()) simplified.text = node.characters.trim().slice(0, 500)
  if (box) {
    simplified.w = Math.round(box.width)
    simplified.h = Math.round(box.height)
  }
  if (node.layoutMode) simplified.layout = node.layoutMode
  const fillColors = simplifyColor(node.fills)
  if (fillColors.length) simplified.fills = fillColors

  if (depth < maxDepth && node.children?.length) {
    const children: SimplifiedFigmaNode[] = []
    for (const child of node.children) {
      const s = simplifyFigmaNode(child, depth + 1, maxDepth)
      if (s) children.push(s)
      if (children.length >= 40) break
    }
    if (children.length) simplified.children = children
  }

  return simplified
}

export function simplifyFigmaTree(document: FigmaNode | undefined): SimplifiedFigmaNode[] {
  if (!document) return []
  const screens: SimplifiedFigmaNode[] = []
  const canvases = document.children ?? [document]
  for (const page of canvases) {
    for (const frame of page.children ?? []) {
      const s = simplifyFigmaNode(frame, 0, 6)
      if (s) screens.push(s)
      if (screens.length >= 8) break
    }
    if (screens.length >= 8) break
  }
  if (!screens.length) {
    const root = simplifyFigmaNode(document, 0, 6)
    if (root) screens.push(root)
  }
  return screens
}

export function figmaSummaryForPrompt(
  fileName: string,
  screens: SimplifiedFigmaNode[],
  extraPrompt?: string,
): string {
  const json = JSON.stringify({ fileName, screens }, null, 0)
  const truncated = json.length > 100_000 ? json.slice(0, 100_000) + '…' : json
  return `Importa este diseño desde Figma (${fileName}):

\`\`\`json
${truncated}
\`\`\`

${extraPrompt?.trim() ? `Instrucciones adicionales: ${extraPrompt.trim()}` : 'Genera todas las pantallas principales como mockups HTML con data-sk-id.'}`
}
