import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['Ping/index.ts', 'ProcessResponses/index.ts'],
  clean: true,
  dts: true,
})
