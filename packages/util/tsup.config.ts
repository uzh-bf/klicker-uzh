import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/pure.ts'],
  clean: true,
  format: 'cjs',
  target: 'node18',
  dts: true,
})
