const {
  TailwindColorsUZH,
  TailwindAnimations,
  TailwindFonts,
} = require('@uzh-bf/design-system/dist/constants')
const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      ...TailwindAnimations,
      colors: {
        ...TailwindColorsUZH,
      },
      screens: {
        xs: '480px',
      },
      fontFamily: {
        sans: ['var(--source-sans-pro)', ...fontFamily.sans],
      },
    },
  },
  plugins: [
    require('tailwindcss-radix')({ variantPrefix: 'rdx' }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/line-clamp'),
  ],
  corePlugins: {
    preflight: false,
    aspectRatio: false,
  },
}
