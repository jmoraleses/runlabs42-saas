import 'server-only'

import {
  isChromeProfileLocked,
  isStitchSessionReady,
  launchStitchChrome,
  openStitchPage,
  REQUIRED_STITCH_EMAIL,
  resolveChromeUserDataDir,
  resolveStitchStorageStatePath,
  stitchChromeProfileReady,
  stitchPlaywrightStorageExists,
} from '@/lib/auto/stitch/stitchPlaywright.shared'

const STITCH_ACCOUNT_EMAIL = REQUIRED_STITCH_EMAIL

export async function getStitchAccountEmail(): Promise<string | null> {
  return STITCH_ACCOUNT_EMAIL
}

export async function isStitchConfigured(): Promise<boolean> {
  return isStitchSessionReady()
}

export async function checkStitchConnection(): Promise<{
  ok: boolean
  message: string
  accountEmail: string | null
}> {
  const accountEmail = await getStitchAccountEmail()
  if (!(await isStitchConfigured())) {
    return {
      ok: false,
      message: `Falta sesión Playwright. Ejecuta: pnpm stitch:auth (guarda en ${resolveStitchStorageStatePath()})`,
      accountEmail,
    }
  }

  if ((await stitchChromeProfileReady()) && (await isChromeProfileLocked())) {
    const hasStorage = await stitchPlaywrightStorageExists()
    return {
      ok: true,
      message: hasStorage
        ? 'Sesión Stitch activa (Chrome abierto con el perfil de auth)'
        : 'Chrome de auth abierto: vuelve a la terminal de pnpm stitch:auth y pulsa ENTER para guardar la sesión',
      accountEmail,
    }
  }

  try {
    const { browser, context, viaCdp } = await launchStitchChrome({ headless: true, preferCdp: true })
    try {
      const page = await openStitchPage(context, '/')
      const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 800).toLowerCase()
      const looksLoggedOut = /sign in|log in|iniciar sesión/i.test(bodyText) && /google/i.test(bodyText)
      if (looksLoggedOut) {
        return {
          ok: false,
          message:
            'Sesión expirada. Cierra Chrome, ejecuta pnpm stitch:chrome-cdp y luego STITCH_CHROME_CDP_URL=http://127.0.0.1:9222 pnpm stitch:auth',
          accountEmail,
        }
      }
      const emailDetected = bodyText.includes(STITCH_ACCOUNT_EMAIL)
      return {
        ok: true,
        message: emailDetected
          ? `Chrome/Stitch listo (${resolveChromeUserDataDir()})`
          : `Stitch accesible; confirma login con ${STITCH_ACCOUNT_EMAIL}`,
        accountEmail,
      }
    } finally {
      if (!viaCdp) {
        await context.close().catch(() => undefined)
        await browser.close().catch(() => undefined)
      }
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'No se pudo validar Stitch con Playwright',
      accountEmail,
    }
  }
}
