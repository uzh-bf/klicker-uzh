import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { assertPlaywrightHostBoundary } from '../util/playwright-host-policy.mjs'

assertPlaywrightHostBoundary()
if (process.env.KLICKER_BROWSER_COVERAGE !== '1') {
  throw new Error(
    'Use the isolated browser coverage workflow for this prototype'
  )
}

export default defineConfig({
  testDir: './coverage-pilot',
  testMatch: 'auth.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: 'test-results/coverage-pilot',
  use: {
    baseURL: 'http://127.0.0.1:3010',
    testIdAttribute: 'data-cy',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: 'node ../../util/playwright-next-runtime.mjs start 3010',
    cwd: fileURLToPath(new URL('../apps/auth', import.meta.url)),
    url: 'http://127.0.0.1:3010',
    timeout: 60_000,
    reuseExistingServer: false,
    env: {
      APP_SECRET: 'synthetic-browser-coverage-secret',
      APP_ORIGIN_AUTH: 'http://127.0.0.1:3010',
      NEXTAUTH_URL: 'http://127.0.0.1:3010',
    },
  },
})
