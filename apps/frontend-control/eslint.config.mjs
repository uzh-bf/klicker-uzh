import coreWebVitals from 'eslint-config-next/core-web-vitals'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
  ...coreWebVitals,
  {
    rules: {
      // Owner: frontend maintainers. Remove this override when this app reports
      // zero violations for the rule under the pinned Next config.
      'react-hooks/set-state-in-effect': 'off',
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
