import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { StitchReferenceBundle } from '@/lib/design/stitchParity'

const REF_ROOT = resolve(process.cwd(), 'uploads', 'stitch-reference')

export function stitchReferenceDir(projectId: string): string {
  const id = projectId.replace(/^projects\//, '')
  return resolve(REF_ROOT, id)
}

/** Carga referencia sincronizada desde uploads/stitch-reference/{projectId}/ */
export function loadStitchReference(
  projectId: string,
  screenId?: string,
): StitchReferenceBundle | null {
  const dir = stitchReferenceDir(projectId)
  const designPath = resolve(dir, 'design.md')
  if (!existsSync(designPath)) return null

  const designMd = readFileSync(designPath, 'utf8')
  const metaPath = resolve(dir, 'meta.json')
  let meta: { title?: string; screenId?: string; screenTitle?: string } = {}
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    } catch {
      /* ignore */
    }
  }

  const sid = screenId ?? meta.screenId
  const htmlPath = sid ? resolve(dir, `screen-${sid}.html`) : resolve(dir, 'screen.html')
  const pngPath = sid ? resolve(dir, `screen-${sid}.png`) : resolve(dir, 'screen.png')
  const promptPath = resolve(dir, 'prompt.txt')

  return {
    projectId: projectId.replace(/^projects\//, ''),
    screenId: sid,
    title: meta.title,
    designMd,
    referenceHtml: existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : undefined,
    referencePrompt: existsSync(promptPath) ? readFileSync(promptPath, 'utf8').trim() : undefined,
    screenshotPath: existsSync(pngPath) ? pngPath : undefined,
  }
}

export function resolveStitchReferenceForOrchestration(
  briefProjectId?: string,
): StitchReferenceBundle | null {
  const fromBrief = briefProjectId?.trim()
  const fromEnv = process.env.STITCH_REFERENCE_PROJECT?.trim()
  const id = fromBrief || fromEnv
  if (!id) return null
  return loadStitchReference(id, process.env.STITCH_REFERENCE_SCREEN?.trim())
}
