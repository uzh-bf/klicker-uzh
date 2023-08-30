const {
  TailwindColorsUZH,
  TailwindAnimations,
} = require('@uzh-bf/design-system/dist/constants')
const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.tsx', './docs/**/*.mdx'],
  theme: {
    extend: {
      ...TailwindAnimations,
      colors: {
        ...TailwindColorsUZH,
      },
      fontFamily: {
        sans: ['Source Sans Pro', fontFamily.sans],
      },
    },
  },
  corePlugins: {
    preflight: false,
    aspectRatio: false,
  },
  plugins: [require('@tailwindcss/typography')],
}
