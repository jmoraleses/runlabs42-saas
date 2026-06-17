import { describe, expect, it } from 'vitest'
import { bundleProject } from '@/lib/preview/bundleProject'

describe('bundleProject', () => {
  it('returns an error when there is no entry point', async () => {
    const r = await bundleProject([{ path: 'src/util.ts', content: 'export const a = 1' }])
    expect(r.error).toBeTruthy()
    expect(r.js).toBe('')
  })

  it('auto-creates App.tsx when main imports ./App but App is missing', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)`,
      },
      { path: 'index.html', content: '<!DOCTYPE html><html><body><div id="root"></div></body></html>' },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('createRoot')
  }, 30000)

  it('resolves ./App from main when App.tsx is at project root', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)`,
      },
      { path: 'App.tsx', content: 'export default function App(){return <h1>Root App</h1>}' },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('Root App')
  }, 30000)

  it('supports default import from react-dom/client (ReactDOM.createRoot)', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content: `import ReactDOM from 'react-dom/client'
import App from './App'
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)`,
      },
      { path: 'src/App.tsx', content: 'function App(){return <h1>Hi</h1>}\nexport default App' },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('createRoot')
  })

  it('bootstraps createRoot when only src/App.tsx exists', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: 'export default function App(){return <h1>Solo App</h1>}',
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('createRoot')
    expect(r.js.trimStart().startsWith('(()')).toBe(true)
  }, 30000)

  it('bundles a minimal React project into a self-contained IIFE', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content:
          "import {createRoot} from 'react-dom/client'\nimport App from './App'\ncreateRoot(document.getElementById('root')!).render(<App/>)",
      },
      { path: 'src/App.tsx', content: 'export default function App(){return <h1>Hi</h1>}' },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('createRoot')
    expect(r.js.trimStart().startsWith('(()')).toBe(true)
  }, 30000)

  it('resolves the react-router-dom shim', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content:
          "import {createRoot} from 'react-dom/client'\nimport App from './App'\ncreateRoot(document.getElementById('root')!).render(<App/>)",
      },
      {
        path: 'src/App.tsx',
        content:
          "import {BrowserRouter,Routes,Route} from 'react-router-dom'\nexport default function App(){return <BrowserRouter><Routes><Route path='/' element={<h1>Home</h1>}/></Routes></BrowserRouter>}",
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('BrowserRouter')
  }, 30000)

  it('resolves chart.js named exports (CategoryScale, LineElement, register)', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)
export default function App() {
  return <p>chart ok</p>
}`,
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('CategoryScale')
    expect(r.js).toContain('chart ok')
  }, 30000)

  it('resolves react-chartjs-2 with a preview stub', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import { Line } from 'react-chartjs-2'
export default function App() {
  return <Line data={{ labels: ['A'], datasets: [{ data: [1] }] }} />
}`,
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('chart')
    expect(r.stubPackages).toContain('react-chartjs-2')
  }, 30000)

  it('uses window.React for router shims (no duplicate React in bundle)', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import { BrowserRouter, Link } from 'react-router-dom'
export default function App() {
  return (
    <BrowserRouter>
      <Link to="/">Home</Link>
    </BrowserRouter>
  )
}`,
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toMatch(/var React = window\.React/)
    expect(r.js).not.toContain('REACT_CONTEXT_TYPE')
    expect(r.js.length).toBeLessThan(50_000)
  }, 30000)

  it('resolves pages/ and context/ at project root when imported from src/App.tsx', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import AuthProvider from './context/AuthContext'
import Home from './pages/Home'
export default function App() {
  return <AuthProvider><Home /></AuthProvider>
}`,
      },
      { path: 'pages/Home.tsx', content: 'export default function Home() { return <h1>Home</h1> }' },
      {
        path: 'context/AuthContext.tsx',
        content: 'export default function AuthContext({ children }) { return children }',
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('Home')
  }, 30000)

  it('bundles router app with default-export page components', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import DashboardDemo from './pages/DashboardDemo'
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<DashboardDemo />} />
      </Routes>
    </BrowserRouter>
  )
}`,
      },
      {
        path: 'src/pages/Landing.tsx',
        content: 'export default function Landing() { return <h1>Landing</h1> }',
      },
      {
        path: 'src/pages/DashboardDemo.tsx',
        content: 'export default function DashboardDemo() { return <h1>Dash</h1> }',
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('Landing')
  }, 30000)

  it('bundles when pages use named exports only (AI-generated pattern)', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import Landing from './pages/Landing'
export default function App() { return <Landing /> }`,
      },
      {
        path: 'src/pages/Landing.tsx',
        content: 'export function Landing() { return <h1>Landing</h1> }',
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('Landing')
  }, 30000)

  it('bundles Route element={Component} without JSX wrapper', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={Landing} />
      </Routes>
    </BrowserRouter>
  )
}`,
      },
      {
        path: 'src/pages/Landing.tsx',
        content: 'export default function Landing() { return <h1>Landing</h1> }',
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('BrowserRouter')
  }, 30000)

  it('bundles lucide-react icon components', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `import { Sparkles } from 'lucide-react'
