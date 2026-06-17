import type { Project } from '@/types'
import { normalizeCodeTemplate } from '@/lib/codeTemplates'

/** Normalize API or snake_case project payloads; returns null if invalid. */
export function normalizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = r.id
  if (id == null || id === '') return null

  return {
    id: String(id),
    userId: String(r.userId ?? r.user_id ?? ''),
    name: String(r.name ?? 'Sin nombre'),
    description: (r.description as string | null) ?? null,
    framework: String(r.framework ?? 'next'),
    status: (r.status as Project['status']) ?? 'draft',
    public: Boolean(r.public),
    createdAt: String(r.createdAt ?? r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updatedAt ?? r.updated_at ?? new Date().toISOString()),
    deployedUrl: (r.deployedUrl ?? r.deployed_url) as string | null | undefined,
    githubRepo: (r.githubRepo ?? r.github_repo) as string | null | undefined,
    coverUrl: (r.coverUrl ?? r.cover_url) as string | null | undefined,
    coverImages: (r.coverImages ?? r.cover_images) as string[] | null | undefined,
    marketplaceListed: Boolean(r.marketplaceListed ?? r.marketplace_listed),
    targetPlatforms: (r.targetPlatforms ?? r.target_platforms) as Project['targetPlatforms'],
    mobileConfig: (r.mobileConfig ?? r.mobile_config) as Project['mobileConfig'],
    mobileReadiness: (r.mobileReadiness ?? r.mobile_readiness) as Project['mobileReadiness'],
    lastMobileBuildAt: (r.lastMobileBuildAt ?? r.last_mobile_build_at) as string | null | undefined,
    designApprovedAt: (r.designApprovedAt ?? r.design_approved_at) as string | null | undefined,
    designPhase: ((r.designPhase ?? r.design_phase) as Project['designPhase']) ?? 'design',
    codeTemplate: normalizeCodeTemplate(
      (r.codeTemplate ?? r.code_template) as string | null | undefined,
    ),
    codeTemplateLinkParamMap: (r.codeTemplateLinkParamMap ??
      r.code_template_link_param_map) as Project['codeTemplateLinkParamMap'],
  }
}

export function normalizeProjects(list: unknown): Project[] {
  if (!Array.isArray(list)) return []
  return list.map(normalizeProject).filter((p): p is Project => p !== null)
}
