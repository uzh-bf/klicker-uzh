import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'

import {
  mergeReleaseAssets,
  RETAINED_PREVIOUS_RELEASES,
} from './merge-release-assets.mjs'

function write(root, file, content) {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), content)
}

function build(files, buildId, previousDir) {
  const staticDir = mkdtempSync(join(tmpdir(), 'static-'))
  for (const [file, content] of Object.entries(files)) {
    write(staticDir, file, content)
  }
  mergeReleaseAssets({ staticDir, buildId, previousDir })
  return staticDir
}

describe('mergeReleaseAssets', () => {
  it('keeps the new build, retains five previous releases and never overwrites', () => {
    let previous
    for (let release = 1; release <= 8; release += 1) {
      previous = build(
        {
          [`b${release}/_buildManifest.js`]: `manifest ${release}`,
          'chunks/shared.js': `shared ${release > 3 ? 'v2' : 'v1'}`,
          [`chunks/own-${release}.js`]: `own ${release}`,
        },
        `b${release}`,
        previous
      )
    }

    const index = readFileSync(join(previous, 'releases/index.txt'), 'utf8')
    assert.deepEqual(
      index.trim().split('\n'),
      ['b8', 'b7', 'b6', 'b5', 'b4', 'b3'],
      `new build plus ${RETAINED_PREVIOUS_RELEASES} previous releases`
    )
    assert.ok(existsSync(join(previous, 'b3/_buildManifest.js')))
    assert.ok(!existsSync(join(previous, 'b2/_buildManifest.js')))
    assert.ok(!existsSync(join(previous, 'chunks/own-2.js')))
    assert.equal(
      readFileSync(join(previous, 'chunks/shared.js'), 'utf8'),
      'shared v2'
    )
  })

  it('keeps a file shared with a retained release', () => {
    const first = build({ 'chunks/a.js': 'a', 'chunks/b.js': 'b' }, 'one')
    const second = build({ 'chunks/b.js': 'b2' }, 'two', first)
    assert.equal(readFileSync(join(second, 'chunks/b.js'), 'utf8'), 'b2')
    assert.equal(readFileSync(join(second, 'chunks/a.js'), 'utf8'), 'a')
  })

  it('adopts an image without manifests as one retained release', () => {
    const legacy = mkdtempSync(join(tmpdir(), 'legacy-'))
    write(legacy, 'old/_buildManifest.js', 'old')
    const merged = build({ 'new/_buildManifest.js': 'new' }, 'new', legacy)
    assert.ok(existsSync(join(merged, 'old/_buildManifest.js')))
    assert.equal(
      readFileSync(join(merged, 'releases/index.txt'), 'utf8'),
      'new\nbootstrap\n'
    )
  })

  it('works without a previous release', () => {
    const merged = build({ 'new/_buildManifest.js': 'new' }, 'new')
    assert.equal(
      readFileSync(join(merged, 'releases/index.txt'), 'utf8'),
      'new\n'
    )
  })
})
