import { defineConfig } from 'tsup'

export default defineConfig({
  entry:
    process.env.NODE_ENV === 'test'
      ? ['instrumented/index.ts', 'instrumented/ops.ts']
      : ['src/index.ts', 'src/ops.ts'],
  clean: false,
  dts: true,
  publicDir: 'src/public',
  target: 'node18',
})
