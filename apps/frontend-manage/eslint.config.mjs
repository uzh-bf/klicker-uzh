import coreWebVitals from 'eslint-config-next/core-web-vitals'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
  ...coreWebVitals,
  {
    rules: {
      // Owner: frontend maintainers. Remove each override when this app reports
      // zero violations for that rule under the pinned Next config.
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  globalIgnores([
    'public/sw*.js*',
    'public/workbox-*.js*',
    'public/fallback*.js*',
    'public/worker*.js',
  ]),
])

export default eslintConfig
