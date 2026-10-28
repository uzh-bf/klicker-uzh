#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const require = createRequire(import.meta.url)
const {
  PREVIEW_LOGICAL_TARGETS,
  PREVIEW_STAGING_IMAGES,
  STAGING_IMAGE_TARGETS,
  buildJobName,
  scanJobName,
} = require('../../.github/scripts/staging-image-targets.cjs')
const {
  configurationDigest,
} = require('../../.github/scripts/preview-image-plan.cjs')
const {
  evaluatePreviewScan,
  parseExceptionPolicy,
} = require('../../.github/scripts/preview-image-receipt.cjs')
const {
  validateScanReceipt,
} = require('../../.github/scripts/image-scan-admission.cjs')
const {
  receiptFileName,
} = require('../../.github/scripts/image-scan-admission.cjs')
const {
  validateStagingWorkflow,
} = require('../../.github/scripts/staging-image-workflow.cjs')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const WORKFLOW_PATH = '.github/workflows/v3_images-stg.yml'
const WORKFLOW_FILE = basename(WORKFLOW_PATH)
const GIT_SHA = /^[0-9a-f]{40}$/
const CORRELATION = /^[0-9a-f]{64}$/
const DIGEST = /^sha256:[0-9a-f]{64}$/
const TARGET = /^[a-z0-9][a-z0-9-]*$/
const MAX_INPUT_BYTES = 32 * 1024
const MAX_OUTPUT_BYTES = 128 * 1024
const MAX_RECEIPTS = 128
const MAX_PINNED_IMAGES = 64
const MAX_DISCOVERY_PAGES = 5
const MAX_PREVIEW_REUSE_RUNS = 10
const MAX_ARTIFACT_PAGES = 3
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024
const MAX_RECEIPT_BYTES = 1024 * 1024
const COMMAND_TIMEOUT_MS = 30_000
const COMMAND_MAX_BUFFER = 32 * 1024 * 1024

// These are the branch-protection contexts documented for v3 and v3-*.
// SonarCloud is additionally required for reusing a staging publication: the
// staging promoter already treats it as release qualification, while CodeQL is
// explicitly a non-required pilot and therefore cannot be invented as a gate.
const REQUIRED_CONTEXTS = Object.freeze([
  'check',
  'check-gitleaks',
  'test-graphql-status',
  'test-playwright-status',
  'test-unit-status',
  'test-olat-api-status',
  'test-intl-production-status',
  'build-images-status',
])
const STAGING_CONTEXTS = Object.freeze([
  ...REQUIRED_CONTEXTS,
  'SonarCloud / SonarCloud',
])
const PREVIEW_RECEIPT_MEMBER = 'preview-images.json'
const TOKEN_NAME = 'DEVROUTER_PREVIEW_GITHUB_TOKEN'
const CONTROL_REF_NAME = 'DEVROUTER_PREVIEW_GITHUB_CONTROL_REF'
const SCAN_POLICY_NAME = 'DEVROUTER_PREVIEW_SCAN_POLICY_JSON'
const PLATFORMS = Object.freeze({
  'linux/amd64': 'amd64',
  'linux/arm64': 'arm64',
})

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  throw error
}

function text(label, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('invalid_input', `${label} is required`)
  }
  return value.trim()
}

function fullSha(label, value) {
  const normalized = text(label, value)
  if (!GIT_SHA.test(normalized)) {
    fail('invalid_input', `${label} must be a full lowercase commit SHA`)
  }
  return normalized
}

function digest(label, value) {
  const normalized = text(label, value)
  if (!DIGEST.test(normalized)) {
    fail('invalid_input', `${label} must be a sha256 digest`)
  }
  return normalized
}

function plainObject(label, value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid_input', `${label} must be an object`)
  }
  return value
}

function normalizeConfiguration(value, label) {
  const configuration = plainObject(label, value)
  const entries = Object.entries(configuration)
  if (entries.length > 128) {
    fail('invalid_input', `${label} has too many keys`)
  }
  for (const [name, item] of entries) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || typeof item !== 'string') {
      fail('invalid_input', `${label} must be a flat string map`)
    }
    if (item.includes(String.fromCharCode(0))) {
      fail('invalid_input', `${label} contains NUL`)
    }
  }
  return Object.fromEntries(
    entries.sort(([left], [right]) => left.localeCompare(right))
  )
}

function configurationForTargets(targetEntries) {
  const selected = []
  const names = new Set()
  for (const entry of targetEntries) {
    const name = text('target', entry?.target)
    if (!TARGET.test(name) || names.has(name)) {
      fail('invalid_input', `target ${name} is invalid or duplicated`)
    }
    names.add(name)
    selected.push({
      configuration: normalizeConfiguration(
        entry.configuration,
        `${name} configuration`
      ),
      target: name,
    })
  }
  return selected
}

