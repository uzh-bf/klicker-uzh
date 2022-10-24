import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['ProcessResponses/index.ts'],
  clean: true,
  dts: true,
})
