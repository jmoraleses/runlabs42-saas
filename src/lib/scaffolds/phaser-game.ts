import type { ScaffoldFile } from '@/lib/scaffolds/types'
import { CANVAS_RESPONSIVE_CSS, CANVAS_VIEWPORT_META } from '@/lib/scaffolds/canvas-shared'

const PHASER_CDN = 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'

export function phaserGameScaffold(name: string): ScaffoldFile[] {
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
  <div id="game-container"></div>
  <div class="canvas-hud">
    <span>Score: <span id="scoreValue">0</span></span>
  </div>
  <script src="${PHASER_CDN}"></script>
  <script src="game.js"></script>
</body>
</html>`,
      language: 'html',
    },
    {
      path: 'style.css',
      content: `${CANVAS_RESPONSIVE_CSS}
#game-container {
  width: 100%;
  max-width: min(100vw, 800px);
  aspect-ratio: 4 / 3;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
#game-container canvas {
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(59, 130, 246, 0.3);
}`,
      language: 'css',
    },
    {
      path: 'game.js',
      content: `// Phaser 3 — arcade demo
let score = 0

class MainScene extends Phaser.Scene {
  constructor() { super('Main') }

  create() {
    const { width, height } = this.scale
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0f)
    this.player = this.add.circle(width / 2, height * 0.75, 18, 0x818cf8)
    this.physics.add.existing(this.player)
    this.player.body.setCollideWorldBounds(true)

    this.obstacles = this.physics.add.group()
    this.time.addEvent({ delay: 1200, callback: this.spawnObstacle, callbackScope: this, loop: true })

    this.cursors = this.input.keyboard.createCursorKeys()
    this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver(), null, this)

    if (this.input.touch) {
      this.input.on('pointermove', p => {
        this.player.x = Phaser.Math.Clamp(p.x, 18, width - 18)
      })
    }

    this.scoreText = document.getElementById('scoreValue')
  }

  spawnObstacle() {
    const { width } = this.scale
    const x = Phaser.Math.Between(30, width - 30)
    const o = this.add.rectangle(x, -20, 28, 28, 0xf97316)
    this.physics.add.existing(o)
    o.body.setVelocityY(180 + score * 2)
    this.obstacles.add(o)
    score++
    if (this.scoreText) this.scoreText.textContent = String(score)
  }

  update() {
    const spd = 220
    if (this.cursors.left.isDown) this.player.x -= spd * (this.game.loop.delta / 1000)
    if (this.cursors.right.isDown) this.player.x += spd * (this.game.loop.delta / 1000)
    this.obstacles.children.each(o => {
      if (o.y > this.scale.height + 40) o.destroy()
    })
  }

  gameOver() {
    this.physics.pause()
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Game Over\\nTap to restart', {
      fontSize: '24px',
      color: '#fff',
      align: 'center',
    }).setOrigin(0.5)
    this.input.once('pointerdown', () => {
      score = 0
      this.scene.restart()
    })
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: Math.min(800, window.innerWidth),
  height: Math.min(600, Math.floor(window.innerWidth * 0.75)),
  backgroundColor: '#0a0a0f',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: MainScene,
}

const game = new Phaser.Game(config)
window.addEventListener('resize', () => {
  if (game && game.scale) game.scale.refresh()
})`,
      language: 'javascript',
    },
  ]
}
