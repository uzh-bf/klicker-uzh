const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  DIGEST_PATTERN,
  baseImageReferences,
  buildFingerprintRecord,
  digestFromInspect,
  fingerprintOf,
  fingerprintTag,
  fingerprintTarget,
  isReuseEligible,
  listTrackedFiles,
  normalizeBuildArguments,
  resolveBaseImageDigests,
  runFingerprintCli,
  trackedBlob,
} = require('./image-input-fingerprint.cjs')
const { STAGING_IMAGE_TARGETS } = require('./staging-image-targets.cjs')

const ROOT = path.resolve(__dirname, '..', '..')
const DIGEST = `sha256:${'a'.repeat(64)}`
const OTHER_DIGEST = `sha256:${'b'.repeat(64)}`

function targetById(id) {
  const target = STAGING_IMAGE_TARGETS.find((entry) => entry.id === id)
  assert.ok(target, `missing inventory target ${id}`)
  return target
}

function backendInputs() {
  const target = targetById('backend-docker-arm')
  return {
    baseImageDigests: { 'docker.io/library/node:24.21.0-alpine': DIGEST },
    inputs: listTrackedFiles({ globs: target.globs, rootDirectory: ROOT }),
    target,
    workflowBlob: trackedBlob({
      filePath: '.github/workflows/v3_images-stg.yml',
      rootDirectory: ROOT,
    }),
  }
}

test('a FROM line resolves to a registry reference and stage references are skipped', () => {
  const references = baseImageReferences(
    [
      '# a comment',
      'FROM docker.io/library/node:24.21.0-alpine AS base',
      'RUN echo hello',
      'FROM base AS builder',
      'FROM --platform=$BUILDPLATFORM node:24 AS installer',
      'FROM scratch',
      'FROM docker.io/library/node:24.21.0-alpine',
      '',
    ].join('\n')
  )
  assert.deepEqual(references, [
    'docker.io/library/node:24.21.0-alpine',
    'node:24',
  ])
})

test('build arguments are normalized to a sorted, duplicate-free shape', () => {
  assert.deepEqual(normalizeBuildArguments(['B=2', 'A=1']), [
    { name: 'A', value: '1' },
    { name: 'B', value: '2' },
  ])
  assert.throws(() => normalizeBuildArguments(['NOVALUE']), /NAME=value/)
  assert.throws(() => normalizeBuildArguments(['A=1', 'A=2']), /declared twice/)
})

