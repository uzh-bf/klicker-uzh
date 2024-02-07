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
    aspectRatio: false,
  },

  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.transform-rotateY-0': {
          transform: 'rotateY(0deg)',
        },
        '.transform-rotateY-180': {
          transform: 'rotateY(180deg)',
        },
        '.transform-style-preserve-3d': {
          transformStyle: 'preserve-3d',
        },
        '.transition-transform-0_6s': {
          transition: 'transform 0.6s',
        },
        '.backface-hidden': {
          backfaceVisibility: 'hidden',
        },
      }
      addUtilities(newUtilities)
    },
    // require('tailwindcss-radix')({
    //   variantPrefix: 'rdx',
    // }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
  ],
}
