// Merges the static assets of earlier releases into the new build's
// `.next/static`, so one image can serve every asset URL that a page of a
// retained release may still request.
//
// Each build writes `releases/<buildId>.txt`, which lists that build's files,
// and `releases/index.txt`, which lists the retained build IDs newest first.
// The directory has no leading dot because the Next.js static handler does not
// serve dot-prefixed path segments.
//
// Usage: node merge-release-assets.mjs <static-dir> <build-id> [<previous-static-dir>]
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RETAINED_PREVIOUS_RELEASES = 5
const RELEASES_DIR = 'releases'
const INDEX_FILE = 'index.txt'
// Names the files of an image built before manifests existed.
const BOOTSTRAP_ID = 'bootstrap'

function listFiles(root, relativeDir = '') {
  return readdirSync(join(root, relativeDir), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = join(relativeDir, entry.name)
      if (entry.isDirectory()) return listFiles(root, relativePath)
      return entry.isFile() ? [relativePath.split(sep).join('/')] : []
    })
    .filter((file) => !file.startsWith(`${RELEASES_DIR}/`))
    .sort()
}

function readLines(file) {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split('\n').filter(Boolean)
}

// A manifest line must stay inside the static directory.
function isSafeRelativePath(file) {
  const normalized = normalize(file)
  return (
    !normalized.startsWith('..') &&
    !normalized.startsWith(sep) &&
    normalized === file.split('/').join(sep)
  )
}

function copyIfAbsent(fromRoot, toRoot, file) {
  const target = join(toRoot, file)
  const source = join(fromRoot, file)
  if (existsSync(target) || !existsSync(source)) return
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
}

export function mergeReleaseAssets({ staticDir, buildId, previousDir }) {
  const releasesDir = join(staticDir, RELEASES_DIR)
  mkdirSync(releasesDir, { recursive: true })
  writeFileSync(
    join(releasesDir, `${buildId}.txt`),
    listFiles(staticDir).join('\n') + '\n'
  )

  let previousIds = []
  if (previousDir && existsSync(previousDir)) {
    previousIds = readLines(join(previousDir, RELEASES_DIR, INDEX_FILE))
    if (previousIds.length === 0 && listFiles(previousDir).length > 0) {
      mkdirSync(join(previousDir, RELEASES_DIR), { recursive: true })
      writeFileSync(
        join(previousDir, RELEASES_DIR, `${BOOTSTRAP_ID}.txt`),
        listFiles(previousDir).join('\n') + '\n'
      )
      previousIds = [BOOTSTRAP_ID]
    }
  }

  const retainedIds = previousIds
    .filter((id) => id !== buildId)
    .slice(0, RETAINED_PREVIOUS_RELEASES)
  for (const id of retainedIds) {
    const manifest = join(RELEASES_DIR, `${id}.txt`)
    for (const file of readLines(join(previousDir, manifest))) {
      if (isSafeRelativePath(file)) copyIfAbsent(previousDir, staticDir, file)
    }
    copyIfAbsent(previousDir, staticDir, manifest)
  }

  writeFileSync(
    join(releasesDir, INDEX_FILE),
    [buildId, ...retainedIds].join('\n') + '\n'
  )
  return [buildId, ...retainedIds]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [staticDir, buildId, previousDir] = process.argv.slice(2)
  if (!staticDir || !buildId) {
    console.error(
      'usage: merge-release-assets.mjs <static-dir> <build-id> [<previous-static-dir>]'
    )
    process.exit(2)
  }
  const retained = mergeReleaseAssets({ staticDir, buildId, previousDir })
  console.log(`retained releases: ${retained.join(' ')}`)
}
