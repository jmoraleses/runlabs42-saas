import { test, expect } from '@playwright/test'

test('landing loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Runlabs42/i)
})

test('pricing page loads', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.locator('body')).toBeVisible()
})

test('health endpoint', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.service).toBe('runlabs42-web')
})

test('marketplace loads', async ({ page }) => {
  await page.goto('/marketplace')
  await expect(page.locator('body')).toBeVisible()
})
