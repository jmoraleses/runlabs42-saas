import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Browser, BrowserContext, FrameLocator, Page } from 'playwright'

export const DEFAULT_STITCH_WEB_BASE_URL = 'https://stitch.withgoogle.com'
export function resolveStitchAccountEmail(): string {
  const email = process.env.STITCH_ACCOUNT_EMAIL?.trim().toLowerCase()
  if (!email) {
    throw new Error('Falta STITCH_ACCOUNT_EMAIL en .env.local para usar Stitch.')
  }
  return email
}

export function resolveStitchStorageStatePath(): string {
  const fromEnv = process.env.STITCH_PLAYWRIGHT_STORAGE_STATE?.trim()
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv)
  return path.join(process.cwd(), '.auth', 'stitch-storage-state.json')
}

/** Perfil persistente de Google Chrome (no Chromium embebido). */
export function resolveChromeUserDataDir(): string {
  const fromEnv = process.env.STITCH_CHROME_USER_DATA_DIR?.trim()
  if (fromEnv) {
    const expanded = fromEnv.replace(/^~(?=$|[/\\])/, process.env.HOME || '')
    return path.isAbsolute(expanded) ? expanded : path.join(process.cwd(), expanded)
  }
  return path.join(process.cwd(), '.auth', 'chrome-stitch-profile')
}

export async function stitchPlaywrightStorageExists(): Promise<boolean> {
  try {
    const p = resolveStitchStorageStatePath()
    const raw = await fs.readFile(p, 'utf8')
    const parsed = JSON.parse(raw) as { cookies?: unknown[] }
    return Array.isArray(parsed.cookies) && parsed.cookies.length > 0
  } catch {
    return false
  }
}

export async function stitchChromeProfileReady(): Promise<boolean> {
  try {
    const dir = resolveChromeUserDataDir()
    await fs.access(path.join(dir, 'Local State'))
    return true
  } catch {
    return false
  }
}

export async function stitchPlaywrightStorageMatchesRequiredEmail(): Promise<boolean> {
  const requiredEmail = process.env.STITCH_ACCOUNT_EMAIL?.trim().toLowerCase()
  if (!requiredEmail) return false
  try {
    const p = resolveStitchStorageStatePath()
    const raw = (await fs.readFile(p, 'utf8')).toLowerCase()
    return raw.includes(requiredEmail)
  } catch {
    return false
  }
}

export async function isStitchSessionReady(): Promise<boolean> {
  if (await stitchPlaywrightStorageExists()) return true
  return stitchChromeProfileReady()
}

export async function isChromeProfileLocked(): Promise<boolean> {
  try {
    await fs.access(path.join(resolveChromeUserDataDir(), 'SingletonLock'))
    return true
  } catch {
    return false
  }
}

function isProcessSingletonError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /ProcessSingleton|SingletonLock|profile is already in use/i.test(msg)
}

type LaunchStitchChromeOpts = {
  headless?: boolean
  preferCdp?: boolean
}

async function connectStitchOverCdp(
  chromium: typeof import('playwright')['chromium'],
  cdpUrl: string,
): Promise<{ browser: Browser; context: BrowserContext; viaCdp: boolean }> {
  const browser = await chromium.connectOverCDP(cdpUrl)
  const context =
    browser.contexts()[0] ?? (await browser.newContext({ acceptDownloads: true }))
  return { browser, context, viaCdp: true }
}

async function launchStitchWithStorageState(
  chromium: typeof import('playwright')['chromium'],
  headless: boolean,
): Promise<{ browser: Browser; context: BrowserContext; viaCdp: boolean }> {
  if (!(await stitchPlaywrightStorageExists())) {
    throw new Error(
      'Perfil Chrome en uso y sin storage guardado. Pulsa ENTER en la terminal de pnpm stitch:auth o cierra esa ventana de Chrome.',
    )
  }
  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
  })
  const context = await browser.newContext({
    acceptDownloads: true,
    storageState: resolveStitchStorageStatePath(),
  })
  return { browser, context, viaCdp: false }
}

/**
 * Abre Google Chrome real (channel: chrome), no el Chromium de Playwright.
 * - STITCH_CHROME_CDP_URL: conecta a tu Chrome ya abierto (remote debugging).
 * - STITCH_CHROME_USER_DATA_DIR: perfil Chrome (tu habitual si apuntas a ~/Library/.../Chrome).
 */
