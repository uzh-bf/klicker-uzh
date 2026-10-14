import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)

// Uses the real schema with mock Prisma/storage; no dotenv or service access.
export default defineConfig({
  // Pothos loads GraphQL through CommonJS. Keep the executor in that same
  // module realm instead of mixing GraphQL's ESM and CJS class instances.
  resolve: {
    alias: [{ find: /^graphql$/, replacement: require.resolve('graphql') }],
  },
  test: {
    environment: 'node',
    include: ['test/mediaUploadApi.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
