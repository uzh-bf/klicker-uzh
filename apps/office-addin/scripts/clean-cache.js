import { execSync } from 'child_process'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { platform } from 'process'

async function cleanMacCache() {
  console.log('Cleaning web cache...')
  const webCachePath = join(
    homedir(),
    'Library/Containers/com.Microsoft.OsfWebHost/Data'
  )
  if (
    await fs
      .access(webCachePath)
      .then(() => true)
      .catch(() => false)
  ) {
    execSync(`rm -rf "${webCachePath}/*"`)
  }

  console.log('Cleaning PowerPoint WEF cache...')
  const wefCachePath = join(
    homedir(),
    'Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef'
  )
  if (
    await fs
      .access(wefCachePath)
      .then(() => true)
      .catch(() => false)
  ) {
    execSync(`rm -rf "${wefCachePath}/*"`)
  }
}

async function cleanWindowsCache() {
  console.log('Cleaning web cache...')
  const webCachePath = join(
    homedir(),
    'AppData/Local/Packages/Microsoft.Win32WebViewHost_cw5n1h2txyewy/AC/#!123/INetCache'
  )
  if (
    await fs
      .access(webCachePath)
      .then(() => true)
      .catch(() => false)
  ) {
    execSync(`rmdir /s /q "${webCachePath}"`)
  }

  console.log('Cleaning PowerPoint WEF cache...')
  const wefCachePath = join(
    homedir(),
    'AppData/Local/Microsoft/Office/16.0/Wef'
  )
  if (
    await fs
      .access(wefCachePath)
      .then(() => true)
      .catch(() => false)
  ) {
    execSync(`rmdir /s /q "${wefCachePath}"`)
  }
}

try {
  if (platform === 'darwin') {
    await cleanMacCache()
  } else if (platform === 'win32') {
    await cleanWindowsCache()
  } else {
    console.error('Unsupported operating system')
    process.exit(1)
  }
  console.log('Cache cleanup complete!')
} catch (error) {
  console.error('Error cleaning cache:', error)
  process.exit(1)
}
