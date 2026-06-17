#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const stitchBaseUrl = process.env.STITCH_WEB_BASE_URL?.trim() || 'https://stitch.withgoogle.com'
const requiredEmail = process.env.STITCH_ACCOUNT_EMAIL?.trim()?.toLowerCase()
if (!requiredEmail) {
  console.error('Falta STITCH_ACCOUNT_EMAIL en .env.local')
  process.exit(1)
}
const outputPath =
  process.env.STITCH_PLAYWRIGHT_STORAGE_STATE?.trim() ||
  path.join(process.cwd(), '.auth', 'stitch-storage-state.json')
const timeoutMs = Number(process.env.STITCH_AUTH_TIMEOUT_MS || 600000)

function resolveChromeUserDataDir() {
  const fromEnv = process.env.STITCH_CHROME_USER_DATA_DIR?.trim()
  if (fromEnv) {
    const expanded = fromEnv.replace(/^~(?=$|[/\\])/, os.homedir())
    return path.isAbsolute(expanded) ? expanded : path.join(process.cwd(), expanded)
  }
  return path.join(process.cwd(), '.auth', 'chrome-stitch-profile')
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function launchChromeForAuth() {
  const cdpUrl = process.env.STITCH_CHROME_CDP_URL?.trim() || 'http://127.0.0.1:9222'
  const tryCdp = process.env.STITCH_CHROME_CDP_URL !== '0'

  if (tryCdp) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl)
      const context = browser.contexts()[0] ?? (await browser.newContext())
      const page = context.pages()[0] ?? (await context.newPage())
      console.log(`[stitch-auth] Conectado a tu Chrome abierto (${cdpUrl})`)
      return { browser, context, page, viaCdp: true }
    } catch {
      console.log('[stitch-auth] No hay Chrome con depuración remota en', cdpUrl)
      console.log('[stitch-auth] Tip: ejecuta primero  pnpm stitch:chrome-cdp')
    }
  }

  const userDataDir = resolveChromeUserDataDir()
  await fs.mkdir(userDataDir, { recursive: true })
  console.log(`[stitch-auth] Abriendo Google Chrome (perfil: ${userDataDir})`)
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const browser = context.browser()
  const page = context.pages()[0] ?? (await context.newPage())
  return { browser, context, page, viaCdp: false }
}

async function main() {
  await ensureDir(outputPath)
  const { browser, context, page, viaCdp } = await launchChromeForAuth()

  console.log(`[stitch-auth] Navegando a ${stitchBaseUrl}`)
  await page.goto(stitchBaseUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
  console.log('[stitch-auth] Inicia sesión en Stitch con Google.')
  console.log(`[stitch-auth] Cuenta requerida: ${requiredEmail}`)
  console.log('[stitch-auth] Cuando veas Stitch ya logueado, vuelve aquí y pulsa ENTER.')
  console.log(`[stitch-auth] Timeout: ${Math.floor(timeoutMs / 1000)}s`)

  const readEnter = new Promise((resolve) => {
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', () => resolve())
  })
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout esperando login en Stitch')), timeoutMs),
  )

  await Promise.race([readEnter, timeout])

  await context.storageState({ path: outputPath })
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
  const raw = (await fs.readFile(outputPath, 'utf8')).toLowerCase()
  const emailOk = body.includes(requiredEmail) || raw.includes(requiredEmail)
  if (!emailOk) {
    console.warn(
      `[stitch-auth] Aviso: no se detectó ${requiredEmail} en la página. Si usaste otra cuenta, repite el login.`,
    )
  }

  if (viaCdp) {
    console.log('[stitch-auth] Sesión tomada de tu Chrome (CDP). No cierres Chrome si quieres seguir usándolo.')
  } else {
    await context.close()
    if (browser) await browser.close()
  }

  console.log(`[stitch-auth] Storage guardado en: ${outputPath}`)
  console.log(`[stitch-auth] Perfil Chrome: ${resolveChromeUserDataDir()}`)
}

main().catch((err) => {
  console.error('[stitch-auth] Error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
