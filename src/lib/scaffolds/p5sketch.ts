import type { ScaffoldFile } from '@/lib/scaffolds/types'
import { CANVAS_RESPONSIVE_CSS, CANVAS_VIEWPORT_META } from '@/lib/scaffolds/canvas-shared'

export function p5SketchScaffold(name: string): ScaffoldFile[] {
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
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js"></script>
</head>
<body>
  <div id="p5-toolbar" class="p5-toolbar">
    <button type="button" id="pauseBtn" class="tool-btn">Pause</button>
    <button type="button" id="saveFrameBtn" class="tool-btn">Save frame</button>
  </div>
  <main id="p5-root" class="canvas-stage"></main>
  <script src="sketch.js"></script>
</body>
</html>`,
      language: 'html',
    },
    {
      path: 'style.css',
      content: `${CANVAS_RESPONSIVE_CSS}
.p5-toolbar {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  display: flex;
  gap: 8px;
  z-index: 10;
}
.tool-btn {
  padding: 8px 14px;
  background: rgba(30,30,40,0.9);
  color: #fff;
  border: 1px solid #444;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  min-height: 44px;
}
#p5-root { width: 100%; height: 100%; }
#p5-root canvas { display: block; }`,
      language: 'css',
    },
    {
      path: 'sketch.js',
      content: `// p5.js Sketch — edit and see live preview!
// Docs: https://p5js.org/reference/

let particles = []
const NUM = 120
let paused = false

class Particle {
  constructor() { this.reset() }

  reset() {
    this.x = random(width)
    this.y = random(height)
    this.vx = random(-1.2, 1.2)
    this.vy = random(-1.2, 1.2)
    this.r = random(3, 8)
    this.hue = random(200, 280)
    this.life = 1
    this.decay = random(0.003, 0.008)
  }

  update() {
    this.x += this.vx
    this.y += this.vy
    this.life -= this.decay
    if (this.x < -20) this.x = width + 20
    if (this.x > width + 20) this.x = -20
    if (this.y < -20) this.y = height + 20
    if (this.y > height + 20) this.y = -20
  }

  draw() {
    const mx = mouseX
    const my = mouseY
    const d = dist(this.x, this.y, mx, my)
    const glow = map(d, 0, 200, 1.6, 0.6, true)
    colorMode(HSB, 360, 100, 100, 1)
    noStroke()
    fill(this.hue, 80, 95, this.life * glow * 0.85)
    circle(this.x, this.y, this.r * 2 * glow)
    colorMode(RGB)
    if (this.life <= 0) this.reset()
  }
}

function drawConnections() {
  const MAX_DIST = 100
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const d = dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y)
      if (d < MAX_DIST) {
        const alpha = map(d, 0, MAX_DIST, 120, 0)
        stroke(180, 150, 255, alpha)
        strokeWeight(0.6)
        line(particles[i].x, particles[i].y, particles[j].x, particles[j].y)
        noStroke()
      }
    }
  }
}

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight)
  cnv.parent('p5-root')
  for (let i = 0; i < NUM; i++) particles.push(new Particle())

  document.getElementById('pauseBtn').addEventListener('click', () => {
    paused = !paused
    document.getElementById('pauseBtn').textContent = paused ? 'Play' : 'Pause'
    if (paused) noLoop()
    else loop()
  })
  document.getElementById('saveFrameBtn').addEventListener('click', () => {
    saveCanvas(cnv.elt, 'png', 'sketch-frame')
  })
}

function draw() {
  if (paused) return
  background(15, 15, 25, 30)
  drawConnections()
  particles.forEach(p => { p.update(); p.draw() })

  particles.forEach(p => {
    const d = dist(p.x, p.y, mouseX, mouseY)
    if (d < 120) {
      p.vx += (mouseX - p.x) * 0.0015
      p.vy += (mouseY - p.y) * 0.0015
      p.vx = constrain(p.vx, -3, 3)
      p.vy = constrain(p.vy, -3, 3)
    }
  })
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

function mousePressed() {
  burstAt(mouseX, mouseY)
}

function touchStarted() {
  if (touches.length > 0) burstAt(touches[0].x, touches[0].y)
  return false
}

function burstAt(x, y) {
  for (let i = 0; i < 20; i++) {
    const p = new Particle()
    p.x = x
    p.y = y
    p.hue = random(0, 60)
    p.life = 1
    particles.push(p)
  }
  if (particles.length > NUM * 2) particles.splice(0, 20)
}`,
      language: 'javascript',
    },
  ]
}
