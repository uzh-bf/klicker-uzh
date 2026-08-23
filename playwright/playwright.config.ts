import { defineConfig, devices } from '@playwright/test'

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
  // Serial execution by default (mirrors Cypress sequential spec ordering)
  workers: isCI ? 1 : 1,
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
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
    // Disable CSS animations to stabilise interactions (mirrors cypress support/e2e.ts)
    launchOptions: {
      // CI-only renderer crashes hit the first heavy chat render while
      // memory, fd, and GPU telemetry stay clean; the 64 MB default
      // /dev/shm of the job container is the remaining resource suspect,
      // so back Chromium shared-memory segments with /tmp instead
      // (run 32648419614 evidence).
      args: ['--lang=en-US', '--disable-gpu', '--disable-dev-shm-usage'],
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