function parseEnvelope(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw ?? ''))
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_INPUT_BYTES) {
    fail(
      'invalid_input',
      `command input must be between 1 and ${MAX_INPUT_BYTES} bytes`
    )
  }
  let envelope
  try {
    envelope = JSON.parse(bytes.toString('utf8'))
    plainObject('command input', envelope)
  } catch {
    fail('invalid_input', 'command input must contain one JSON object')
  }
  if (!['resolve', 'dispatch'].includes(envelope.action)) {
    fail('invalid_input', 'action must be resolve or dispatch')
  }
  const correlation = text('correlation', envelope.correlation)
  if (!CORRELATION.test(correlation)) {
    fail(
      'invalid_input',
      'correlation must be exactly 64 lowercase hex characters'
    )
  }
  const request = plainObject('request', envelope.request)
  const revision = fullSha('request revision', request.revision)
  const platform = text('request platform', request.platform)
  if (!Object.hasOwn(PLATFORMS, platform)) {
    fail('invalid_input', 'request platform must be linux/amd64 or linux/arm64')
  }
  if (!Array.isArray(request.targets) || request.targets.length === 0) {
    fail('invalid_input', 'request targets are required')
  }
  const targets = configurationForTargets(request.targets)
  const targetNames = new Set(targets.map((entry) => entry.target))
  if (!Array.isArray(envelope.missing)) {
    fail('invalid_input', 'missing targets are required')
  }
  const missing = (
    envelope.action === 'resolve' ? [...targetNames] : envelope.missing
  ).map((target) => text('missing target', target))
  if (new Set(missing).size !== missing.length) {
    fail('invalid_input', 'missing targets must be unique')
  }
  for (const target of missing) {
    if (!TARGET.test(target) || !targetNames.has(target)) {
      fail('invalid_input', `missing target ${target} is not selected`)
    }
  }
  const producer = plainObject('producer', envelope.producer)
  const repository = text('producer repository', producer.repository)
  const workflow = text('producer workflow', producer.workflow)
  const controlRevision = fullSha(
    'producer control revision',
    producer.controlRevision
  )
  if (repository !== REPOSITORY || workflow !== WORKFLOW_PATH) {
    fail(
      'producer_mismatch',
      'producer is outside the reviewed GitHub inventory'
    )
  }
  const pinnedImages = envelope.pinnedImages
  if (!Array.isArray(pinnedImages) || pinnedImages.length > MAX_PINNED_IMAGES) {
    fail(
      'invalid_input',
      `pinnedImages must contain at most ${MAX_PINNED_IMAGES} images`
    )
  }
  const normalizedPinned = pinnedImages.map((reference) => {
    const value = text('pinned image', reference)
    const at = value.lastIndexOf('@')
    if (at <= 0 || !DIGEST.test(value.slice(at + 1))) {
      fail('invalid_input', `pinned image ${value} is not digest-pinned`)
    }
    return value
  })
  if (new Set(normalizedPinned).size !== normalizedPinned.length) {
    fail('invalid_input', 'pinnedImages must be unique')
  }
  return {
    action: envelope.action,
    controlRevision,
    correlation,
    missing,
    pinnedImages: normalizedPinned,
    platform,
    repository,
    revision,
    targets,
    workflow,
  }
}

function createProcessTransport(spawnSyncImpl = spawnSync) {
  return {
    run(command, args, options = {}) {
      const result = spawnSyncImpl(command, args, {
        cwd: options.cwd,
        encoding: null,
        env: options.env ?? process.env,
        maxBuffer: options.maxBuffer ?? COMMAND_MAX_BUFFER,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeoutMs ?? COMMAND_TIMEOUT_MS,
      })
      if (result.error) {
        fail('command_failed', `${command} could not run`)
      }
      if (result.status !== 0) {
        fail('command_failed', `${command} exited with status ${result.status}`)
      }
      return {
        stdout: Buffer.isBuffer(result.stdout)
          ? result.stdout
          : Buffer.from(String(result.stdout ?? '')),
      }
    },
  }
}

function ghEnvironment(baseEnvironment, token) {
  const environment = { ...baseEnvironment, GH_TOKEN: token }
  delete environment.GITHUB_TOKEN
  return environment
}

function workflowTarget(logicalTarget) {
  return PREVIEW_LOGICAL_TARGETS.find(
    (entry) => entry.logicalTarget === logicalTarget
  )?.target
}

function stagingTargetForPreview(target) {
  return STAGING_IMAGE_TARGETS.find((entry) => entry.id === target?.stagingId)
}

function expectedPhysicalTargets(selected) {
  const physical = new Map()
  for (const logical of selected) {
    const target = workflowTarget(logical.target)
    if (!target)
      fail('unknown_target', `unknown logical target ${logical.target}`)
    const digest = configurationDigest(logical.configuration)
    const current = physical.get(target.id)
    if (current && current.configurationDigest !== digest) {
      fail(
        'configuration_mismatch',
        `logical targets sharing ${target.id} require one configuration`
      )
    }
    physical.set(target.id, {
      ...(current ?? {}),
      configuration: logical.configuration,
      configurationDigest: digest,
      logicalTargets: [...(current?.logicalTargets ?? []), logical.target],
      target,
    })
  }
  return physical
}

function publicReceipt(input) {
  const receipt = {
    revision: input.revision,
    repository: input.repository,
    workflow: input.workflow,
    controlRevision: input.controlRevision,
    runId: String(input.runId),
    attempt: Number(input.attempt),
    target: input.target,
    platform: input.platform,
    configurationDigest: input.configurationDigest,
    inputFingerprint: input.inputFingerprint,
    image: input.image,
    ciPassed: true,
    admissionPassed: true,
  }
  return receipt
}

