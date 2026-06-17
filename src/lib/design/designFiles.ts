import type { DesignPageFileRef } from '@/lib/design/pages'
import { DESIGN_SPEC_JSON, type DesignSpec } from '@/lib/design/types'

export function defaultDesignSpec(title: string): string {
  return JSON.stringify(
    {
      version: 1,
      title,
      summary: title,
      tokens: {
        colors: { primary: '#3b82f6', background: '#0f172a', text: '#f8fafc' },
        fonts: { body: 'system-ui', heading: 'system-ui' },
      },
    } satisfies DesignSpec,
    null,
    2,
  )
}

export function collectDesignHtmlPaths(files: DesignPageFileRef[]): string[] {
  return files
    .filter(
      (f) =>
        f.path === 'design/site/index.html' ||
        (f.path.startsWith('design/pages/') && f.path.endsWith('/index.html')),
    )
    .map((f) => f.path)
}

export function ensureDesignSpecFile(
  files: Array<{ path: string; content: string }>,
  title: string,
): Array<{ path: string; content: string }> {
  if (files.some((f) => f.path === DESIGN_SPEC_JSON)) return files
  return [
    ...files,
    { path: DESIGN_SPEC_JSON, content: defaultDesignSpec(title) },
  ]
}
