import { defineConfig } from 'vitest/config'

// Uses the real schema with mock Prisma/storage; no dotenv or service access.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/mediaUploadApi.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
