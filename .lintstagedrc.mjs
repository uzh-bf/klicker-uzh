import { lstatSync } from 'fs'

// Skip symlinks (the repo checks in skill/config symlinks that must not be
// rewritten by a formatter).
const realFiles = (stagedFiles) =>
  stagedFiles.filter((f) => {
    try {
      return !lstatSync(f).isSymbolicLink()
    } catch {
      return false
    }
  })

// Biome owns code everywhere except the E2E suites; playwright/ and cypress/
// stay on Prettier (Biome mangles their `test.describe.serial()` chains).
const isE2E = (f) => /(^|\/)(playwright|cypress)\//.test(f)

export default {
  // Code, JSON and CSS: Biome (check-only; run `pnpm format` to fix), except
  // the E2E suites which route to Prettier below.
  '*.{js,jsx,ts,tsx,cjs,mjs,json,jsonc,css}': (stagedFiles) => {
    const files = realFiles(stagedFiles)
    const biomeFiles = files.filter((f) => !isE2E(f))
    const prettierFiles = files.filter(isE2E)
    const cmds = []
    if (biomeFiles.length > 0) {
      cmds.push(`biome format --no-errors-on-unmatched ${biomeFiles.join(' ')}`)
    }
    if (prettierFiles.length > 0) {
      cmds.push(
        `prettier --config .prettierrc.mjs --ignore-unknown --check ${prettierFiles.join(' ')}`
      )
    }
    return cmds
  },
  // Prettier owns Markdown and YAML everywhere.
  '*.{md,mdx,yaml,yml}': (stagedFiles) => {
    const files = realFiles(stagedFiles)
    if (files.length === 0) return []
    return [
      `prettier --config .prettierrc.mjs --ignore-unknown --check ${files.join(' ')}`,
    ]
  },
}
