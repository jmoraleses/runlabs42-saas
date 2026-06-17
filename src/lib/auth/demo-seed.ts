'use client'

import type { Project } from '@/types'
import {
  DEMO_MARKETPLACE_STORAGE_KEY,
  DEMO_PROJECT_FILES_STORAGE_KEY,
  DEMO_PROJECTS_STORAGE_KEY,
  DEMO_USER,
  findDemoProject,
  slimDemoMarketplaceMedia,
  writeDemoJson,
  type DemoProjectFile,
} from '@/lib/auth/demo'
import { getDemoPreviewUrl } from '@/lib/env'

export const DEMO_MARKETPLACE_STORAGE_QUOTA_ERROR = 'DEMO_STORAGE_QUOTA'

export type DemoMarketplaceProduct = {
  id: string
  name: string
  author: string
  desc: string
  price: number
  stars: number
  rating: number
  framework: string
  category: string
  previewUrl?: string | null
  coverImages?: string[] | null
  /** Proyecto demo del usuario local, si aplica */
  demoProjectId?: string | null
}

const SEED_PROJECT_IDS = {
  saas: 'demo-seed-saas-landing',
  dashboard: 'demo-seed-dashboard',
} as const

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString()
}

function previewHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, sans-serif;
      background: linear-gradient(145deg, #1a1a22 0%, #111116 100%);
      color: #f1f1f5;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    h1 { font-size: 1.75rem; margin: 0 0 8px; letter-spacing: -0.03em; }
    p { color: #9a9aa0; font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Vista previa · Runlabs42 demo</p>
</body>
</html>`
}

function _buildSeedProjects(): Project[] {
  return [
    {
      id: SEED_PROJECT_IDS.saas,
      userId: DEMO_USER.id,
      name: 'Landing SaaS Pro',
      description: 'Landing con pricing, testimonios y flujo de registro listo para producción.',
      framework: 'next',
      status: 'draft',
      public: false,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(2),
      deployedUrl: getDemoPreviewUrl(SEED_PROJECT_IDS.saas),
      targetPlatforms: ['web'],
      mobileConfig: null,
      mobileReadiness: null,
    },
    {
      id: SEED_PROJECT_IDS.dashboard,
      userId: DEMO_USER.id,
      name: 'Dashboard Analytics',
      description: 'Panel de analíticas con gráficos, tablas y modo oscuro.',
      framework: 'react',
      status: 'draft',
      public: false,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(1),
      deployedUrl: null,
      targetPlatforms: ['web', 'ios', 'android'],
      mobileConfig: null,
      mobileReadiness: null,
    },
  ]
}

function _buildSeedMarketplace(): DemoMarketplaceProduct[] {
  return [
    {
      id: 'demo-mp-saas-starter',
      name: 'SaaS Starter Pro',
      author: 'María García',
      desc: 'Landing completa con pricing, testimonios y flujo de autenticación. Lista para producción.',
      price: 0,
      stars: 412,
      rating: 4.9,
      framework: 'next',
      category: 'landing',
    },
    {
      id: 'demo-mp-ecommerce',
      name: 'E-commerce Store',
      author: 'Sam Wilson',
      desc: 'Tienda con carrito, checkout e integración Stripe. Full-stack con Next.js.',
      price: 32,
      stars: 183,
      rating: 4.6,
      framework: 'next',
      category: 'ecommerce',
    },
    {
      id: 'demo-mp-saas-landing',
      name: 'Landing SaaS Pro',
      author: 'Usuario Demo',
      desc: 'Plantilla publicada desde el proyecto demo. Incluye hero, pricing y CTA de conversión.',
      price: 0,
      stars: 89,
      rating: 4.8,
      framework: 'next',
      category: 'landing',
      demoProjectId: SEED_PROJECT_IDS.saas,
    },
    {
      id: 'demo-mp-dashboard',
      name: 'Dashboard Analytics',
      author: 'Usuario Demo',
      desc: 'Dashboard de métricas con gráficos y tablas. Ideal para productos B2B.',
      price: 18,
      stars: 56,
      rating: 4.7,
      framework: 'react',
      category: 'dashboard',
      demoProjectId: SEED_PROJECT_IDS.dashboard,
    },
  ]
}

function _buildSeedProjectFiles(): Record<string, DemoProjectFile[]> {
  return {
    [SEED_PROJECT_IDS.saas]: [
      { path: 'index.html', content: previewHtml('Landing SaaS Pro'), language: 'html' },
    ],
    [SEED_PROJECT_IDS.dashboard]: [
      { path: 'index.html', content: previewHtml('Dashboard Analytics'), language: 'html' },
    ],
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown, keepMarketplaceId?: string) {
  return writeDemoJson(key, value, undefined, keepMarketplaceId)
}

export function isDemoMarketplaceId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('demo-mp-')
}

export function loadDemoMarketplaceProducts(): DemoMarketplaceProduct[] {
  return readJson<DemoMarketplaceProduct[]>(DEMO_MARKETPLACE_STORAGE_KEY, [])
}

export function findDemoMarketplaceProduct(id: string): DemoMarketplaceProduct | null {
  return loadDemoMarketplaceProducts().find((p) => p.id === id) ?? null
}

/** Portadas en listing demo se guardan sin data: URLs; se resuelven desde el proyecto vinculado. */
export function resolveDemoMarketplaceCovers(product: DemoMarketplaceProduct): {
  coverImages: string[] | null
  previewUrl: string | null
} {
  if (product.demoProjectId) {
    const proj = findDemoProject(product.demoProjectId)
    if (proj?.coverImages?.length) {
      return {
        coverImages: proj.coverImages,
        previewUrl: proj.coverImages[0] ?? null,
      }
    }
    if (proj?.coverUrl) {
      return { coverImages: [proj.coverUrl], previewUrl: proj.coverUrl }
    }
  }
  const coverImages = product.coverImages ?? null
  return {
    coverImages,
    previewUrl: product.previewUrl ?? coverImages?.[0] ?? null,
  }
}

export function withDemoMarketplaceCovers(product: DemoMarketplaceProduct): DemoMarketplaceProduct {
  return { ...product, ...resolveDemoMarketplaceCovers(product) }
}

export function addDemoMarketplaceProduct(product: DemoMarketplaceProduct): void {
  if (typeof window === 'undefined') return
  const media = slimDemoMarketplaceMedia(product.previewUrl, product.coverImages ?? null)
  const slim: DemoMarketplaceProduct = { ...product, ...media }
  const existing = loadDemoMarketplaceProducts().filter((p) => p.id !== slim.id)
  const ok = writeJson(DEMO_MARKETPLACE_STORAGE_KEY, [slim, ...existing], slim.id)
  if (!ok) throw new Error(DEMO_MARKETPLACE_STORAGE_QUOTA_ERROR)
}

const DEMO_SEED_VERSION_KEY = 'runlabs_demo_seed_v'
const DEMO_SEED_VERSION = '1'

/** Inserta listings de ejemplo para la cuenta demo (sin crear proyectos locales de ejemplo). */
export function ensureDemoSeedData(): void {
  if (typeof window === 'undefined') return

  const storedVersion = window.localStorage.getItem(DEMO_SEED_VERSION_KEY)
  const projects = readJson<Project[]>(DEMO_PROJECTS_STORAGE_KEY, [])
  const marketplace = readJson<DemoMarketplaceProduct[]>(DEMO_MARKETPLACE_STORAGE_KEY, [])

  const hasSeedMarketplace = marketplace.some((p) => p.id.startsWith('demo-mp-'))

  if (storedVersion === DEMO_SEED_VERSION && hasSeedMarketplace) {
    return
  }

  const seedIds = new Set([SEED_PROJECT_IDS.saas, SEED_PROJECT_IDS.dashboard])
  const keptProjects = projects.filter(
    (p) => !seedIds.has(p.id as (typeof SEED_PROJECT_IDS)[keyof typeof SEED_PROJECT_IDS]),
  )
  // Never auto-create sample projects in local demo mode.
  writeJson(DEMO_PROJECTS_STORAGE_KEY, keptProjects)

  const keptMp = marketplace.filter((p) => !p.id.startsWith('demo-mp-'))
  writeJson(DEMO_MARKETPLACE_STORAGE_KEY, [..._buildSeedMarketplace(), ...keptMp])

  const allFiles = readJson<Record<string, DemoProjectFile[]>>(DEMO_PROJECT_FILES_STORAGE_KEY, {})
  // Remove seeded demo project files if they existed from a previous version.
  const nextFiles = { ...allFiles }
  delete nextFiles[SEED_PROJECT_IDS.saas]
  delete nextFiles[SEED_PROJECT_IDS.dashboard]
  writeJson(DEMO_PROJECT_FILES_STORAGE_KEY, nextFiles)

  window.localStorage.setItem(DEMO_SEED_VERSION_KEY, DEMO_SEED_VERSION)
}

export { SEED_PROJECT_IDS }
