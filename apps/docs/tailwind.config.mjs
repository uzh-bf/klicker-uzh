import {
  TailwindAnimations,
  TailwindColorsUZH,
} from '@uzh-bf/design-system/dist/constants'
import { fontFamily } from 'tailwindcss/defaultTheme'

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.tsx', './docs/**/*.mdx'],
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
  plugins: [require('@tailwindcss/typography')],
}
