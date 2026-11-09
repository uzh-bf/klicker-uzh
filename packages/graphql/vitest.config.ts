import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      KLICKER_HOST_ROOT: fileURLToPath(new URL('../../', import.meta.url)),
    },
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    silent: false,
    reporters: ['verbose'],
    setupFiles: ['dotenv/config'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // equivalent to Jest's maxWorkers: 1
      },
    },
  },
  resolve: {
    alias: {
      '@klicker-uzh/adaptive-test-host/schema': fileURLToPath(
        new URL('./src/index.ts', import.meta.url)
      ),
      '@klicker-uzh/adaptive-test-host/helpers': fileURLToPath(
        new URL('./test/helpers.ts', import.meta.url)
      ),
      '@klicker-uzh/adaptive-test-host/services': fileURLToPath(
        new URL('./src/services', import.meta.url)
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Let Node handle workspace packages naturally with proper conditions
    conditions: ['node', 'import', 'default'],
  },
})