export async function launchStitchChrome(opts: LaunchStitchChromeOpts = {}): Promise<{
  browser: Browser
  context: BrowserContext
  viaCdp: boolean
}> {
  const { chromium } = await import('playwright')
  const cdpUrl = process.env.STITCH_CHROME_CDP_URL?.trim() || 'http://127.0.0.1:9222'
  const headless = opts.headless ?? process.env.STITCH_HEADLESS === '1'
  const tryCdp = process.env.STITCH_CHROME_CDP_URL !== '0'

  if (tryCdp) {
    try {
      return await connectStitchOverCdp(chromium, cdpUrl)
    } catch {
      /* sigue con otras estrategias */
    }
  }

  const profileLocked = await isChromeProfileLocked()
  if (profileLocked) {
    try {
      return await connectStitchOverCdp(chromium, cdpUrl)
    } catch {
      return launchStitchWithStorageState(chromium, headless)
    }
  }

  const userDataDir = resolveChromeUserDataDir()
  await fs.mkdir(userDataDir, { recursive: true })

  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',
      headless,
      acceptDownloads: true,
      viewport: null,
      args: ['--disable-blink-features=AutomationControlled'],
    })
    const browser = context.browser()
    if (!browser) {
      throw new Error('No se pudo iniciar Google Chrome para Stitch')
    }
    return { browser, context, viaCdp: false }
  } catch (e) {
    if (!isProcessSingletonError(e)) throw e
    try {
      return await connectStitchOverCdp(chromium, cdpUrl)
    } catch {
      return launchStitchWithStorageState(chromium, headless)
    }
  }
}

export async function closeStitchSession(opts: {
  browser: Browser
  context: BrowserContext
  viaCdp: boolean
}): Promise<void> {
  if (opts.viaCdp) {
    await opts.browser.close().catch(() => undefined)
    return
  }
  await opts.context.close().catch(() => undefined)
  await opts.browser.close().catch(() => undefined)
}

export async function launchStitchBrowser(): Promise<{
  browser: Browser
  context: BrowserContext
  viaCdp: boolean
}> {
  if (!(await isStitchSessionReady())) {
    throw new Error(
      'Falta sesión Stitch. Ejecuta: pnpm stitch:auth (define STITCH_ACCOUNT_EMAIL en .env.local). ' +
        'Para usar tu Chrome habitual: cierra Chrome, luego pnpm stitch:chrome-cdp y STITCH_CHROME_CDP_URL=http://127.0.0.1:9222 pnpm stitch:auth',
    )
  }

  return launchStitchChrome({
    headless: process.env.STITCH_HEADLESS !== '0',
    preferCdp: true,
  })
}

export function stitchBaseUrl(): string {
  return process.env.STITCH_WEB_BASE_URL?.trim() || DEFAULT_STITCH_WEB_BASE_URL
}

export function isStitchNavigationAbortError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /ERR_ABORTED|NS_BINDING_ABORTED|frame was detached|Navigation failed/i.test(msg)
}

/** goto tolerante a abortos SPA/redirect en stitch.withgoogle.com */
export async function safeStitchGoto(page: Page, targetPath = '/'): Promise<void> {
  const base = stitchBaseUrl().replace(/\/+$/, '')
  const suffix = targetPath.startsWith('/') ? targetPath : `/${targetPath}`
  const url = `${base}${suffix}`

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, {
        timeout: 90_000,
        waitUntil: attempt < 2 ? 'domcontentloaded' : 'commit',
      })
      await waitForStitchAppFrame(page).catch(() => undefined)
      return
    } catch (e) {
      lastError = e
      if (!isStitchNavigationAbortError(e)) throw e
      const shellReady = await page
        .locator('iframe[src*="app-companion"], iframe[title*="Stitch" i]')
        .first()
        .waitFor({ state: 'attached', timeout: 20_000 })
        .then(() => true)
        .catch(() => false)
      if (shellReady) {
        await waitForStitchAppFrame(page).catch(() => undefined)
        return
      }
      await page.waitForTimeout(700 + attempt * 500)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function openStitchPage(
  context: BrowserContext,
  targetPath = '/',
): Promise<Page> {
  const page = context.pages()[0] ?? (await context.newPage())
  await safeStitchGoto(page, targetPath)
  return page
}

/** La UI real de Stitch vive en un iframe (app-companion). */
export function stitchAppFrame(page: Page): FrameLocator {
  return page
    .frameLocator('iframe[src*="app-companion"], iframe[title*="Stitch" i]')
    .first()
}

export async function waitForStitchAppFrame(page: Page): Promise<FrameLocator> {
  const iframe = page.locator('iframe[src*="app-companion"], iframe[title*="Stitch" i]').first()
  await iframe.waitFor({ state: 'attached', timeout: 90_000 })
  const frame = stitchAppFrame(page)
  await frame
    .locator('div[role="textbox"][contenteditable="true"], input[placeholder*="Buscar"]')
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 })
    .catch(() => undefined)
  await page.waitForTimeout(1500)
  return frame
}

