#!/usr/bin/env node
// Generates the browser code runtime files that an app serves under
// /code-runtimes/<version>/ from the exact-pinned pyodide and webr packages.
//
// Every file is verified against the checked-in manifest before it is copied,
// so a changed package, a tampered file or a stale manifest fails the build
// instead of publishing unreviewed bytes. The browser host verifies the same
// hashes again before it hands the bytes to the sandboxed runner.
//
//   klicker-code-runtimes --out public/code-runtimes  verify and generate
//   klicker-code-runtimes --write-manifest            refresh the manifest
//
// The version segment is derived from the manifest content, so browsers can
// cache the files as immutable and a changed file always gets a new path.
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = join(PACKAGE_DIR, 'src/runtime-manifest.json')
const RUNNER_SOURCES = join(PACKAGE_DIR, 'src/runner')
// Both runner documents carry the same inline bootstrap; the proxy gives
// each its own CSP, because only the R runtime needs 'unsafe-eval'.
export const RUNNER_DOCUMENTS = ['runner-python.html', 'runner-r.html']

const CONTENT_TYPES = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
}

function packageDir(name) {
  return realpathSync(join(PACKAGE_DIR, 'node_modules', name))
}

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? walk(path) : [path]
    })
}

// The qualified runtime profiles: asset id -> source path. Python is the
// Pyodide core with its standard library; R is webR with the base R
// distribution. Package repositories are deliberately absent, so a program
// that tries to install packages fails closed inside the runner.
export function collectSources() {
  const pyodide = packageDir('pyodide')
  const webrDist = join(packageDir('webr'), 'dist')
  const python = {
    'runner/shim.js': join(RUNNER_SOURCES, 'shim.js'),
    'runner/py-worker.js': join(RUNNER_SOURCES, 'py-worker.js'),
  }
  for (const name of [
    'pyodide.js',
    'pyodide.asm.mjs',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
  ]) {
    python[`pyodide/${name}`] = join(pyodide, name)
  }
  const r = { 'runner/shim.js': join(RUNNER_SOURCES, 'shim.js') }
  for (const name of [
    'webr.js',
    'webr-worker.js',
    'R.js',
    'R.wasm',
    'libRblas.so',
    'libRlapack.so',
  ]) {
    r[`webr/${name}`] = join(webrDist, name)
  }
  for (const path of walk(join(webrDist, 'vfs'))) {
    r[`webr/${relative(webrDist, path).split(sep).join('/')}`] = path
  }
  return {
    runnerScript: readFileSync(join(RUNNER_SOURCES, 'bootstrap.js'), 'utf8'),
    profiles: { 'python-core': python, 'r-base': r },
    notices: {
      'LICENSE-webR.md': join(packageDir('webr'), 'LICENSE.md'),
    },
  }
}

export function sha256(buffer, encoding = 'hex') {
  return createHash('sha256').update(buffer).digest(encoding)
}

