import { defineConfig, devices } from '@playwright/test'

/** Playwright contra `pnpm run dev` (puerto 3010); no arranca otro servidor. */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3010',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'Desktop', use: { ...devices['Desktop Chrome'] } }],
})
