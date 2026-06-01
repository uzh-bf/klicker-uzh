import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    silent: false,
    reporters: ['verbose'],
    setupFiles: ['dotenv/config'],
    pool: 'forks',
    maxWorkers: 1,
  },
  resolve: {
    // Let Node handle workspace packages naturally with proper conditions
    conditions: ['node', 'import', 'default'],
  },
})
