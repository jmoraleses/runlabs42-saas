import type { WebStudioCanvasTool } from '@/components/editor/webStudio/WebStudioToolsRail'

/** Single-letter shortcuts (no modifiers) for primary canvas tools. */
export const WEB_STUDIO_TOOL_SHORTCUTS: Partial<Record<WebStudioCanvasTool, string>> = {
  select: 'V',
  pan: 'H',
  edit: 'E',
  connect: 'L',
  rect: 'R',
  image: 'I',
  palette: 'P',
}

export function canvasToolFromShortcutKey(key: string): WebStudioCanvasTool | null {
  const k = key.length === 1 ? key.toLowerCase() : ''
  if (!k) return null
  for (const [tool, shortcut] of Object.entries(WEB_STUDIO_TOOL_SHORTCUTS) as [
    WebStudioCanvasTool,
    string,
  ][]) {
    if (shortcut.toLowerCase() === k) return tool
  }
  return null
}
