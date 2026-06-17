import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Download, FrameLocator, Page } from 'playwright'
import { exportStitchProjectZipViaMcp } from '@/lib/auto/stitch/exportStitchProjectZipViaMcp'
import { openStitchProjectByListTitle } from '@/lib/auto/stitch/stitchProjectListNav'
import { isStitchApiConfigured } from '@/lib/design/stitchMcpClient'
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
const THINKING_MAX_WAIT_MS = 50_000
const EXPORT_PANEL_READY_MS = 22_000

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

function stitchTopExportButton(frame: FrameLocator) {
  return frame.getByRole('button', { name: /^(exportar|export)$/i }).first()
}

function stitchPanelExportButton(frame: FrameLocator) {
  return frame.getByRole('button', { name: /^(exportar|export)$/i }).last()
}

async function dismissStitchOverlays(page: Page, frame: FrameLocator): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => undefined)
    await page.waitForTimeout(180)
  }
  const googleAccountMenu = page.getByText(/cerrar sesión|sign out/i).first()
  if (await googleAccountMenu.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.mouse.click(96, 96)
    await page.waitForTimeout(350)
    await page.keyboard.press('Escape').catch(() => undefined)
  }
  await frame.locator('body').click({ position: { x: 360, y: 320 } }).catch(() => undefined)
  await page.waitForTimeout(200)
}

async function isStitchCanvasBusy(frame: FrameLocator): Promise<boolean> {
  const busyText = frame.getByText(/thinking|pensando|generando/i).first()
  if (await busyText.isVisible({ timeout: 500 }).catch(() => false)) return true
  const panelExport = stitchPanelExportButton(frame)
  if (await panelExport.isVisible({ timeout: 400 }).catch(() => false)) {
    return !(await panelExport.isEnabled().catch(() => true))
  }
  return false
}

async function cancelStitchInProgressGeneration(page: Page, frame: FrameLocator): Promise<boolean> {
  const stopLocators = [
    frame.getByRole('button', { name: /detener|stop|cancelar|cancel/i }),
    frame.locator('button[aria-label*="Detener" i], button[aria-label*="Stop" i]'),
  ]
  for (const locator of stopLocators) {
    const target = locator.first()
    if (await target.isVisible({ timeout: 1200 }).catch(() => false)) {
      await target.click({ timeout: MENU_CLICK_TIMEOUT_MS }).catch(() => undefined)
      await page.waitForTimeout(1500)
      return true
    }
  }
  return false
}

async function focusProjectCanvas(page: Page, frame: FrameLocator): Promise<void> {
  await dismissStitchOverlays(page, frame)
  await frame.locator('body').click({ position: { x: 360, y: 320 } }).catch(() => undefined)
  await page.waitForTimeout(300)
}

async function selectAllStitchScreens(page: Page, frame: FrameLocator): Promise<void> {
  await focusProjectCanvas(page, frame)
  await page.keyboard.press('Meta+a').catch(() => undefined)
  await page.keyboard.press('Control+a').catch(() => undefined)
  await page.waitForTimeout(700)
}

/** Selecciona al menos una pantalla (miniaturas del lienzo o lista lateral). */
async function ensureStitchScreensSelected(page: Page, frame: FrameLocator): Promise<void> {
  const noSelection = frame.getByText(/no hay pantallas seleccionadas|no screens selected/i)
  if (!(await noSelection.isVisible({ timeout: 1200 }).catch(() => false))) return

  await selectAllStitchScreens(page, frame)
  if (!(await noSelection.isVisible({ timeout: 1200 }).catch(() => false))) return

  const thumbCandidates = [
    frame.locator('[class*="thumbnail" i], [class*="Thumbnail"]').first(),
    frame.locator('img').nth(2),
    frame.locator('li[role="button"]').nth(1),
  ]
  for (const thumb of thumbCandidates) {
    if (await thumb.isVisible({ timeout: 1500 }).catch(() => false)) {
      await thumb.click({ timeout: MENU_CLICK_TIMEOUT_MS }).catch(() => undefined)
      await page.waitForTimeout(400)
      break
    }
  }
  await page.keyboard.press('Meta+a').catch(() => undefined)
  await page.keyboard.press('Control+a').catch(() => undefined)
  await page.waitForTimeout(500)
}

