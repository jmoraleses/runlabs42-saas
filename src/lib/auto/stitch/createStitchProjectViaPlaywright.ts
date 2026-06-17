import 'server-only'

import type { Page } from 'playwright'
import type { StitchDesignType } from '@/lib/auto/stitch/stitchDesignType'
import { parseStitchDesignType } from '@/lib/auto/stitch/stitchDesignType'
import { clampTopicMaxScreens, enrichTopicPromptForStitch } from '@/lib/auto/topicStitchPrompt'
import {
  clickFirstVisible,
  closeStitchSession,
  extractStitchProjectIdFromUrl,
  fillStitchPromptField,
  launchStitchBrowser,
  openStitchPage,
  resolveStitchDesignType,
  selectStitchDesignType,
  stitchAppFrame,
  stitchBaseUrl,
  submitStitchPrompt,
} from '@/lib/auto/stitch/stitchPlaywright.shared'

export type CreateStitchProjectViaPlaywrightOpts = {
  projectTitle: string
  prompt: string
  maxScreens?: number
  designType?: StitchDesignType
}

function collectProjectIdsFromFrames(page: Page): string[] {
  const ids: string[] = []
  for (const frame of page.frames()) {
    const fromUrl = extractStitchProjectIdFromUrl(frame.url())
    if (fromUrl) ids.push(fromUrl)
  }
  return ids
}

async function waitForProjectId(page: Page, timeoutMs: number): Promise<string | null> {
  const frame = stitchAppFrame(page)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const id of collectProjectIdsFromFrames(page)) {
      if (id) return id
    }

    const links = frame.locator('a[href*="/project"]')
    const count = await links.count().catch(() => 0)
    for (let i = 0; i < Math.min(count, 12); i++) {
      const href = await links.nth(i).getAttribute('href')
      const id = href ? extractStitchProjectIdFromUrl(href) : null
      if (id) return id
    }

    await page.waitForTimeout(4000)
  }
  return null
}

async function ensureStitchWorkspace(page: Page): Promise<void> {
  const base = stitchBaseUrl().replace(/\/+$/, '')
  await page.goto(`${base}/`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const frame = stitchAppFrame(page)
  const hasPrompt = await frame
    .locator('div[role="textbox"][contenteditable="true"]')
    .first()
    .isVisible({ timeout: 4000 })
    .catch(() => false)

  if (hasPrompt) return

  await clickFirstVisible(page, [
    frame.getByRole('button', { name: /empieza por tu diseño|new project|nuevo proyecto/i }),
    frame.getByRole('button', { name: /new project|new design|nuevo|crear|create/i }),
  ])
  await page.waitForTimeout(2500)
}

/**
 * Crea un proyecto en Stitch usando solo la web (Playwright), sin MCP/API.
 */
export async function createStitchProjectViaPlaywright(
  opts: CreateStitchProjectViaPlaywrightOpts,
): Promise<{ stitchProjectId: string; projectUrl: string }> {
  const projectTitle = String(opts.projectTitle ?? '').trim().slice(0, 80) || 'Auto project'
  const maxScreens = clampTopicMaxScreens(opts.maxScreens ?? 1)
  const designType = opts.designType ?? resolveStitchDesignType()
  const mainPrompt = enrichTopicPromptForStitch({
    prompt: String(opts.prompt ?? '').trim() || projectTitle,
    maxScreens,
    designType,
  })
  const combinedPrompt = `Project title: ${projectTitle}\n\n${mainPrompt}`

  const { browser, context, viaCdp } = await launchStitchBrowser()
  try {
    const page = await openStitchPage(context, '/')
    await ensureStitchWorkspace(page)
    await selectStitchDesignType(page, designType)

    const filled = await fillStitchPromptField(page, combinedPrompt)
    if (!filled) {
      if (process.env.STITCH_DEBUG_SCREENSHOT === '1') {
        const shot = `.tmp/stitch-debug-${Date.now()}.png`
        await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined)
        throw new Error(
          `No se encontró el campo de prompt en Stitch. Captura guardada en ${shot}. Prueba con STITCH_HEADLESS=0 y STITCH_CHROME_CDP_URL=http://127.0.0.1:9222`,
        )
      }
      throw new Error(
        'No se encontró el campo de prompt en Stitch. Abre stitch.withgoogle.com manualmente, crea un proyecto con el prompt, y usa la sección "Proyectos existentes" para importar. También puedes usar STITCH_HEADLESS=0 para ver el navegador.',
      )
    }

    await submitStitchPrompt(page)

    const waitMs = Number(process.env.STITCH_GENERATION_WAIT_MS || 180_000)
    let projectId = await waitForProjectId(page, waitMs)

    if (!projectId) {
      await page.goto(stitchBaseUrl(), { timeout: 90_000, waitUntil: 'domcontentloaded' })
      projectId = await waitForProjectId(page, 30_000)
    }

    if (!projectId) {
      throw new Error(
        'Stitch no devolvió projectId tras generar. Comprueba que la generación terminó en la UI (puede tardar 2–3 min).',
      )
    }

    const projectUrl = `${stitchBaseUrl().replace(/\/+$/, '')}/projects/${projectId}`

    if (maxScreens > 1) {
      await page.goto(projectUrl, { timeout: 90_000, waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3000)
      for (let i = 2; i <= maxScreens; i++) {
        await selectStitchDesignType(page, designType)
        const extra = `${mainPrompt}\n\nGenera la pantalla ${i} de ${maxScreens}, coherente con el proyecto y las pantallas ya generadas.`
        if (await fillStitchPromptField(page, extra)) {
          await submitStitchPrompt(page)
          await page.waitForTimeout(Math.min(waitMs, 180_000))
        }
      }
    }

    return { stitchProjectId: projectId, projectUrl }
  } finally {
    await closeStitchSession({ browser, context, viaCdp })
  }
}