function validatePublicReceipt(receipt, expected) {
  plainObject('preview receipt', receipt)
  for (const field of [
    'revision',
    'repository',
    'workflow',
    'controlRevision',
    'target',
    'platform',
    'configurationDigest',
  ]) {
    const wanted =
      field === 'repository'
        ? REPOSITORY
        : field === 'workflow'
          ? WORKFLOW_PATH
          : expected[field]
    if (receipt[field] !== wanted) {
      fail('receipt_mismatch', `${expected.target}: receipt ${field} differs`)
    }
  }
  if (String(receipt.runId) !== String(expected.runId)) {
    fail('receipt_mismatch', `${expected.target}: receipt run differs`)
  }
  if (Number(receipt.attempt) !== Number(expected.attempt)) {
    fail('receipt_mismatch', `${expected.target}: receipt attempt differs`)
  }
  digest('receipt input fingerprint', receipt.inputFingerprint)
  const image = text('receipt image', receipt.image)
  const at = image.lastIndexOf('@')
  if (
    at <= 0 ||
    image.slice(0, at) !== expected.imageRepository ||
    !DIGEST.test(image.slice(at + 1))
  ) {
    fail(
      'receipt_mismatch',
      `${expected.target}: receipt image is outside preview inventory`
    )
  }
  if (receipt.ciPassed !== true || receipt.admissionPassed !== true) {
    fail(
      'receipt_mismatch',
      `${expected.target}: receipt success flags are absent`
    )
  }
  return publicReceipt(receipt)
}

function parseJson(body, label) {
  try {
    return JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : body)
  } catch {
    fail('invalid_evidence', `${label} returned malformed JSON`)
  }
}

function isPendingRun(run) {
  return run?.status === 'queued' || run?.status === 'in_progress'
}

function validateRunIdentity(run, expected) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) {
    fail('run_mismatch', `${expected.label} is unavailable`)
  }
  if (run.repository?.full_name !== REPOSITORY) {
    fail('run_mismatch', `${expected.label} repository differs`)
  }
  if (run.path !== WORKFLOW_PATH) {
    fail('run_mismatch', `${expected.label} workflow path differs`)
  }
  if (run.event !== expected.event) {
    fail('run_mismatch', `${expected.label} event differs`)
  }
  if (run.head_sha !== expected.sha) {
    fail('run_mismatch', `${expected.label} source revision differs`)
  }
  if (!Number.isSafeInteger(Number(run.id)) || Number(run.id) < 1) {
    fail('run_mismatch', `${expected.label} has no stable id`)
  }
  if (
    !Number.isSafeInteger(Number(run.run_attempt)) ||
    Number(run.run_attempt) < 1
  ) {
    fail('run_mismatch', `${expected.label} has no current attempt`)
  }
}

function validateCompletedRun(run, label) {
  if (run.status !== 'completed') {
    fail('run_pending', `${label} is ${String(run.status)}`)
  }
  if (run.conclusion !== 'success') {
    fail('run_failed', `${label} concluded ${String(run.conclusion)}`)
  }
}

