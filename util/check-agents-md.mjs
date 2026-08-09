// Smoke check for AGENTS.md: relative links must resolve and `pnpm run` /
// `pnpm --filter` commands must reference existing package.json scripts.
// Warn-only for now (always exits 0); graduate to exit(1) once stable.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

// Mirrors pnpm-workspace.yaml: apps/*, packages/*, playwright
const workspaceDirs = [
  '.',
  'playwright',
  ...['apps', 'packages'].flatMap((parent) =>
    fs
      .readdirSync(path.join(ROOT_DIR, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parent, entry.name))
  ),
]

const packages = new Map()
for (const dir of workspaceDirs) {
  const pkgPath = path.join(ROOT_DIR, dir, 'package.json')
  if (!fs.existsSync(pkgPath)) continue
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  packages.set(pkg.name, {
    scripts: pkg.scripts ?? {},
    path: path.join(dir, 'package.json'),
  })
}
const rootScripts = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')
).scripts

const agentsContent = fs.readFileSync(path.join(ROOT_DIR, 'AGENTS.md'), 'utf8')
let warnings = 0
const warn = (message) => {
  console.warn(`[WARNING] ${message}`)
  warnings += 1
}

for (const [, text, target] of agentsContent.matchAll(
  /\[([^\]]+)\]\(([^)]+)\)/g
)) {
  const link = target.split('#')[0]
  if (link === '' || /^(https?:|mailto:|file:)/.test(link)) continue
  const cleanLink = link.startsWith('/') ? link.slice(1) : link
  if (!fs.existsSync(path.resolve(ROOT_DIR, cleanLink))) {
    warn(`Broken link: "${text}" -> "${link}" does not exist.`)
  }
}

for (const [, command] of agentsContent.matchAll(/`([^`]+)`/g)) {
  const runMatch = command.trim().match(/^pnpm run (\S+)/)
  if (runMatch && !rootScripts[runMatch[1]]) {
    warn(
      `\`${command}\` references script "${runMatch[1]}" missing from root package.json.`
    )
  }

  const filterMatch = command
    .trim()
    .match(/^pnpm --filter (\S+) (?:run )?(\S+)/)
  if (filterMatch) {
    const [, pkgName, script] = filterMatch
    const pkg = packages.get(pkgName)
    if (!pkg) {
      warn(`\`${command}\` references unknown package "${pkgName}".`)
    } else if (!pkg.scripts[script]) {
      warn(
        `\`${command}\` references script "${script}" missing from ${pkg.path}.`
      )
    }
  }
}

console.log(
  warnings > 0
    ? `AGENTS.md check completed with ${warnings} warning(s).`
    : 'AGENTS.md check completed with zero warnings.'
)
