import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const appRoot = process.cwd()
const prodServerUrl = 'https://pwa.klicker.uzh.ch'
const devServerPattern = /pwa\.klicker\.com/

const expectedServerUrl = process.env.CAPACITOR_SERVER_URL
const requestedPlatforms = new Set(process.argv.slice(2))

const errors = []

if (expectedServerUrl !== prodServerUrl) {
  errors.push(
    `CAPACITOR_SERVER_URL must be ${prodServerUrl} for release checks.`
  )
}

function readOptional(path) {
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8')
}

function shouldCheck(platform) {
  return requestedPlatforms.size === 0 || requestedPlatforms.has(platform)
}

function checkCapacitorConfig(path, platform) {
  if (!shouldCheck(platform)) return

  const content = readOptional(path)
  if (!content) {
    errors.push(`${path} is missing. Run cap sync ${platform} first.`)
    return
  }

  if (devServerPattern.test(content)) {
    errors.push(`${path} contains local development domain pwa.klicker.com.`)
  }

  const config = JSON.parse(content)

  if (config.server?.url !== prodServerUrl) {
    errors.push(`${path} server.url is ${config.server?.url ?? 'missing'}.`)
  }

  if (config.server?.cleartext === true) {
    errors.push(`${path} has server.cleartext enabled.`)
  }
}

function checkInfoPlist(path) {
  const content = readOptional(path)
  if (!content) return

  if (
    content.includes('<key>NSAllowsArbitraryLoads</key>') &&
    content.includes('<true/>')
  ) {
    errors.push(`${path} allows arbitrary network loads.`)
  }
}

checkCapacitorConfig(
  join(appRoot, 'android/app/src/main/assets/capacitor.config.json'),
  'android'
)
checkCapacitorConfig(join(appRoot, 'ios/App/App/capacitor.config.json'), 'ios')
checkInfoPlist(join(appRoot, 'ios/App/App/Info.plist'))

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exit(1)
}

console.log('Capacitor release configuration looks safe.')
