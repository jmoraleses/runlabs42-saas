#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { chromium } from 'playwright'

const exec = promisify(execCb)

async function run(cmd) {
  const { stdout, stderr } = await exec(cmd, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 8 })
  return { stdout: stdout.trim(), stderr: stderr.trim() }
}

async function setupWordPressExamples() {
  const out = { app: 'wordpress', ok: true, notes: [] }
  try {
    // Create three example posts if they do not exist already.
    for (const title of ['Articulo de ejemplo 1', 'Articulo de ejemplo 2', 'Articulo de ejemplo 3']) {
      const check = await run(
        `docker run --rm --user 33:33 --network cms-net --volumes-from wp-local wordpress:cli wp post list --post_type=post --title="${title}" --field=ID --allow-root`,
      )
      if (!check.stdout) {
        await run(
          `docker run --rm --user 33:33 --network cms-net --volumes-from wp-local wordpress:cli wp post create --post_type=post --post_status=publish --post_title="${title}" --post_content="Contenido de ejemplo generado automaticamente." --allow-root`,
        )
        out.notes.push(`Creado: ${title}`)
      }
    }
  } catch (error) {
    out.ok = false
    out.notes.push(`Error WordPress examples: ${error instanceof Error ? error.message : String(error)}`)
  }
  return out
}

async function setupJoomla(page) {
  const out = { app: 'joomla', ok: true, notes: [] }
  try {
    await page.goto('http://localhost:8082/installation/index.php', { waitUntil: 'domcontentloaded' })
    const title = await page.title()
    if (!title.toLowerCase().includes('installer')) {
      out.notes.push('Joomla ya parece instalado o no está en wizard.')
      return out
    }

    if (await page.locator('#step1').count()) await page.click('#step1')
    await page.fill('#jform_site_name', 'Joomla Local', { force: true })
    await page.fill('#jform_admin_user', 'Administrador', { force: true })
    await page.fill('#jform_admin_username', 'admin', { force: true })
    await page.fill('#jform_admin_password', 'Admin1234!', { force: true })
    await page.fill('#jform_admin_email', 'admin@local.test', { force: true })

    if (await page.locator('#step2').count()) await page.click('#step2')
    await page.selectOption('#jform_db_type', 'mysqli').catch(() => null)
    await page.fill('#jform_db_host', 'joomla-db-local', { force: true })
    await page.fill('#jform_db_user', 'joomla', { force: true })
    await page.fill('#jform_db_pass', 'joomla', { force: true })
    await page.fill('#jform_db_name', 'joomla', { force: true })

    const sampleSelect = page.locator('select[name=\"jform[sample_file]\"]')
    if (await sampleSelect.count()) {
      const options = await sampleSelect.locator('option').allTextContents()
      const sampleCandidate =
        options.find((x) => /sample|blog|brochure/i.test(x)) ?? null
      if (sampleCandidate) {
        await sampleSelect.selectOption({ label: sampleCandidate })
        out.notes.push(`Sample data Joomla seleccionado: ${sampleCandidate}`)
      }
    }

    await page.click('#setupButton', { force: true })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)

    const bodyText = (await page.locator('body').innerText()).toLowerCase()
    out.ok = bodyText.includes('installation successful') || bodyText.includes('open administrator')
    out.notes.push(out.ok ? 'Instalación Joomla completada.' : 'No se pudo confirmar finalización Joomla.')
  } catch (error) {
    out.ok = false
    out.notes.push(`Error Joomla: ${error instanceof Error ? error.message : String(error)}`)
  }
  return out
}

