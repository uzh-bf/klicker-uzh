import {
  TailwindAnimations,
  TailwindColorsUZH,
} from '@uzh-bf/design-system/dist/constants'
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.tsx',
    './docs/**/*.mdx',
    // import is required for corresponding styles to be included correctly
    // otherwise, shadcn variable-based styles might be missing (unless used in application and matched by regex above)
    './node_modules/@uzh-bf/design-system/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      ...TailwindAnimations,
      color: TailwindColorsUZH,
      fontFamily: {
        sans: ['Source Sans Pro', fontFamily.sans],
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  corePlugins: {
    preflight: false,
    aspectRatio: false,
  },
  plugins: ['@tailwindcss/typography'],
}
