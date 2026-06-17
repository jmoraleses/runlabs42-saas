'use client'

import { apiFetch } from '@/lib/api/client'
import {
  createDemoProject,
  findDemoProject,
  isDemoActive,
  loadDemoProjectSpec,
  saveDemoProjectSpec,
  shouldUseDemoData,
  updateDemoProject,
} from '@/lib/auth/demo'
import { fetchDemoProjectFiles } from '@/lib/auth/demoProjectFilesClient'
import {
  ensureDemoSeedData,
  findDemoMarketplaceProduct,
  isDemoMarketplaceId,
  type DemoMarketplaceProduct,
} from '@/lib/auth/demo-seed'
import type { Project } from '@/types'

const DEMO_PURCHASES_KEY = 'runlabs_demo_marketplace_purchases'
const DEMO_CREDITS_KEY = 'runlabs_demo_credits'

export type MarketplaceAcquireItem = {
  id: string
  name: string
  price?: number
  priceCredits?: number
  framework?: string
  desc?: string
  description?: string
}

export function getMarketplacePrice(item: MarketplaceAcquireItem): number {
  const n = item.priceCredits ?? item.price ?? 0
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function isDemoMarketplaceFlow(
  productId: string,
  profile?: { id?: string; plan?: string } | null,
): boolean {
  return isDemoMarketplaceId(productId) || isDemoActive() || shouldUseDemoData(profile)
}

function readDemoPurchases(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DEMO_PURCHASES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeDemoPurchases(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DEMO_PURCHASES_KEY, JSON.stringify(ids))
  window.dispatchEvent(new Event('runlabs:demo-change'))
}

export function hasDemoMarketplacePurchase(productId: string): boolean {
  return readDemoPurchases().includes(productId)
}

export function loadDemoMarketplacePurchasesList(): Array<{
  product_id: string
  purchased_at: string
  product?: DemoMarketplaceProduct
}> {
  return readDemoPurchases().map((id) => ({
    product_id: id,
    purchased_at: new Date().toISOString(),
    product: findDemoMarketplaceProduct(id) ?? undefined,
  }))
}

/** IDs de plantillas ya adquiridas por el usuario actual (demo local o API). */
export async function loadOwnedMarketplaceProductIds(
  profile?: { id?: string; plan?: string } | null,
): Promise<Set<string>> {
  if (typeof window === 'undefined') return new Set()
  if (isDemoActive() || shouldUseDemoData(profile)) {
    ensureDemoSeedData()
    return new Set(readDemoPurchases())
  }
  try {
    const data = await apiFetch<{
      purchases: Array<{ product_id?: string; product?: { id?: string } }>
    }>('/api/marketplace/purchases')
    const ids = (data.purchases ?? [])
      .map((p) => p.product_id ?? p.product?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    return new Set(ids)
  } catch {
    return new Set()
  }
}

export function loadDemoCreditsBalance(): number {
  if (typeof window === 'undefined') return 100
  try {
    const raw = window.localStorage.getItem(DEMO_CREDITS_KEY)
    if (raw == null) return 100
    const n = Number(JSON.parse(raw))
    return Number.isFinite(n) ? Math.max(0, n) : 100
  } catch {
    return 100
  }
}

export function saveDemoCreditsBalance(credits: number) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DEMO_CREDITS_KEY, JSON.stringify(Math.max(0, credits)))
  window.dispatchEvent(new Event('runlabs:demo-change'))
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
    h1 { font-size: 1.75rem; margin: 0 0 8px; }
    p { color: #9a9aa0; font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Plantilla · Runlabs42</p>
</body>
</html>`
}

async function putDemoProjectFiles(
  projectId: string,
  files: { path: string; content: string; language?: string | null }[],
) {
  if (!files.length) return
  await apiFetch(`/api/projects/${projectId}/files`, {
    method: 'PUT',
    body: JSON.stringify({ files }),
  })
}

async function cloneDemoProjectFromSource(
  sourceId: string,
  name: string,
  framework: string,
): Promise<Project> {
  const source = findDemoProject(sourceId)
  const project = createDemoProject(name, framework || source?.framework || 'react')
  const files = await fetchDemoProjectFiles(sourceId)
  if (files.length > 0) {
    await putDemoProjectFiles(
      project.id,
      files.map((f) => ({ ...f })),
    )
  } else {
    await putDemoProjectFiles(project.id, [
      { path: 'index.html', content: previewHtml(name), language: 'html' },
    ])
  }
  const spec =
    loadDemoProjectSpec(sourceId) ||
    `# ${name}\n\nPlantilla importada desde el marketplace.\n`
  saveDemoProjectSpec(project.id, spec)
  return project
}

async function importDemoMarketplaceProduct(
  product: DemoMarketplaceProduct,
): Promise<Project> {
  ensureDemoSeedData()
  if (product.demoProjectId && findDemoProject(product.demoProjectId)) {
    return cloneDemoProjectFromSource(
      product.demoProjectId,
      product.name,
      product.framework ?? 'react',
    )
  }
  const project = createDemoProject(product.name, product.framework ?? 'react')
  await putDemoProjectFiles(project.id, [
    { path: 'index.html', content: previewHtml(product.name), language: 'html' },
  ])
  saveDemoProjectSpec(
    project.id,
    `# ${product.name}\n\n${product.desc || 'Plantilla del marketplace.'}\n`,
  )
  return project
}

async function purchaseDemoProduct(productId: string, price: number): Promise<void> {
  if (hasDemoMarketplacePurchase(productId)) return
  if (price > 0) {
    const balance = loadDemoCreditsBalance()
    if (balance < price) {
      throw new Error('INSUFFICIENT_CREDITS')
    }
    saveDemoCreditsBalance(balance - price)
  }
  writeDemoPurchases([...readDemoPurchases(), productId])
}

export async function purchaseMarketplaceProduct(
  productId: string,
  options?: { demo?: boolean; price?: number },
): Promise<void> {
  if (options?.demo || isDemoMarketplaceId(productId)) {
    await purchaseDemoProduct(productId, options?.price ?? 0)
    return
  }
  try {
    await apiFetch('/api/marketplace/purchase', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Ya compraste') || msg.toLowerCase().includes('already')) return
    throw e
  }
}

export async function importMarketplaceToProject(
  productId: string,
  name?: string,
  options?: { demo?: boolean },
): Promise<Project> {
  if (options?.demo || isDemoMarketplaceId(productId)) {
    const product = findDemoMarketplaceProduct(productId)
    if (!product) throw new Error('Producto no encontrado')
    const project = await importDemoMarketplaceProduct(product)
    if (name?.trim()) {
      updateDemoProject(project.id, { name: name.trim() })
      return { ...project, name: name.trim() }
    }
    return project
  }

  const data = await apiFetch<{ project: Project }>('/api/marketplace/import', {
    method: 'POST',
    body: JSON.stringify({ productId, name: name?.trim() || undefined }),
  })
  if (!data.project?.id) throw new Error('No se pudo crear el proyecto')
  return data.project
}

/** Compra (si aplica), crea proyecto del usuario y devuelve el id para Studio. */
export async function acquireTemplateAndCreateProject(
  item: MarketplaceAcquireItem,
  profile?: { id?: string; plan?: string; credits?: number } | null,
): Promise<{ projectId: string }> {
  if (!item.id) throw new Error('Plantilla no válida')

  const price = getMarketplacePrice(item)
  const demo = isDemoMarketplaceFlow(item.id, profile)

  if (demo && price > 0 && loadDemoCreditsBalance() < price) {
    throw new Error('INSUFFICIENT_CREDITS')
  }

  if (!demo && price > 0 && (profile?.credits ?? 0) < price) {
    throw new Error('INSUFFICIENT_CREDITS')
  }

  await purchaseMarketplaceProduct(item.id, { demo, price })
  const project = await importMarketplaceToProject(item.id, item.name, { demo })
  return { projectId: project.id }
}

export function studioPathForProject(projectId: string): string {
  return `/studio?project=${encodeURIComponent(projectId)}`
}
