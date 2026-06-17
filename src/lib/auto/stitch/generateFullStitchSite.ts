import 'server-only'

import {
  createStitchProject,
  fetchStitchScreenAssets,
  generateStitchScreen,
  listStitchScreens,
  normalizeStitchScreenId,
  screenIdsFromList,
  waitForNewStitchScreen,
  type GenerateStitchScreenOpts,
} from '@/lib/design/stitchMcpClient'
import type { AutoRunSend, AutoScreenPrompt } from '@/lib/auto/types'

export type StitchScreenWithBuffers = {
  pageId: string
  screenId: string
  title: string
  htmlPath: string
  pngPath: string
  html: string
  pngBase64: string
}

export type GenerateFullStitchSiteResult = {
  stitchProjectId: string
  screens: StitchScreenWithBuffers[]
}

export async function generateFullStitchSite(opts: {
  niche: string
  stitchProjectId?: string
  createStitchProject: boolean
  screenPrompts: AutoScreenPrompt[]
  selectedThemeName?: string
  deviceType: GenerateStitchScreenOpts['deviceType']
  send: AutoRunSend
}): Promise<GenerateFullStitchSiteResult> {
  let projectId = opts.stitchProjectId?.trim()
  if (!projectId && opts.createStitchProject) {
    opts.send({ phase: 'stitch-connect', message: 'Creando proyecto Stitch…' })
    projectId = await createStitchProject(opts.niche.slice(0, 80) || 'Auto store')
  }
  if (!projectId) {
    throw new Error('Indica stitchProjectId o activa createStitchProject')
  }

  const screens: StitchScreenWithBuffers[] = []
  const total = opts.screenPrompts.length

  for (let i = 0; i < total; i++) {
    const sp = opts.screenPrompts[i]!
    opts.send({
      phase: 'stitch-generate-screens',
      message: opts.selectedThemeName
        ? `Generando pantalla ${sp.name} (tema: ${opts.selectedThemeName})…`
        : `Generando pantalla ${sp.name}…`,
      progress: `${i + 1}/${total}`,
      pageId: sp.id,
    })

    const known = screenIdsFromList(await listStitchScreens(projectId))
    await generateStitchScreen(projectId, sp.prompt, { deviceType: opts.deviceType })
    const novel = await waitForNewStitchScreen(projectId, known, {
      timeoutMs: 240_000,
      intervalMs: 6_000,
    })
    const screenId = normalizeStitchScreenId(novel.name ?? '')

    opts.send({
      phase: 'stitch-fetch-assets',
      message: opts.selectedThemeName
        ? `Descargando assets ${sp.name} (tema: ${opts.selectedThemeName})…`
        : `Descargando assets ${sp.name}…`,
      progress: `${i + 1}/${total}`,
      pageId: sp.id,
    })

    const assets = await fetchStitchScreenAssets(projectId, screenId)
    screens.push({
      pageId: sp.id,
      screenId,
      title: assets.title || sp.name,
      htmlPath: `spec/inspiration/stitch/screens/${screenId}/screen.html`,
      pngPath: `spec/inspiration/stitch/screens/${screenId}/screen.png`,
      html: assets.html,
      pngBase64: assets.png.toString('base64'),
    })
  }

  return { stitchProjectId: projectId, screens }
}
