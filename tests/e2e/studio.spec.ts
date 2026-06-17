import { test, expect } from '@playwright/test'

test('studio redirects unauthenticated users to signin with next=/studio', async ({ page }) => {
  await page.goto('/studio')
  await expect(page).toHaveURL(/auth\/signin/)
  const url = new URL(page.url())
  expect(url.searchParams.get('next')).toBe('/studio')
})

test('legacy /editor redirects to /studio', async ({ page }) => {
  await page.goto('/editor')
  await expect(page).toHaveURL(/\/studio/)
})

test('demo studio loads without auth', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.setItem('runlabs_demo', '1')
    window.localStorage.setItem('runlabs_demo_projects', '[]')
  })
  await page.goto('/studio')
  await expect(page).toHaveURL(/\/studio/)
  await expect(page.locator('.editor-studio, .editor-studio--lovable').first()).toBeVisible({
    timeout: 15_000,
  })
})
