import { defineConfig, devices } from '@playwright/test'
import { assertPlaywrightHostBoundary } from '../util/playwright-host-policy.mjs'

assertPlaywrightHostBoundary()

// Local-only LTI launch harness (see lti-harness/README.md). It has no global
// setup, so it never resets or seeds the database.
export default defineConfig({
  testDir: './lti-harness',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-third-party-cookies-blocked',
      use: { ...devices['Desktop Chrome'] },
      // the spec enables Chromium's third-party cookie restriction over CDP
      metadata: { blocksThirdPartyCookies: true },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
