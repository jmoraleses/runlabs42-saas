#!/usr/bin/env node
/**
 * Depura selectores de exportación ZIP en un proyecto Stitch.
 * Uso: STITCH_HEADLESS=0 node scripts/stitch-probe-export.mjs "Mercado de Artesanía Viva"
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.env.STITCH_WEB_BASE_URL?.trim() || 'https://stitch.withgoogle.com'
const storage =
  process.env.STITCH_PLAYWRIGHT_STORAGE_STATE?.trim() ||
  path.join(process.cwd(), '.auth', 'stitch-storage-state.json')
const title = process.argv[2] || 'Mercado de Artesanía Viva'

function frame(page) {
  return page.frameLocator('iframe[src*="app-companion"], iframe[title*="Stitch" i]').first()
}

async function dumpButtons(frame, label) {
  const buttons = await frame
    .locator('button, [role="button"], [role="menuitem"]')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 4 && r.height > 4
        })
        .map((el) => ({
          tag: el.tagName,
          role: el.getAttribute('role'),
          aria: el.getAttribute('aria-label'),
          text: (el.textContent || '').trim().slice(0, 60),
          disabled: (el instanceof HTMLButtonElement && el.disabled) || el.getAttribute('aria-disabled') === 'true',
        })),
    )
    .catch(() => [])
  console.log(`\n=== ${label} (${buttons.length}) ===`)
  for (const b of buttons.slice(0, 80)) {
    if (/export|descarg|download|más|more|zip|cerrar|account|cuenta/i.test(`${b.aria} ${b.text}`)) {
      console.log(JSON.stringify(b))
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: process.env.STITCH_HEADLESS !== '0',
  })
  const context = await browser.newContext({ storageState: storage, acceptDownloads: true })
  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.locator('iframe[src*="app-companion"]').first().waitFor({ state: 'attached', timeout: 90_000 })
  await page.waitForTimeout(6000)

  const f = frame(page)
  const misProyectos = f.getByRole('radio', { name: /^Mis proyectos$/i }).first()
  if (await misProyectos.isVisible({ timeout: 5000 }).catch(() => false)) {
    if (!(await misProyectos.isChecked().catch(() => false))) await misProyectos.click()
    await page.waitForTimeout(800)
  }

  const rows = await f.locator('li[role="button"]').evaluateAll((els) =>
    els.map((el) => (el.textContent || '').trim().slice(0, 80)),
  )
  const matches = rows.filter((r) => r.toLowerCase().includes(title.toLowerCase().slice(0, 12)))
  console.log('Filas lista (primeras 8):', rows.slice(0, 8))
  console.log('Coincidencias lista:', matches.slice(0, 5))

  const projectId = process.env.STITCH_PROBE_PROJECT_ID?.trim()
  if (projectId) {
    await page.goto(`${base}/projects/${projectId}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(5000)
  } else {
    const item = f.locator('li[role="button"]').filter({ hasText: title }).first()
    if (!(await item.isVisible({ timeout: 12_000 }).catch(() => false))) {
      console.error('Proyecto no encontrado en lista:', title)
      await browser.close()
      process.exit(1)
    }
    await item.click({ timeout: 15_000 })
    await page.waitForTimeout(5000)
  }

  const outDir = path.join(process.cwd(), '.tmp', 'stitch-export-debug')
  await fs.mkdir(outDir, { recursive: true })
  const snap = (name) => path.join(outDir, `probe-${name}-${Date.now()}.png`)

  await page.screenshot({ path: await snap('loaded'), fullPage: true })
  await dumpButtons(f, 'tras abrir proyecto')

  const thinking = await f.getByText(/thinking|pensando|generando/i).first().isVisible().catch(() => false)
  console.log('\nThinking visible:', thinking)

  const exportBtn = f.getByRole('button', { name: /^(exportar|export)$/i }).first()
  console.log('Export top visible:', await exportBtn.isVisible().catch(() => false))

  // Esperar a que desaparezca Thinking
  for (let i = 0; i < 15; i++) {
    const busy = await f.getByText(/thinking|pensando|generando/i).first().isVisible().catch(() => false)
    if (!busy) break
    if (i % 10 === 0) console.log('esperando thinking...', i)
    await page.waitForTimeout(1000)
  }
  console.log('\nThinking tras espera:', await f.getByText(/thinking|pensando/i).first().isVisible().catch(() => false))

  await page.screenshot({ path: await snap('ready'), fullPage: true })
  await dumpButtons(f, 'canvas listo')

  if (await exportBtn.isVisible().catch(() => false)) {
    await exportBtn.click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: await snap('after-export-click'), fullPage: true })
    await dumpButtons(f, 'tras click Exportar')

    const zipRadio = f.getByRole('radio', { name: /\.zip|^zip$/i }).first()
    console.log('zip radio visible:', await zipRadio.isVisible().catch(() => false))
    const panelExport = f.getByRole('button', { name: /^(exportar|export)$/i }).last()
    console.log('panel export visible:', await panelExport.isVisible().catch(() => false))
    console.log('panel export enabled:', await panelExport.isEnabled().catch(() => false))

    const downloadItems = await f.locator('[role="menuitem"]').evaluateAll((els) =>
      els.map((el) => (el.textContent || '').trim()),
    )
    console.log('menuitems:', downloadItems.filter(Boolean).slice(0, 20))
  }

  // Probar cancelar generación
  const stopBtn = f.getByRole('button', { name: /detener|stop|cancelar|cancel/i }).first()
  console.log('\nstop visible:', await stopBtn.isVisible().catch(() => false))
  if (await stopBtn.isVisible().catch(() => false)) {
    await stopBtn.click()
    await page.waitForTimeout(3000)
    console.log('thinking tras stop:', await f.getByText(/thinking|pensando/i).first().isVisible().catch(() => false))
  }

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  console.log('\nTras reload thinking:', await f.getByText(/thinking|pensando/i).first().isVisible().catch(() => false))
  const ex2 = f.getByRole('button', { name: /^(exportar|export)$/i }).first()
  if (await ex2.isVisible().catch(() => false)) {
    await ex2.click()
    await page.waitForTimeout(1000)
    const panel = f.getByRole('button', { name: /^(exportar|export)$/i }).last()
    console.log('panel enabled tras reload:', await panel.isEnabled().catch(() => false))
    console.log('zip radio tras reload:', await f.getByRole('radio', { name: /\.zip/i }).first().isVisible().catch(() => false))
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
