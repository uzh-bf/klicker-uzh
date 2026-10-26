import { defineConfig, devices } from '@playwright/test'
import {
  assertPlaywrightHostBoundary,
  preserveLocalDatabase,
} from '../util/playwright-host-policy.mjs'

assertPlaywrightHostBoundary()
if (
  process.env.KLICKER_CODEAPI_BROWSER_E2E === '1' &&
  !preserveLocalDatabase()
) {
  throw new Error(
    'CodeAPI browser E2E requires --preserve-database before global setup.'
  )
}

const isCI = !!process.env.CI

// URL defaults mirror cypress.config.ts env block
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.URL_STUDENT ??
  'http://127.0.0.1:3001'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Serial execution by default (mirrors Cypress sequential spec ordering).
  // Routes can raise this via PLAYWRIGHT_WORKERS to run spec files in parallel.
  workers:
    Number.isInteger(Number(process.env.PLAYWRIGHT_WORKERS)) &&
    Number(process.env.PLAYWRIGHT_WORKERS) > 0
      ? Number(process.env.PLAYWRIGHT_WORKERS)
      : 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  // Run cleanup + seed once before the whole suite (mirrors cypress before:run hook)
  globalSetup: './global-setup.ts',

  reporter: isCI
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ],

  use: {
    baseURL,
    // Matches the data-cy attribute used throughout KlickerUZH
    testIdAttribute: 'data-cy',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'off' : 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: ['--lang=en-US'],
    },
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 }, // macbook-16 equivalent
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
