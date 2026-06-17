import { describe, expect, it } from 'vitest'
import {
  COVER_VIEWPORT_WIDTHS,
  detectRoutes,
  isCoverCaptureHostIframe,
  pickPreviewIframe,
} from '@/lib/projects/coverCapture'

describe('detectRoutes', () => {
  it('returns / first when present', () => {
    const routes = detectRoutes([
      { path: 'src/App.tsx', content: '<Route path="/about" element={<About />} />' },
      { path: 'src/pages/index.tsx', content: 'export default function Home() {}' },
    ])
    expect(routes[0]).toBe('/')
    expect(routes).toContain('/about')
  })

  it('parses app router pages', () => {
    const routes = detectRoutes([
      { path: 'src/app/page.tsx', content: '' },
      { path: 'src/app/pricing/page.tsx', content: '' },
    ])
    expect(routes[0]).toBe('/')
    expect(routes).toContain('/pricing')
  })

  it('defaults to / when no routes found', () => {
    expect(detectRoutes([])).toEqual(['/'])
  })
})

describe('COVER_VIEWPORT_WIDTHS', () => {
  it('includes mobile, tablet and desktop widths', () => {
    expect(COVER_VIEWPORT_WIDTHS).toEqual([390, 768, null])
  })
})

describe('pickPreviewIframe', () => {
  it('prefers visible preview over hidden capture host', () => {
    const hiddenHost = { className: 'editor-cover-capture-host' }
    const hidden = {
      closest: (sel: string) => (sel === '.editor-cover-capture-host' ? hiddenHost : null),
      contentDocument: null,
    } as unknown as HTMLIFrameElement
    const visible = {
      closest: () => null,
      contentDocument: null,
    } as unknown as HTMLIFrameElement

    const picked = pickPreviewIframe([hidden, visible])
    expect(picked).toBe(visible)
    expect(isCoverCaptureHostIframe(hidden)).toBe(true)
    expect(isCoverCaptureHostIframe(visible)).toBe(false)
  })
})
