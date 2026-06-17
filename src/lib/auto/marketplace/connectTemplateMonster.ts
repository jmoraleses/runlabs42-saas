import 'server-only'

const TM_AUTH_URL = 'https://account.templatemonster.com/auth/sign-in'
const TM_HOME = 'https://www.templatemonster.com/'

export type TemplateMonsterConnectResult = {
  ok: boolean
  credentialsConfigured: boolean
  message: string
  loginAttempted: boolean
  portalUrl: string
}

export async function connectTemplateMonster(): Promise<TemplateMonsterConnectResult> {
  const user = process.env.TEMPLATEMONSTER_AUTHOR_EMAIL?.trim()
  const pass = process.env.TEMPLATEMONSTER_AUTHOR_PASSWORD?.trim()
  const credentialsConfigured = Boolean(user && pass)

  if (!credentialsConfigured) {
    return {
      ok: true,
      credentialsConfigured: false,
      loginAttempted: false,
      message: 'Portal accesible',
      portalUrl: TM_HOME,
    }
  }

  try {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({
      headless: process.env.TM_HEADLESS !== '0',
    })
    const page = await browser.newPage()

    await page.goto(TM_AUTH_URL, { timeout: 45_000, waitUntil: 'domcontentloaded' })

    const emailSel = 'input[type="email"], input[name="email"], #email'
    const passSel = 'input[type="password"], input[name="password"], #password'

    if (await page.locator(emailSel).first().isVisible({ timeout: 8000 }).catch(() => false)) {
      await page.locator(emailSel).first().fill(user!)
      await page.locator(passSel).first().fill(pass!)
      const submit = page.locator('button[type="submit"], input[type="submit"]').first()
      if (await submit.isVisible().catch(() => false)) {
        await submit.click()
        await page.waitForTimeout(4000)
      }
    }

    const finalUrl = page.url()
    await browser.close()

    const loggedIn = !finalUrl.includes('sign-in') && !finalUrl.includes('login')

    return {
      ok: true,
      credentialsConfigured: true,
      loginAttempted: true,
      message: loggedIn
        ? 'TemplateMonster conectado (sesión iniciada)'
        : 'Credenciales enviadas; revisa login en portal de autores',
      portalUrl: loggedIn ? finalUrl : TM_HOME,
    }
  } catch (e) {
    return {
      ok: false,
      credentialsConfigured: true,
      loginAttempted: true,
      message: e instanceof Error ? e.message : 'Error al conectar con Playwright',
      portalUrl: TM_HOME,
    }
  }
}
