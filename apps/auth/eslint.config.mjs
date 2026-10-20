import { defineConfig } from 'eslint/config'
import coreWebVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = defineConfig([
  ...coreWebVitals,
  { ignores: ['coverage/**'] },
])

export default eslintConfig
