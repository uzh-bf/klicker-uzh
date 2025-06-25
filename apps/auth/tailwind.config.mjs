import {
  TailwindAnimations,
  TailwindColorsUZH,
  TailwindFonts,
} from '@uzh-bf/design-system/dist/constants'

const tailwindConfig = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    // import is required for corresponding styles to be included correctly
    // otherwise, shadcn variable-based styles might be missing (unless used in application and matched by regex above)
    './node_modules/@uzh-bf/design-system/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      ...TailwindAnimations,
      colors: TailwindColorsUZH,
      fontFamily: TailwindFonts,
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
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
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
  ],
}

export default tailwindConfig
