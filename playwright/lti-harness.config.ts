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
    // WebKit blocks all third-party cookies, like Safari. Chromium's DevTools
    // cookie restriction misses navigations a cross-site iframe starts itself,
    // so it cannot stand in for a blocking browser.
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Playwright's Firefox turns off Total Cookie Protection; restore the
        // release default, which partitions all third-party cookies
        launchOptions: {
          firefoxUserPrefs: { 'network.cookie.cookieBehavior': 5 },
        },
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      metadata: { blocksThirdPartyCookies: true },
    },
  ],
})
