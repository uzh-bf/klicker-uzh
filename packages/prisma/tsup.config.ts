import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/util.ts'],
  clean: true,
  target: 'node18',
  publicDir: 'src/public',
})
