import { isDemoActive } from '@/lib/auth/demo'
import { loadDemoMarketplaceProducts } from '@/lib/auth/demo-seed'
import type { Project } from '@/types'

/** Whether this project has an active marketplace listing. */
export function isProjectMarketplaceListed(project: Project | null | undefined): boolean {
  if (!project) return false
  if (project.marketplaceListed) return true
  if (isDemoActive()) {
    return loadDemoMarketplaceProducts().some((p) => p.demoProjectId === project.id)
  }
  return false
}

export interface ProjectRating {
  rating: number
  reviewCount: number
}

export interface ProjectMarketplaceMeta {
  rating: number
  reviewCount: number
  priceCredits: number
}

/** Returns marketplace metadata for a project when available. */
export function getProjectMarketplaceMeta(project: Project | null | undefined): ProjectMarketplaceMeta | null {
  if (!project) return null
  if (isDemoActive()) {
    const product = loadDemoMarketplaceProducts().find((p) => p.demoProjectId === project.id)
    if (!product) return null
    return {
      rating: product.rating ?? 0,
      reviewCount: Math.max(0, Math.floor((product.stars ?? 0) / 10)),
      priceCredits: Math.max(0, Number(product.price ?? 0)),
    }
  }
  return null
}

/** Returns the marketplace rating for a project, or null if not listed / no reviews. */
export function getProjectMarketplaceRating(project: Project | null | undefined): ProjectRating | null {
  const meta = getProjectMarketplaceMeta(project)
  if (!meta) return null
  return { rating: meta.rating, reviewCount: meta.reviewCount }
}
