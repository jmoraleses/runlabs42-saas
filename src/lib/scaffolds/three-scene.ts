import type { ScaffoldFile } from '@/lib/scaffolds/types'
import { CANVAS_RESPONSIVE_CSS, CANVAS_VIEWPORT_META } from '@/lib/scaffolds/canvas-shared'

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js'

export function threeSceneScaffold(name: string): ScaffoldFile[] {
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
  <div id="canvas-container" class="canvas-stage"></div>
  <p class="scene-hint">Drag to orbit · Pinch on mobile</p>
  <script src="${THREE_CDN}"></script>
  <script src="main.js"></script>
</body>
</html>`,
      language: 'html',
    },
    {
      path: 'style.css',
      content: `${CANVAS_RESPONSIVE_CSS}
#canvas-container {
  width: 100%;
  height: 100%;
  min-height: 60dvh;
}
#canvas-container canvas {
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(34, 211, 238, 0.25);
}
.scene-hint {
  position: fixed;
  bottom: max(12px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(12px, 3vw, 14px);
  color: rgba(255,255,255,0.5);
  pointer-events: none;
  z-index: 5;
}`,
      language: 'css',
    },
    {
      path: 'main.js',
      content: `// Three.js scene
const container = document.getElementById('canvas-container')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a0f)

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
camera.position.z = 4

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
container.appendChild(renderer.domElement)

const light = new THREE.DirectionalLight(0xffffff, 1)
light.position.set(2, 3, 4)
scene.add(light)
scene.add(new THREE.AmbientLight(0x404060, 0.6))

const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({
  color: 0x22d3ee,
  metalness: 0.3,
  roughness: 0.4,
})
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

const torus = new THREE.Mesh(
  new THREE.TorusGeometry(0.6, 0.2, 16, 48),
  new THREE.MeshStandardMaterial({ color: 0xa78bfa })
)
torus.position.x = 1.8
scene.add(torus)

function resize() {
  const w = container.clientWidth
  const h = container.clientHeight || Math.min(window.innerHeight * 0.7, 600)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
resize()
window.addEventListener('resize', resize)
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resize).observe(container)
}

// Simple orbit controls (mouse + touch)
let dragging = false
let prevX = 0
let prevY = 0
let rotY = 0
let rotX = 0

function onPointerDown(x, y) {
  dragging = true
  prevX = x
  prevY = y
}
function onPointerMove(x, y) {
  if (!dragging) return
  rotY += (x - prevX) * 0.01
  rotX += (y - prevY) * 0.01
  rotX = Math.max(-1.2, Math.min(1.2, rotX))
  prevX = x
  prevY = y
}
function onPointerUp() { dragging = false }

const el = renderer.domElement
el.addEventListener('mousedown', e => onPointerDown(e.clientX, e.clientY))
el.addEventListener('mousemove', e => onPointerMove(e.clientX, e.clientY))
el.addEventListener('mouseup', onPointerUp)
el.addEventListener('touchstart', e => {
  e.preventDefault()
  onPointerDown(e.touches[0].clientX, e.touches[0].clientY)
}, { passive: false })
el.addEventListener('touchmove', e => {
  e.preventDefault()
  onPointerMove(e.touches[0].clientX, e.touches[0].clientY)
}, { passive: false })
el.addEventListener('touchend', onPointerUp)

// Auto-rotate on narrow screens when idle
let idle = 0
function isMobile() { return window.innerWidth < 768 }

function animate() {
  requestAnimationFrame(animate)
  idle++
  if (isMobile() && !dragging && idle > 120) {
    rotY += 0.008
  }
  cube.rotation.x = rotX
  cube.rotation.y = rotY
  torus.rotation.x = rotX * 0.5
  torus.rotation.y = rotY * 1.2
  renderer.render(scene, camera)
}
animate()
el.addEventListener('pointerdown', () => { idle = 0 })`,
      language: 'javascript',
    },
  ]
}
