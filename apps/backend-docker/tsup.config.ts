import { defineConfig } from 'tsup'

export default defineConfig({
  entry:
    process.env.NODE_ENV === 'test'
      ? ['instrumented/index.ts']
      : ['src/index.ts'],
  format: 'esm',
  clean: true,
  target: 'node20',
})
