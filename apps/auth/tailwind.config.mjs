import {
  TailwindAnimations,
  TailwindColorsUZH,
  TailwindFonts,
} from '@uzh-bf/design-system/dist/constants'

const tailwindConfig = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
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
}

export default tailwindConfig
