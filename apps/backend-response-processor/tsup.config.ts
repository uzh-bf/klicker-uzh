import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/functions/index.ts'],
  clean: true,
  dts: true,
})