async function setupDrupal(page) {
  const out = { app: 'drupal', ok: true, notes: [] }
  try {
    await page.goto('http://localhost:8083/core/install.php', { waitUntil: 'domcontentloaded' })
    const firstTitle = await page.title()

    if (firstTitle.toLowerCase().includes('already installed')) {
      out.notes.push('Drupal ya estaba instalado.')
      return out
    }

    // Step 1: language
    if (await page.locator('#edit-submit').count()) {
      await page.click('#edit-submit')
      await page.waitForLoadState('domcontentloaded')
    }

    // Step 2: choose profile with sample content if available.
    if (await page.locator('input[value=\"demo_umami\"]').count()) {
      await page.check('input[value=\"demo_umami\"]')
      out.notes.push('Perfil Drupal Umami seleccionado (incluye contenido de ejemplo).')
    } else if (await page.locator('input[value=\"standard\"]').count()) {
      await page.check('input[value=\"standard\"]')
    }
    if (await page.locator('#edit-submit').count()) {
      await page.click('#edit-submit')
      await page.waitForLoadState('domcontentloaded')
    }

    // DB settings (sqlite fallback if mysql form not shown).
    if (await page.locator('#edit-driver-drupalsqlitedriverdatabasesqlite').count()) {
      await page.check('#edit-driver-drupalsqlitedriverdatabasesqlite')
      await page.click('#edit-save')
      await page.waitForLoadState('domcontentloaded')
    }

    // Site configuration.
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
      await page.waitForTimeout(2500)
    }

    const finalText = (await page.locator('body').innerText()).toLowerCase()
    out.ok =
      finalText.includes('congratulations') ||
      finalText.includes('you are now logged in') ||
      finalText.includes('umami')
    out.notes.push(out.ok ? 'Instalación Drupal completada.' : 'No se pudo confirmar finalización Drupal.')
  } catch (error) {
    out.ok = false
    out.notes.push(`Error Drupal: ${error instanceof Error ? error.message : String(error)}`)
  }
  return out
}

async function setupOpenCart(page) {
  const out = { app: 'opencart', ok: true, notes: [] }
  try {
    await page.goto('http://localhost:8086/install/index.php?route=install/step_1&language=en-gb', {
      waitUntil: 'domcontentloaded',
    })
    const body = await page.locator('body').innerText()
    if (!/license agreement/i.test(body)) {
      out.notes.push('OpenCart ya instalado o no está en wizard.')
      return out
    }

    // Step 1 -> Step 2
    await page.click('a.btn.btn-primary, a:has-text("Continue")')
    await page.waitForLoadState('domcontentloaded')
    // Step 2 -> Step 3
    await page.click('a.btn.btn-primary, a:has-text("Continue")')
    await page.waitForLoadState('domcontentloaded')

    // Step 3 configuration
    await page.selectOption('#input-db-driver', 'mysqli')
    await page.fill('#input-db-hostname', 'opencart-db-local')
    await page.fill('#input-db-username', 'opencart')
    await page.fill('#input-db-password', 'opencart')
    await page.fill('#input-db-database', 'opencart')
    await page.fill('#input-db-port', '3306')
    await page.fill('#input-db-prefix', 'oc_')
    await page.fill('#input-username', 'admin')
    await page.fill('#input-password', 'Admin1234!')
    await page.fill('#input-email', 'admin@local.test')
    await page.click('input.btn.btn-primary[type=submit]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)

    const finalText = (await page.locator('body').innerText()).toLowerCase()
    out.ok = finalText.includes('installation complete') || finalText.includes('your store')
    out.notes.push(
      out.ok
        ? 'Instalación OpenCart completada (incluye datos iniciales).'
        : 'No se pudo confirmar finalización OpenCart.',
    )
  } catch (error) {
    out.ok = false
    out.notes.push(`Error OpenCart: ${error instanceof Error ? error.message : String(error)}`)
  }
  return out
}

async function main() {
  const report = []

  // Ensure DB backend for OpenCart.
  await run(
    'docker rm -f opencart-db-local >/dev/null 2>&1 || true && docker run --name opencart-db-local --network cms-net -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=opencart -e MYSQL_USER=opencart -e MYSQL_PASSWORD=opencart -d mariadb:10.11 >/dev/null',
  )

  report.push(await setupWordPressExamples())

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  report.push(await setupJoomla(page))
  report.push(await setupDrupal(page))
  report.push(await setupOpenCart(page))
  await browser.close()

  const outputPath = path.join(
    process.cwd(),
    'spec',
    'template-stack-installers',
    'initial-setup-report.json',
  )
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        report,
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(
    JSON.stringify(
      {
        ok: report.every((r) => r.ok),
        reportPath: path.relative(process.cwd(), outputPath),
        apps: report,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