function createAdapter(options = {}) {
  const environment = options.environment ?? process.env
  const transport = options.transport ?? createProcessTransport()
  const token = environment[TOKEN_NAME]
  const controlRef = environment[CONTROL_REF_NAME]
  const now = options.now ?? Date.now
  let expectedControlRevision
  const ghEnv = token ? ghEnvironment(environment, token) : null
  const tempRoot = mkdtempSync(join(tmpdir(), 'klicker-preview-images-'))
  const registryCache = new Map()
  const workflowCache = new Map()
  const artifactCache = new Map()
  const registryEnvironment = {
    PATH: environment.PATH,
    ...(environment.DEVROUTER_PREVIEW_DOCKER_CONFIG
      ? { DOCKER_CONFIG: environment.DEVROUTER_PREVIEW_DOCKER_CONFIG }
      : {}),
  }
  const extractArtifact =
    options.extractArtifact ??
    ((bytes, member) => {
      const archive = join(
        tempRoot,
        `artifact-${createHash('sha256').update(bytes).digest('hex')}.zip`
      )
      writeFileSync(archive, bytes)
      try {
        return transport
          .run('unzip', ['-p', archive, member], {
            maxBuffer: MAX_RECEIPT_BYTES,
            timeoutMs: COMMAND_TIMEOUT_MS,
          })
          .stdout.toString('utf8')
      } finally {
        rmSync(archive, { force: true })
      }
    })

  function gh(args, optionsForCommand = {}) {
    if (!ghEnv) {
      fail('credentials_unavailable', `${TOKEN_NAME} is unavailable`)
    }
    return transport.run('gh', args, {
      ...optionsForCommand,
      env: ghEnv,
    }).stdout
  }

  function ghJson(endpoint, extra = []) {
    return parseJson(
      gh(['api', '--method', 'GET', endpoint, ...extra]),
      'GitHub API'
    )
  }

  async function pages(endpoint, collection, maximum, label) {
    const items = []
    for (let page = 1; page <= maximum; page += 1) {
      const separator = endpoint.includes('?') ? '&' : '?'
      const data = ghJson(`${endpoint}${separator}page=${page}&per_page=100`)
      const batch = data?.[collection]
      if (!Array.isArray(batch)) {
        fail('invalid_evidence', `${label} response has no ${collection}`)
      }
      items.push(...batch)
      if (batch.length < 100) return items
    }
    fail('evidence_limit', `${label} exceeded ${maximum * 100} records`)
  }

  async function sourceCi(revision, contexts = REQUIRED_CONTEXTS) {
    const checks = await pages(
      `repos/${REPOSITORY}/commits/${revision}/check-runs?filter=all`,
      'check_runs',
      MAX_DISCOVERY_PAGES,
      'source checks'
    )
    for (const name of contexts) {
      const matches = checks
        .filter(
          (check) =>
            check?.name === name &&
            check?.head_sha === revision &&
            check?.app?.slug === 'github-actions'
        )
        .sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0))
      const current = matches[0]
      if (!current) {
        fail(
          'source_ci_missing',
          `source check ${name} is absent for ${revision}`
        )
      }
      if (current.status !== 'completed' || current.conclusion !== 'success') {
        fail(
          'source_ci_blocked',
          `source check ${name} is ${String(current.status)}/${String(current.conclusion)}`
        )
      }
    }
  }

  async function workflowAt(ref, sourceBranch) {
    const content = workflowContent(ref)
    try {
      ;(options.validateWorkflow ?? validateStagingWorkflow)({
        content,
        path: WORKFLOW_PATH,
        sourceBranch,
      })
    } catch {
      fail(
        'workflow_mismatch',
        'producer workflow blob is outside the trusted inventory'
      )
    }
  }

  function workflowContent(ref) {
    if (!workflowCache.has(ref)) {
      const body = gh([
        'api',
        '--method',
        'GET',
        `repos/${REPOSITORY}/contents/${WORKFLOW_PATH}?ref=${ref}`,
        '--header',
        'Accept: application/vnd.github.raw+json',
      ])
      const content = body.toString('utf8')
      if (content.length === 0 || content.length > MAX_RECEIPT_BYTES) {
        fail(
          'workflow_mismatch',
          'producer workflow blob is outside the read budget'
        )
      }
      workflowCache.set(ref, content)
    }
    return workflowCache.get(ref)
  }

  function validatePreviewDispatcher() {
    const content = workflowContent(expectedControlRevision)
    if (
      !/^run-name:[ ]*[$][{][{][ ]*inputs[.]correlationId[ ]*[}][}][ ]*$/m.test(
        content
      ) &&
      !/^run-name:[ ]*>-\n[ ]*[$][{][{][ ]*github[.]event_name == 'workflow_dispatch' && inputs[.]correlationId [|][|] [(]/m.test(
        content
      )
    ) {
      fail(
        'producer_unavailable',
        'the reviewed workflow does not expose correlationId as its run-name'
      )
    }
    const marker = '\n  workflow_dispatch:\n'
    const offset = content.indexOf(marker)
    if (offset < 0) {
      fail(
        'producer_unavailable',
        'the reviewed workflow has no dispatch trigger'
      )
    }
    const block = content.slice(offset + marker.length)
    for (const input of [
      'buildConfigurationJson',
      'correlationId',
      'platform',
      'sourceSha',
      'targets',
    ]) {
      if (!new RegExp(`^      ${input}:$`, 'm').test(block)) {
        fail('producer_unavailable', `the reviewed workflow lacks ${input}`)
      }
    }
  }

  async function listDispatchedRuns() {
    return pages(
      `repos/${REPOSITORY}/actions/runs?event=workflow_dispatch`,
      'workflow_runs',
      MAX_DISCOVERY_PAGES,
      'correlated runs'
    )
  }

  async function listPushRuns(revision) {
    const runs = await pages(
      `repos/${REPOSITORY}/actions/workflows/${WORKFLOW_FILE}/runs?event=push&head_sha=${revision}`,
      'workflow_runs',
      MAX_DISCOVERY_PAGES,
      'staging publisher runs'
    )
    return runs
      .filter(
        (run) =>
          run?.repository?.full_name === REPOSITORY &&
          run?.path === WORKFLOW_PATH &&
          run?.event === 'push' &&
          run?.head_sha === revision &&
          String(run?.head_branch ?? '').startsWith('v3')
      )
      .sort(
        (left, right) =>
          Number(right.id ?? 0) - Number(left.id ?? 0) ||
          Number(right.run_attempt ?? 0) - Number(left.run_attempt ?? 0)
      )
  }

  async function listJobs(run) {
    return pages(
      `repos/${REPOSITORY}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`,
      'jobs',
      MAX_DISCOVERY_PAGES,
      'workflow jobs'
    )
  }

  function requireJob(jobs, run, name, startedAfter) {
    const matches = jobs.filter((job) => job?.name === name)
    if (matches.length !== 1) {
      fail('job_mismatch', `${name} has ${matches.length} current-attempt jobs`)
    }
    const job = matches[0]
    if (
      Number(job.id) < 1 ||
      String(job.run_id) !== String(run.id) ||
      Number(job.run_attempt) !== Number(run.run_attempt) ||
      job.head_sha !== (startedAfter?.headSha ?? job.head_sha) ||
      job.status !== 'completed' ||
      job.conclusion !== 'success'
    ) {
      fail('job_mismatch', `${name} is not a successful current-attempt job`)
    }
    if (startedAfter?.headSha && job.head_sha !== startedAfter.headSha) {
      fail('job_mismatch', `${name} belongs to another source revision`)
    }
    if (startedAfter?.requireStarted && typeof job.started_at !== 'string') {
      fail('job_mismatch', `${name} has no start time`)
    }
    return job
  }

  async function listArtifacts(run) {
    return pages(
      `repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`,
      'artifacts',
      MAX_ARTIFACT_PAGES,
      'workflow artifacts'
    )
  }

  function selectArtifact(artifacts, name, job) {
    const matches = artifacts.filter(
      (artifact) => artifact?.name === name && artifact?.expired === false
    )
    if (matches.length !== 1) {
      fail(
        'artifact_mismatch',
        `${name} has ${matches.length} unexpired artifacts`
      )
    }
    const artifact = matches[0]
    if (
      Number(artifact.id) < 1 ||
      !Number.isSafeInteger(Number(artifact.size_in_bytes)) ||
      Number(artifact.size_in_bytes) < 1 ||
      Number(artifact.size_in_bytes) > MAX_ARTIFACT_BYTES ||
      typeof artifact.created_at !== 'string' ||
      typeof job.started_at !== 'string' ||
      artifact.created_at < job.started_at
    ) {
      fail(
        'artifact_mismatch',
        `${name} is not bound to the current run attempt`
      )
    }
    return artifact
  }

  function artifactContent(artifact, member) {
    const bytes =
      artifactCache.get(artifact.id) ??
      gh([
        'api',
        '--method',
        'GET',
        `repos/${REPOSITORY}/actions/artifacts/${artifact.id}/zip`,
      ])
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_ARTIFACT_BYTES) {
      fail(
        'artifact_mismatch',
        `${artifact.name} is outside the download budget`
      )
    }
    artifactCache.set(artifact.id, bytes)
    let content
    try {
      content = extractArtifact(bytes, member)
    } catch {
      fail('artifact_mismatch', `${artifact.name} does not contain ${member}`)
    }
    if (Buffer.byteLength(content) > MAX_RECEIPT_BYTES) {
      fail(
        'artifact_mismatch',
        `${artifact.name}/${member} exceeds the receipt budget`
      )
    }
    return content
  }

  function artifactMember(artifact, member) {
    try {
      return JSON.parse(artifactContent(artifact, member))
    } catch (error) {
      if (error?.code === 'artifact_mismatch') throw error
      fail('artifact_mismatch', `${artifact.name}/${member} is not JSON`)
    }
  }

  function inspectRegistryImage(reference, platform) {
    const key = `${reference}\u0000${platform}`
    if (registryCache.has(key)) return registryCache.get(key)
    const inspection = Promise.resolve().then(() => {
      const raw = inspectRaw(reference)
      let manifest
      try {
        manifest = JSON.parse(raw)
      } catch {
        fail(
          'registry_platform_unknown',
          `${reference}: registry manifest is malformed`
        )
      }
      if (Array.isArray(manifest?.manifests)) {
        const wanted = platform.slice('linux/'.length)
        const matches = manifest.manifests.filter((entry) => {
          const candidate = entry?.platform
          if (
            !candidate ||
            candidate.os === 'unknown' ||
            candidate.architecture === 'unknown'
          ) {
            return false
          }
          return candidate.os === 'linux' && candidate.architecture === wanted
        })
        if (matches.length !== 1) {
          fail(
            'registry_platform_mismatch',
            `${reference} does not contain exactly one ${platform} manifest`
          )
        }
      } else if (manifest?.config) {
        const metadata = parseJson(
          transport.run(
            'docker',
            [
              'buildx',
              'imagetools',
              'inspect',
              reference,
              '--format',
              '{{json .Image}}',
            ],
            { timeoutMs: COMMAND_TIMEOUT_MS, env: registryEnvironment }
          ).stdout,
          'registry image metadata'
        )
        const candidate = metadata?.platform ??
          metadata?.Platform ??
          metadata?.image?.platform ??
          metadata?.Image?.Platform ?? {
            os: metadata?.os,
            architecture: metadata?.architecture,
          }
        if (
          candidate?.os !== 'linux' ||
          candidate.architecture !== platform.slice('linux/'.length)
        ) {
          fail(
            'registry_platform_mismatch',
            `${reference} cannot prove ${platform}`
          )
        }
      } else {
        fail(
          'registry_platform_unknown',
          `${reference} has no readable OCI manifest`
        )
      }
      return true
    })
    registryCache.set(key, inspection)
    return inspection
  }

  function inspectRaw(reference) {
    return transport
      .run('docker', ['buildx', 'imagetools', 'inspect', reference, '--raw'], {
        env: registryEnvironment,
        timeoutMs: COMMAND_TIMEOUT_MS,
      })
      .stdout.toString('utf8')
  }

  async function validatePinnedImages(request) {
    for (const reference of request.pinnedImages) {
      await inspectRegistryImage(reference, request.platform)
    }
  }

  function correlatedRun(request, runs) {
    const matches = runs.filter(
      (run) =>
        run?.display_title === request.correlation &&
        run?.repository?.full_name === REPOSITORY &&
        run?.path === WORKFLOW_PATH &&
        run?.event === 'workflow_dispatch'
    )
    if (matches.length > 1) {
      fail(
        'correlation_ambiguous',
        'more than one producing run carries the correlation'
      )
    }
    const run = matches[0]
    if (!run) return null
    validateRunIdentity(run, {
      event: 'workflow_dispatch',
      label: 'correlated preview run',
      sha: request.controlRevision,
    })
    return run
  }

  async function previewReceipts(request, run, physical, discovery = false) {
    validateCompletedRun(run, 'correlated preview run')
    const jobs = await listJobs(run)
    const finalize = requireJob(jobs, run, 'preview-finalize', {
      headSha: run.head_sha,
      requireStarted: true,
    })

    const artifacts = await listArtifacts(run)
    const receiptArtifact = selectArtifact(
      artifacts,
      `preview-images-${run.display_title}`,
      finalize
    )
    const envelope = artifactMember(receiptArtifact, PREVIEW_RECEIPT_MEMBER)
    if (!Array.isArray(envelope?.receipts)) {
      fail(
        'artifact_mismatch',
        'preview receipt envelope has no receipts array'
      )
    }
    if (envelope.receipts.length === 0)
      fail('receipt_missing', 'completed preview run carries no image receipts')
    const byTarget = new Map()
    for (const receipt of envelope.receipts) {
      if (typeof receipt?.target === 'string') {
        const values = byTarget.get(receipt.target) ?? []
        values.push(receipt)
        byTarget.set(receipt.target, values)
      }
    }
    const result = []
    for (const entry of physical.values()) {
      if (!entry.logicalTargets.some((target) => byTarget.has(target))) continue
      if (
        discovery &&
        !entry.logicalTargets.some((target) =>
          (byTarget.get(target) ?? []).some(
            (receipt) =>
              receipt.revision === request.revision &&
              receipt.controlRevision === request.controlRevision &&
              receipt.platform === request.platform &&
              receipt.configurationDigest === entry.configurationDigest
          )
        )
      )
        continue
      const suffix = PLATFORMS[request.platform]
      requireJob(jobs, run, `preview-${entry.target.id}-${suffix}`, {
        headSha: run.head_sha,
        requireStarted: true,
      })
      const scanJob = requireJob(jobs, run, `preview-scan-${entry.target.id}`, {
        headSha: run.head_sha,
        requireStarted: true,
      })
      for (const target of entry.logicalTargets) {
        const matches = byTarget.get(target) ?? []
        if (matches.length !== 1) {
          fail(
            'receipt_missing',
            `${target} has ${matches.length} preview receipts`
          )
        }
        const receipt = validatePublicReceipt(matches[0], {
          attempt: run.run_attempt,
          controlRevision: request.controlRevision,
          configurationDigest: entry.configurationDigest,
          imageRepository: `ghcr.io/${REPOSITORY}/${entry.target.image}`,
          platform: request.platform,
          revision: request.revision,
          runId: run.id,
          target,
        })
        await inspectRegistryImage(receipt.image, request.platform)
        await admitScan({
          artifacts,
          imageDigest: receipt.image.slice(receipt.image.lastIndexOf('@') + 1),
          repository: receipt.image.slice(0, receipt.image.lastIndexOf('@')),
          platform: request.platform,
          revision: request.revision,
          run,
          scanArtifact: `preview-scan-${entry.target.id}`,
          scanJob,
          targetId: entry.target.id,
          receiptMember: `image-scan-${entry.target.id}-receipt.json`,
          preview: true,
        })
        result.push(receipt)
      }
    }
    return result
  }

  async function existingPreviewReceipts(request, runs, available) {
    const candidates = runs
      .filter(
        (run) =>
          run?.display_title !== request.correlation &&
          CORRELATION.test(run?.display_title) &&
          run?.repository?.full_name === REPOSITORY &&
          run?.path === WORKFLOW_PATH &&
          run?.event === 'workflow_dispatch' &&
          run?.head_sha === request.controlRevision &&
          run?.status === 'completed' &&
          run?.conclusion === 'success'
      )
      .sort((left, right) => Number(right.id) - Number(left.id))
      .slice(0, MAX_PREVIEW_REUSE_RUNS)
    const receipts = []
    for (const run of candidates) {
      const missing = expectedPhysicalTargets(
        request.targets.filter((entry) => !available.has(entry.target))
      )
      if (missing.size === 0) break
      validateRunIdentity(run, {
        event: 'workflow_dispatch',
        label: 'existing preview run',
        sha: request.controlRevision,
      })
      for (const receipt of await previewReceipts(
        request,
        run,
        missing,
        true
      )) {
        available.add(receipt.target)
        receipts.push(receipt)
      }
    }
    return receipts
  }

  async function stagingReceipts(request, missing, physical) {
    const attempts = []
    for (const target of missing) {
      const entry = physical.get(workflowTarget(target).id)
      const published = PREVIEW_STAGING_IMAGES.find(
        (candidate) => candidate.logicalTarget === target
      )
      if (!published) continue
      const staging = stagingTargetForPreview(entry.target)
      if (
        request.platform !== published.platform ||
        staging?.reuse !== true ||
        published.scan !== true ||
        Object.keys(entry.configuration).length !== 0
      ) {
        continue
      }
      attempts.push({ entry, published, staging, target })
    }
    if (attempts.length === 0) return new Map()

    const runs = await listPushRuns(request.revision)
    if (runs.length === 0) return new Map()
    const run = runs[0]
    if (isPendingRun(run)) {
      fail(
        'existing_reuse_unprovable',
        'the exact staging publisher run is still pending'
      )
    }
    validateRunIdentity(run, {
      event: 'push',
      label: 'staging publisher run',
      sha: request.revision,
    })
    validateCompletedRun(run, 'staging publisher run')
    // A staging image is a legacy producer only when its workflow still meets
    // the trusted structural inventory. The receipt controlRevision names the
    // verifier revision; the run head itself must be the requested source.
    await workflowAt(run.head_sha, run.head_branch)

    const jobs = await listJobs(run)
    const artifacts = await listArtifacts(run)
    requireJob(jobs, run, 'build-images-status', {
      headSha: request.revision,
      requireStarted: true,
    })
    const receipts = new Map()
    for (const { entry, published, staging, target } of attempts) {
      const buildJob = requireJob(jobs, run, buildJobName(staging), {
        headSha: request.revision,
        requireStarted: true,
      })
      const scanJob = requireJob(jobs, run, scanJobName(staging), {
        headSha: request.revision,
        requireStarted: true,
      })
      const digestArtifact = selectArtifact(
        artifacts,
        published.buildArtifact,
        buildJob
      )
      const digestText = artifactContent(digestArtifact, 'digest.txt')
      const imageDigest = digestText.trim()
      if (!DIGEST.test(imageDigest)) {
        fail('artifact_mismatch', `${staging.id} published no image digest`)
      }
      const fingerprint = artifactMember(
        digestArtifact,
        `image-input-fingerprint-${staging.id}.json`
      )
      if (fingerprint?.target !== staging.id) {
        fail(
          'artifact_mismatch',
          `${staging.id} published another target fingerprint`
        )
      }
      digest('staging input fingerprint', fingerprint.fingerprint)
      const reuse = artifactMember(
        digestArtifact,
        `image-reuse-${staging.id}.json`
      )
      if (
        reuse?.schemaVersion !== 1 ||
        typeof reuse?.adopted !== 'boolean' ||
        reuse?.digest !== imageDigest ||
        reuse?.tag !== fingerprint.tag
      ) {
        fail(
          'existing_reuse_unprovable',
          `${staging.id} did not admit this exact digest and fingerprint in the requested run`
        )
      }
      const repository = `ghcr.io/${REPOSITORY}/${published.image}`
      const image = `${repository}@${imageDigest}`
      await inspectRegistryImage(image, request.platform)
      await admitScan({
        artifacts,
        imageDigest,
        platform: published.platform,
        repository,
        revision: request.revision,
        run,
        scanArtifact: published.scanArtifact,
        receiptMember: receiptFileName(published.scanArtifact),
        scanJob,
        targetId: staging.id,
      })
      receipts.set(target, {
        admissionPassed: true,
        attempt: Number(run.run_attempt),
        ciPassed: true,
        configurationDigest: entry.configurationDigest,
        controlRevision: request.controlRevision,
        image,
        inputFingerprint: fingerprint.fingerprint,
        platform: request.platform,
        repository: REPOSITORY,
        revision: request.revision,
        runId: String(run.id),
        target,
        workflow: WORKFLOW_PATH,
      })
    }
    return receipts
  }

  async function admitScan({
    artifacts,
    imageDigest,
    platform,
    repository,
    revision,
    run,
    scanArtifact,
    scanJob,
    targetId,
    receiptMember,
    preview = false,
  }) {
    const artifact = selectArtifact(artifacts, scanArtifact, scanJob)
    const scanReceipt = artifactMember(artifact, receiptMember)
    if (preview) {
      const reportName = scanReceipt.reports?.findings
      if (
        typeof reportName !== 'string' ||
        /[\\/]/.test(reportName) ||
        !reportName.endsWith('.json')
      ) {
        fail('scan_admission_missing', `${targetId}: invalid findings member`)
      }
      const report = artifactMember(artifact, reportName)
      if (
        !report ||
        typeof report.SchemaVersion !== 'number' ||
        !Object.hasOwn(report, 'Results') ||
        (report.Results !== null && !Array.isArray(report.Results))
      ) {
        fail('scan_admission_missing', `${targetId}: malformed findings report`)
      }
      const policy = parseExceptionPolicy(
        environment[SCAN_POLICY_NAME],
        { sourceRevision: revision, platform },
        now()
      )
      const { summary, admission } = evaluatePreviewScan(
        report.Results ?? [],
        targetId,
        policy
      )
      if (
        summary.violation ||
        !isDeepStrictEqual(scanReceipt.previewAdmission, admission)
      ) {
        fail(
          'scan_admission_missing',
          `${targetId}: findings or exception annotation differ from operator policy`
        )
      }
    }
    const decision = validateScanReceipt(scanReceipt, {
      allowPreviewExceptions: preview,
      candidateSha: revision,
      digest: imageDigest,
      image: repository,
      runAttempt: run.run_attempt,
      runId: run.id,
    })
    if (!decision.ok || scanReceipt.artifact?.architecture !== platform) {
      fail(
        'scan_admission_missing',
        `${targetId}: ${decision.ok ? 'wrong platform' : decision.reason}`
      )
    }
  }

  async function dispatch(request) {
    if (request.missing.length === 0) {
      fail('invalid_input', 'dispatch requires at least one missing target')
    }
    const buildConfiguration = {}
    for (const target of request.missing) {
      const selected = request.targets.find((entry) => entry.target === target)
      buildConfiguration[target] = selected.configuration
    }
    parseExceptionPolicy(
      environment[SCAN_POLICY_NAME],
      { sourceRevision: request.revision, platform: request.platform },
      now()
    )
    gh([
      'workflow',
      'run',
      WORKFLOW_FILE,
      '--repo',
      REPOSITORY,
      '--ref',
      controlRef,
      '--field',
      `buildConfigurationJson=${JSON.stringify(buildConfiguration)}`,
      '--field',
      `correlationId=${request.correlation}`,
      '--field',
      `platform=${request.platform}`,
      '--field',
      `sourceSha=${request.revision}`,
      '--field',
      `targets=${request.missing.join(',')}`,
      ...(environment[SCAN_POLICY_NAME]
        ? [
            '--field',
            `scanExceptionPolicyJson=${environment[SCAN_POLICY_NAME]}`,
          ]
        : []),
    ])
    return {}
  }

  return {
    async execute(raw) {
      try {
        const request = parseEnvelope(raw)
        parseExceptionPolicy(
          environment[SCAN_POLICY_NAME],
          { sourceRevision: request.revision, platform: request.platform },
          now()
        )
        if (
          typeof controlRef !== 'string' ||
          !/^[A-Za-z0-9_./-]{1,240}$/.test(controlRef)
        )
          fail(
            'control_mismatch',
            `${CONTROL_REF_NAME} must identify the installed branch or tag`
          )
        expectedControlRevision = request.controlRevision
        const observedControl = ghJson(
          `repos/${REPOSITORY}/commits/${encodeURIComponent(controlRef)}`
        )
        if (observedControl?.sha !== expectedControlRevision)
          fail(
            'control_mismatch',
            'the installed producer ref moved; review its new revision before dispatch'
          )
        const physical = expectedPhysicalTargets(
          request.targets.filter((entry) =>
            request.missing.includes(entry.target)
          )
        )
        validatePreviewDispatcher()
        if (request.action === 'dispatch') {
          await sourceCi(request.revision)
          return await dispatch(request)
        }

        await validatePinnedImages(request)
        const dispatchedRuns = await listDispatchedRuns()
        const run = correlatedRun(request, dispatchedRuns)
        if (run && isPendingRun(run)) {
          return { receipts: [], pending: true }
        }
        const receipts = run
          ? await previewReceipts(request, run, physical)
          : []
        const available = new Set(receipts.map((receipt) => receipt.target))
        receipts.push(
          ...(await existingPreviewReceipts(request, dispatchedRuns, available))
        )
        const staging = await stagingReceipts(
          request,
          request.missing.filter((target) => !available.has(target)),
          physical
        )
        await sourceCi(
          request.revision,
          staging.size > 0 ? STAGING_CONTEXTS : REQUIRED_CONTEXTS
        )
        parseExceptionPolicy(
          environment[SCAN_POLICY_NAME],
          { sourceRevision: request.revision, platform: request.platform },
          now()
        )
        return {
          receipts: sortReceipts([...receipts, ...staging.values()]),
          pending: false,
        }
      } finally {
        rmSync(tempRoot, { force: true, recursive: true })
      }
    },
  }
}

function sortReceipts(receipts) {
  if (receipts.length > MAX_RECEIPTS) {
    fail('output_limit', `receipt output exceeds ${MAX_RECEIPTS} entries`)
  }
  return receipts
    .map((receipt) => publicReceipt(receipt))
    .sort((left, right) => left.target.localeCompare(right.target))
}

function serializeOutput(value) {
  const output = `${JSON.stringify(value)}\n`
  if (Buffer.byteLength(output) > MAX_OUTPUT_BYTES) {
    fail('output_limit', `command output exceeds ${MAX_OUTPUT_BYTES} bytes`)
  }
  return output
}

async function main() {
  try {
    const input = readFileSync(0)
    const adapter = createAdapter()
    const result = await adapter.execute(input)
    process.stdout.write(serializeOutput(result))
  } catch (error) {
    process.stderr.write(`preview-images: ${String(error?.message ?? error)}\n`)
    process.exitCode = error?.code === 'invalid_input' ? 2 : 1
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}

export {
  CONTROL_REF_NAME,
  configurationForTargets,
  createAdapter,
  createProcessTransport,
  expectedPhysicalTargets,
  MAX_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  MAX_RECEIPTS,
  parseEnvelope,
  publicReceipt,
  REPOSITORY,
  REQUIRED_CONTEXTS,
  STAGING_CONTEXTS,
  serializeOutput,
  TOKEN_NAME,
  WORKFLOW_PATH,
}
