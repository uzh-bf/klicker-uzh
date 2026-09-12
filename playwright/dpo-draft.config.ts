import { defineConfig } from '@playwright/test'
import { assertPlaywrightHostBoundary } from '../util/playwright-host-policy.mjs'

assertPlaywrightHostBoundary()

export default defineConfig({
  testDir: './dpo-draft',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: process.env.URL_STUDENT ?? 'http://127.0.0.1:3001',
    ignoreHTTPSErrors: true,
    testIdAttribute: 'data-cy',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
  },
})
