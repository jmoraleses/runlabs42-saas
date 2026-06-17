import type { ScaffoldFile } from '@/lib/scaffolds/types'
import {
  CANVAS_RESIZE_JS,
  CANVAS_RESPONSIVE_CSS,
  CANVAS_VIEWPORT_META,
  ORIENTATION_HINT_CSS,
  VIRTUAL_JOYSTICK_CSS,
  VIRTUAL_JOYSTICK_HTML,
  VIRTUAL_JOYSTICK_JS,
} from '@/lib/scaffolds/canvas-shared'

export function canvasGameScaffold(name: string): ScaffoldFile[] {
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
  <div class="canvas-stage">
    <canvas id="gameCanvas"></canvas>
  </div>
  <div id="ui" class="canvas-hud">
    <div id="score">Score: <span id="scoreValue">0</span></div>
    <div id="lives">Lives: <span id="livesValue">3</span></div>
  </div>
  ${VIRTUAL_JOYSTICK_HTML}
  <div id="overlay" class="canvas-overlay hidden">
    <h1 id="overlayTitle">Game Over</h1>
    <p id="overlayMsg"></p>
    <button id="restartBtn" class="canvas-btn">Restart</button>
  </div>
  <div class="orientation-hint orientation-hint--game">Rotate to portrait for best experience</div>
  <script src="game.js"></script>
</body>
</html>`,
      language: 'html',
    },
    {
      path: 'style.css',
      content: `${CANVAS_RESPONSIVE_CSS}
${ORIENTATION_HINT_CSS}
${VIRTUAL_JOYSTICK_CSS}
#gameCanvas {
  border: 2px solid #333;
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(99, 102, 241, 0.3);
}`,
      language: 'css',
    },
    {
      path: 'game.js',
      content: `// ─── Canvas Game Engine ──────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
${CANVAS_RESIZE_JS}
${VIRTUAL_JOYSTICK_JS}

let gameW = 0
let gameH = 0
function resize() {
  const r = resizeCanvasToContainer(canvas, { maxScale: 0.88, square: true })
  gameW = r.cssW
  gameH = r.cssH
}
resize()
window.addEventListener('resize', resize)

// ─── Game state ───────────────────────────────────────────────────────────────
const W = () => gameW
const H = () => gameH
let score = 0, lives = 3, running = false, animId = null

const player = { x: 0, y: 0, r: 18, speed: 5, color: '#818cf8', trail: [] }
const enemies = []
const bullets = []
const particles = []

const keys = {}
document.addEventListener('keydown', e => { keys[e.key] = true })
document.addEventListener('keyup',   e => { keys[e.key] = false })

