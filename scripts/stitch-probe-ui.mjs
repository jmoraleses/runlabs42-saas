#!/usr/bin/env node
/**
 * Inspecciona la UI de Stitch para depurar selectores de Playwright.
 * Uso: STITCH_HEADLESS=1 node scripts/stitch-probe-ui.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.env.STITCH_WEB_BASE_URL?.trim() || 'https://stitch.withgoogle.com'
const storage = process.env.STITCH_PLAYWRIGHT_STORAGE_STATE?.trim() ||
  path.join(process.cwd(), '.auth', 'stitch-storage-state.json')

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: process.env.STITCH_HEADLESS !== '0' })
  const context = await browser.newContext({
    storageState: storage,
    acceptDownloads: true,
  })
  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(5000)

  const frame = page.frameLocator('iframe[src*="app-companion"], iframe[title*="Stitch" i]').first()
  const frameNodes = await frame.locator('textarea, input, [contenteditable], [role="textbox"], button').evaluateAll((els) =>
    els.slice(0, 30).map((el) => ({
      tag: el.tagName,
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      text: (el.textContent || '').trim().slice(0, 40),
    })),
  ).catch(() => [])

  const info = await page.evaluate(() => {
    const pick = (el) => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      contentEditable: el.getAttribute('contenteditable'),
      testId: el.getAttribute('data-testid'),
      className: (el.className || '').toString().slice(0, 80),
      text: (el.textContent || '').trim().slice(0, 60),
    })

    function walk(root, out, depth = 0) {
      if (depth > 12 || out.length > 80) return
      const sel = 'textarea, input, [contenteditable], [role="textbox"], button, [role="button"]'
      for (const el of root.querySelectorAll(sel)) {
        const rect = el.getBoundingClientRect()
        if (rect.width < 8 || rect.height < 8) continue
        out.push({ ...pick(el), w: Math.round(rect.width), h: Math.round(rect.height), depth })
      }
      for (const host of root.querySelectorAll('*')) {
        if (host.shadowRoot) walk(host.shadowRoot, out, depth + 1)
      }
    }

    const nodes = []
    walk(document, nodes)
    const iframes = [...document.querySelectorAll('iframe')].map((f) => ({
      src: f.src?.slice(0, 120),
      title: f.title,
    }))
    const bodyText = (document.body?.innerText || '').slice(0, 500)
    return {
      url: location.href,
      title: document.title,
      bodyText,
      iframeCount: iframes.length,
      iframes,
      nodes: nodes.slice(0, 50),
    }
  })

  const outDir = path.join(process.cwd(), '.tmp')
  await fs.mkdir(outDir, { recursive: true })
  const ts = Date.now()
  await page.screenshot({ path: path.join(outDir, `stitch-probe-${ts}.png`), fullPage: true })
  console.log(JSON.stringify({ ...info, frameNodes }, null, 2))
  console.error(`Screenshot: .tmp/stitch-probe-${ts}.png`)

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
