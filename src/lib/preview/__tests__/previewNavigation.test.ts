import { describe, expect, it } from 'vitest'
import {
  isVisualPreviewFile,
  previewFileForRoute,
  previewRouteForFile,
} from '@/lib/preview/previewNavigation'

const appWithRoutes = `import { Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  )
}
`

describe('previewNavigation', () => {
  it('detecta archivos visuales', () => {
    expect(isVisualPreviewFile('src/pages/AboutPage.tsx')).toBe(true)
    expect(isVisualPreviewFile('src/index.css')).toBe(false)
    expect(isVisualPreviewFile('src/App.tsx')).toBe(true)
  })

  it('resuelve ruta desde App.tsx', () => {
    const files = [
      { path: 'src/App.tsx', content: appWithRoutes },
      { path: 'src/pages/AboutPage.tsx', content: 'export default function AboutPage() {}' },
    ]
    expect(previewRouteForFile('src/pages/AboutPage.tsx', files)).toBe('/about')
    expect(previewRouteForFile('src/pages/HomePage.tsx', files)).toBe('/')
    expect(previewRouteForFile('src/App.tsx', files)).toBe('/')
  })

  it('infiere ruta por nombre de archivo sin App', () => {
    expect(previewRouteForFile('src/pages/ContactPage.tsx')).toBe('/contact')
  })

  it('resuelve Home importado como ./pages/Home', () => {
    const appHome = `import Home from './pages/Home'
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
    </Routes>
  )
}
`
    const files = [
      { path: 'src/App.tsx', content: appHome },
      { path: 'src/pages/Home.tsx', content: 'export default function Home() {}' },
      { path: 'src/pages/About.tsx', content: 'export default function About() {}' },
    ]
    expect(previewRouteForFile('src/pages/Home.tsx', files)).toBe('/')
    expect(previewRouteForFile('src/pages/About.tsx', files)).toBe('/about')
    expect(previewFileForRoute('/about', files)).toBe('src/pages/About.tsx')
    expect(previewFileForRoute('/', files)).toBe('src/pages/Home.tsx')
  })
})
