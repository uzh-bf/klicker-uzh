import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/util.ts'],
  clean: true,
})
