import { describe, expect, it } from 'vitest'
import { htmlEmbedsFullPageMockup } from '@/lib/design/mockupHtmlQuality'

describe('htmlEmbedsFullPageMockup', () => {
  it('detecta img a pantalla completa del mockup', () => {
    const html = `<body><img src="../mockups/home.png" style="width:100%;object-fit:cover" /></body>`
    expect(htmlEmbedsFullPageMockup(html, 'home')).toBe(true)
  })

  it('no marca HTML estructurado con assets de contenido', () => {
    const html = `<body><header data-sk-id="h">Nav</header><img src="assets/hero.jpg" /></body>`
    expect(htmlEmbedsFullPageMockup(html, 'home')).toBe(false)
  })
})
