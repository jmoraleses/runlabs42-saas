import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_USER_MEMORIES = 12
const MAX_PROJECT_MEMORIES = 16
const MAX_MEMORY_CHARS = 400

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export async function buildMemoryContextBlock(
  supabase: SupabaseClient,
  userId: string,
  projectId?: string,
): Promise<string> {
  const lines: string[] = []

  const { data: userRows } = await supabase
    .from('user_memories')
    .select('category, content')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(MAX_USER_MEMORIES)

  if (userRows?.length) {
    lines.push('', '## Preferencias del usuario (memoria persistente)', '')
    for (const row of userRows) {
      const cat = String(row.category ?? 'general')
      lines.push(`- [${cat}] ${truncate(String(row.content ?? ''), MAX_MEMORY_CHARS)}`)
    }
  }

  if (projectId) {
    const { data: projectRows } = await supabase
      .from('project_memories')
      .select('category, content')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(MAX_PROJECT_MEMORIES)

    if (projectRows?.length) {
      lines.push('', '## Contexto del proyecto (memoria persistente)', '')
      for (const row of projectRows) {
        const cat = String(row.category ?? 'general')
        lines.push(`- [${cat}] ${truncate(String(row.content ?? ''), MAX_MEMORY_CHARS)}`)
      }
    }
  }

  if (!lines.length) return ''
  lines.push('', 'Usa esta memoria para personalizar respuestas sin repetirla literalmente al usuario.')
  return lines.join('\n')
}
