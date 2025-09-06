import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Enable globals (describe, it, expect, etc.) without importing
    globals: true,

    // Test timeout for integration tests that need Azure/Docker
    testTimeout: 30000, // 30 seconds

    // Hook timeouts for setup/teardown
    hookTimeout: 10000, // 10 seconds

    // Include test files
    include: ['test/**/*.{test,spec}.{js,ts}'],

    // Exclude files
    exclude: [
      'node_modules',
      'dist',
      'test/fixtures/**',
      'test/manual-test.http',
      'test/README.md',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'test/**',
        'dist/**',
        'rollup.config.js',
        'vitest.config.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },

    // Setup files run before each test file
    setupFiles: [],

    // Global setup/teardown (runs once for entire test suite)
    // Note: Docker setup is handled in individual test files for now

    // Reporter configuration
    reporter: ['verbose', 'json'],

    // Retry failed tests (useful for flaky integration tests)
    retry: 1,

    // Run tests in sequence for integration tests that might conflict
    pool: 'threads',
    poolOptions: {
      threads: {
        // Limit concurrency for integration tests that use shared Docker resources
        maxThreads: 2,
        minThreads: 1,
      },
    },
  },
})
