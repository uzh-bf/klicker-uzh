import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  noExternal: [/@klicker-uzh.*/],
  dts: true,
})
