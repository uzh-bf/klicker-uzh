const { TailwindColorsUZH } = require('@uzh-bf/design-system/dist/constants')

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ...TailwindColorsUZH,
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
}
