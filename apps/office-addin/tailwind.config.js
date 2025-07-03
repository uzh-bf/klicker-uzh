import { TailwindColorsUZH } from '@uzh-bf/design-system/dist/constants'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/*.html',
    // import is required for corresponding styles to be included correctly
    // otherwise, shadcn variable-based styles might be missing (unless used in application and matched by regex above)
    './node_modules/@uzh-bf/design-system/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: TailwindColorsUZH,
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
