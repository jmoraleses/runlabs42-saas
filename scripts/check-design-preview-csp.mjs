/**
 * Comprueba si el CSP del preview bloquea cdn.tailwindcss.com.
 * Uso: node scripts/check-design-preview-csp.mjs [previewUrl]
 */
import { chromium } from 'playwright'

const projectId = process.env.PROJECT_ID ?? 'demo-6c257373-ce5c-4383-8da3-faca8ba4d491'
const base = process.env.BASE_URL ?? 'http://localhost:3010'
const previewUrl =
  process.argv[2] ?? `${base}/api/projects/${projectId}/design/preview?page=home&k=1`

const blocked = []
const consoleErrors = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('requestfailed', (req) => {
  const url = req.url()
  if (url.includes('tailwindcss')) {
    blocked.push({ url, failure: req.failure()?.errorText ?? 'failed' })
  }
})
page.on('response', (res) => {
  const url = res.url()
  if (url.includes('tailwindcss') && res.status() >= 400) {
    blocked.push({ url, status: res.status() })
  }
})

const res = await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30_000 })
const cspHeaders = await res?.allHeaders?.() ?? {}
const csp = [cspHeaders['content-security-policy'], cspHeaders['content-security-policy-report-only']]
  .filter(Boolean)
  .join(' | ')

await page.waitForTimeout(1500)

const probe = await page.evaluate(() => {
  const body = document.body
  const bg = getComputedStyle(body).backgroundColor
  const display = getComputedStyle(body).display
  const hasTw = typeof window.tailwind !== 'undefined'
  const section = document.querySelector('section, header, main')
  const sectionBg = section ? getComputedStyle(section).backgroundColor : null
  return { bg, display, hasTw, sectionBg, title: document.title }
})

await browser.close()

console.log(JSON.stringify({ previewUrl, csp, probe, blocked, consoleErrors: consoleErrors.slice(0, 8) }, null, 2))

const tailwindBlocked =
  blocked.length > 0 ||
  consoleErrors.some((e) => /tailwindcss|cdn\.tailwindcss/i.test(e))
const unstyled =
  probe.bg === 'rgba(0, 0, 0, 0)' ||
  probe.bg === 'transparent' ||
  (probe.bg === 'rgb(255, 255, 255)' && !probe.hasTw)

if (tailwindBlocked) {
  console.error('\nRESULT: Tailwind CDN likely BLOCKED by CSP or network')
  process.exit(1)
}
if (unstyled && !probe.hasTw) {
  console.error('\nRESULT: Tailwind did not run (no window.tailwind, default body styles)')
  process.exit(1)
}
console.log('\nRESULT: Tailwind CDN loaded and styles appear active')
