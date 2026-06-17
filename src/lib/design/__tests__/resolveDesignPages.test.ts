import { describe, expect, it } from 'vitest'
import {
  bumpPagePreviewStampsForPageIds,
  bumpPagePreviewStampsFromPaths,
  resolveDesignPages,
} from '@/lib/design/pages'
import { isDesignCanvasFilePath } from '@/lib/design/types'

describe('bumpPagePreviewStampsForPageIds', () => {
  it('incrementa solo el stamp html de las páginas indicadas', () => {
    const stamps = bumpPagePreviewStampsForPageIds(
      { home: { html: 2, assets: 1 } },
      ['contact'],
    )
    expect(stamps.home).toEqual({ html: 2, assets: 1 })
    expect(stamps.contact?.html).toBe(1)
    expect(stamps.contact?.assets).toBe(0)
  })
})

describe('bumpPagePreviewStampsFromPaths', () => {
  it('incrementa html y assets por página', () => {
    let stamps = bumpPagePreviewStampsFromPaths({}, ['design/pages/home/index.html'])
    expect(stamps.home?.html).toBe(1)
    stamps = bumpPagePreviewStampsFromPaths(stamps, ['design/pages/home/assets/hero.jpg'])
    expect(stamps.home?.assets).toBe(1)
    stamps = bumpPagePreviewStampsFromPaths(stamps, ['design/site/assets/logo.png'])
    expect(stamps.home?.assets).toBe(2)
  })
})

describe('isDesignCanvasFilePath', () => {
  it('incluye mockups PNG del pipeline Imagen', () => {
    expect(isDesignCanvasFilePath('design/mockups/home.png')).toBe(true)
    expect(isDesignCanvasFilePath('design/pages/home/index.html')).toBe(true)
    expect(isDesignCanvasFilePath('spec/design.json')).toBe(false)
  })
})

describe('resolveDesignPages', () => {
  it('resuelve páginas desde spec + mockups PNG', () => {
    const spec = JSON.stringify({
      version: 2,
      title: 'Demo',
      summary: 'Demo',
      tokens: {},
      source: 'vertex-imagen',
      pages: [
        { id: 'home', name: 'Inicio', path: 'design/mockups/home.png', media: 'image' },
        { id: 'pricing', name: 'Precios', path: 'design/mockups/pricing.png', media: 'image' },
      ],
    })
    const files = [
      { path: 'design/mockups/home.png' },
      { path: 'design/mockups/pricing.png' },
    ]

    const pages = resolveDesignPages(files, spec)
    expect(pages).toHaveLength(2)
    expect(pages[0]?.path).toBe('design/mockups/home.png')
    expect(pages[0]?.media).toBe('image')
  })

  it('muestra HTML (un solo marco) cuando ya existe; sin marco mockup duplicado', () => {
    const spec = JSON.stringify({
      version: 2,
      title: 'Demo',
      summary: 'Demo',
      tokens: {},
      source: 'vertex-imagen',
      pages: [
        {
          id: 'pricing',
          name: 'Precios',
          path: 'design/pages/pricing/index.html',
          media: 'html',
          mockupPath: 'design/mockups/pricing.png',
        },
      ],
    })
    const files = [
      { path: 'design/mockups/pricing.png' },
      { path: 'design/pages/pricing/index.html', content: '<!DOCTYPE html><html><body><h1>Precios</h1></body></html>' },
    ]

    const pages = resolveDesignPages(files, spec)
    expect(pages).toHaveLength(1)
    expect(pages[0]?.id).toBe('pricing')
    expect(pages[0]?.path).toBe('design/pages/pricing/index.html')
    expect(pages[0]?.media).toBe('html')
    expect(pages[0]?.mockupPath).toBe('design/mockups/pricing.png')
  })

  it('mantiene páginas HTML del spec aunque el archivo aún no exista', () => {
    const spec = JSON.stringify({
      version: 2,
      title: 'Demo',
      pages: [
        { id: 'home', name: 'Inicio', path: 'design/site/index.html', media: 'html' },
        {
          id: 'pricing',
          name: 'Precios',
          path: 'design/pages/pricing/index.html',
          media: 'html',
        },
      ],
    })
    const files = [{ path: 'spec/design.json' }]
    const pages = resolveDesignPages(files, spec)
    expect(pages.map((p) => p.id).sort()).toEqual(['home', 'pricing'])
  })

  it('muestra solo PNG mientras el HTML aún no existe', () => {
    const spec = JSON.stringify({
      version: 2,
      title: 'Demo',
      pages: [
        { id: 'home', name: 'Inicio', path: 'design/mockups/home.png', media: 'image' },
      ],
    })
    const files = [{ path: 'design/mockups/home.png' }]
    const pages = resolveDesignPages(files, spec)
    expect(pages).toHaveLength(1)
    expect(pages[0]?.path).toBe('design/mockups/home.png')
    expect(pages[0]?.media).toBe('image')
  })
})
