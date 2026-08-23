// These paths were intentionally removed from the engineering wiki. Keep the
// check filesystem-based so it also catches untracked or ignored recreations.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const forbiddenPaths = ['docs/index.md', 'docs/log.md', 'docs/log/']
const presentPaths = forbiddenPaths.filter((relativePath) => {
  try {
    fs.lstatSync(path.join(rootDir, relativePath))
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
})

if (presentPaths.length > 0) {
  console.error('Removed engineering-wiki paths must not be recreated:')
  for (const relativePath of presentPaths) {
    console.error(`- ${relativePath}`)
  }
  process.exitCode = 1
} else {
  console.log('Removed engineering-wiki path check passed.')
}
