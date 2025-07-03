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
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
}

export default tailwindConfig
