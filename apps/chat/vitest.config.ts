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
    server: {
      deps: {
        // Process the design-system through vite instead of Node: its
        // `development` export condition resolves to TS source that imports
        // tailwind.css, which only the aliased css stub below can absorb.
        inline: [/@uzh-bf\/design-system/],
      },
    },
  },
  plugins: [
    {
      // Resolve any stylesheet import to the empty stub before vite's css
      // pipeline sees it; postcss cannot process them in this node suite.
      name: 'chat-test-css-stub',
      enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('.css')) {
          return fileURLToPath(new URL('./test/style-stub.ts', import.meta.url))
        }
        return null
      },
    },
  ],
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
