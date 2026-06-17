import type { DesignReferenceImage, DesignSpec } from '@/lib/design/types'
import { DESIGN_SPEC_JSON } from '@/lib/design/types'

export function parseDesignSpecJson(raw: string | null | undefined): DesignSpec | null {
  if (!raw?.trim()) return null
  try {
    return JSON.parse(raw) as DesignSpec
  } catch {
    return null
  }
}

export function mergeReferenceImagesIntoSpec(
  specContent: string,
  refs: DesignReferenceImage[],
): string {
  const spec = parseDesignSpecJson(specContent) ?? ({
    version: 2 as const,
    title: 'Diseño',
    summary: '',
    tokens: {},
  } satisfies DesignSpec)
  const existing = spec.referenceImages ?? []
  const byId = new Map(existing.map((r) => [r.id, r]))
  for (const r of refs) byId.set(r.id, r)
  const merged: DesignSpec = {
    ...spec,
    referenceImages: [...byId.values()].slice(-20),
  }
  return JSON.stringify(merged, null, 2)
}

export function findSpecInFiles(
  files: Array<{ path: string; content: string }>,
): { path: string; content: string } | undefined {
  return files.find((f) => f.path === DESIGN_SPEC_JSON)
}
