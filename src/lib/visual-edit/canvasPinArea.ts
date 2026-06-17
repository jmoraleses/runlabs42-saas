/** Rectángulo de área en el canvas del preview (porcentajes 0–100). */

export type PinAreaPercent = {
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}

const MIN_SIZE = 4
const DEFAULT_SIZE = 12

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v))
}

/** Convierte coordenadas de cliente a % relativas al rect del contenedor. */
export function clientToRectPercent(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
): { x: number; y: number } {
  if (containerRect.width < 1 || containerRect.height < 1) return { x: 0, y: 0 }
  return {
    x: ((clientX - containerRect.left) / containerRect.width) * 100,
    y: ((clientY - containerRect.top) / containerRect.height) * 100,
  }
}

/** @deprecated Usa clientToRectPercent */
export function clientToCanvasPercent(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
): { x: number; y: number } {
  return clientToRectPercent(clientX, clientY, canvasRect)
}

/** Normaliza un arrastre a un rectángulo válido (mínimo tamaño si fue solo clic). */
export function normalizePinAreaFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
): PinAreaPercent {
  let x1 = Math.min(start.x, end.x)
  let y1 = Math.min(start.y, end.y)
  let w = Math.abs(end.x - start.x)
  let h = Math.abs(end.y - start.y)

  if (w < 0.5 && h < 0.5) {
    const cx = start.x
    const cy = start.y
    x1 = clamp(cx - DEFAULT_SIZE / 2, 0, 100 - DEFAULT_SIZE)
    y1 = clamp(cy - DEFAULT_SIZE / 2, 0, 100 - DEFAULT_SIZE)
    w = DEFAULT_SIZE
    h = DEFAULT_SIZE
  } else {
    if (w < MIN_SIZE) {
      const cx = (start.x + end.x) / 2
      x1 = clamp(cx - MIN_SIZE / 2, 0, 100 - MIN_SIZE)
      w = MIN_SIZE
    }
    if (h < MIN_SIZE) {
      const cy = (start.y + end.y) / 2
      y1 = clamp(cy - MIN_SIZE / 2, 0, 100 - MIN_SIZE)
      h = MIN_SIZE
    }
    x1 = clamp(x1, 0, 100 - w)
    y1 = clamp(y1, 0, 100 - h)
  }

  return {
    xPercent: x1,
    yPercent: y1,
    widthPercent: Math.min(w, 100 - x1),
    heightPercent: Math.min(h, 100 - y1),
  }
}

export function pinAreaCenter(area: PinAreaPercent): { xPercent: number; yPercent: number } {
  return {
    xPercent: area.xPercent + area.widthPercent / 2,
    yPercent: area.yPercent + area.heightPercent / 2,
  }
}

export function formatPinAreaLabel(area: PinAreaPercent): string {
  return `${area.widthPercent.toFixed(0)}% × ${area.heightPercent.toFixed(0)}%`
}

export function iframePreviewScale(iframe: HTMLIFrameElement): { scaleX: number; scaleY: number } {
  const box = iframe.getBoundingClientRect()
  const cw = iframe.clientWidth
  const ch = iframe.clientHeight
  return {
    scaleX: cw > 0 ? box.width / cw : 1,
    scaleY: ch > 0 ? box.height / ch : 1,
  }
}

/** Desplazamiento del contenido dentro del stage (scroll del iframe o del contenedor). */
export function readStageContentScroll(
  stage: HTMLElement,
  iframe?: HTMLIFrameElement | null,
): { x: number; y: number } {
  let x = stage.scrollLeft
  let y = stage.scrollTop
  const frame =
    iframe ?? stage.querySelector<HTMLIFrameElement>('iframe.design-page-frame__iframe')
  if (!frame?.contentWindow) return { x, y }
  const doc = frame.contentDocument
  const scrollEl = doc?.scrollingElement ?? doc?.documentElement
  if (!scrollEl) return { x, y }
  const { scaleX, scaleY } = iframePreviewScale(frame)
  return {
    x: x + scrollEl.scrollLeft * scaleX,
    y: y + scrollEl.scrollTop * scaleY,
  }
}

/** Convierte un área en % del stage de preview a píxeles relativos al contenedor del lienzo. */
export function mapPinAreaPercentToCanvas(
  canvas: HTMLElement,
  stage: HTMLElement,
  area: PinAreaPercent,
  opts?: { iframe?: HTMLIFrameElement | null },
): { top: number; left: number; width: number; height: number } {
  const canvasBox = canvas.getBoundingClientRect()
  const stageBox = stage.getBoundingClientRect()
  const normalized = pinAreaWithDefaults(area)
  const scroll = readStageContentScroll(stage, opts?.iframe)
  return {
    top:
      stageBox.top -
      canvasBox.top +
      (normalized.yPercent / 100) * stageBox.height -
      scroll.y,
    left:
      stageBox.left -
      canvasBox.left +
      (normalized.xPercent / 100) * stageBox.width -
      scroll.x,
    width: (normalized.widthPercent / 100) * stageBox.width,
    height: (normalized.heightPercent / 100) * stageBox.height,
  }
}

export function pinAreaWithDefaults(pin: {
  xPercent: number
  yPercent: number
  widthPercent?: number
  heightPercent?: number
}): PinAreaPercent {
  const w = pin.widthPercent ?? DEFAULT_SIZE
  const h = pin.heightPercent ?? DEFAULT_SIZE
  return {
    xPercent: clamp(pin.xPercent, 0, 100 - w),
    yPercent: clamp(pin.yPercent, 0, 100 - h),
    widthPercent: w,
    heightPercent: h,
  }
}

export type PinResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

export function clampPinArea(area: PinAreaPercent): PinAreaPercent {
  let { xPercent, yPercent, widthPercent, heightPercent } = area
  widthPercent = Math.max(MIN_SIZE, Math.min(widthPercent, 100))
  heightPercent = Math.max(MIN_SIZE, Math.min(heightPercent, 100))
  xPercent = clamp(xPercent, 0, 100 - widthPercent)
  yPercent = clamp(yPercent, 0, 100 - heightPercent)
  return { xPercent, yPercent, widthPercent, heightPercent }
}

export function applyPinAreaMove(
  area: PinAreaPercent,
  deltaXPercent: number,
  deltaYPercent: number,
): PinAreaPercent {
  return clampPinArea({
    ...area,
    xPercent: area.xPercent + deltaXPercent,
    yPercent: area.yPercent + deltaYPercent,
  })
}

export function applyPinAreaResize(
  start: PinAreaPercent,
  handle: PinResizeHandle,
  pointer: { x: number; y: number },
): PinAreaPercent {
  const right = start.xPercent + start.widthPercent
  const bottom = start.yPercent + start.heightPercent
  let x1 = start.xPercent
  let y1 = start.yPercent
  let x2 = right
  let y2 = bottom

  if (handle.includes('w')) x1 = Math.min(pointer.x, right - MIN_SIZE)
  if (handle.includes('e')) x2 = Math.max(pointer.x, x1 + MIN_SIZE)
  if (handle.includes('n')) y1 = Math.min(pointer.y, bottom - MIN_SIZE)
  if (handle.includes('s')) y2 = Math.max(pointer.y, y1 + MIN_SIZE)

  return clampPinArea({
    xPercent: x1,
    yPercent: y1,
    widthPercent: x2 - x1,
    heightPercent: y2 - y1,
  })
}

export const PIN_RESIZE_HANDLES: PinResizeHandle[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
]
