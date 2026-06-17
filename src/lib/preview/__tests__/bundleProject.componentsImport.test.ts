import { describe, expect, it } from 'vitest'
import { bundleProject } from '@/lib/preview/bundleProject'

describe('bundleProject component import paths', () => {
  it('resolves ./components/X from within src/components/Dashboard.tsx', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)`,
      },
      {
        path: 'src/App.tsx',
        content: `import Dashboard from './components/Dashboard'
export default function App() { return <Dashboard /> }`,
      },
      {
        path: 'src/components/Dashboard.tsx',
        content: `import MetricCard from './components/MetricCard'
export default function Dashboard() { return <MetricCard title="T" value="1" /> }`,
      },
      {
        path: 'src/components/MetricCard.tsx',
        content: `export default function MetricCard({ title, value }) {
  return <div><span>{title}</span><strong>{value}</strong></div>
}`,
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('MetricCard')
    expect(r.js).toContain('Dashboard')
  }, 30000)

  it('resolves ./pages/Home from src/App.tsx', async () => {
    const r = await bundleProject([
      {
        path: 'src/main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)`,
      },
      {
        path: 'src/App.tsx',
        content: `import Home from './pages/Home'
export default function App() { return <Home /> }`,
      },
      {
        path: 'src/pages/Home.tsx',
        content: 'export default function Home() { return <h1>Home</h1> }',
      },
    ])
    expect(r.error).toBeNull()
    expect(r.js).toContain('Home')
  }, 30000)
})
