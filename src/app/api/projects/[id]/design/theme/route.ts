import { NextResponse } from 'next/server'
export { dynamic } from '@/lib/api/routeSegment'
import { jsonError, ApiError } from '@/lib/api/errors'
import { requireStreamUser } from '@/lib/auth/requireStreamUser'
import { applyThemeToHtml } from '@/lib/design/applyThemeToHtml'
import { listDesignPageFiles, parseDesignSpec } from '@/lib/design/pages'
import { ensureDesignTokens } from '@/lib/design/themeTokens'
import { DESIGN_SPEC_JSON, DESIGN_SPEC_MD, type DesignTokens } from '@/lib/design/types'
import { requireDesignRouteContext } from '@/lib/design/requireDesignRoute'

type Params = { params: Promise<{ id: string }> }

function mergeTokens(specTokens: DesignTokens | undefined, body: Record<string, unknown>): DesignTokens {
  const fromBody = body.tokens as DesignTokens | undefined
  const colorsIn = (fromBody?.colors ?? body.colors) as Record<string, string> | undefined
  const merged: DesignTokens = {
    ...specTokens,
    ...fromBody,
    colorMode:
      fromBody?.colorMode === 'dark' || body.colorMode === 'dark'
        ? 'dark'
        : fromBody?.colorMode === 'light' || body.colorMode === 'light'
          ? 'light'
          : specTokens?.colorMode,
    colors: {
      ...specTokens?.colors,
      ...colorsIn,
      ...(body.primary ? { primary: String(body.primary) } : {}),
      ...(body.background ? { background: String(body.background) } : {}),
      ...(body.secondary ? { secondary: String(body.secondary) } : {}),
      ...(body.tertiary ? { tertiary: String(body.tertiary) } : {}),
      ...(body.neutral ? { neutral: String(body.neutral) } : {}),
      ...(body.seed ? { seed: String(body.seed) } : {}),
    },
    fonts: {
      body: 'Inter, system-ui, sans-serif',
      heading: 'Inter, system-ui, sans-serif',
      ...specTokens?.fonts,
      ...fromBody?.fonts,
      ...(body.bodyFont
        ? { body: String(body.bodyFont), heading: String(body.bodyFont) }
        : {}),
    },
  }
  return ensureDesignTokens(merged, merged.colorMode)
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: projectId } = await params
    await requireStreamUser()
    const body = await request.json()
    const ctx = await requireDesignRouteContext(projectId)
    const files = await ctx.store.list()
    const specRaw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
    let spec = parseDesignSpec(specRaw)
    if (!spec) throw new ApiError(400, 'Sin spec de diseño')

    const tokens = mergeTokens(spec.tokens, body as Record<string, unknown>)
    spec = { ...spec, tokens }

    const htmlFiles = listDesignPageFiles(files)
    const updates: Array<{ path: string; content: string }> = [
      { path: DESIGN_SPEC_JSON, content: JSON.stringify(spec, null, 2) },
    ]

    const designMd =
      typeof body.designMd === 'string' ? String(body.designMd) : null
    if (designMd != null) {
      updates.push({ path: DESIGN_SPEC_MD, content: designMd })
    }

    for (const meta of htmlFiles) {
      const f = files.find((x) => x.path === meta.path)
      if (f) updates.push({ path: f.path, content: applyThemeToHtml(f.content, spec) })
    }
    await ctx.store.putMany(updates)
    return NextResponse.json({
      ok: true,
      updated: updates.map((u) => u.path),
      tokens: spec.tokens,
    })
  } catch (e) {
    return jsonError(e)
  }
}