// Touch / mouse aiming
let aimX = null, aimY = null
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect()
  aimX = e.clientX - r.left; aimY = e.clientY - r.top
})
canvas.addEventListener('click', shoot)
canvas.addEventListener('touchend', e => {
  const t = e.changedTouches[0], r = canvas.getBoundingClientRect()
  aimX = t.clientX - r.left; aimY = t.clientY - r.top
  shoot()
})

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  score = 0; lives = 3
  enemies.length = 0; bullets.length = 0; particles.length = 0
  player.x = W() / 2; player.y = H() * 0.8
  player.trail = []
  document.getElementById('scoreValue').textContent = score
  document.getElementById('livesValue').textContent = lives
  document.getElementById('overlay').classList.add('hidden')
  if (animId) cancelAnimationFrame(animId)
  running = true
  spawnLoop()
  loop()
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
let spawnTimer = null
function spawnLoop() {
  if (!running) return
  const interval = Math.max(600, 2000 - score * 15)
  spawnTimer = setTimeout(() => {
    spawnEnemy()
    spawnLoop()
  }, interval)
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4)
  let x, y
  if (side === 0) { x = Math.random() * W(); y = -20 }
  else if (side === 1) { x = W() + 20; y = Math.random() * H() }
  else if (side === 2) { x = Math.random() * W(); y = H() + 20 }
  else { x = -20; y = Math.random() * H() }
  enemies.push({ x, y, r: 14, color: \`hsl(\${Math.random()*40+0},80%,55%)\`, hp: 1 })
}

// ─── Shoot ────────────────────────────────────────────────────────────────────
let lastShot = 0
function shoot() {
  if (!running || Date.now() - lastShot < 180) return
  lastShot = Date.now()
  const tx = aimX ?? W() / 2, ty = aimY ?? 0
  const dx = tx - player.x, dy = ty - player.y
  const len = Math.hypot(dx, dy) || 1
  bullets.push({ x: player.x, y: player.y, vx: (dx / len) * 12, vy: (dy / len) * 12, r: 5 })
}

// ─── Particles ────────────────────────────────────────────────────────────────
function explode(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2
    const s = 2 + Math.random() * 4
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r: 4+Math.random()*3, color, life: 1 })
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function loop() {
  if (!running) return
  animId = requestAnimationFrame(loop)
  update()
  draw()
}

function update() {
  const w = W(), h = H()
  // Player movement
  const spd = player.speed
  const jx = (window.joystick && window.joystick.dx) || 0
  const jy = (window.joystick && window.joystick.dy) || 0
  if (keys['ArrowLeft']  || keys['a'] || jx < -0.2) player.x -= spd
  if (keys['ArrowRight'] || keys['d'] || jx > 0.2) player.x += spd
  if (keys['ArrowUp']    || keys['w'] || jy < -0.2) player.y -= spd
  if (keys['ArrowDown']  || keys['s'] || jy > 0.2) player.y += spd
  if (keys[' ']) shoot()
  player.x = Math.max(player.r, Math.min(w - player.r, player.x))
  player.y = Math.max(player.r, Math.min(h - player.r, player.y))

  player.trail.unshift({ x: player.x, y: player.y })
  if (player.trail.length > 12) player.trail.pop()

  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    b.x += b.vx; b.y += b.vy
    if (b.x < 0 || b.x > w || b.y < 0 || b.y > h) { bullets.splice(i, 1); continue }
    // Hit enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j]
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
        explode(e.x, e.y, e.color)
        enemies.splice(j, 1); bullets.splice(i, 1)
        score++; document.getElementById('scoreValue').textContent = score
        break
      }
    }
  }

  // Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]
    const dx = player.x - e.x, dy = player.y - e.y
    const len = Math.hypot(dx, dy) || 1
    const spd2 = 1.5 + score * 0.01
    e.x += (dx / len) * spd2; e.y += (dy / len) * spd2
    if (Math.hypot(dx, dy) < player.r + e.r) {
      explode(e.x, e.y, '#ef4444')
      enemies.splice(i, 1)
      lives--; document.getElementById('livesValue').textContent = lives
      if (lives <= 0) gameOver()
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx; p.y += p.vy; p.life -= 0.045; p.r *= 0.96
    if (p.life <= 0) particles.splice(i, 1)
  }
}

function draw() {
  const w = W(), h = H()
  // Background
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, w, h)

  // Grid
  ctx.strokeStyle = 'rgba(99,102,241,0.07)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }

  // Player trail
  player.trail.forEach((pt, i) => {
    const a = (1 - i / player.trail.length) * 0.25
    ctx.beginPath(); ctx.arc(pt.x, pt.y, player.r * (1 - i / player.trail.length * 0.6), 0, Math.PI*2)
    ctx.fillStyle = \`rgba(129,140,248,\${a})\`; ctx.fill()
  })

  // Player
  ctx.save()
  const grd = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.r)
  grd.addColorStop(0, '#c7d2fe'); grd.addColorStop(1, '#4f46e5')
  ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI*2)
  ctx.fillStyle = grd; ctx.fill()
  ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()

  // Bullets
  enemies.forEach(e => {
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2)
    ctx.fillStyle = e.color; ctx.fill()
  })

  bullets.forEach(b => {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2)
    ctx.fillStyle = '#fbbf24'
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 8
    ctx.fill(); ctx.shadowBlur = 0
  })

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
    ctx.fillStyle = p.color; ctx.fill()
  })
  ctx.globalAlpha = 1
}

function gameOver() {
  running = false; clearTimeout(spawnTimer)
  const ov = document.getElementById('overlay')
  document.getElementById('overlayTitle').textContent = 'Game Over'
  document.getElementById('overlayMsg').textContent = \`Final score: \${score}\`
  ov.classList.remove('hidden')
}

document.getElementById('restartBtn').addEventListener('click', init)

// Start
window.addEventListener('load', init)`,
      language: 'javascript',
    },
  ]
}
