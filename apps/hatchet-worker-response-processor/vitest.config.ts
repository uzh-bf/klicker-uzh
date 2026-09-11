import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    silent: false,
    reporters: ['verbose'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // equivalent to Jest's maxWorkers: 1
      },
    },
  },
  resolve: {
    // Let Node handle workspace packages naturally with proper conditions
    conditions: ['node', 'import', 'default'],
  },
})
