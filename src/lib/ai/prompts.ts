import type { AICommand } from '@/types'

const SYSTEM = `You are Runlabs42, an AI assistant for building production-ready web apps from the browser.`

const TEMPLATES: Record<AICommand['command'], string> = {
  '/plan': `Create a structured implementation plan with milestones and risks.\n\nUser request:\n`,
  '/spec': `Write a technical specification with acceptance criteria.\n\nUser request:\n`,
  '/build': `Generate implementation steps and file-level changes.\n\nUser request:\n`,
  '/review': `Review the code for bugs, security, and performance. Return findings as a diff summary.\n\nUser request:\n`,
  '/css': `Suggest CSS/Tailwind improvements for layout, spacing, and responsiveness.\n\nUser request:\n`,
  '/mobile-fix': `Fix mobile store readiness issues (viewport, manifest, touch targets). Do not add privacy/terms pages unless the user explicitly asks.\n\nUser request:\n`,
}

export function buildPrompt(command: AICommand, context?: string) {
  const header = TEMPLATES[command.command]
  const parts = [SYSTEM, '', header + command.prompt]
  if (context) parts.push('', 'Context:', context)
  return parts.join('\n')
}

const MOCK_BY_COMMAND: Record<AICommand['command'], (cmd: AICommand) => string[]> = {
  '/plan': (cmd) => [
    '## Plan de implementación (demo)',
    '',
    '**Fases:**',
    '1. Modelado de datos y API',
    '2. UI del editor y dashboard',
    '3. Integración marketplace y créditos',
    '',
    `**Solicitud:** ${cmd.prompt || '(vacía)'}`,
    '',
    '> Modo demo — configura GEMINI_API_KEY en .env.local para IA real.',
  ],
  '/spec': (cmd) => [
    '## Especificación técnica (demo)',
    '',
    '### Criterios de aceptación',
    '- [ ] Autenticación OAuth funcional',
    '- [ ] Persistencia de archivos por proyecto',
    '- [ ] Deducción de créditos en stream mock',
    '',
    `**Contexto:** ${cmd.prompt || '(vacío)'}`,
  ],
  '/build': (cmd) => {
    const ask = (cmd.prompt || '').replace(/`/g, '').slice(0, 200)
    const wantsForm = /\b(formulario|form)\b/i.test(ask)
    const wantsLanding = /\b(landing|saas|hero|features|precios|pricing|cta)\b/i.test(ask)
    const appBody = wantsForm
      ? `export default function App() {
  return (
    <main className="app-shell">
      <form className="app-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          Nombre
          <input name="name" type="text" required autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <button type="submit">Enviar</button>
      </form>
    </main>
  )
}`
      : wantsLanding
        ? `export default function App() {
  return (
    <main className="landing">
      <header className="hero">
        <p className="hero-kicker">SaaS demo</p>
        <h1>Lanza tu producto más rápido</h1>
        <p className="hero-lead">Hero, features, precios y CTA listos para iterar con IA real.</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary">Empezar gratis</button>
          <button type="button" className="btn btn-ghost">Ver demo</button>
        </div>
      </header>
      <section className="features">
        <h2>Features</h2>
        <ul className="feature-grid">
          <li><strong>Editor visual</strong><span>Vista previa en vivo</span></li>
          <li><strong>IA integrada</strong><span>Genera y corrige código</span></li>
          <li><strong>Deploy</strong><span>Publica en un clic</span></li>
        </ul>
      </section>
      <section className="pricing">
        <h2>Precios</h2>
        <div className="price-card">
          <h3>Pro</h3>
          <p className="price">29€/mes</p>
          <button type="button" className="btn btn-primary">Elegir plan</button>
        </div>
      </section>
    </main>
  )
}`
        : `export default function App() {
  return <main className="app-shell" />
}`
    const cssBody = `:root {
  font-family: system-ui, sans-serif;
  color: #0f172a;
  background: #f8fafc;
}
body { margin: 0; }
.landing { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
.hero { text-align: center; padding: 48px 16px; }
.hero-kicker { text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #64748b; }
.hero h1 { font-size: clamp(2rem, 5vw, 3rem); margin: 12px 0; }
.hero-lead { color: #475569; max-width: 520px; margin: 0 auto 24px; }
.hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.btn { border: 0; border-radius: 10px; padding: 12px 20px; font-weight: 600; cursor: pointer; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-ghost { background: #e2e8f0; color: #0f172a; }
.features, .pricing { margin-top: 48px; }
.feature-grid { list-style: none; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.feature-grid li { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.price-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 280px; }
.price { font-size: 1.75rem; font-weight: 700; }`
    return [
      '## Cambios aplicados (modo demo)',
      '',
      '```tsx src/App.tsx',
      "import './styles/app.css'",
      '',
      appBody,
      '```',
      '',
      '```css src/styles/app.css',
      cssBody,
      '```',
      '',
      '> Modo demo — configura GEMINI_API_KEY en .env.local para IA real.',
      ask ? `\n**Prompt:** ${ask}` : '',
    ]
  },
  '/review': (cmd) => [
    '## Revisión de código (demo)',
    '',
    '| Severidad | Hallazgo |',
    '|-----------|----------|',
    '| media | Falta validación de entrada en API |',
    '| baja | Considerar debounce en guardado |',
    '',
    `**Ámbito:** ${cmd.prompt || 'archivo activo'}`,
  ],
  '/mobile-fix': (cmd) => [
    '## Correcciones móvil (demo)',
    '',
    '- Añadir meta viewport y manifest.json',
    '- Mobile-first, manifest y viewport (sin páginas legales salvo petición)',
    '',
    `**Issues:** ${cmd.prompt || '(vacío)'}`,
  ],
  '/css': (cmd) => [
    '## Mejoras CSS (demo)',
    '',
    '```css',
    '.card {',
    '  display: grid;',
    '  gap: 1rem;',
    '  padding: 1.5rem;',
    '  border-radius: var(--radius-lg);',
    '}',
    '```',
    '',
    `**Objetivo:** ${cmd.prompt || 'layout responsive'}`,
  ],
}

/** Mock response when AI providers are not connected. */
export function mockAIResponse(command: AICommand): string {
  const lines = MOCK_BY_COMMAND[command.command](command)
  return [
    ...lines,
    '',
    '---',
    '*Runlabs42 modo demo — sin GEMINI_API_KEY configurada.*',
  ].join('\n')
}
