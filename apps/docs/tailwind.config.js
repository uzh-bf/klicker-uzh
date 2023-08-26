const {
  TailwindColorsUZH,
  TailwindAnimations,
  TailwindFonts,
} = require('@uzh-bf/design-system/dist/constants')

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
        ...TailwindFonts,
      },
    },
  },
  corePlugins: {
    preflight: false,
    aspectRatio: false,
  },
  plugins: [],

}
