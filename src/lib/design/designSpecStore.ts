import { parseDesignSpec } from '@/lib/design/pages'
import { DESIGN_SPEC_JSON, type DesignSpec } from '@/lib/design/types'
import type { ProjectFileRecord } from '@/lib/storage/projectFiles'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

export function readDesignSpecFromFiles(files: ProjectFileRecord[]): DesignSpec | null {
  const raw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content
  return parseDesignSpec(raw)
}

export async function loadDesignSpec(
  ctx: ProjectFilesContext,
): Promise<{ spec: DesignSpec | null; raw: string | null }> {
  const files = await ctx.store.list()
  const raw = files.find((f) => f.path === DESIGN_SPEC_JSON)?.content ?? null
  return { spec: parseDesignSpec(raw), raw }
}

export async function saveDesignSpec(ctx: ProjectFilesContext, spec: DesignSpec): Promise<void> {
  await ctx.store.put(DESIGN_SPEC_JSON, JSON.stringify(spec, null, 2))
}
