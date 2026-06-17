import { ApiError } from '@/lib/api/errors'
import type { CodeTemplate } from '@/lib/codeTemplates'
import { requireProjectFilesContext, type ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

export async function requireDesignRouteContext(
  projectId: string,
): Promise<ProjectFilesContext & { projectId: string }> {
  const ctx = await requireProjectFilesContext(projectId)
  return { ...ctx, projectId }
}

export async function updateProjectDesignMeta(
  ctx: ProjectFilesContext,
  projectId: string,
  updates: {
    designApprovedAt?: string | null
    designPhase?: 'design' | 'code'
    codeTemplate?: CodeTemplate
  },
): Promise<void> {
  if (ctx.mode !== 'db') return
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.designApprovedAt !== undefined) {
    row.design_approved_at = updates.designApprovedAt
  }
  if (updates.designPhase) row.design_phase = updates.designPhase
  if (updates.codeTemplate) row.code_template = updates.codeTemplate
  const { error } = await ctx.supabase
    .from('projects')
    .update(row)
    .eq('id', projectId)
    .eq('user_id', ctx.user.id)
  if (error) throw new ApiError(500, 'No se pudo actualizar el proyecto')
}
