'use strict'

const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

// Canonical input fingerprint for one staging image target (priority R3 of the
// CI efficiency roadmap).
//
// A publication may adopt an already-qualified image only when every input that
// can change the produced image is identical. The fingerprint therefore covers,
// in a stable order:
//
// - every tracked file in the target's declared dependency closure, identified
//   by its Git blob object id instead of its content, so an unchanged closure
//   fingerprints identically across commits and a rewritten file does not;
// - the target's Dockerfile, by blob id, and whether it is tracked at all;
// - the environment-file selection the workflow performs before the build (the
//   inventory's `prep` steps), because replacing a staging environment file
//   changes the image; the selected files themselves are inside the closure;
// - the build arguments the caller passes, sorted by name;
// - the digest of every base image the Dockerfile references, because a moved
//   base tag changes the image without touching this repository.
//
// Every step fails closed. A closure that matches no tracked file, an untracked
// Dockerfile, a build argument without a value, an unresolved or malformed base
// image digest, and an unreadable Git index all produce an error instead of a
// fingerprint, and a caller that has no fingerprint may not reuse anything.
//
// Reuse is additionally limited by the inventory: only a target the inventory
// marks reusable may adopt a previous digest. Frontend images are deliberately
// excluded, because Next.js freezes the `NEXT_PUBLIC_*` build arguments into the
// browser bundle at build time, so an image built for one environment must not
// be promoted into another.

const FINGERPRINT_PREFIX = 'sha256:'
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const BLOB_PATTERN = /^[0-9a-f]{40}$/
// A registry tag may not exceed 128 characters; the prefix plus a SHA-256 hex
// digest stays far below that.
const FINGERPRINT_TAG_PREFIX = 'fp-'

