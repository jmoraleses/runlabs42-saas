/** Canal postMessage entre el shell del editor y el sandbox del preview (patrón Base44 / Lovable). */

export const VISUAL_EDIT_CHANNEL = 'runlabs42-visual-edit' as const

export type VisualEditMode = 'off' | 'select' | 'pan'

export type ElementDescriptor = {
  skId: string
  tagName: string
  rect: { top: number; left: number; width: number; height: number }
  text?: string
  styles: Record<string, string>
  source?: { file: string; line: number; column?: number }
}

export type InsertNodeKind = 'text' | 'heading' | 'image' | 'button' | 'section'

export type InsertNodePayload = {
  kind: InsertNodeKind
  skId: string
  parentSkId?: string
  text?: string
  src?: string
}

/** Contexto de drop al insertar desde la herramienta del canvas. */
export type InsertPlacementContext = {
  kind: InsertNodeKind
  skId: string
  parentSkId: string
  parentTag: string
  insertBeforeSkId?: string | null
  siblingIndex?: number
  dropXPercent?: number
  dropYPercent?: number
}

export type NodeInsertedPayload = {
  element: ElementDescriptor
  placement: InsertPlacementContext
}

export type VisualPatch = {
  skId: string
  property:
    | 'text'
    | 'color'
    | 'backgroundColor'
    | 'fontSize'
    | 'fontWeight'
    | 'padding'
    | 'margin'
    | 'textAlign'
    | 'borderRadius'
    | 'borderWidth'
    | 'borderColor'
    | 'opacity'
    | 'className'
    | 'href'
    | 'display'
    | 'fontStyle'
    | 'textDecoration'
    | 'src'
  value: string
}

export type PinPickPayload = {
  clientX: number
  clientY: number
  element: ElementDescriptor | null
}

export type BridgeToParent =
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'bridge-ready' }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'element-hover'; payload: ElementDescriptor | null }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'element-select'; payload: ElementDescriptor | null }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'node-inserted'; payload: NodeInsertedPayload }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'pin-picked'; payload: PinPickPayload }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'preview-context-menu'; payload: { clientX: number; clientY: number } }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'preview-pointer-down'; payload?: undefined }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'navigate'; payload: { path: string } }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'html-updated'; payload: { html: string } }

export type ParentToBridge =
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'ping' }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'init'; payload: { mode: VisualEditMode } }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'set-mode'; payload: { mode: VisualEditMode } }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'begin-placement'; payload: { kind: InsertNodeKind } }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'cancel-placement' }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'highlight'; payload: { skId: string } | null }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'apply-patch'; payload: VisualPatch }
  | { channel: typeof VISUAL_EDIT_CHANNEL; type: 'reload-styles'; payload: Record<string, Record<string, string>> }
  | {
      channel: typeof VISUAL_EDIT_CHANNEL
      type: 'set-link-assignments'
      payload: Record<string, string[]>
    }
  | {
      channel: typeof VISUAL_EDIT_CHANNEL
      type: 'pick-at-point'
      payload: { clientX: number; clientY: number }
    }
  | {
      channel: typeof VISUAL_EDIT_CHANNEL
      type: 'move-sibling'
      payload: { skId: string; direction: 'up' | 'down' }
    }

export function isVisualEditMessage(data: unknown): data is BridgeToParent | ParentToBridge {
  return (
    typeof data === 'object' &&
    data !== null &&
    'channel' in data &&
    (data as { channel: string }).channel === VISUAL_EDIT_CHANNEL &&
    'type' in data
  )
}

/** Origen opaco de iframes `srcdoc` / sandbox — no es válido como targetOrigin. */
export function isOpaqueSandboxOrigin(origin: string): boolean {
  return origin === 'null' || origin === ''
}

export function postToBridge(iframe: HTMLIFrameElement | null, message: ParentToBridge) {
  // srcdoc → origen opaco; el destino debe ser '*' (validamos con ev.source en el listener).
  iframe?.contentWindow?.postMessage(message, '*')
}

export function isMessageFromPreviewIframe(
  ev: MessageEvent,
  iframe: HTMLIFrameElement | null,
): boolean {
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return false
  if (typeof window === 'undefined') return true
  if (ev.origin === window.location.origin) return true
  if (isOpaqueSandboxOrigin(ev.origin)) return true
  return false
}