export function extractStitchProjectIdFromUrl(url: string): string | null {
  const m = url.match(/\/projects?\/(\d{5,})/i)
  return m?.[1] ?? null
}

export async function clickFirstVisible(
  page: Page,
  locators: Array<ReturnType<Page['locator']>>,
  timeoutMs = 4000,
): Promise<boolean> {
  for (const locator of locators) {
    const target = locator.first()
    if (await target.isVisible({ timeout: timeoutMs }).catch(() => false)) {
      await target.click({ timeout: 10_000 })
      return true
    }
  }
  return false
}

export async function fillFirstVisible(
  page: Page,
  locators: Array<ReturnType<Page['locator']>>,
  value: string,
): Promise<boolean> {
  for (const locator of locators) {
    const target = locator.first()
    if (await target.isVisible({ timeout: 3000 }).catch(() => false)) {
      await target.click({ timeout: 5000 }).catch(() => undefined)
      await target.fill(value, { timeout: 10_000 })
      return true
    }
  }
  return false
}

import {
  parseStitchDesignType,
  type StitchDesignType,
} from '@/lib/auto/stitch/stitchDesignType'

export type { StitchDesignType }

export function resolveStitchDesignType(): StitchDesignType {
  return parseStitchDesignType(process.env.STITCH_DESIGN_TYPE ?? 'web')
}

/** Selecciona Web o Aplicación en el home de Stitch (por defecto Web). */
export async function selectStitchDesignType(
  page: Page,
  designType: StitchDesignType = resolveStitchDesignType(),
): Promise<void> {
  await waitForStitchAppFrame(page)
  const frame = stitchAppFrame(page)
  const target =
    designType === 'web'
      ? frame.getByRole('radio', { name: /^Web$/i })
      : frame.getByRole('radio', { name: /^Aplicación$/i })

  if (!(await target.isVisible({ timeout: 5000 }).catch(() => false))) return

  const checked = await target.isChecked().catch(() => false)
  if (!checked) {
    await target.click({ timeout: 10_000 })
    await page.waitForTimeout(400)
  }
}

/** Campo principal de prompt en el home de Stitch (dentro del iframe). */
export function stitchMainPromptLocator(page: Page) {
  const frame = stitchAppFrame(page)
  return frame.locator('div[role="textbox"][contenteditable="true"]').first()
}

/** Busca el campo de prompt/chat visible en Stitch (iframe app-companion). */
export async function fillStitchPromptField(page: Page, text: string): Promise<boolean> {
  await waitForStitchAppFrame(page)
  const frame = stitchAppFrame(page)

  const promptLocators = [
    stitchMainPromptLocator(page),
    frame.locator('div[role="textbox"][contenteditable="true"]'),
    frame.getByPlaceholder(/aplicación móvil|qué aplicación|diseñar|describe|prompt|what/i),
    frame.locator('textarea:visible'),
    frame.getByRole('textbox').nth(1),
  ]

  for (const locator of promptLocators) {
    try {
      const target = locator.first()
      if (!(await target.isVisible({ timeout: 3000 }).catch(() => false))) continue
      await target.scrollIntoViewIfNeeded().catch(() => undefined)
      await target.click({ timeout: 8000 })
      await page.keyboard.press('Meta+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.type(text.slice(0, 8000), { delay: 3 })
      const current = (await target.textContent().catch(() => '')) ?? ''
      if (current.trim().length >= Math.min(12, text.length / 5)) return true
    } catch {
      /* siguiente candidato */
    }
  }

  return false
}

export async function submitStitchPrompt(page: Page): Promise<void> {
  const frame = stitchAppFrame(page)
  const clicked = await clickFirstVisible(page, [
    frame.getByRole('button', { name: /generar diseños|generate designs/i }),
    frame.locator('button[aria-label*="Generar" i], button[aria-label*="Generate" i]'),
    frame.getByRole('button', { name: /generate|generar|create|crear|send|enviar/i }),
  ])
  if (!clicked) {
    await stitchMainPromptLocator(page).press('Enter').catch(() => page.keyboard.press('Enter'))
  }
}
