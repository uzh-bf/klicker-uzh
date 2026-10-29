'use strict'

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { canReuseImage } = require('./stg-image-reuse-ancestry.cjs')

const candidateSha = '7a105521270c826ccedd655d56fbcf3545942b2d'
const sourceSha = 'f75f398c957689eb27fcc9dae1a2a65262caa42b'
const image = 'ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm'
const digest =
  'sha256:2dd2be49847fe889e9e43b2687339099538e0cce6609e6f738860cc1d7ecd6ac'
const options = {
  candidateSha,
  repository: 'uzh-bf/klicker-uzh',
  image,
  digest,
  getImageRevision: async (request) => {
    assert.deepEqual(request, { repository: image, digest })
    return sourceSha
  },
}

for (const [status, expected] of [
  ['diverged', false],
  ['behind', false],
  ['ahead', true],
  ['identical', true],
]) {
  test(`cached image comparison ${status} permits reuse: ${expected}`, async () => {
    let comparisons = 0
    const actual = await canReuseImage({
      ...options,
      compare: async (request) => {
        comparisons++
        assert.deepEqual(request, {
          repository: options.repository,
          sourceSha,
          candidateSha,
        })
        return status
      },
    })
    assert.equal(actual, expected)
    assert.equal(comparisons, 1)
  })
}

test('the candidate image can be reused without a comparison', async () => {
  assert.equal(
    await canReuseImage({
      ...options,
      getImageRevision: async () => candidateSha,
      compare: () => assert.fail('equal revisions need no API comparison'),
    }),
    true
  )
})

test('missing provenance, registry and API failures do not authorize reuse', async () => {
  for (const overrides of [
    { candidateSha: '' },
    { repository: '' },
    { getImageRevision: async () => null },
    {
      getImageRevision: async () => {
        throw new Error('registry unavailable')
      },
    },
    {
      compare: async () => {
        throw new Error('API unavailable')
      },
    },
    { compare: async () => 'unknown' },
  ]) {
    await assert.rejects(canReuseImage({ ...options, ...overrides }))
  }
})

test('the action passes candidate and authentication to the check before adoption', () => {
  const action = readFileSync(
    path.join(
      __dirname,
      '../actions/staging-image-input-fingerprint/action.yml'
    ),
    'utf8'
  )
  const check = action.split('    - id: check')[1].split('    - id: adopt')[0]
  assert.match(check, /GH_TOKEN: \$\{\{ github.token \}\}/)
  assert.match(check, /SHA: \$\{\{ inputs.sha \}\}/)
  const guard = readFileSync(
    path.join(__dirname, 'stg-image-reuse-guard.sh'),
    'utf8'
  )
  const checkMode = guard.split('  check)')[1]
  assert.ok(checkMode.includes('stg-image-reuse-ancestry.cjs'))
  assert.ok(
    checkMode.indexOf('stg-image-reuse-ancestry.cjs') <
      checkMode.indexOf("printf 'adopt=true")
  )
})
