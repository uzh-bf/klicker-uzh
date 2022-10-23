const {
  TailwindColorsUZH,
  TailwindAnimations,
  TailwindFonts,
} = require('@uzh-bf/design-system/dist/constants')

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
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
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/line-clamp'),
  ],
}