export function runnerDocument(runnerScript) {
  if (/<\/script|<!--/i.test(runnerScript)) {
    throw new Error('Runner bootstrap contains an HTML-terminating sequence')
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Code runner</title></head><body><script>${runnerScript}</script></body></html>\n`
}

export function describeFiles(profiles, readFile = readFileSync) {
  const files = {}
  for (const sources of Object.values(profiles)) {
    for (const [id, path] of Object.entries(sources)) {
      const buffer = readFile(path)
      files[id] = {
        sha256: sha256(buffer),
        size: buffer.length,
        type: CONTENT_TYPES[extname(id)] ?? 'application/octet-stream',
      }
    }
  }
  return files
}

// Code-unit order, independent of the machine's locale, keeps the manifest
// byte-stable wherever it is regenerated.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b)

export function buildManifest(
  profiles,
  readFile = readFileSync,
  runnerScript = ''
) {
  const files = describeFiles(profiles, readFile)
  const sortedFiles = Object.fromEntries(
    Object.keys(files)
      .sort(byCodeUnit)
      .map((id) => [id, files[id]])
  )
  const profileIds = Object.fromEntries(
    Object.entries(profiles).map(([name, sources]) => [
      name,
      Object.keys(sources).sort(byCodeUnit),
    ])
  )
  // The proxy pins the inline bootstrap by this hash in the runner CSP.
  const runnerScriptSha256 = sha256(runnerScript, 'base64')
  const version = sha256(
    JSON.stringify({
      files: sortedFiles,
      profiles: profileIds,
      runnerScriptSha256,
    })
  ).slice(0, 16)
  return {
    version,
    runnerScriptSha256,
    profiles: profileIds,
    files: sortedFiles,
  }
}

// Returns a list of human-readable differences; empty means the sources match
// the reviewed manifest exactly.
export function compareManifest(expected, actual) {
  const problems = []
  if (expected.version !== actual.version) {
    problems.push(
      `version ${actual.version} does not match manifest ${expected.version}`
    )
  }
  if (expected.runnerScriptSha256 !== actual.runnerScriptSha256) {
    problems.push('runner bootstrap hash mismatch')
  }
  for (const id of Object.keys(expected.files)) {
    const want = expected.files[id]
    const got = actual.files[id]
    if (!got) problems.push(`missing ${id}`)
    else if (got.sha256 !== want.sha256 || got.size !== want.size) {
      problems.push(`hash mismatch ${id}`)
    }
  }
  for (const id of Object.keys(actual.files)) {
    if (!expected.files[id]) problems.push(`unexpected ${id}`)
  }
  return problems
}

function sourceNotice(manifestVersion) {
  const read = (name) =>
    JSON.parse(readFileSync(join(packageDir(name), 'package.json'), 'utf8'))
  const pyodide = read('pyodide')
  const webr = read('webr')
  return `# Browser code runtimes ${manifestVersion}

These files are unmodified copies from the npm packages below. KlickerUZH
serves them to run learner code locally in the browser.

| Package | Version | Licence | Corresponding source |
| --- | --- | --- | --- |
| pyodide | ${pyodide.version} | ${pyodide.license}; CPython standard library PSF-2.0 | https://github.com/pyodide/pyodide/tree/${pyodide.version} |
| webr | ${webr.version} | binaries GPL-3.0, see LICENSE-webR.md | https://github.com/r-wasm/webr/tree/v${webr.version} |

The webR licence text is in LICENSE-webR.md. The Mozilla Public License 2.0 is
at https://mozilla.org/MPL/2.0/.
`
}

export function generate({ outDir, writeManifest = false } = {}) {
  const { profiles, notices, runnerScript } = collectSources()
  const actual = buildManifest(profiles, readFileSync, runnerScript)
  if (writeManifest) {
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(actual, null, 2)}\n`)
  }
  const expected = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const problems = compareManifest(expected, actual)
  if (problems.length > 0) {
    throw new Error(
      `Browser code runtime files do not match ${relative(PACKAGE_DIR, MANIFEST_PATH)}:\n  ${problems.join('\n  ')}\nRun "klicker-code-runtimes --write-manifest" only after reviewing the change.`
    )
  }
  if (!outDir) return actual

  // Regeneration empties outDir first, so refuse any directory that contains
  // the working directory or this package.
  for (const kept of [process.cwd(), PACKAGE_DIR]) {
    const fromOut = relative(resolve(outDir), kept)
    if (!fromOut.startsWith('..') && !isAbsolute(fromOut)) {
      throw new Error(`Refusing to replace ${outDir}: it contains ${kept}.`)
    }
  }
  rmSync(outDir, { recursive: true, force: true })
  const target = join(outDir, actual.version)
  for (const sources of Object.values(profiles)) {
    for (const [id, path] of Object.entries(sources)) {
      mkdirSync(dirname(join(target, id)), { recursive: true })
      copyFileSync(path, join(target, id))
    }
  }
  for (const [name, path] of Object.entries(notices)) {
    copyFileSync(path, join(target, name))
  }
  for (const name of RUNNER_DOCUMENTS) {
    writeFileSync(join(target, name), runnerDocument(runnerScript))
  }
  writeFileSync(join(target, 'NOTICE.md'), sourceNotice(actual.version))
  return actual
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const outIndex = process.argv.indexOf('--out')
    const outArg = outIndex === -1 ? undefined : process.argv[outIndex + 1]
    if (outIndex !== -1 && (!outArg || outArg.startsWith('--'))) {
      throw new Error('--out needs a directory.')
    }
    const outDir = outArg === undefined ? undefined : resolve(outArg)
    const writeManifest = process.argv.includes('--write-manifest')
    if (!outDir && !writeManifest) {
      throw new Error('Pass --out <directory> or --write-manifest.')
    }
    const manifest = generate({ outDir, writeManifest })
    console.log(
      `[code-runtimes] ${Object.keys(manifest.files).length} files, version ${manifest.version}`
    )
  } catch (error) {
    console.error(`[code-runtimes] ${error.message}`)
    process.exit(1)
  }
}
