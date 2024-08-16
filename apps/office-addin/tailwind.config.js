const { TailwindColorsUZH } = require("@uzh-bf/design-system/dist/constants");

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./src/*.html"],
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
    require("tailwindcss-radix")({
      variantPrefix: "rdx",
    }),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
    require("@tailwindcss/forms"),
  ],
};
