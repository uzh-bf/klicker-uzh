import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function missingDynamicRoutes(pagesDirectory, manifest) {
  if (
    !Array.isArray(manifest?.pages) ||
    manifest.pages.some(
      (page) => typeof page !== 'string' || !page.startsWith('/')
    )
  ) {
    throw new Error('development pages manifest is malformed')
  }
  const expected = readdirSync(pagesDirectory, { recursive: true })
    .filter((path) => /\.(jsx?|tsx?)$/.test(path) && path.includes('['))
    .map((path) => {
      if (!lstatSync(join(pagesDirectory, path)).isFile()) {
        throw new Error('dynamic route source must be a regular file')
      }
      return `/${path.replace(/\.(jsx?|tsx?)$/, '').replace(/\/index$/, '')}`
    })
  if (expected.length === 0) {
    throw new Error('no dynamic route source was found')
  }
  const published = new Set(manifest.pages)
  return expected.filter((route) => !published.has(route)).sort()
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const missing = missingDynamicRoutes(
      process.argv[2],
      JSON.parse(readFileSync(0, 'utf8'))
    )
    if (missing.length > 0) {
      console.log(
        `waiting: development inventory is missing ${missing.join(', ')}`
      )
      process.exitCode = 21
    }
  } catch {
    console.log(
      'unexpected: development inventory or route source is unavailable or malformed'
    )
    process.exitCode = 22
  }
}
