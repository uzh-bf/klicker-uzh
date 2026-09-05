// Prettier now formats only Markdown and YAML; Biome owns all code/JSON/CSS
// formatting (incl. import organization and Tailwind class sorting). The
// prettier-plugin-organize-imports and prettier-plugin-tailwindcss plugins were
// removed with the Biome migration — see project/2026-07-19-biome-knip-repo-quality.md.
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
}
