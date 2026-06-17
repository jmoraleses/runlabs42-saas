import type { Project, MarketplaceProduct } from '@/types'
import type { MobileConfig, MobileReadiness, TargetPlatform } from '@/types/mobile'
import { normalizeCodeTemplate } from '@/lib/codeTemplates'

export function mapProject(row: Record<string, unknown>): Project {
  const targetPlatforms = row.target_platforms as string[] | null | undefined
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    framework: String(row.framework ?? 'next'),
    status: row.status as Project['status'],
    public: Boolean(row.public),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deployedUrl: row.deployed_url ? String(row.deployed_url) : null,
    githubRepo: row.github_repo ? String(row.github_repo) : null,
    coverUrl: row.cover_url ? String(row.cover_url) : null,
    coverImages: Array.isArray(row.cover_images) ? (row.cover_images as string[]) : null,
    marketplaceListed: Boolean(row.marketplace_listed),
    targetPlatforms: Array.isArray(targetPlatforms)
      ? (targetPlatforms.filter((p) => p === 'web' || p === 'ios' || p === 'android') as TargetPlatform[])
      : ['web'],
    mobileConfig: (row.mobile_config as MobileConfig | null) ?? null,
    mobileReadiness: (row.mobile_readiness as MobileReadiness | null) ?? null,
    lastMobileBuildAt: row.last_mobile_build_at ? String(row.last_mobile_build_at) : null,
    designApprovedAt: row.design_approved_at ? String(row.design_approved_at) : null,
    designPhase: (row.design_phase as Project['designPhase']) ?? 'design',
    codeTemplate: normalizeCodeTemplate(
      row.code_template != null ? String(row.code_template) : undefined,
    ),
    codeTemplateLinkParamMap: (row.code_template_link_param_map as Project['codeTemplateLinkParamMap']) ?? null,
  }
}

export function mapProduct(row: Record<string, unknown>): MarketplaceProduct {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    priceCredits: Number(row.price_credits ?? 0),
    previewUrl: (row.preview_url as string | null) ?? null,
    coverImages: Array.isArray(row.cover_images) ? (row.cover_images as string[]) : null,
    code: '',
    rating: Number(row.rating ?? 0),
    downloads: Number(row.downloads ?? 0),
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at),
  }
}
