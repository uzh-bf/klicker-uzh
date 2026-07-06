import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

function getPackageJsonFiles(dir) {
  const results = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      if (
        file === 'node_modules' ||
        file === '.git' ||
        file === '.turbo' ||
        file === '.next'
      ) {
        continue
      }
      results.push(...getPackageJsonFiles(filePath))
    } else if (file === 'package.json') {
      results.push(filePath)
    }
  }
  return results
}

function runCheck() {
  console.log('Running AGENTS.md smoke check...')
  let hasWarnings = false

  // 1. Build a map of packages and their scripts
  const packageMap = new Map()
  const packageJsons = getPackageJsonFiles(ROOT_DIR)

  for (const pkgJsonPath of packageJsons) {
    try {
      const content = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
      const name = content.name
      const scripts = content.scripts || {}
      const relativePath = path.relative(ROOT_DIR, pkgJsonPath)
      packageMap.set(name, { scripts, path: relativePath })
    } catch (e) {
      console.warn(
        `Warning: Failed to parse package.json at ${pkgJsonPath}:`,
        e.message
      )
    }
  }

  // Get root package scripts
  const rootPackageJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')
  )
  const rootScripts = rootPackageJson.scripts || {}

  // 2. Read and parse AGENTS.md
  const agentsMdPath = path.join(ROOT_DIR, 'AGENTS.md')
  if (!fs.existsSync(agentsMdPath)) {
    console.error('Error: AGENTS.md not found!')
    process.exit(1)
  }

  const agentsContent = fs.readFileSync(agentsMdPath, 'utf8')

  // Regex to match relative links, e.g. [text](relative/path)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  console.log('\nChecking markdown links inside AGENTS.md...')
  while ((match = linkRegex.exec(agentsContent)) !== null) {
    const linkText = match[1]
    let linkUrl = match[2].split('#')[0] // ignore hash fragments

    // Ignore web links, absolute external links, mailto
    if (
      linkUrl.startsWith('http://') ||
      linkUrl.startsWith('https://') ||
      linkUrl.startsWith('mailto:') ||
      linkUrl.startsWith('#') ||
      linkUrl === ''
    ) {
      continue
    }

    // Convert file:/// absolute paths to relative if they point to the repo
    if (linkUrl.startsWith('file://')) {
      const filePrefix = 'file:///Volumes/HOME/Git/klicker/klicker-uzh/'
      const altFilePrefix = 'file://'
      if (linkUrl.startsWith(filePrefix)) {
        linkUrl = linkUrl.substring(filePrefix.length)
      } else if (linkUrl.includes('klicker-uzh')) {
        const parts = linkUrl.split('klicker-uzh/')
        linkUrl = parts[parts.length - 1]
      } else {
        // External absolute file link, ignore
        continue
      }
    }

    const resolvedPath = path.resolve(ROOT_DIR, linkUrl)
    if (!fs.existsSync(resolvedPath)) {
      console.warn(
        `[WARNING] Broken Link: "${linkText}" -> target "${linkUrl}" (Resolved: ${resolvedPath}) does not exist.`
      )
      hasWarnings = true
    } else {
      console.log(`[OK] Link: "${linkText}" -> ${linkUrl}`)
    }
  }

  // Regex to find backticked scripts/commands
  const codeRegex = /`([^`]+)`/g
  console.log('\nChecking script commands inside AGENTS.md...')
  while ((match = codeRegex.exec(agentsContent)) !== null) {
    const command = match[1].trim()

    // Check root pnpm commands
    if (command.startsWith('pnpm run ')) {
      const scriptName = command.substring('pnpm run '.length).split(' ')[0]
      if (!rootScripts[scriptName]) {
        console.warn(
          `[WARNING] Command \`${command}\` references script "${scriptName}" which is not defined in root package.json.`
        )
        hasWarnings = true
      } else {
        console.log(`[OK] Root Command: \`${command}\``)
      }
    }

    // Check workspace-filtered commands, e.g., pnpm --filter @klicker-uzh/graphql generate
    else if (command.startsWith('pnpm --filter ')) {
      const parts = command.substring('pnpm --filter '.length).split(/\s+/)
      const pkgName = parts[0]
      let scriptName = parts[1] === 'run' ? parts[2] : parts[1]
      if (scriptName) {
        scriptName = scriptName.split(' ')[0]
      }

      if (!pkgName || !scriptName) {
        continue
      }

      const pkgInfo = packageMap.get(pkgName)
      if (!pkgInfo) {
        console.warn(
          `[WARNING] Command \`${command}\` references unknown package "${pkgName}".`
        )
        hasWarnings = true
      } else {
        // Note: standard commands like 'test', 'build', 'lint' can run even if not in package.json scripts (standard lifecycle hooks / pnpm fallback)
        const isStandardLifecycle = ['test', 'build', 'lint', 'check'].includes(
          scriptName
        )
        if (!pkgInfo.scripts[scriptName] && !isStandardLifecycle) {
          console.warn(
            `[WARNING] Command \`${command}\` references script "${scriptName}" which does not exist in ${pkgInfo.path}.`
          )
          hasWarnings = true
        } else {
          console.log(`[OK] Filtered Command: \`${command}\``)
        }
      }
    }
  }

  if (hasWarnings) {
    console.log('\nAGENTS.md check completed with warnings.')
  } else {
    console.log('\nAGENTS.md check completed successfully with zero warnings.')
  }

  // Warn-only exit code for first iteration
  process.exit(0)
}

runCheck()
