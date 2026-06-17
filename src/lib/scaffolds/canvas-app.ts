import type { ScaffoldFile } from '@/lib/scaffolds/types'
import {
  CANVAS_POINTER_JS,
  CANVAS_RESIZE_JS,
  CANVAS_RESPONSIVE_CSS,
  CANVAS_VIEWPORT_META,
} from '@/lib/scaffolds/canvas-shared'

export function canvasAppScaffold(name: string): ScaffoldFile[] {
  const title = name.replace(/"/g, '\\"')
  return [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${CANVAS_VIEWPORT_META}
  <title>${title}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="app-root" class="canvas-stage">
    <canvas id="drawCanvas"></canvas>
  </div>
  <aside id="toolbar" class="canvas-toolbar canvas-toolbar--side" aria-label="Drawing tools">
    <div class="toolbar-colors" id="colorPalette"></div>
    <label class="toolbar-size">Brush <input type="range" id="brushSize" min="2" max="48" value="8" /></label>
    <button type="button" id="eraserBtn" class="tool-btn" title="Eraser">Eraser</button>
    <button type="button" id="undoBtn" class="tool-btn" title="Undo">Undo</button>
    <button type="button" id="clearBtn" class="tool-btn" title="Clear">Clear</button>
    <button type="button" id="exportBtn" class="tool-btn tool-btn--primary" title="Export PNG">Save PNG</button>
  </aside>
  <script src="app.js"></script>
</body>
</html>`,
      language: 'html',
    },
    {
      path: 'style.css',
      content: `${CANVAS_RESPONSIVE_CSS}
body { flex-direction: row; gap: 0; }
#drawCanvas {
  border: 2px solid #333;
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(167, 139, 250, 0.25);
  background: #fff;
  cursor: crosshair;
}
.canvas-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(20,20,28,0.95);
  border-left: 1px solid #333;
  flex-shrink: 0;
  width: clamp(72px, 22vw, 200px);
  z-index: 10;
  overflow-y: auto;
}
.canvas-toolbar--side { min-height: 0; }
.toolbar-colors { display: flex; flex-wrap: wrap; gap: 8px; }
.swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
}
.swatch.active { border-color: #fff; box-shadow: 0 0 0 2px #a78bfa; }
.tool-btn {
  padding: 10px 12px;
  background: #2c2c38;
  color: #fff;
  border: 1px solid #444;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  min-height: 44px;
}
.tool-btn.active { background: #4f46e5; border-color: #6366f1; }
.tool-btn--primary { background: #7c3aed; border-color: #8b5cf6; }
.toolbar-size { font-size: 12px; color: #b5b5be; display: flex; flex-direction: column; gap: 6px; }
.toolbar-size input { width: 100%; }
@media (max-width: 768px) {
  body { flex-direction: column; }
  .canvas-toolbar--side {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
    border-left: none;
    border-top: 1px solid #333;
    order: 2;
  }
  .canvas-stage { order: 1; flex: 1; min-height: 50dvh; }
}`,
      language: 'css',
    },
    {
      path: 'app.js',
      content: `// Canvas Draw App
const canvas = document.getElementById('drawCanvas')
const ctx = canvas.getContext('2d')
${CANVAS_RESIZE_JS}
${CANVAS_POINTER_JS}

const COLORS = ['#0c0c0e','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a78bfa','#ec4899','#ffffff']
let color = COLORS[0]
let brushSize = 8
let eraser = false
let drawing = false
let last = null
const undoStack = []
const MAX_UNDO = 20

function resize() {
  const prev = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const had = canvas.width > 0
  resizeCanvasToContainer(canvas, { maxScale: 0.95, square: false, heightRatio: 0.75 })
  if (had && prev.width && prev.height) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))
    ctx.putImageData(prev, 0, 0)
  } else {
    ctx.fillStyle = '#fff'
    const w = canvas.width / (window.devicePixelRatio || 1)
    const h = canvas.height / (window.devicePixelRatio || 1)
    ctx.fillRect(0, 0, w, h)
  }
}
resize()
window.addEventListener('resize', resize)

function pushUndo() {
  const dpr = window.devicePixelRatio || 1
  const w = Math.round(canvas.width / dpr)
  const h = Math.round(canvas.height / dpr)
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
  if (undoStack.length > MAX_UNDO) undoStack.shift()
}

function drawLine(from, to) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = brushSize
  ctx.strokeStyle = eraser ? '#ffffff' : color
  ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
}

bindPointerCanvas(canvas,
  pt => {
    if (!drawing) return
    if (last) drawLine(last, pt)
    last = pt
  },
  pt => {
    pushUndo()
    drawing = true
    last = pt
    drawLine(pt, pt)
  },
  () => { drawing = false; last = null }
)

const palette = document.getElementById('colorPalette')
COLORS.forEach((c, i) => {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'swatch' + (i === 0 ? ' active' : '')
  btn.style.background = c
  btn.addEventListener('click', () => {
    color = c
    eraser = false
    document.getElementById('eraserBtn').classList.remove('active')
    palette.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'))
    btn.classList.add('active')
  })
  palette.appendChild(btn)
})

document.getElementById('brushSize').addEventListener('input', e => {
  brushSize = Number(e.target.value)
})
document.getElementById('eraserBtn').addEventListener('click', function() {
  eraser = !eraser
  this.classList.toggle('active', eraser)
})
document.getElementById('undoBtn').addEventListener('click', () => {
  const img = undoStack.pop()
  if (img) ctx.putImageData(img, 0, 0)
})
document.getElementById('clearBtn').addEventListener('click', () => {
  pushUndo()
  const dpr = window.devicePixelRatio || 1
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
})
document.getElementById('exportBtn').addEventListener('click', () => {
  const a = document.createElement('a')
  a.download = 'drawing.png'
  a.href = canvas.toDataURL('image/png')
  a.click()
})`,
      language: 'javascript',
    },
  ]
}
