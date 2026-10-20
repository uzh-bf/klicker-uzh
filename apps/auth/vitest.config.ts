import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const srcDirectory = fileURLToPath(new URL('./src', import.meta.url))

// One config with three projects: `test`/`test:run` cover the unit and handler
// integration suites, and `test:built` runs the built-app suite, which starts a
// production server itself.
//
// The environment is part of the fixture contract. The integration suites stub
// their variables with vi.stubEnv while the file loads and restore them with
// vi.unstubAllEnvs in afterAll, so `unstubEnvs` and `restoreMocks` stay off:
// unstubbing or restoring before every test would drop the handler environment
// and the intended defaults of the mocked account handlers.
export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    testTimeout: 30_000,
    // A vi.stubGlobal left behind by one file must not leak into the next one.
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/types/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/*.test.ts'],
          exclude: ['test/*.integration.test.ts', 'test/*.built.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'built',
          include: ['test/*.built.test.ts'],
          // The built-app suite owns its server startup.
          hookTimeout: 60_000,
        },
      },
    ],
  },
  resolve: {
    alias: [{ find: /^@\//, replacement: `${srcDirectory}/` }],
    conditions: ['node', 'import', 'default'],
  },
})
