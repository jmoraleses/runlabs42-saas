import { readFileSync } from 'fs'
import { join } from 'path'
import { importDesignHtmlToWorkspace } from '@/lib/design/importDesignHtml'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'

let cachedHtml: string | null = null

/** HTML de la pantalla Studio (semilla local en el repo). */
export function getWebStudioStudioHtml(): string {
  if (cachedHtml) return cachedHtml
  const path = join(process.cwd(), 'src/lib/design/seeds/web-studio-studio.html')
  cachedHtml = readFileSync(path, 'utf8')
  return cachedHtml
}

/** Escribe design/pages/studio/index.html + spec/design.json en el proyecto. */
export async function applyWebStudioStudioSeed(
  ctx: ProjectFilesContext,
  appProjectId: string,
  htmlOverride?: string,
) {
  return importDesignHtmlToWorkspace(ctx, appProjectId, {
    pageId: 'studio',
    pageName: 'Studio',
    html: htmlOverride?.trim() || getWebStudioStudioHtml(),
    width: 1440,
    height: 900,
    source: 'vertex',
    includePrototypeLinks: false,
  })
}
