import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Download, FrameLocator, Page } from 'playwright'
import { openStitchProjectByListTitle } from '@/lib/auto/stitch/stitchProjectListNav'
import {
  closeStitchSession,
  launchStitchBrowser,
  openStitchPage,
  stitchAppFrame,
  waitForStitchAppFrame,
} from '@/lib/auto/stitch/stitchPlaywright.shared'

type ExportOpts = {
  stitchProjectId?: string
  projectTitle?: string
}

const DOWNLOAD_EVENT_TIMEOUT_MS = 90_000
const MENU_CLICK_TIMEOUT_MS = 20_000

function safeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function clickStitchDownloadEntry(page: Page, frame: FrameLocator): Promise<boolean> {
  const locators = [
    frame.getByRole('menuitem', { name: /descargar|download/i }),
    frame.getByRole('button', { name: /descargar|download/i }),
    frame.locator('[role="menuitem"]').filter({ hasText: /descargar|download/i }),
    frame.getByText(/^(descargar|download)(\s+zip)?$/i),
    page.getByRole('menuitem', { name: /descargar|download/i }),
    page.getByRole('button', { name: /descargar|download/i }),
  ]

  for (const locator of locators) {
    const target = locator.first()
    if (await target.isVisible({ timeout: 2500 }).catch(() => false)) {
      await target.click({ timeout: MENU_CLICK_TIMEOUT_MS })
      return true
    }
  }
  return false
}

async function openStitchExportMenu(page: Page, frame: FrameLocator): Promise<boolean> {
  const exportBtn = frame.getByRole('button', { name: /^(exportar|export)$/i }).first()
  if (await exportBtn.isVisible({ timeout: 12_000 }).catch(() => false)) {
    await exportBtn.click({ timeout: MENU_CLICK_TIMEOUT_MS })
    await page.waitForTimeout(700)
    return true
  }

  const moreBtn = frame
    .getByRole('button', { name: /más|more|opciones|options|menú|menu/i })
    .first()
  if (await moreBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await moreBtn.click({ timeout: MENU_CLICK_TIMEOUT_MS })
    await page.waitForTimeout(500)
    const exportInMenu = frame.getByRole('menuitem', { name: /exportar|export/i }).first()
    if (await exportInMenu.isVisible({ timeout: 4000 }).catch(() => false)) {
      await exportInMenu.click({ timeout: MENU_CLICK_TIMEOUT_MS })
      await page.waitForTimeout(600)
      return true
    }
  }

  return false
}

async function focusProjectCanvas(page: Page, frame: FrameLocator): Promise<void> {
  await frame.locator('body').click({ position: { x: 520, y: 420 } }).catch(() => undefined)
  await page.keyboard.press('Meta+a').catch(() => undefined)
  await page.waitForTimeout(400)
}

async function waitForStitchDownload(
  page: Page,
  trigger: () => Promise<void>,
): Promise<Download | null> {
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: DOWNLOAD_EVENT_TIMEOUT_MS }),
      trigger(),
    ])
    return download
  } catch {
    return null
  }
}

async function captureStitchExportDebug(page: Page): Promise<string | null> {
  try {
    const debugDir = path.join(process.cwd(), '.tmp', 'stitch-export-debug')
    await ensureDir(debugDir)
    const outPath = path.join(debugDir, `export-fail-${Date.now()}.png`)
    await page.screenshot({ path: outPath, fullPage: true })
    return outPath
  } catch {
    return null
  }
}

async function triggerStitchZipDownload(page: Page): Promise<Download> {
  const frame = stitchAppFrame(page)
  await page.waitForTimeout(2000)

  const strategies: Array<() => Promise<Download | null>> = [
    () =>
      waitForStitchDownload(page, async () => {
        if (!(await openStitchExportMenu(page, frame))) {
          throw new Error('export menu unavailable')
        }
        if (!(await clickStitchDownloadEntry(page, frame))) {
          throw new Error('download entry unavailable')
        }
      }),
    () =>
      waitForStitchDownload(page, async () => {
        await focusProjectCanvas(page, frame)
        await page.keyboard.press('Shift+D')
        await page.waitForTimeout(600)
        if (await clickStitchDownloadEntry(page, frame)) return
        await page.waitForTimeout(800)
        if (await clickStitchDownloadEntry(page, frame)) return
        throw new Error('download entry unavailable after shortcut')
      }),
    () =>
      waitForStitchDownload(page, async () => {
        await focusProjectCanvas(page, frame)
        if (!(await openStitchExportMenu(page, frame))) {
          throw new Error('export menu unavailable after select-all')
        }
        if (!(await clickStitchDownloadEntry(page, frame))) {
          throw new Error('download entry unavailable after select-all')
        }
      }),
    () =>
      waitForStitchDownload(page, async () => {
        await focusProjectCanvas(page, frame)
        await page.keyboard.press('Control+Shift+D').catch(() => undefined)
        await page.waitForTimeout(600)
        if (await clickStitchDownloadEntry(page, frame)) return
        throw new Error('download entry unavailable after ctrl+shift+d')
      }),
  ]

  for (const strategy of strategies) {
    const download = await strategy()
    if (download) return download
  }

  const screenshot = await captureStitchExportDebug(page)
  const hint = screenshot
    ? ` Captura de depuración: ${screenshot}.`
    : ''
  throw new Error(
    `No se pudo iniciar la descarga ZIP en Stitch (Exportar/Descargar). Comprueba que el proyecto cargue en stitch.withgoogle.com y que la sesión Playwright esté activa (pnpm stitch:auth).${hint}`,
  )
}

export async function exportStitchProjectZipViaPlaywright(
  opts: ExportOpts,
): Promise<{ zipPath: string; stitchProjectId: string }> {
  const projectTitle = String(opts.projectTitle ?? '').trim()
  let stitchProjectId = String(opts.stitchProjectId ?? '').trim()

  if (!stitchProjectId && !projectTitle) {
    throw new Error('stitchProjectId o projectTitle requerido para exportar ZIP')
  }

  const { browser, context, viaCdp } = await launchStitchBrowser()

  try {
    const page = stitchProjectId
      ? await openStitchPage(context, `/projects/${encodeURIComponent(stitchProjectId)}`)
      : await openStitchPage(context, '/')

    if (!stitchProjectId) {
      stitchProjectId = (await openStitchProjectByListTitle(page, projectTitle)) ?? ''
      if (!stitchProjectId) {
        throw new Error(`No se encontró el proyecto «${projectTitle}» en la lista de Stitch`)
      }
    }

    await waitForStitchAppFrame(page)

    const downloadDir =
      process.env.STITCH_EXPORT_DOWNLOAD_DIR?.trim() ||
      path.join(process.cwd(), '.tmp', 'stitch-downloads')
    await ensureDir(downloadDir)

    const download = await triggerStitchZipDownload(page)
    const suggested =
      download.suggestedFilename() || `${safeName(opts.projectTitle || stitchProjectId)}.zip`
    const filename = suggested.toLowerCase().endsWith('.zip') ? suggested : `${suggested}.zip`
    const outPath = path.join(downloadDir, `${Date.now()}-${safeName(filename)}`)
    await download.saveAs(outPath)
    return { zipPath: outPath, stitchProjectId }
  } finally {
    await closeStitchSession({ browser, context, viaCdp })
  }
}
