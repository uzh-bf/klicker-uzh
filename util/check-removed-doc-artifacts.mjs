// These paths were intentionally removed from the engineering wiki. The
// filesystem check catches untracked or ignored recreations, while hooks also
// supply exact index and tree inventories.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const FORBIDDEN_DOC_PATHS = Object.freeze([
  'docs/index.md',
  'docs/log.md',
  'docs/log/',
])

function matchesForbiddenPath(inventoryPath, forbiddenPath) {
  const normalized = forbiddenPath.endsWith('/')
    ? forbiddenPath.slice(0, -1)
    : forbiddenPath
  return (
    inventoryPath === normalized || inventoryPath.startsWith(normalized + '/')
  )
}

function findForbiddenPaths(inventory) {
  if (!Array.isArray(inventory)) {
    throw new Error('Document inventory must be an array of paths')
  }
  return FORBIDDEN_DOC_PATHS.filter((forbiddenPath) =>
    inventory.some((inventoryPath) =>
      matchesForbiddenPath(inventoryPath, forbiddenPath)
    )
  )
}

function findFilesystemForbiddenPaths(root = rootDir) {
  return FORBIDDEN_DOC_PATHS.filter((relativePath) => {
    try {
      fs.lstatSync(path.join(root, relativePath))
      return true
    } catch (error) {
      if (error.code === 'ENOENT') return false
      throw error
    }
  })
}

function assertNoForbiddenPaths(presentPaths, label) {
  if (presentPaths.length === 0) return
  console.error('Removed engineering-wiki paths must not be recreated:')
  if (label) console.error('Inventory: ' + label)
  for (const relativePath of presentPaths) {
    console.error('- ' + relativePath)
  }
  throw new Error('Removed engineering-wiki paths must not be recreated')
}

export function checkRemovedDocArtifacts({
  root = rootDir,
  inventories = [],
} = {}) {
  const filesystemPaths = findFilesystemForbiddenPaths(root)
  assertNoForbiddenPaths(filesystemPaths, 'working tree')
  for (const { label, paths } of inventories) {
    assertNoForbiddenPaths(findForbiddenPaths(paths), label)
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    checkRemovedDocArtifacts()
    console.log('Removed engineering-wiki path check passed.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
