import type { ScaffoldFile } from '@/lib/scaffolds/types'

export function reactScaffold(name: string): ScaffoldFile[] {
  const title = name.replace(/"/g, '\\"')
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'app'

  return [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'runlabs-app',
          private: true,
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            'react-router-dom': '^6.22.0',
          },
          devDependencies: {
            vite: '^5.0.0',
            '@vitejs/plugin-react': '^4.0.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.3.0',
          },
        },
        null,
        2,
      ),
      language: 'json',
    },
    {
      path: 'vite.config.ts',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
})
`,
      language: 'typescript',
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020', 'DOM'],
            module: 'ESNext',
            jsx: 'react-jsx',
            moduleResolution: 'bundler',
            strict: true,
            skipLibCheck: true,
          },
          include: ['src'],
        },
        null,
        2,
      ),
      language: 'json',
    },
    {
      path: 'capacitor.config.ts',
      content: `// Activa tras publicar en web (Publish → Mobile)
// import type { CapacitorConfig } from '@capacitor/cli'
// const config: CapacitorConfig = { appId: 'com.runlabs.${slug}', appName: '${title}', webDir: 'dist' }
// export default config
`,
      language: 'typescript',
    },
    {
      path: 'public/manifest.json',
      content: JSON.stringify(
        {
          name: title,
          short_name: title.slice(0, 12),
          start_url: '/',
          display: 'standalone',
          background_color: '#0f172a',
          theme_color: '#3b82f6',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        null,
        2,
      ),
      language: 'json',
    },
    {
      path: 'src/App.tsx',
      content: `import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './styles/app.css'
import HomePage from './pages/HomePage'

export default function App() {
  return (
    <BrowserRouter>
      <nav className="app-nav" aria-label="Principal">
        <Link to="/">Inicio</Link>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  )
}
`,
      language: 'typescript',
    },
    {
      path: 'src/pages/HomePage.tsx',
      content: `export default function HomePage() {
  return <main className="app-shell" />
}
`,
      language: 'typescript',
    },
    {
      path: 'src/styles/app.css',
      content: `:root {
  color-scheme: light dark;
  --touch-min: 44px;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; }
.app-nav {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid #e2e8f0;
}
.app-nav a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
  min-height: var(--touch-min, 44px);
  display: inline-flex;
  align-items: center;
}
.app-shell {
  min-height: 100dvh;
  padding: max(16px, env(safe-area-inset-top)) 20px 24px;
  max-width: 640px;
  margin: 0 auto;
}
.app-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 24rem;
}
.app-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
}
.app-form input,
.app-form button {
  min-height: var(--touch-min, 44px);
  font: inherit;
}
.app-form input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}
.app-form button {
  margin-top: 4px;
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
}
`,
      language: 'css',
    },
    {
      path: 'src/main.tsx',
      content: `import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
`,
      language: 'typescript',
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#3b82f6" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      language: 'html',
    },
  ]
}
