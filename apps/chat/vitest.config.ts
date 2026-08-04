import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The suite runs in a single fork, so a vi.stubGlobal left behind by one
    // file (fetch, URL, window, ...) leaks into whichever file the scheduler
    // runs next. Restore real globals before every test.
    unstubGlobals: true,
    testTimeout: 30000,
    silent: false,
    reporters: ['verbose'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL('.', import.meta.url))}/`,
      },
    ],
    conditions: ['node', 'import', 'default'],
  },
})
