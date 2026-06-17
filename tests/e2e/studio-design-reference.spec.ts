import { readFileSync } from 'fs'
import { resolve } from 'path'
import { test, expect } from '@playwright/test'

const refImage = resolve(__dirname, '../../uploads/petvibe-ref.png')

test.describe('Studio referencia visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.setItem('runlabs_demo', '1')
      window.localStorage.setItem('runlabs_demo_projects', '[]')
    })
  })

  test('design/generate incluye imágenes al adjuntar captura', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/studio')
    await expect(page.locator('.editor-studio, .editor-studio--lovable').first()).toBeVisible({
      timeout: 20_000,
    })

    const fileInput = page.getByTestId('studio-reference-file-input')
    await fileInput.setInputFiles(refImage)

    await expect(page.locator('.web-studio-prompt__attachment img').first()).toBeVisible({
      timeout: 10_000,
    })

    const textarea = page.getByRole('textbox', { name: /describ|describe/i })
    await textarea.fill('Réplica fiel de la captura PetVibe')

    const submit = page.locator('.web-studio-prompt__send[type="submit"]')
    await expect(submit).toBeEnabled({ timeout: 5_000 })

    const generateResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/design/generate') &&
        r.status() === 200,
      { timeout: 90_000 },
    )
    await submit.click()
    const response = await generateResponse
    const generateBody = response.request().postDataJSON() as {
      images?: Array<{ data?: string; url?: string; mimeType?: string }>
    }

    expect(generateBody.images?.length ?? 0).toBeGreaterThan(0)

    const first = generateBody.images![0]!
    const dataLen =
      typeof first.data === 'string' ? first.data.replace(/^data:[^;]+;base64,/, '').length : 0
    const hasUrl = typeof first.url === 'string' && first.url.length > 0
    expect(dataLen > 64 || hasUrl).toBe(true)
  })
})