function fail(message) {
  throw new Error(`image-input-fingerprint: ${message}`)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

// The fingerprint is computed over canonical JSON, so two callers that supply
// the same inputs in a different order produce the same value.
function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function git(args, rootDirectory) {
  try {
    return execFileSync('git', args, {
      cwd: rootDirectory,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    fail(`git ${args[0]} failed: ${error.message.trim()}`)
  }
}

// `git ls-files -s -z` reports the staged blob of each tracked path, which is
// the file identity that survives a checkout, a line-ending change and a mode
// change without reading the file contents.
function listTrackedFiles({ globs, rootDirectory }) {
  if (!Array.isArray(globs) || globs.length === 0) {
    fail('a target must declare at least one build input glob')
  }
  const output = git(['ls-files', '-s', '-z', '--', ...globs], rootDirectory)
  const files = output
    .split('\u0000')
    .filter((entry) => entry.trim() !== '')
    .map((entry) => {
      const match = /^([0-9]+) ([0-9a-f]+) ([0-9]+)\t(.+)$/s.exec(entry)
      if (!match) fail(`unreadable git index entry ${entry}`)
      if (!BLOB_PATTERN.test(match[2])) {
        fail(`git index entry for ${match[4]} carries no stable blob id`)
      }
      return { blob: match[2], path: match[4] }
    })
    .sort((left, right) => left.path.localeCompare(right.path))
  if (files.length === 0) {
    fail(`no tracked file matches ${globs.join(', ')}`)
  }
  return files
}

function trackedBlob({ filePath, rootDirectory }) {
  const normalized = filePath.split(path.sep).join('/')
  const output = git(['ls-files', '-s', '-z', '--', normalized], rootDirectory)
  const entry = output.split('\u0000').find((value) => value.trim() !== '')
  if (!entry) fail(`${normalized} is not tracked, so its content is unknown`)
  const blob = /^[0-9]+ ([0-9a-f]+) [0-9]+\t/s.exec(entry)?.[1]
  if (!blob || !BLOB_PATTERN.test(blob)) {
    fail(`${normalized} has no stable blob id in the git index`)
  }
  return blob
}

// Only a base image reference that names another stage of the same Dockerfile
// is not a registry image; everything else, including a registry-less `node:24`
// reference, has to resolve to a digest before it can be fingerprinted.
function baseImageReferences(dockerfileText) {
  const stages = new Set(['scratch'])
  const references = []
  for (const rawLine of dockerfileText.split('\n')) {
    const line = rawLine.trim()
    if (!/^FROM\s/i.test(line)) continue
    const tokens = line
      .slice(4)
      .split(/\s+/)
      .filter((token) => token !== '' && !token.startsWith('--'))
    const reference = tokens[0]
    if (!reference) fail(`unreadable FROM line: ${line}`)
    const stageName = tokens[1]?.toLowerCase() === 'as' ? tokens[2] : undefined
    // `FROM base AS builder` continues from an earlier stage of the same file,
    // so only a reference that names no stage is a registry image.
    if (!stages.has(reference) && reference !== 'scratch') {
      references.push(reference)
    }
    const name = stageName ?? reference.split('/').pop().split(':')[0]
    if (name) stages.add(name)
  }
  return [...new Set(references)].sort()
}

function digestFromInspect(stdout) {
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch (error) {
    fail(`base image inspection returned unreadable JSON: ${error.message}`)
  }
  const digest = parsed?.Digest ?? parsed?.digest ?? parsed?.Descriptor?.digest
  if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest)) {
    fail(`base image inspection returned no canonical digest`)
  }
  return digest
}

function inspectBaseImage(reference) {
  return execFileSync(
    'docker',
    [
      'buildx',
      'imagetools',
      'inspect',
      reference,
      '--format',
      '{{json .Manifest}}',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
}

function resolveBaseImageDigests({ references, inspect = inspectBaseImage }) {
  const digests = {}
  for (const reference of references) {
    let stdout
    try {
      stdout = inspect(reference)
    } catch (error) {
      fail(
        `base image ${reference} could not be inspected, so no input identity exists: ` +
          String(error.message ?? error).trim()
      )
    }
    digests[reference] = digestFromInspect(stdout)
  }
  return digests
}

function normalizeBuildArguments(buildArguments = []) {
  const seen = new Map()
  for (const entry of buildArguments) {
    const index = entry.indexOf('=')
    if (index <= 0) fail(`build argument ${entry} has no NAME=value shape`)
    const name = entry.slice(0, index)
    if (seen.has(name)) fail(`build argument ${name} is declared twice`)
    seen.set(name, entry.slice(index + 1))
  }
  return [...seen.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function isReuseEligible(target) {
  return target?.reuse === true
}

// The record is the complete input identity of one target. `inputs` and
// `baseImages` are sorted, and `buildArguments` is normalized, so the record is
// deterministic for the same tree, arguments and base digests.
function buildFingerprintRecord({
  baseImageDigests,
  buildArguments = [],
  dockerfileBlob: blob,
  inputs,
  target,
  workflowBlob = null,
  workflowPath,
}) {
  if (!target?.id || !target?.dockerfile) {
    fail('a target needs an id and a dockerfile')
  }
  if (!BLOB_PATTERN.test(blob ?? ''))
    fail('the Dockerfile has no stable blob id')
  if (!Array.isArray(inputs) || inputs.length === 0) {
    fail(`target ${target.id} has no build inputs`)
  }
  const normalizedDigests = Object.entries(baseImageDigests ?? {})
    .map(([reference, digest]) => {
      if (!DIGEST_PATTERN.test(digest ?? '')) {
        fail(`base image ${reference} has no canonical digest`)
      }
      return { digest, reference }
    })
    .sort((left, right) => left.reference.localeCompare(right.reference))
  return {
    baseImages: normalizedDigests,
    buildArguments: normalizeBuildArguments(buildArguments),
    dockerfile: { blob, path: target.dockerfile },
    prep: [...(target.prep ?? [])],
    schemaVersion: 1,
    target: target.id,
    trackedInputs: inputs,
    // A workflow change can alter the build steps, so the workflow content is
    // part of the identity; a caller that names a workflow path but cannot
    // resolve its blob fails instead of fingerprinting a partial input set.
    workflow: { blob: workflowBlob, path: workflowPath ?? null },
  }
}

function fingerprintOf(record) {
  if (
    record.workflow.path !== null &&
    !BLOB_PATTERN.test(record.workflow.blob ?? '')
  ) {
    fail('the publication workflow has no stable blob id')
  }
  return `${FINGERPRINT_PREFIX}${sha256(canonicalJson(record))}`
}

function fingerprintTag(fingerprint) {
  if (!DIGEST_PATTERN.test(fingerprint ?? '')) {
    fail(`cannot derive a tag from ${fingerprint}`)
  }
  return `${FINGERPRINT_TAG_PREFIX}${fingerprint.slice(FINGERPRINT_PREFIX.length)}`
}

function fingerprintTarget({
  baseImageDigests,
  buildArguments = [],
  inspect,
  rootDirectory,
  target,
  workflowBlob,
  workflowPath,
}) {
  const dockerfilePath = path.join(rootDirectory, target.dockerfile)
  let dockerfileText
  try {
    dockerfileText = fs.readFileSync(dockerfilePath, 'utf8')
  } catch (error) {
    fail(`could not read ${target.dockerfile}: ${error.message}`)
  }
  const references = baseImageReferences(dockerfileText)
  const missing = references.filter(
    (reference) => !DIGEST_PATTERN.test(baseImageDigests?.[reference] ?? '')
  )
  if (missing.length > 0 && typeof inspect !== 'function') {
    fail(
      `no digest was supplied for base image(s) ${missing.join(', ')} and no inspector is configured`
    )
  }
  const resolved =
    missing.length > 0
      ? {
          ...(baseImageDigests ?? {}),
          ...resolveBaseImageDigests({ inspect, references: missing }),
        }
      : baseImageDigests
  const record = buildFingerprintRecord({
    baseImageDigests: resolved,
    buildArguments,
    dockerfileBlob: trackedBlob({
      filePath: target.dockerfile,
      rootDirectory,
    }),
    inputs: listTrackedFiles({ globs: target.globs, rootDirectory }),
    target,
    workflowBlob:
      workflowBlob ??
      (workflowPath === undefined || workflowPath === null
        ? null
        : trackedBlob({ filePath: workflowPath, rootDirectory })),
    workflowPath,
  })
  const fingerprint = fingerprintOf(record)
  return {
    baseImages: record.baseImages,
    fingerprint,
    record,
    reuseEligible: isReuseEligible(target),
    tag: fingerprintTag(fingerprint),
    target: target.id,
  }
}

function writeGithubOutputs(outputs, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) return false
  const lines = Object.entries(outputs).map(
    ([name, value]) => `${name}=${value}`
  )
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
  return true
}

function parseArguments(argv) {
  const args = { 'build-arg': [], 'base-digest': [] }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (typeof flag !== 'string' || !flag.startsWith('--')) {
      fail(`unexpected argument ${flag}`)
    }
    const name = flag.slice(2)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      fail(`${flag} requires a value`)
    }
    index += 1
    if (name === 'build-arg' || name === 'base-digest') {
      args[name].push(value)
    } else {
      args[name] = value
    }
  }
  return args
}

function readTarget(targetId, inventoryPath) {
  const modulePath =
    inventoryPath ?? path.join(__dirname, 'staging-image-targets.cjs')
  const { STAGING_IMAGE_TARGETS } = require(modulePath)
  const target = STAGING_IMAGE_TARGETS.find((entry) => entry.id === targetId)
  if (!target) fail(`unknown image target ${targetId}`)
  return target
}

// Base digests are read from the registry by default, because a caller that
// names them itself could hide a moved base tag. `--base-digest REF=DIGEST`
// exists for tests and for a caller that has already resolved the same value.
function runFingerprintCli(argv = process.argv.slice(2)) {
  const args = parseArguments(argv)
  if (!args.target) fail('--target is required')
  const rootDirectory = path.resolve(args.root ?? process.cwd())
  const target = readTarget(args.target, args.inventory)
  const supplied = Object.fromEntries(
    args['base-digest'].map((entry) => {
      const index = entry.indexOf('=')
      if (index <= 0) fail(`base digest ${entry} has no REF=DIGEST shape`)
      return [entry.slice(0, index), entry.slice(index + 1)]
    })
  )
  const result = fingerprintTarget({
    buildArguments: args['build-arg'],
    inspect: args['no-inspect'] ? undefined : inspectBaseImage,
    rootDirectory,
    target,
    workflowPath: args['workflow-path'],
    ...(Object.keys(supplied).length > 0 ? { baseImageDigests: supplied } : {}),
  })
  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true })
    fs.writeFileSync(
      args.output,
      `${JSON.stringify({ ...result, record: undefined }, null, 2)}\n`
    )
  }
  writeGithubOutputs({
    fingerprint: result.fingerprint,
    reuse: result.reuseEligible ? 'true' : 'false',
    tag: result.tag,
  })
  process.stdout.write(
    `${JSON.stringify({ fingerprint: result.fingerprint, reuseEligible: result.reuseEligible, tag: result.tag, target: result.target })}\n`
  )
  return result
}

if (require.main === module) {
  try {
    runFingerprintCli()
  } catch (error) {
    console.error(`::error::${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  DIGEST_PATTERN,
  FINGERPRINT_TAG_PREFIX,
  baseImageReferences,
  buildFingerprintRecord,
  canonicalJson,
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
}
