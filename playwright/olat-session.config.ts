import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  testMatch: '**/PA-olat-session-recovery.spec.ts',
  projects: [
    {
      name: 'chromium-allowed',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--lang=en-US',
            '--disable-features=TrackingProtection3pcd,LocalNetworkAccessChecks',
          ],
        },
      },
    },
    {
      name: 'chromium-blocked',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--lang=en-US',
            '--test-third-party-cookie-phaseout',
            '--disable-features=LocalNetworkAccessChecks',
          ],
        },
      },
    },
    {
      name: 'firefox-standard',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: { 'network.cookie.cookieBehavior': 5 },
        },
      },
    },
    {
      name: 'firefox-blocked',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: { 'network.cookie.cookieBehavior': 1 },
        },
      },
    },
    {
      name: 'webkit-standard',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
