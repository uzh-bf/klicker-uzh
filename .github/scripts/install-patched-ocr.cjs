#!/usr/bin/env node
'use strict'

const { execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const SOURCE_COMMIT = '1672852136fc87748249d22bce0819f33419ea79'
const SOURCE_SHA256 =
  'a1378ddc336bb874349ad47ad370fdf725e8db1dd03753d7df73347342ae093f'
const PATCH_PATH = path.resolve(
  __dirname,
  '../open-code-review/ocr-compression.patch'
)
const digest = (bytes) =>
  crypto.createHash('sha256').update(bytes).digest('hex')

function expectedVersion(patch = fs.readFileSync(PATCH_PATH)) {
  return `open-code-review v1.13.0 (${SOURCE_COMMIT.slice(0, 12)}+compression-${digest(patch).slice(0, 12)}) `
}

function verifyVersion(version, patch) {
  if (
    typeof version !== 'string' ||
    !version.startsWith(expectedVersion(patch))
  ) {
    throw new Error('OCR executable does not match the pinned source and patch')
  }
}

function verifyArchive(bytes) {
  if (digest(bytes) !== SOURCE_SHA256) {
    throw new Error('OCR source archive checksum mismatch')
  }
}

function install(directory, archive) {
  if (!directory || !path.isAbsolute(directory)) {
    throw new Error('An absolute installation directory is required')
  }
  const env = { ...process.env, GOTOOLCHAIN: 'local', GOFLAGS: '-mod=readonly' }
  delete env.MISTRAL_API_KEY
  delete env.OCR_LLM_TOKEN
  delete env.GH_TOKEN
  delete env.GITHUB_TOKEN
  const run = (command, args, options = {}) =>
    execFileSync(command, args, { env, stdio: 'inherit', ...options })
  const goVersion = execFileSync('go', ['version'], { env, encoding: 'utf8' })
  if (!goVersion.startsWith('go version go1.26.9 ')) {
    throw new Error('OCR source build requires Go 1.26.9')
  }
  fs.mkdirSync(directory, { recursive: true })
  const source = fs.mkdtempSync(path.join(directory, 'source-'))
  const archivePath = archive ?? path.join(source, 'upstream.tar.gz')
  if (!archive) {
    run('curl', [
      '--fail',
      '--silent',
      '--show-error',
      '--location',
      '--output',
      archivePath,
      `https://api.github.com/repos/alibaba/open-code-review/tarball/${SOURCE_COMMIT}`,
    ])
  }
  verifyArchive(fs.readFileSync(archivePath))
  run('tar', ['-xzf', archivePath, '--strip-components=1', '-C', source])
  run('patch', ['--batch', '--fuzz=0', '-p1', '--input', PATCH_PATH], {
    cwd: source,
  })
  run('go', ['test', '-race', './internal/llmloop', './internal/agent'], {
    cwd: source,
  })
  const patchDigest = digest(fs.readFileSync(PATCH_PATH))
  const commit = `${SOURCE_COMMIT.slice(0, 12)}+compression-${patchDigest.slice(0, 12)}`
  const binary = path.join(directory, 'ocr')
  run(
    'go',
    [
      'build',
      '-trimpath',
      '-buildvcs=false',
      '-ldflags',
      `-s -w -X main.Version=v1.13.0 -X main.GitCommit=${commit}`,
      '-o',
      binary,
      './cmd/opencodereview',
    ],
    { cwd: source, env: { ...env, CGO_ENABLED: '0' } }
  )
  const version = execFileSync(binary, ['version'], {
    env: { ...env, OCR_NO_UPDATE: '1' },
    encoding: 'utf8',
  })
  verifyVersion(version)
  fs.writeFileSync(
    path.join(directory, 'provenance.json'),
    JSON.stringify({
      source_commit: SOURCE_COMMIT,
      source_archive_sha256: SOURCE_SHA256,
      patch_sha256: patchDigest,
      binary_sha256: digest(fs.readFileSync(binary)),
      go_version: goVersion.trim(),
      version: version.trim(),
    })
  )
  return binary
}

module.exports = { expectedVersion, verifyVersion, verifyArchive, install }

if (require.main === module) {
  if (process.argv[2] === 'verify-version') verifyVersion(process.argv[3])
  else install(process.argv[2], process.argv[3])
}
