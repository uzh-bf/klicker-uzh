import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Upstream runtime-mode coverage uses node:test, not the Vitest runner.
    exclude: ['test/mode.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
