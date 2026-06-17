import { normalizeCodeTemplate, type CodeTemplate } from '@/lib/codeTemplates'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import type { CodeTemplateLinkParamMap } from '@/lib/design/codeTemplateConvert'

export async function resolveProjectCodeTemplate(
  ctx: ProjectFilesContext,
  projectId: string,
  bodyValue?: unknown,
): Promise<CodeTemplate> {
  const fromBody = bodyValue != null ? String(bodyValue).trim().toLowerCase() : ''
  if (fromBody) return normalizeCodeTemplate(fromBody)

  if (ctx.mode !== 'db') return 'html'

  const { data, error } = await ctx.supabase
    .from('projects')
    .select('code_template')
    .eq('id', projectId)
    .eq('user_id', ctx.user.id)
    .single()

  if (error || !data) return 'html'
  return normalizeCodeTemplate(data.code_template as string | null)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseCodeTemplateLinkParamMap(raw: unknown): CodeTemplateLinkParamMap | null {
  if (!isRecord(raw)) return null
  const out: CodeTemplateLinkParamMap = {}
  const templates: CodeTemplate[] = [
    'html',
    'wordpress',
    'shopify',
    'woocommerce',
    'prestashop',
    'joomla',
  ]
  for (const template of templates) {
    const val = raw[template]
    if (!isRecord(val)) continue
    const map: Record<string, string> = {}
    for (const [k, v] of Object.entries(val)) {
      if (!k || typeof v !== 'string' || !v) continue
      map[k.trim()] = v.trim()
    }
    if (Object.keys(map).length) out[template] = map
  }
  return Object.keys(out).length ? out : null
}

export async function resolveProjectCodeTemplateLinkParamMap(
  ctx: ProjectFilesContext,
  projectId: string,
): Promise<CodeTemplateLinkParamMap | null> {
  if (ctx.mode !== 'db') return null
  const { data, error } = await ctx.supabase
    .from('projects')
    .select('code_template_link_param_map')
    .eq('id', projectId)
    .eq('user_id', ctx.user.id)
    .single()
  if (error || !data) return null
  return parseCodeTemplateLinkParamMap(data.code_template_link_param_map)
}
