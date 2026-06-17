import { test, expect } from '@playwright/test'

test('signin page loads with OAuth buttons', async ({ page }) => {
  await page.goto('/auth/signin')
  await expect(page.locator('body')).toContainText(/Runlabs42|signin|iniciar/i)
  await expect(page.getByRole('button').first()).toBeVisible()
})

test('protected route redirects to signin with next param', async ({ page }) => {
  await page.goto('/studio')
  await expect(page).toHaveURL(/auth\/signin/)
  const url = new URL(page.url())
  expect(url.searchParams.get('next')).toBe('/studio')
})
