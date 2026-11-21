import { defineConfig, devices } from '@playwright/test'
import baseConfig from './playwright.config.js'

const browserNeutralUse = {
  ...(baseConfig.use ?? {}),
  launchOptions: undefined,
}

export default defineConfig({
  ...baseConfig,
  use: browserNeutralUse,
  testMatch: '**/O3-live-quiz-recovery.spec.ts',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--lang=en-US'] },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
