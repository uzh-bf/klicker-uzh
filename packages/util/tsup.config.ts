import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/pure.ts', 'src/types.ts'],
  clean: true,
  format: 'esm',
  target: 'node20',
  dts: true,
  // splitting: false,
  sourcemap: true,
  // treeshake: true,
  // skipNodeModulesBundle: true,
})
