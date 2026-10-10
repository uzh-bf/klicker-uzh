import { defineConfig, devices } from '@playwright/test'
import { assertPlaywrightHostBoundary } from '../util/playwright-host-policy.mjs'

assertPlaywrightHostBoundary()

const baseURL = process.env.PLAYWRIGHT_BASE_URL
if (!baseURL) {
  throw new Error(
    'retained citations require PLAYWRIGHT_BASE_URL from the host launcher'
  )
}

export default defineConfig({
  testDir: './retained',
  testMatch: '**/retained-citations.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    testIdAttribute: 'data-cy',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--lang=en-US'] },
      },
    },
  ],
})
