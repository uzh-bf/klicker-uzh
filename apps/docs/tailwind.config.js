const { TailwindColorsUZH } = require('@uzh-bf/design-system/dist/constants')
const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./src/**/*.tsx', './docs/**/*.mdx'],
  theme: {
    extend: {
      colors: {
        ...TailwindColorsUZH,
        primary: '#dc6027',
      },
      fontFamily: {
        sans: ['Source Sans Pro', ...fontFamily.sans],
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
