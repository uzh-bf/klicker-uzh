import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/util.ts'],
  clean: false,
  target: 'node18',
})
