/**
 * Snippets embebidos en scaffolds canvas (generados como strings en HTML/CSS/JS).
 * No se importan en runtime del proyecto generado.
 */

export const CANVAS_VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />'

/** CSS base responsive para proyectos canvas */
export const CANVAS_RESPONSIVE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background: #0a0a0f;
  color: #fff;
}
#app-root, .canvas-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  position: relative;
}
canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  touch-action: none;
}
.canvas-hud {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: clamp(12px, 4vw, 24px);
  font-size: clamp(14px, 3.5vw, 18px);
  font-weight: 600;
  pointer-events: none;
  z-index: 10;
}
.canvas-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.75);
  gap: 16px;
  backdrop-filter: blur(4px);
  z-index: 20;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.canvas-overlay h1 { font-size: clamp(28px, 8vw, 48px); color: #818cf8; }
.canvas-overlay p { font-size: clamp(16px, 4vw, 20px); opacity: 0.8; }
.canvas-btn {
  padding: 12px 32px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: clamp(16px, 4vw, 18px);
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
}
.canvas-btn:hover { background: #6366f1; }
.hidden { display: none !important; }
@media (max-width: 768px) {
  .canvas-toolbar--side { flex-direction: row; width: 100%; height: auto; }
}
`

export const ORIENTATION_HINT_CSS = `
.orientation-hint {
  display: none;
  position: fixed;
  inset: 0;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.9);
  z-index: 100;
  padding: 24px;
  text-align: center;
  font-size: 18px;
}
@media (max-width: 768px) and (orientation: landscape) {
  .orientation-hint--game { display: flex; }
}
`

/** Utilidades JS para resize con devicePixelRatio */
export const CANVAS_RESIZE_JS = `
function resizeCanvasToContainer(canvas, opts) {
  opts = opts || {}
  const maxScale = opts.maxScale != null ? opts.maxScale : 0.92
  const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const size = Math.min(vw, vh) * maxScale
  const cssW = Math.round(size)
  const cssH = Math.round(opts.square !== false ? size : (opts.heightRatio || 1) * size)
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { cssW, cssH, dpr }
}
`

/** Pointer unificado mouse + touch */
export const CANVAS_POINTER_JS = `
function bindPointerCanvas(canvas, onMove, onDown, onUp) {
  function pt(e) {
    const r = canvas.getBoundingClientRect()
    const x = (e.clientX != null ? e.clientX : e.touches[0].clientX) - r.left
    const y = (e.clientY != null ? e.clientY : e.touches[0].clientY) - r.top
    return { x, y }
  }
  canvas.addEventListener('mousemove', e => onMove && onMove(pt(e)))
  canvas.addEventListener('mousedown', e => { e.preventDefault(); onDown && onDown(pt(e)) })
  canvas.addEventListener('mouseup', e => onUp && onUp(pt(e)))
  canvas.addEventListener('touchmove', e => { e.preventDefault(); onMove && onMove(pt(e)) }, { passive: false })
  canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown && onDown(pt(e)) }, { passive: false })
  canvas.addEventListener('touchend', e => { onUp && onUp(pt(e)) })
}
`

/** Joystick virtual para móvil (juegos) */
export const VIRTUAL_JOYSTICK_HTML = `
<div id="joystick" class="virtual-joystick" aria-hidden="true">
  <div id="joystickKnob" class="virtual-joystick__knob"></div>
</div>`

export const VIRTUAL_JOYSTICK_CSS = `
.virtual-joystick {
  display: none;
  position: fixed;
  left: max(16px, env(safe-area-inset-left));
  bottom: max(24px, env(safe-area-inset-bottom));
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(129,140,248,0.4);
  z-index: 15;
  touch-action: none;
}
.virtual-joystick__knob {
  position: absolute;
  width: 40px;
  height: 40px;
  left: 50%;
  top: 50%;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  background: rgba(129,140,248,0.6);
}
@media (max-width: 768px) {
  .virtual-joystick { display: block; }
}
`

export const VIRTUAL_JOYSTICK_JS = `
(function initJoystick() {
  const pad = document.getElementById('joystick')
  const knob = document.getElementById('joystickKnob')
  if (!pad || !knob) return
  window.joystick = { dx: 0, dy: 0 }
  const maxR = 30
  function moveKnob(cx, cy) {
    const r = pad.getBoundingClientRect()
    const cx0 = r.left + r.width / 2
    const cy0 = r.top + r.height / 2
    let dx = cx - cx0
    let dy = cy - cy0
    const len = Math.hypot(dx, dy) || 1
    if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'
    window.joystick.dx = dx / maxR
    window.joystick.dy = dy / maxR
  }
  function reset() {
    knob.style.transform = 'translate(0,0)'
    window.joystick.dx = 0
    window.joystick.dy = 0
  }
  pad.addEventListener('touchstart', e => { e.preventDefault(); moveKnob(e.touches[0].clientX, e.touches[0].clientY) }, { passive: false })
  pad.addEventListener('touchmove', e => { e.preventDefault(); moveKnob(e.touches[0].clientX, e.touches[0].clientY) }, { passive: false })
  pad.addEventListener('touchend', reset)
})()
`
