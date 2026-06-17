#!/usr/bin/env node
import { chromium } from 'playwright'

async function clickContinue(page) {
  const agree = page.locator('input[name="agree"], #agree').first()
  if (await agree.count()) {
    try {
      if (!(await agree.isChecked())) await agree.check()
      await page.waitForTimeout(250)
    } catch {
      // Ignore.
    }
  }

  const candidates = [
    'button:has-text("Continue")',
    'a:has-text("Continue")',
    'input[type="submit"][value="Continue"]',
  ]
  for (const sel of candidates) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      await el.click()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(800)
      return true
    }
  }
  return false
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto('http://localhost:8087/index.php/install/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })

  // License + Localization steps.
  await clickContinue(page)
  await clickContinue(page)

  // Configuration step.
  if (await page.locator('#host').count()) {
    await page.fill('#host', 'magento-db-local')
  }
  if (await page.locator('#dbname').count()) {
    await page.fill('#dbname', 'magento')
  }
  if (await page.locator('#user').count()) {
    await page.fill('#user', 'root')
  }
  if (await page.locator('#password').count()) {
    await page.fill('#password', 'root')
  }
  if (await page.locator('#base_url').count()) {
    await page.fill('#base_url', 'http://localhost:8087/')
  }
  if (await page.locator('#admin_frontname').count()) {
    await page.fill('#admin_frontname', 'admin')
  }
  const skipUrl = page.locator('#skip_url_validation, #skip_base_url_validation').first()
  if (await skipUrl.count()) {
    try {
      if (!(await skipUrl.isChecked())) await skipUrl.check()
    } catch {
      // Ignore if it is not a checkbox in this installer variant.
    }
  }
  await clickContinue(page)

  // Create Admin Account step.
  if (await page.locator('#admin_username').count()) {
    await page.fill('#admin_username', 'admin')
  }
  if (await page.locator('#admin_password').count()) {
    await page.fill('#admin_password', 'Admin1234!')
  }
  if (await page.locator('#admin_password_confirmation').count()) {
    await page.fill('#admin_password_confirmation', 'Admin1234!')
  }
  if (await page.locator('#admin_firstname').count()) {
    await page.fill('#admin_firstname', 'Admin')
  }
  if (await page.locator('#admin_lastname').count()) {
    await page.fill('#admin_lastname', 'Local')
  }
  if (await page.locator('#admin_email').count()) {
    await page.fill('#admin_email', 'admin@local.test')
  }

  const installButton = page
    .locator('button:has-text("Install Now"), input[type="submit"][value*="Install"]')
    .first()
  if (await installButton.count()) {
    await installButton.click()
  } else {
    await clickContinue(page)
  }

  await page.waitForTimeout(12000)
  console.log('URL', page.url())
  console.log('TITLE', await page.title())
  console.log((await page.locator('body').innerText()).slice(0, 2000))

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
