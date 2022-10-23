import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['AddResponse/index.ts'],
  clean: true,
  dts: true,
})
