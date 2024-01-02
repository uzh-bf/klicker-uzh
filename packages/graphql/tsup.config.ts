import { defineConfig } from 'tsup'

export default defineConfig({
  entry:
    process.env.NODE_ENV === 'test'
      ? ['instrumented/index.ts', 'instrumented/ops.ts', 'instrumented/util.ts']
      : ['src/index.ts', 'src/ops.ts', 'src/util.ts'],
  clean: false,
  dts: true,
  publicDir: 'src/public',
  target: 'node18',
})
