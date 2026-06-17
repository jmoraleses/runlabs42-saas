#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'

async function finalizeJoomla(page, report) {
  const item = { app: 'joomla', ok: false, notes: [] }
  try {
    await page.goto('http://localhost:8082/installation/index.php', { waitUntil: 'domcontentloaded' })

    await page.evaluate(() => {
      const set = (name, value) => {
        const el = document.querySelector(`[name="${name}"]`)
        if (el) el.value = value
      }
      set('jform[site_name]', 'Joomla Local')
      set('jform[admin_user]', 'Administrador')
      set('jform[admin_username]', 'admin')
      set('jform[admin_password]', 'Admin1234!')
      set('admin_password2', 'Admin1234!')
      set('jform[admin_email]', 'admin@local.test')
      set('jform[db_type]', 'mysqli')
      set('jform[db_host]', 'joomla-db-local')
      set('jform[db_user]', 'joomla')
      set('jform[db_pass]', 'joomla')
      set('jform[db_name]', 'joomla')
      const form = document.querySelector('form#adminForm')
      if (form) form.submit()
    })

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    const txt = (await page.locator('body').innerText()).toLowerCase()
    item.ok = txt.includes('open administrator') || txt.includes('installation successful')
    item.notes.push(item.ok ? 'Joomla instalado.' : 'Joomla no confirmó finalización.')
  } catch (e) {
    item.notes.push(`Error Joomla: ${e instanceof Error ? e.message : String(e)}`)
  }
  report.push(item)
}

async function finalizeDrupal(page, report) {
  const item = { app: 'drupal', ok: false, notes: [] }
  try {
    await page.goto('http://localhost:8083/core/install.php', { waitUntil: 'domcontentloaded' })

    // language
    if (await page.locator('#edit-submit').count()) {
      await page.click('#edit-submit')
      await page.waitForLoadState('domcontentloaded')
    }
    // profile
    if (await page.locator('input[value="demo_umami"]').count()) {
      await page.check('input[value="demo_umami"]')
      item.notes.push('Perfil Umami seleccionado (contenido de ejemplo).')
    } else if (await page.locator('input[value="standard"]').count()) {
      await page.check('input[value="standard"]')
    }
    if (await page.locator('#edit-submit').count()) {
      await page.click('#edit-submit')
      await page.waitForLoadState('domcontentloaded')
    }

    // db (sqlite, evita dependencias)
    if (await page.locator('#edit-driver-drupalsqlitedriverdatabasesqlite').count()) {
      await page.check('#edit-driver-drupalsqlitedriverdatabasesqlite')
      await page.click('#edit-save')
      await page.waitForLoadState('domcontentloaded')
    }

    // site config
    if (await page.locator('#edit-site-name').count()) {
      await page.fill('#edit-site-name', 'Drupal Local')
      if (await page.locator('#edit-site-mail').count()) {
        await page.fill('#edit-site-mail', 'admin@local.test')
      }
      await page.fill('#edit-account-name', 'admin')
      await page.fill('#edit-account-mail', 'admin@local.test')
      await page.fill('#edit-account-pass-pass1', 'Admin1234!')
      await page.fill('#edit-account-pass-pass2', 'Admin1234!')
      await page.click('#edit-submit')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(6000)
    }

    const text = (await page.locator('body').innerText()).toLowerCase()
    item.ok = text.includes('congratulations') || text.includes('umami') || text.includes('log out')
    item.notes.push(item.ok ? 'Drupal instalado.' : 'Drupal sin confirmación final.')
  } catch (e) {
    item.notes.push(`Error Drupal: ${e instanceof Error ? e.message : String(e)}`)
  }
  report.push(item)
}

async function finalizeOpenCart(page, report) {
  const item = { app: 'opencart', ok: false, notes: [] }
  try {
    await page.goto('http://localhost:8086/install/index.php?route=install/step_1&language=en-gb', {
      waitUntil: 'domcontentloaded',
    })
    await page.goto('http://localhost:8086/install/index.php?route=install/step_2&language=en-gb', {
      waitUntil: 'domcontentloaded',
    })
    await page.goto('http://localhost:8086/install/index.php?route=install/step_3&language=en-gb', {
      waitUntil: 'domcontentloaded',
    })

    await page.fill('#input-db-hostname', 'opencart-db-local')
    await page.fill('#input-db-username', 'opencart')
    await page.fill('#input-db-password', 'opencart')
    await page.fill('#input-db-database', 'opencart')
    await page.fill('#input-db-port', '3306')
    await page.fill('#input-db-prefix', 'oc_')
    await page.fill('#input-username', 'admin')
    await page.fill('#input-password', 'Admin1234!')
    await page.fill('#input-email', 'admin@local.test')
    await page.click('input.btn.btn-primary[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3500)

    const text = (await page.locator('body').innerText()).toLowerCase()
    item.ok = text.includes('installation complete') || text.includes('your store')
    item.notes.push(item.ok ? 'OpenCart instalado.' : 'OpenCart sin confirmación final.')
  } catch (e) {
    item.notes.push(`Error OpenCart: ${e instanceof Error ? e.message : String(e)}`)
  }
  report.push(item)
}

async function main() {
  const report = []
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await finalizeJoomla(page, report)
  await finalizeDrupal(page, report)
  await finalizeOpenCart(page, report)
  await browser.close()

  const output = {
    generatedAt: new Date().toISOString(),
    report,
  }
  const outPath = path.join(process.cwd(), 'spec', 'template-stack-installers', 'playwright-finalize-report.json')
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: report.every((x) => x.ok), reportPath: outPath, report }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
