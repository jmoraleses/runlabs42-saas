import type { ScaffoldFile } from '@/lib/scaffolds/types'

export function vanillaScaffold(name: string): ScaffoldFile[] {
  const title = name.replace(/"/g, '\\"')
  return [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="site-header">
    <nav class="nav">
      <span class="nav__logo">${title}</span>
      <ul class="nav__links">
        <li><a href="#features">Features</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero__content">
        <span class="hero__tag">✨ New release</span>
        <h1 class="hero__title">Build something <em>amazing</em></h1>
        <p class="hero__desc">A clean starting point for your next vanilla web project. Edit me in the studio!</p>
        <div class="hero__actions">
          <button class="btn btn--primary" id="ctaBtn">Get started</button>
          <button class="btn btn--ghost">Learn more</button>
        </div>
      </div>
    </section>

    <section class="features" id="features">
      <h2 class="section-title">Features</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Fast</h3>
          <p>Zero build step. Pure HTML, CSS and JavaScript.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎨</div>
          <h3>Styled</h3>
          <p>Modern CSS with custom properties and responsive layout.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📱</div>
          <h3>Responsive</h3>
          <p>Mobile-first design that looks great on any device.</p>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <p>Built with ❤️ using Runlabs42</p>
  </footer>

  <script src="main.js"></script>
</body>
</html>`,
      language: 'html',
    },
    {
      path: 'style.css',
      content: `/* ── Variables ─────────────────────────────────────────── */
:root {
  --color-bg: #0f0f13;
  --color-surface: #1a1a24;
  --color-border: rgba(255,255,255,0.08);
  --color-text: #e2e8f0;
  --color-muted: #94a3b8;
  --color-accent: #6366f1;
  --color-accent-glow: rgba(99,102,241,0.25);
  --radius: 12px;
  --font: 'Segoe UI', system-ui, sans-serif;
}

/* ── Reset ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: var(--font); background: var(--color-bg); color: var(--color-text); line-height: 1.6; }
a { color: var(--color-accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Nav ───────────────────────────────────────────────── */
.site-header { position: sticky; top: 0; z-index: 100; background: rgba(15,15,19,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--color-border); }
.nav { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 60px; }
.nav__logo { font-weight: 700; font-size: 18px; color: var(--color-text); }
.nav__links { list-style: none; display: flex; gap: 28px; }
.nav__links a { color: var(--color-muted); font-size: 14px; transition: color 0.2s; }
.nav__links a:hover { color: var(--color-text); }

/* ── Hero ──────────────────────────────────────────────── */
.hero { min-height: 88vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 80px 24px; background: radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%); }
.hero__content { max-width: 640px; }
.hero__tag { display: inline-block; padding: 4px 14px; border-radius: 999px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); font-size: 13px; color: #a5b4fc; margin-bottom: 24px; }
.hero__title { font-size: clamp(36px, 6vw, 64px); font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 20px; }
.hero__title em { font-style: normal; background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero__desc { font-size: 18px; color: var(--color-muted); margin-bottom: 36px; max-width: 500px; margin-inline: auto; }
.hero__actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

/* ── Buttons ───────────────────────────────────────────── */
.btn { padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
.btn--primary { background: var(--color-accent); color: #fff; box-shadow: 0 0 24px var(--color-accent-glow); }
.btn--primary:hover { background: #4f46e5; box-shadow: 0 0 36px var(--color-accent-glow); transform: translateY(-1px); }
.btn--ghost { background: transparent; color: var(--color-muted); border: 1px solid var(--color-border); }
.btn--ghost:hover { border-color: var(--color-accent); color: var(--color-text); }

/* ── Features ──────────────────────────────────────────── */
.features { max-width: 1100px; margin: 0 auto; padding: 80px 24px; }
.section-title { text-align: center; font-size: 32px; font-weight: 700; margin-bottom: 48px; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
.feature-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 28px; transition: border-color 0.2s, transform 0.2s; }
.feature-card:hover { border-color: rgba(99,102,241,0.4); transform: translateY(-3px); }
.feature-icon { font-size: 32px; margin-bottom: 14px; }
.feature-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
.feature-card p { color: var(--color-muted); font-size: 14px; }

/* ── Footer ────────────────────────────────────────────── */
.footer { text-align: center; padding: 32px; color: var(--color-muted); font-size: 13px; border-top: 1px solid var(--color-border); }`,
      language: 'css',
    },
    {
      path: 'main.js',
      content: `// main.js — Vanilla JS entry point

// ── Smooth scroll CTA ────────────────────────────────────────────────────────
document.getElementById('ctaBtn')?.addEventListener('click', () => {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
})

// ── Fade-in on scroll ────────────────────────────────────────────────────────
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1'
        entry.target.style.transform = 'translateY(0)'
        observer.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.1 },
)

document.querySelectorAll('.feature-card').forEach((el, i) => {
  el.style.opacity = '0'
  el.style.transform = 'translateY(20px)'
  el.style.transition = \`opacity 0.5s \${i * 0.1}s, transform 0.5s \${i * 0.1}s\`
  observer.observe(el)
})

console.log('🚀 ${title} — running on Runlabs42 Studio')`,
      language: 'javascript',
    },
  ]
}