export default function App() { return <Sparkles /> }`,
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js.length).toBeGreaterThan(1000)
  }, 30000)

  it('does not run Tailwind for custom CSS class names only', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content:
          "import {createRoot} from 'react-dom/client'\nimport App from './App'\ncreateRoot(document.getElementById('root')!).render(<App/>)",
      },
      {
        path: 'src/App.tsx',
        content: `export default function App() {
  return (
    <main className="landing">
      <section className="feature-grid">Hola</section>
    </main>
  )
}`,
      },
      {
        path: 'src/styles/app.css',
        content: '.landing { padding: 2rem; } .feature-grid { display: grid; }',
      },
    ])
    expect(r.error).toBeNull()
    expect(r.css).toContain('.feature-grid')
    expect(r.css).not.toMatch(/\.p-8\s*\{/)
  }, 30000)

  it('inlines import.meta.env.VITE_* for preview (no Vite runtime)', async () => {
    const r = await bundleProject([
      {
        path: 'src/App.tsx',
        content: `const api = import.meta.env.VITE_API_URL
export default function App() { return <p data-api={api || 'ok'}>Hi</p> }`,
      },
    ])
    expect(r.error).toBeNull()
    // El código del proyecto debe quedar como literal (no leer import.meta.env en runtime).
    expect(r.js).toMatch(/var api = ""|api = ""/)
    expect(r.js).not.toMatch(/import\.meta\.env\.VITE_/)
  }, 30000)

  it('processes Tailwind utility classes into CSS', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content:
          "import {createRoot} from 'react-dom/client'\nimport App from './App'\nimport './styles/app.css'\ncreateRoot(document.getElementById('root')!).render(<App/>)",
      },
      {
        path: 'src/App.tsx',
        content:
          'export default function App(){return <main className="p-8 text-blue-600">Hola</main>}',
      },
      { path: 'src/styles/app.css', content: '@tailwind base;@tailwind utilities;' },
    ])
    expect(r.error).toBeNull()
    // Tailwind debe haber generado la utilidad usada en el marcado.
    expect(r.css).toMatch(/\.p-8\s*\{/)
  }, 30000)

  it('bundles preview/index.html as static HTML when present', async () => {
    const r = await bundleProject([
      {
        path: 'preview/index.html',
        content: '<!DOCTYPE html><html><head></head><body><h1>CMS preview</h1></body></html>',
      },
      {
        path: 'export/wordpress/style.css',
        content: 'body { font-size: 99px; }',
      },
      {
        path: 'src/main.tsx',
        content: "import App from './App'",
      },
    ])
    expect(r.error).toBeNull()
    expect(r.html).toContain('CMS preview')
  })
})
