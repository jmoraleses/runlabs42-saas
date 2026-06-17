import { describe, expect, it } from 'vitest'
import {
  expandSparseDesignPlanPages,
  isExplicitSinglePageBrief,
} from '@/lib/design/expandDesignPlanPages'
import { ensureDesignTokens } from '@/lib/design/themeTokens'
import type { DesignPageMeta, DesignSpec } from '@/lib/design/types'

const home: DesignPageMeta = {
  id: 'home',
  name: 'Inicio',
  path: 'design/site/index.html',
  media: 'html',
  width: 1280,
  height: 2400,
  x: 0,
  y: 0,
}

const spec: DesignSpec = {
  version: 2,
  title: 'SaaS Demo',
  summary: 'Plataforma de software para equipos',
  tokens: ensureDesignTokens({}),
  pages: [home],
}

describe('expandSparseDesignPlanPages', () => {
  it('añade pantallas cuando el plan solo trae inicio', () => {
    const pages = expandSparseDesignPlanPages([home], {
      prompt: 'Crea un sitio para mi SaaS',
      spec,
      device: 'desktop',
    })
    const ids = pages.map((p) => p.id)
    expect(ids).toContain('home')
    expect(ids.length).toBeGreaterThanOrEqual(3)
    expect(ids).toContain('pricing')
  })

  it('no expande si el brief pide una sola landing', () => {
    const pages = expandSparseDesignPlanPages([home], {
      prompt: 'Solo una landing page de una sola página para captar leads',
      spec,
      device: 'desktop',
    })
    expect(pages).toHaveLength(1)
  })
})

describe('isExplicitSinglePageBrief', () => {
  it('detecta petición de landing única', () => {
    expect(isExplicitSinglePageBrief('Quiero una landing page simple')).toBe(true)
    expect(isExplicitSinglePageBrief('Sitio completo con varias secciones')).toBe(false)
  })
})
