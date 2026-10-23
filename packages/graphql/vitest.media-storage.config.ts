import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pure adapter tests: no dotenv, database, Redis or storage service required.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/mediaStorage.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      '@klicker-uzh/util': fileURLToPath(
        new URL('../util/src/blobStorage.ts', import.meta.url)
      ),
    },
  },
})
