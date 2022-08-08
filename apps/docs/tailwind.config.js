const { TailwindColorsUZH } = require('@uzh-bf/design-system/dist/constants')

module.exports = {
  content: ['./src/**/*.tsx', './docs/**/*.mdx', './blog/**/*.mdx'],
  theme: {
    extend: {
      colors: {
        ...TailwindColorsUZH,
        primary: '#dc6027',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