test('a tracked path fingerprints by the content hash of its blob', () => {
  const blob = trackedBlob({ filePath: 'package.json', rootDirectory: ROOT })
  const expected = execFileSync('git', ['hash-object', 'package.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
  // Git blob identity, not commit identity: the same content gives the same
  // fingerprint on every commit, which is what makes reuse possible at all.
  assert.equal(blob, expected)
  assert.throws(
    () =>
      trackedBlob({
        filePath: 'not-tracked-anywhere.txt',
        rootDirectory: ROOT,
      }),
    /not tracked/
  )
})

test('a closure that matches no tracked file fails closed', () => {
  assert.throws(
    () =>
      listTrackedFiles({
        globs: ['no-such-directory/**'],
        rootDirectory: ROOT,
      }),
    /no tracked file matches/
  )
  assert.throws(
    () => listTrackedFiles({ globs: [], rootDirectory: ROOT }),
    /at least one build input glob/
  )
})

test('a base image inspection result must carry a canonical digest', () => {
  assert.equal(digestFromInspect(JSON.stringify({ Digest: DIGEST })), DIGEST)
  assert.throws(
    () => digestFromInspect(JSON.stringify({})),
    /no canonical digest/
  )
  assert.throws(() => digestFromInspect('not json'), /unreadable JSON/)
  assert.throws(
    () =>
      resolveBaseImageDigests({
        references: ['node:24'],
        inspect: () => {
          throw new Error('registry unreachable')
        },
      }),
    /could not be inspected/
  )
})

test('the same inputs always produce the same fingerprint', () => {
  const { baseImageDigests, inputs, target, workflowBlob } = backendInputs()
  const record = buildFingerprintRecord({
    baseImageDigests,
    dockerfileBlob: trackedBlob({
      filePath: target.dockerfile,
      rootDirectory: ROOT,
    }),
    inputs,
    target,
    workflowBlob,
    workflowPath: '.github/workflows/v3_images-stg.yml',
  })
  const fingerprint = fingerprintOf(record)
  assert.match(fingerprint, DIGEST_PATTERN)
  assert.equal(fingerprintOf(record), fingerprint)
  // Rebuilding the record from the same tree reproduces the value, which is the
  // property a later publication relies on when it compares fingerprints.
  const again = fingerprintTarget({
    baseImageDigests: { 'docker.io/library/node:24.21.0-alpine': DIGEST },
    rootDirectory: ROOT,
    target,
    workflowPath: '.github/workflows/v3_images-stg.yml',
  })
  assert.equal(again.fingerprint, fingerprint)
  assert.equal(again.tag, fingerprintTag(fingerprint))
  assert.equal(again.reuseEligible, true)
})

test('a changed input, a changed Dockerfile, a build argument or a moved base image changes the fingerprint', () => {
  const { baseImageDigests, inputs, target, workflowBlob } = backendInputs()
  const base = {
    baseImageDigests,
    dockerfileBlob: trackedBlob({
      filePath: target.dockerfile,
      rootDirectory: ROOT,
    }),
    inputs,
    target,
    workflowBlob,
    workflowPath: '.github/workflows/v3_images-stg.yml',
  }
  const fingerprint = fingerprintOf(buildFingerprintRecord(base))
  const mutated = inputs.map((input, index) =>
    index === 0 ? { ...input, blob: 'f'.repeat(40) } : input
  )
  assert.notEqual(
    fingerprintOf(buildFingerprintRecord({ ...base, inputs: mutated })),
    fingerprint
  )
  assert.notEqual(
    fingerprintOf(
      buildFingerprintRecord({ ...base, dockerfileBlob: 'e'.repeat(40) })
    ),
    fingerprint
  )
  assert.notEqual(
    fingerprintOf(
      buildFingerprintRecord({
        ...base,
        buildArguments: ['NEXT_PUBLIC_ENV=production'],
      })
    ),
    fingerprint
  )
  // The publication workflow itself is an input: another build step set is a
  // different image even when the repository sources are identical.
  assert.notEqual(
    fingerprintOf(
      buildFingerprintRecord({ ...base, workflowBlob: 'd'.repeat(40) })
    ),
    fingerprint
  )
  assert.notEqual(
    fingerprintOf(
      buildFingerprintRecord({
        ...base,
        baseImageDigests: {
          'docker.io/library/node:24.21.0-alpine': OTHER_DIGEST,
        },
      })
    ),
    fingerprint
  )
  // Order of the same arguments is not an input difference.
  assert.equal(
    fingerprintOf(
      buildFingerprintRecord({ ...base, buildArguments: ['A=1', 'B=2'] })
    ),
    fingerprintOf(
      buildFingerprintRecord({ ...base, buildArguments: ['B=2', 'A=1'] })
    )
  )
})

test('a missing or malformed base digest blocks the fingerprint', () => {
  const target = targetById('backend-docker-arm')
  assert.throws(
    () => fingerprintTarget({ rootDirectory: ROOT, target }),
    /no digest was supplied|no inspector is configured/
  )
  assert.throws(
    () =>
      fingerprintTarget({
        baseImageDigests: {
          'docker.io/library/node:24.21.0-alpine': 'sha256:short',
        },
        rootDirectory: ROOT,
        target,
      }),
    /no digest was supplied|no inspector is configured/
  )
})

test('reuse eligibility is an explicit inventory flag and never covers a Next build', () => {
  const reusable = STAGING_IMAGE_TARGETS.filter(isReuseEligible)
  // An optional target only exists on the integration lines, so its Dockerfile
  // is absent here; the eligibility rules below still apply on those branches.
  const present = STAGING_IMAGE_TARGETS.filter((target) =>
    fs.existsSync(path.join(ROOT, target.dockerfile))
  )
  const frontends = present.filter((target) =>
    /next build|NEXT_PUBLIC/.test(
      fs.readFileSync(path.join(ROOT, target.dockerfile), 'utf8')
    )
  )
  assert.ok(reusable.length > 0, 'at least one component must be reusable')
  assert.ok(frontends.length > 0, 'the frontend exclusion must still apply')
  for (const target of frontends) {
    assert.equal(
      isReuseEligible(target),
      false,
      `${target.id} injects build-time environment values and must not be reusable`
    )
  }
  for (const target of reusable) {
    // A reusable target has no environment-file selection that could differ
    // between environments; the runtime supplies its configuration instead.
    assert.equal(
      target.prep,
      undefined,
      `${target.id} must not replace env files`
    )
  }
  // A target without the flag stays out of the reusable set.
  assert.equal(isReuseEligible({ id: 'unknown' }), false)
})

test('the CLI writes the fingerprint, the reuse decision and the tag', (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'klicker-fingerprint-')
  )
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }))
  const outputPath = path.join(directory, 'github-output.txt')
  const recordPath = path.join(directory, 'fingerprint.json')
  const previous = process.env.GITHUB_OUTPUT
  process.env.GITHUB_OUTPUT = outputPath
  t.after(() => {
    if (previous === undefined) delete process.env.GITHUB_OUTPUT
    else process.env.GITHUB_OUTPUT = previous
  })
  const result = runFingerprintCli([
    '--target',
    'backend-docker-arm',
    '--root',
    ROOT,
    '--output',
    recordPath,
    '--base-digest',
    `docker.io/library/node:24.21.0-alpine=${DIGEST}`,
    '--workflow-path',
    '.github/workflows/v3_images-stg.yml',
  ])
  const written = fs.readFileSync(outputPath, 'utf8')
  assert.match(written, /^fingerprint=sha256:[0-9a-f]{64}$/m)
  assert.match(written, /^reuse=true$/m)
  assert.match(written, new RegExp(`^tag=fp-[0-9a-f]{64}$`, 'm'))
  assert.equal(result.reuseEligible, true)
  assert.equal(
    JSON.parse(fs.readFileSync(recordPath, 'utf8')).fingerprint,
    result.fingerprint
  )
  assert.throws(
    () => runFingerprintCli(['--target', 'unknown-target']),
    /unknown image target/
  )
  assert.throws(() => runFingerprintCli([]), /--target is required/)
})