async function reloadStitchProjectView(page: Page): Promise<void> {
  const url = page.url()
  if (!/\/projects?\//i.test(url)) return
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
  await waitForStitchAppFrame(page)
  await page.waitForTimeout(2500)
}

/**
 * Si el proyecto quedó en «Thinking…», Stitch deshabilita la exportación ZIP.
 * Cancelamos, recargamos o esperamos hasta que el panel de exportación esté usable.
 */
async function recoverStitchProjectForExport(page: Page, frame: FrameLocator): Promise<void> {
  await dismissStitchOverlays(page, frame)

  const thinkingDeadline = Date.now() + THINKING_MAX_WAIT_MS
  while (Date.now() < thinkingDeadline) {
    if (!(await isStitchCanvasBusy(frame))) break
    await page.waitForTimeout(1000)
  }

  if (await isStitchCanvasBusy(frame)) {
    await cancelStitchInProgressGeneration(page, frame)
    await dismissStitchOverlays(page, frame)
  }

  if (await isStitchCanvasBusy(frame)) {
    await reloadStitchProjectView(page)
    await dismissStitchOverlays(page, frame)
  }

  await ensureStitchScreensSelected(page, frame)
}

async function waitForStitchExportPanelReady(page: Page, frame: FrameLocator): Promise<boolean> {
  const deadline = Date.now() + EXPORT_PANEL_READY_MS
  while (Date.now() < deadline) {
    await dismissStitchOverlays(page, frame)
    const topExport = stitchTopExportButton(frame)
    if (await topExport.isVisible({ timeout: 2000 }).catch(() => false)) {
      await topExport.click({ timeout: MENU_CLICK_TIMEOUT_MS }).catch(() => undefined)
      await page.waitForTimeout(600)
    }

    const zipRadio = frame.getByRole('radio', { name: /\.zip|^zip$/i }).first()
    const panelExport = stitchPanelExportButton(frame)
    const zipReady = await zipRadio.isVisible({ timeout: 800 }).catch(() => false)
    const panelReady =
      (await panelExport.isVisible({ timeout: 800 }).catch(() => false)) &&
      (await panelExport.isEnabled().catch(() => false))

    if (zipReady || panelReady) return true

    if (await isStitchCanvasBusy(frame)) {
      await cancelStitchInProgressGeneration(page, frame)
    } else {
      await ensureStitchScreensSelected(page, frame)
    }
    await page.waitForTimeout(900)
  }
  return false
}

/** Espera a que el lienzo deje de bloquear la exportación ZIP. */
async function waitForStitchProjectCanvasReady(page: Page, frame: FrameLocator): Promise<void> {
  await recoverStitchProjectForExport(page, frame)
  const topExport = stitchTopExportButton(frame)
  await topExport.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => undefined)
  await waitForStitchExportPanelReady(page, frame)
  await page.waitForTimeout(500)
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
  await dismissStitchOverlays(page, frame)
  const exportBtn = stitchTopExportButton(frame)
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

/** En el panel lateral, elige el formato .zip (por defecto Stitch marca AI Studio). */
async function selectStitchZipExportFormat(page: Page, frame: FrameLocator): Promise<boolean> {
  const zipRadio = frame.getByRole('radio', { name: /\.zip|^zip$/i }).first()
  if (await zipRadio.isVisible({ timeout: 4000 }).catch(() => false)) {
    const checked = await zipRadio.isChecked().catch(() => false)
    if (!checked) {
      await zipRadio.click({ timeout: MENU_CLICK_TIMEOUT_MS })
      await page.waitForTimeout(500)
    }
    return true
  }

  const zipLabel = frame.getByText(/^\.zip$/i).first()
  if (await zipLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipLabel.click({ timeout: MENU_CLICK_TIMEOUT_MS })
    await page.waitForTimeout(500)
    return true
  }

  return false
}

/** UI actual: panel lateral con botón Exportar al pie (requiere pantallas + formato .zip). */
async function clickStitchExportPanelButton(page: Page, frame: FrameLocator): Promise<boolean> {
  await ensureStitchScreensSelected(page, frame)

  const panelExport = stitchPanelExportButton(frame)
  const ready = await waitForStitchExportPanelReady(page, frame)
  if (!ready) {
    await recoverStitchProjectForExport(page, frame)
    if (!(await openStitchExportMenu(page, frame))) return false
  }

  await selectStitchZipExportFormat(page, frame)

  if (!(await panelExport.isVisible({ timeout: 6000 }).catch(() => false))) return false

  for (let attempt = 0; attempt < 18; attempt++) {
    if (await panelExport.isEnabled().catch(() => false)) {
      await panelExport.click({ timeout: MENU_CLICK_TIMEOUT_MS })
      return true
    }
    if (attempt === 8) await ensureStitchScreensSelected(page, frame)
    if (attempt === 16) await cancelStitchInProgressGeneration(page, frame)
    await page.waitForTimeout(1000)
  }
  return false
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
  await recoverStitchProjectForExport(page, frame)
  await waitForStitchProjectCanvasReady(page, frame)

  const strategies: Array<() => Promise<Download | null>> = [
    () =>
      waitForStitchDownload(page, async () => {
        await selectAllStitchScreens(page, frame)
        if (!(await openStitchExportMenu(page, frame))) {
          throw new Error('export panel unavailable')
        }
        if (!(await clickStitchExportPanelButton(page, frame))) {
          throw new Error('export panel button unavailable')
        }
      }),
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
        await selectAllStitchScreens(page, frame)
        await page.keyboard.press('Shift+D')
        await page.waitForTimeout(600)
        if (await clickStitchDownloadEntry(page, frame)) return
        if (await clickStitchExportPanelButton(page, frame)) return
        throw new Error('download entry unavailable after shortcut')
      }),
    () =>
      waitForStitchDownload(page, async () => {
        await selectAllStitchScreens(page, frame)
        if (!(await openStitchExportMenu(page, frame))) {
          throw new Error('export menu unavailable after select-all')
        }
        if (await clickStitchExportPanelButton(page, frame)) return
        if (await clickStitchDownloadEntry(page, frame)) return
        throw new Error('download entry unavailable after select-all')
      }),
  ]

  for (const strategy of strategies) {
    const download = await strategy()
    if (download) return download
  }

  const stillThinking = await isStitchCanvasBusy(frame)
  const screenshot = await captureStitchExportDebug(page)
  const hint = screenshot
    ? ` Captura de depuración: ${screenshot}.`
    : ''
  const busyHint = stillThinking
    ? ' El proyecto sigue en «Thinking…»/generación; espera a que termine en stitch.withgoogle.com o vuelve a intentar.'
    : ''
  throw new Error(
    `No se pudo iniciar la descarga ZIP en Stitch (Exportar/Descargar). Comprueba que el proyecto cargue en stitch.withgoogle.com y que la sesión Playwright esté activa (pnpm stitch:auth).${busyHint}${hint}`,
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

  if (stitchProjectId && (await isStitchApiConfigured())) {
    try {
      return await exportStitchProjectZipViaMcp({ stitchProjectId, projectTitle })
    } catch {
      /* reintento por UI Playwright */
    }
  }

  const { browser, context, viaCdp } = await launchStitchBrowser()
  let playwrightError: Error | null = null

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
    await recoverStitchProjectForExport(page, stitchAppFrame(page))

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
  } catch (e) {
    playwrightError = e instanceof Error ? e : new Error(String(e))
  } finally {
    await closeStitchSession({ browser, context, viaCdp })
  }

  if (stitchProjectId && (await isStitchApiConfigured())) {
    try {
      return await exportStitchProjectZipViaMcp({ stitchProjectId, projectTitle })
    } catch {
      /* conservar error Playwright con captura */
    }
  }

  throw playwrightError ?? new Error('Exportación Stitch fallida')
}
