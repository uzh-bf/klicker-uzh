import {
  TailwindAnimations,
  TailwindColorsUZH,
  TailwindFonts,
} from '@uzh-bf/design-system/dist/constants'

export default {
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
