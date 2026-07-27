import officeAddins from 'eslint-plugin-office-addins'
import tseslint from 'typescript-eslint'

export default [
  ...officeAddins.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      'no-undef': 'off',
    },
  },
]
