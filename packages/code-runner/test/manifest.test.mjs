import { describe, expect, test } from 'vitest'
import {
  buildManifest,
  compareManifest,
  RUNNER_DOCUMENTS,
  runnerDocument,
  sha256,
} from '../scripts/code-runtimes.mjs'
import { RUNNER_DOCUMENTS as DOCUMENTS_BY_PROFILE } from '../src/manifest'

// Synthetic two-profile source set; the reader maps fake paths to bytes.
const bytes = {
  '/src/a.js': Buffer.from('console.log(1)'),
  '/src/b.wasm': Buffer.from([0, 97, 115, 109]),
}
const read = (path) => bytes[path]
const profiles = {
  python: { 'pyodide/a.js': '/src/a.js' },
  r: { 'webr/b.wasm': '/src/b.wasm' },
}

describe('browser code runtime manifest', () => {
  test('generates every document requested by the bridge and serving policy', () => {
    expect([...RUNNER_DOCUMENTS].sort()).toEqual(
      Object.values(DOCUMENTS_BY_PROFILE).sort()
    )
  })

  test.each([
    '</script>',
    '</SCRIPT >',
    '<!--',
  ])('rejects bootstrap bytes that the HTML parser would reinterpret: %s', (sequence) => {
    expect(() => runnerDocument(`const marker = '${sequence}'`)).toThrow()
  })

  test('accepts sources that match the reviewed manifest', () => {
    const manifest = buildManifest(profiles, read)

    expect(compareManifest(manifest, buildManifest(profiles, read))).toEqual([])
    expect(manifest.files['webr/b.wasm'].type).toBe('application/wasm')
  })

  test('rejects a changed file and gives it a different version', () => {
    const reviewed = buildManifest(profiles, read)
    const tampered = buildManifest(profiles, (path) =>
      path === '/src/a.js' ? Buffer.from('console.log(2)') : read(path)
    )

    expect(tampered.version).not.toBe(reviewed.version)
    expect(compareManifest(reviewed, tampered)).toContain(
      'hash mismatch pyodide/a.js'
    )
  })

  test('rejects files that the manifest does not list', () => {
    const reviewed = buildManifest(profiles, read)
    const extra = buildManifest(
      { ...profiles, r: { ...profiles.r, 'webr/c.js': '/src/a.js' } },
      read
    )

    expect(compareManifest(reviewed, extra)).toContain('unexpected webr/c.js')
  })

  test('pins the runner bootstrap and rejects a stale hash', () => {
    const script = 'console.log("runner")'
    const reviewed = buildManifest(profiles, read, script)
    const changed = buildManifest(profiles, read, 'console.log("changed")')

    expect(reviewed.runnerScriptSha256).toBe(sha256(script, 'base64'))
    expect(runnerDocument(script)).toContain(`<script>${script}</script>`)
    expect(compareManifest(reviewed, changed)).toContain(
      'runner bootstrap hash mismatch'
    )
  })
})
