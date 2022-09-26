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
  plugins: [
    require("tailwindcss-radix")({
      variantPrefix: "rdx",
    }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/line-clamp'),
  ],
}
