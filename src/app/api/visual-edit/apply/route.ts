import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { captureException } from '@/lib/observability/captureException'
import { requireProjectAccess } from '@/lib/projects/access'

const ALLOWED_CSS_PROPS = [
  'color', 'backgroundColor', 'fontSize', 'fontWeight', 'padding', 'paddingTop',
  'paddingBottom', 'paddingLeft', 'paddingRight', 'margin', 'marginTop', 'marginBottom',
  'marginLeft', 'marginRight', 'textAlign', 'borderRadius', 'border', 'borderColor',
  'lineHeight', 'letterSpacing', 'width', 'height', 'maxWidth', 'minHeight',
  'display', 'flexDirection', 'gap', 'alignItems', 'justifyContent',
] as const

const patchSchema = z.object({
  projectId: z.string().uuid().optional(),
  skId: z.string().min(1).max(256),
  property: z.enum([
    'text', 'color', 'backgroundColor', 'fontSize', 'fontWeight',
    'padding', 'margin', 'textAlign', 'borderRadius', 'className',
    ...ALLOWED_CSS_PROPS,
  ]),
  value: z.string().max(2000),
  prompt: z.string().max(4000).optional(),
  filePath: z.string().max(512).optional(),
})

/**
 * Aplica parches visuales al código fuente del proyecto.
 * Busca el elemento por data-sk-id y actualiza el atributo style o className.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const result = patchSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Parche inválido', details: result.error.flatten() },
        { status: 400 },
      )
    }

    const { projectId, skId, property, value, filePath } = result.data

    if (projectId) {
      await requireProjectAccess(supabase, projectId, user.id)
    }

    // If we have projectId and filePath, try to apply the patch to the stored file
    let applied = false
    let patchedContent: string | null = null

    if (projectId && filePath) {
      const { data: fileRow } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', filePath)
        .eq('user_id', user.id)
        .single()

      if (fileRow?.content) {
        patchedContent = applyPatchToSource(fileRow.content, skId, property, value)
        if (patchedContent !== fileRow.content) {
          const { error: updateErr } = await supabase
            .from('project_files')
            .update({ content: patchedContent, updated_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .eq('path', filePath)
            .eq('user_id', user.id)
          if (!updateErr) applied = true
        }
      }
    }

    return NextResponse.json({
      ok: true,
      applied,
      patch: { skId, property, value },
      patchedContent,
      projectId: projectId ?? null,
      appliedAt: new Date().toISOString(),
    })
  } catch (e) {
    await captureException(e)
    return NextResponse.json({ error: 'Error al aplicar parche visual' }, { status: 500 })
  }
}

/**
 * Applies a visual patch to JSX/TSX source by matching data-sk-id attributes.
 * Uses regex-based approach to avoid AST dependency in the runtime.
 */
function applyPatchToSource(source: string, skId: string, property: string, value: string): string {
  // Find JSX elements with matching data-sk-id
  const escapedId = skId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  if (property === 'text') {
    // Replace text content between tags with matching sk-id
    const textRegex = new RegExp(
      `(data-sk-id="${escapedId}"[^>]*>)([^<]*)`,
      'g',
    )
    return source.replace(textRegex, `$1${sanitizeTextValue(value)}`)
  }

  if (property === 'className') {
    // Replace className prop on element with matching sk-id
    const classRegex = new RegExp(
      `(data-sk-id="${escapedId}"[^>]*?)\\s*className="[^"]*"`,
      'g',
    )
    if (classRegex.test(source)) {
      return source.replace(classRegex, `$1 className="${sanitizeAttrValue(value)}"`)
    }
    // Insert className if not present
    return source.replace(
      new RegExp(`(data-sk-id="${escapedId}")`, 'g'),
      `$1 className="${sanitizeAttrValue(value)}"`,
    )
  }

  // CSS property: update or insert in style prop
  const styleRegex = new RegExp(
    `(data-sk-id="${escapedId}"[^>]*?)\\s*style=\\{\\{([^}]*)\\}\\}`,
    'g',
  )
  const cssProp = cssPropertyToJsKey(property)
  const cssValue = sanitizeAttrValue(value)

  if (styleRegex.test(source)) {
    return source.replace(styleRegex, (_match, prefix, existingStyle) => {
      const updated = updateStyleObject(existingStyle, cssProp, cssValue)
      return `${prefix} style={{${updated}}}`
    })
  }

  // No existing style — insert one
  return source.replace(
    new RegExp(`(data-sk-id="${escapedId}")`, 'g'),
    `$1 style={{ ${cssProp}: '${cssValue}' }}`,
  )
}

function cssPropertyToJsKey(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function updateStyleObject(existing: string, key: string, value: string): string {
  const keyRegex = new RegExp(`${key}:\\s*'[^']*'|${key}:\\s*"[^"]*"`, 'g')
  if (keyRegex.test(existing)) {
    return existing.replace(keyRegex, `${key}: '${value}'`)
  }
  return `${existing.trimEnd()}, ${key}: '${value}'`
}

function sanitizeTextValue(value: string): string {
  return value.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c))
}

function sanitizeAttrValue(value: string): string {
  // Strip anything that could inject JSX or JS expressions
  return value.replace(/[{}\\]/g, '').slice(0, 500)
}
