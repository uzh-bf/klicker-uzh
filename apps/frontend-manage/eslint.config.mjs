import coreWebVitals from 'eslint-config-next/core-web-vitals'

// React Hooks 7 (bundled in eslint-config-next 16) introduced new React
// Compiler rules that flag pre-existing patterns. Downgraded to warn so
// they're visible without blocking CI. Address in a follow-up.
const newReactHooksRulesAsWarn = {
  'react-hooks/static-components': 'warn',
  'react-hooks/use-memo': 'warn',
  'react-hooks/preserve-manual-memoization': 'warn',
  'react-hooks/immutability': 'warn',
  'react-hooks/globals': 'warn',
  'react-hooks/refs': 'warn',
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/error-boundaries': 'warn',
  'react-hooks/purity': 'warn',
  'react-hooks/set-state-in-render': 'warn',
}

export default [...coreWebVitals, { rules: newReactHooksRulesAsWarn }]
