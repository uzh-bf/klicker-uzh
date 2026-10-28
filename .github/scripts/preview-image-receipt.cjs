'use strict'

const { execFile } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { evaluatePolicy, readTrivyResults } = require('./image-scan-receipt.cjs')
const { PREVIEW_IMAGE_TARGETS } = require('./staging-image-targets.cjs')

const RECEIPT_SCHEMA_VERSION = 1
const WORKFLOW_PATH = '.github/workflows/v3_images-stg.yml'
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/
const PLATFORM_PATTERN = /^linux\/(?:amd64|arm64)$/
const TARGET_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const PREVIEW_ARTIFACT_PATTERN = /^preview-images-[0-9a-f]{64}$/
const MAX_PREVIEW_RECEIPT_BYTES = 1024 * 1024
const GH_TIMEOUT_MS = 20000

function fail(message) {
  throw new Error(`preview-image-receipt: ${message}`)
}

function requiredText(label, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} is required`)
  }
  return value.trim()
}

function digest(label, value) {
  const normalized = requiredText(label, value)
  if (!DIGEST_PATTERN.test(normalized)) {
    fail(`${label} must be a sha256 digest`)
  }
  return normalized
}

function gitSha(label, value) {
  const normalized = requiredText(label, value)
  if (!GIT_SHA_PATTERN.test(normalized)) {
    fail(`${label} must be a full commit SHA`)
  }
  return normalized
}

function positiveRunNumber(label, value) {
  const normalized = requiredText(label, value)
  if (!/^[1-9][0-9]*$/.test(normalized)) {
    fail(`${label} must be a positive integer string`)
  }
  return normalized
}

function targetId(value) {
  const normalized = requiredText('target', value)
  if (!TARGET_PATTERN.test(normalized)) {
    fail('target must be a logical target identifier')
  }
  return normalized
}

function platform(value) {
  const normalized = requiredText('platform', value)
  if (!PLATFORM_PATTERN.test(normalized)) {
    fail('platform must be linux/amd64 or linux/arm64')
  }
  return normalized
}

function repository(value) {
  const normalized = requiredText('repository', value)
  if (!/^[^/\s]+\/[^/\s]+$/.test(normalized)) {
    fail('repository must use owner/name form')
  }
  return normalized
}

function workflowPath(value) {
  const normalized = requiredText('workflow path', value)
  if (normalized !== WORKFLOW_PATH) {
    fail(`workflow path must be ${WORKFLOW_PATH}`)
  }
  return normalized
}

function requiredTrue(label, value) {
  if (value !== true && value !== 'true') {
    fail(`${label} must be true before a receipt is published`)
  }
  return true
}

function immutableImage(image, imageDigest) {
  const normalized = requiredText('image', image)
  if (!normalized.endsWith(`@${imageDigest}`)) {
    fail(`image must be pinned to ${imageDigest}`)
  }
  return normalized
}

function writeJson(outputPath, value) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`)
}

function buildMetadata(input) {
  const imageDigest = digest('image digest', input.imageDigest)
  const logicalTargets = input.logicalTargets
  if (!Array.isArray(logicalTargets) || logicalTargets.length === 0) {
    fail('logical targets are required')
  }
  const normalizedTargets = logicalTargets.map(targetId)
  if (new Set(normalizedTargets).size !== normalizedTargets.length) {
    fail('logical targets must be unique')
  }
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    id: targetId(input.id),
    image: immutableImage(input.image, imageDigest),
    digest: imageDigest,
    logicalTargets: normalizedTargets,
    configurationDigest: digest(
      'configuration digest',
      input.configurationDigest
    ),
    inputFingerprint: digest('input fingerprint', input.inputFingerprint),
    platform: platform(input.platform),
    sourceRevision: gitSha('source revision', input.sourceRevision),
    controlRevision: gitSha('control revision', input.controlRevision),
  }
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`${label} at ${filePath} is unavailable: ${error.message}`)
  }
}

function filesNamed(root, fileName) {
  if (!fs.existsSync(root)) return []
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && entry.name === fileName) files.push(entryPath)
    }
  }
  visit(root)
  return files.sort()
}

function reportPath(scanPath, reportName, label) {
  const name = requiredText(label, reportName)
  if (path.basename(name) !== name) {
    fail(`${label} must name a file beside the scan receipt`)
  }
  const report = path.join(path.dirname(scanPath), name)
  if (!fs.existsSync(report) || !fs.statSync(report).isFile()) {
    fail(`${label} ${name} is absent from the scan artifact`)
  }
  return report
}

function verifyScan(metadata, scanPath, identity) {
  const scan = readJson(scanPath, 'scan receipt')
  if (scan.schemaVersion !== 'klicker.image-scan-receipt/v1') {
    fail(`${metadata.id} has an unsupported scan receipt schema`)
  }
  if (scan.artifact?.digest !== metadata.digest) {
    fail(`${metadata.id} scan digest does not match the built digest`)
  }
  if (scan.artifact?.image !== metadata.image) {
    fail(`${metadata.id} scan image does not match the immutable build image`)
  }
  if (scan.artifact?.architecture !== metadata.platform) {
    fail(
      `${metadata.id} scan platform does not match the native build platform`
    )
  }
  if (scan.scanner?.name !== 'trivy') {
    fail(`${metadata.id} scan was not produced by Trivy`)
  }
  if (
    !Array.isArray(scan.policy?.failOn) ||
    scan.policy.failOn.join(',') !== 'HIGH,CRITICAL' ||
    scan.policy?.failOnUnfixed !== false
  ) {
    fail(`${metadata.id} scan receipt does not carry the required policy`)
  }
  if (
    scan.run?.id !== identity.runId ||
    scan.run?.attempt !== identity.attempt
  ) {
    fail(`${metadata.id} scan receipt is from another workflow run`)
  }
  if (scan.run?.gitSha !== identity.sourceRevision) {
    fail(`${metadata.id} scan receipt is from another source revision`)
  }
  const findings = reportPath(
    scanPath,
    scan.reports?.findings,
    'findings report'
  )
  const sbom = reportPath(scanPath, scan.reports?.sbom, 'SBOM report')
  const summary = evaluatePolicy(readTrivyResults(findings))
  if (summary.violation) {
    fail(
      `${metadata.id} still has ${summary.fixable} fixable HIGH/CRITICAL findings`
    )
  }
  if (fs.statSync(sbom).size === 0) {
    fail(`${metadata.id} SBOM report is empty`)
  }
  return scan
}

function parseTargetMap(value) {
  let parsed
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    fail('target map must contain valid JSON')
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail('target map must list at least one logical target')
  }
  const entries = parsed.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail('target map entries must be objects')
    }
    return {
      buildTarget: targetId(entry.buildTarget),
      configurationDigest: digest(
        'target configuration digest',
        entry.configurationDigest
      ),
      logicalTarget: targetId(entry.logicalTarget),
    }
  })
  const logicalTargets = new Set()
  for (const entry of entries) {
    if (logicalTargets.has(entry.logicalTarget)) {
      fail(`target map repeats ${entry.logicalTarget}`)
    }
    logicalTargets.add(entry.logicalTarget)
  }
  return entries
}

function publicReceipt({
  attempt,
  configurationDigest,
  controlRevision,
  metadata,
  repository: repositoryName,
  runId,
  sourceRevision,
  target,
  workflow,
}) {
  return {
    repository: repositoryName,
    workflow,
    controlRevision,
    revision: sourceRevision,
    runId,
    attempt: Number(positiveRunNumber('run attempt', attempt)),
    target,
    platform: metadata.platform,
    configurationDigest,
    inputFingerprint: metadata.inputFingerprint,
    image: metadata.image,
    ciPassed: true,
    admissionPassed: true,
  }
}

function finalizeReceipts(input) {
  const repositoryName = repository(input.repository)
  const workflow = workflowPath(input.workflow)
  const controlRevision = gitSha('control revision', input.controlRevision)
  const sourceRevision = gitSha('source revision', input.sourceRevision)
  const runId = positiveRunNumber('run ID', input.runId)
  const attempt = positiveRunNumber('run attempt', input.attempt)
  const expectedPlatform = platform(input.platform)
  requiredTrue('CI result', input.ciPassed)
  requiredTrue('scan admission', input.admissionPassed)
  const targetMap = parseTargetMap(input.targetMap)
  const expectedTargets = [
    ...new Set(targetMap.map((entry) => entry.buildTarget)),
  ].sort()
  const expectedDigests = new Map()
  for (const entry of targetMap) {
    const previous = expectedDigests.get(entry.buildTarget)
    if (previous && previous !== entry.configurationDigest) {
      fail(`${entry.buildTarget} has conflicting target configurations`)
    }
    expectedDigests.set(entry.buildTarget, entry.configurationDigest)
  }

  const buildFiles = filesNamed(input.buildArtifactsRoot, 'preview-build.json')
  const metadata = buildFiles.map((file) => readJson(file, 'build metadata'))
  if (metadata.length !== expectedTargets.length) {
    fail(
      `expected ${expectedTargets.length} build metadata records, received ${metadata.length}`
    )
  }
  const expected = new Set(expectedTargets)
  const metadataById = new Map()
  for (const entry of metadata) {
    if (!expected.has(entry.id)) fail(`unexpected physical build ${entry.id}`)
    if (metadataById.has(entry.id)) fail(`duplicate physical build ${entry.id}`)
    if (entry.platform !== expectedPlatform) {
      fail(`${entry.id} was not built for ${expectedPlatform}`)
    }
    if (entry.configurationDigest !== expectedDigests.get(entry.id)) {
      fail(`${entry.id} configuration digest does not match the plan`)
    }
    if (entry.sourceRevision !== sourceRevision) {
      fail(`${entry.id} source revision does not match the run`)
    }
    if (entry.controlRevision !== controlRevision) {
      fail(`${entry.id} control revision does not match the run`)
    }
    metadataById.set(entry.id, entry)
  }

  const scanFiles = expectedTargets.flatMap((target) =>
    filesNamed(input.scanArtifactsRoot, `image-scan-${target}-receipt.json`)
  )
  const scanReceipts = scanFiles.map((file) => ({
    file,
    receipt: readJson(file, 'scan receipt'),
  }))
  fs.rmSync(input.outputRoot, { force: true, recursive: true })
  fs.mkdirSync(input.outputRoot, { recursive: true })

  const identity = { attempt, runId, sourceRevision }
  const verifiedScans = new Map()
  for (const entry of metadataById.values()) {
    const matching = scanReceipts.filter(({ receipt }) => {
      return (
        receipt.artifact?.digest === entry.digest &&
        receipt.artifact?.image === entry.image
      )
    })
    if (matching.length !== 1) {
      fail(
        `${entry.id} requires exactly one digest-bound scan receipt, found ${matching.length}`
      )
    }
    verifyScan(entry, matching[0].file, identity)
    const scanDirectory = path.join(input.outputRoot, 'scans', entry.id)
    fs.mkdirSync(scanDirectory, { recursive: true })
    fs.cpSync(path.dirname(matching[0].file), scanDirectory, {
      recursive: true,
    })
    verifiedScans.set(entry.id, entry)
  }

  const receipts = targetMap.map((entry) => {
    const entryMetadata = verifiedScans.get(entry.buildTarget)
    if (!entryMetadata) {
      fail(`${entry.buildTarget} has no verified physical build`)
    }
    if (!entryMetadata.logicalTargets.includes(entry.logicalTarget)) {
      fail(`${entry.buildTarget} does not build ${entry.logicalTarget}`)
    }
    return publicReceipt({
      attempt,
      configurationDigest: entry.configurationDigest,
      controlRevision,
      metadata: entryMetadata,
      repository: repositoryName,
      runId,
      sourceRevision,
      target: entry.logicalTarget,
      workflow,
    })
  })

  const envelope = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    receipts: receipts.sort((left, right) =>
      left.target.localeCompare(right.target)
    ),
  }
  writeJson(path.join(input.outputRoot, 'preview-images.json'), envelope)
  return envelope
}

function execFileResult(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: GH_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024, ...options },
      (error, stdout) => {
        if (error) reject(new Error('external-command-failed'))
        else resolve(stdout)
      }
    )
  })
}

async function ghCli(args) {
  return execFileResult('gh', args, { encoding: 'utf8' })
}

async function extractPreviewArtifact({ artifact, repository }) {
  if (!Number.isSafeInteger(artifact?.id) || artifact.id <= 0) {
    throw new Error('invalid artifact')
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-receipt-'))
  const archive = path.join(directory, 'artifact.zip')
  try {
    const archiveBytes = await execFileResult(
      'gh',
      ['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`],
      { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }
    )
    fs.writeFileSync(archive, archiveBytes)
    const entries = await execFileResult('unzip', ['-Z1', archive], {
      encoding: 'utf8',
    })
    if (
      entries.split(/\r?\n/).filter((name) => name === 'preview-images.json')
        .length !== 1
    ) {
      throw new Error('preview receipt is missing or ambiguous')
    }
    const payload = await execFileResult(
      'unzip',
      ['-p', archive, 'preview-images.json'],
      { encoding: 'buffer', maxBuffer: MAX_PREVIEW_RECEIPT_BYTES }
    )
    if (
      !Buffer.isBuffer(payload) ||
      payload.length > MAX_PREVIEW_RECEIPT_BYTES
    ) {
      throw new Error('preview receipt is too large')
    }
    return JSON.parse(payload.toString('utf8'))
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
}

async function requestJson(transport, args) {
  const value = await transport(args)
  return typeof value === 'string' ? JSON.parse(value) : value
}

async function readCollection(transport, basePath, key) {
  const separator = basePath.includes('?') ? '&' : '?'
  const response = await requestJson(transport, [
    'api',
    `${basePath}${separator}per_page=100`,
  ])
  if (
    !Array.isArray(response?.[key]) ||
    !Number.isSafeInteger(response.total_count) ||
    response.total_count !== response[key].length
  ) {
    throw new Error(`incomplete ${key} response`)
  }
  return response[key]
}

function success(job) {
  return job?.status === 'completed' && job.conclusion === 'success'
}

async function findReusablePreviewImage({
  repository: repositoryName,
  workflow,
  controlRevision,
  target,
  inputFingerprint,
  configurationDigest,
  platform: targetPlatform,
  gh = ghCli,
  extract = extractPreviewArtifact,
}) {
  const repositoryValue = repository(repositoryName)
  const workflowValue = workflowPath(workflow)
  const control = gitSha('control revision', controlRevision)
  const physicalTarget = targetId(target)
  const fingerprint = digest('input fingerprint', inputFingerprint)
  const configuration = digest('configuration digest', configurationDigest)
  const platformValue = platform(targetPlatform)
  const inventory = PREVIEW_IMAGE_TARGETS.find(
    (entry) => entry.id === physicalTarget
  )
  if (!inventory) return null

  try {
    const runsPath =
      `repos/${repositoryValue}/actions/workflows/` +
      `${encodeURIComponent(path.basename(workflowValue))}/runs` +
      `?event=workflow_dispatch&head_sha=${control}` +
      '&status=success&per_page=5'
    const listed = await requestJson(gh, ['api', runsPath])
    if (!Array.isArray(listed?.workflow_runs)) return null
    const runs = listed.workflow_runs
      .filter(
        (run) =>
          run.event === 'workflow_dispatch' &&
          run.status === 'completed' &&
          run.conclusion === 'success' &&
          run.head_sha === control &&
          run.repository?.full_name === repositoryValue &&
          run.head_repository?.full_name === repositoryValue &&
          run.path?.split('@')[0] === workflowValue &&
          Number.isSafeInteger(run.id) &&
          Number.isSafeInteger(run.run_attempt) &&
          run.run_attempt > 0
      )
      .sort((left, right) => right.id - left.id)
      .slice(0, 5)

    for (const run of runs) {
      const jobs = await readCollection(
        gh,
        `repos/${repositoryValue}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`,
        'jobs'
      )
      if (
        !jobs.every(
          (job) =>
            job.run_attempt === run.run_attempt &&
            job.status === 'completed' &&
            ['success', 'skipped'].includes(job.conclusion)
        )
      ) {
        continue
      }
      const finalizers = jobs.filter((job) => job.name === 'preview-finalize')
      const builds = jobs.filter(
        (job) =>
          job.name ===
          `preview-${physicalTarget}-${platformValue.split('/')[1]}`
      )
      const scans = jobs.filter(
        (job) => job.name === `preview-scan-${physicalTarget}`
      )
      if (
        finalizers.length !== 1 ||
        builds.length !== 1 ||
        scans.length !== 1 ||
        ![finalizers[0], builds[0], scans[0]].every(
          (job) => job.run_attempt === run.run_attempt && success(job)
        )
      ) {
        continue
      }
      const finalizerStarted = Date.parse(finalizers[0].started_at)
      if (!Number.isFinite(finalizerStarted)) continue

      const artifacts = await readCollection(
        gh,
        `repos/${repositoryValue}/actions/runs/${run.id}/artifacts`,
        'artifacts'
      )
      const receipts = artifacts.filter((artifact) => {
        const created = Date.parse(artifact.created_at)
        return (
          PREVIEW_ARTIFACT_PATTERN.test(artifact.name) &&
          artifact.expired === false &&
          artifact.workflow_run?.id === run.id &&
          artifact.workflow_run?.head_sha === control &&
          Number.isFinite(created) &&
          created >= finalizerStarted
        )
      })
      if (receipts.length !== 1) continue

      const envelope = await extract({
        artifact: receipts[0],
        repository: repositoryValue,
      })
      if (
        envelope?.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
        !Array.isArray(envelope.receipts)
      ) {
        continue
      }
      const expectedTargets = new Set(inventory.logicalTargets)
      const imagePrefix = `ghcr.io/${repositoryValue}/${inventory.image}@`
      const qualified = envelope.receipts.flatMap((receipt) => {
        const imageDigest = receipt?.image?.startsWith(imagePrefix)
          ? receipt.image.slice(imagePrefix.length)
          : ''
        const matches =
          expectedTargets.has(receipt?.target) &&
          receipt.repository === repositoryValue &&
          receipt.workflow === workflowValue &&
          receipt.controlRevision === control &&
          receipt.runId === String(run.id) &&
          receipt.attempt === run.run_attempt &&
          receipt.inputFingerprint === fingerprint &&
          receipt.configurationDigest === configuration &&
          receipt.platform === platformValue &&
          receipt.ciPassed === true &&
          receipt.admissionPassed === true &&
          DIGEST_PATTERN.test(imageDigest)
        return matches ? [{ ...receipt, digest: imageDigest }] : []
      })
      if (qualified.length === 0) continue
      const digests = new Set(qualified.map((receipt) => receipt.digest))
      const images = new Set(qualified.map((receipt) => receipt.image))
      if (digests.size !== 1 || images.size !== 1) continue
      return {
        image: qualified[0].image,
        digest: qualified[0].digest,
        producerRunId: run.id,
        producerAttempt: run.run_attempt,
      }
    }
    return null
  } catch {
    return null
  }
}

function writeGithubOutputs(outputs) {
  const outputPath = requiredText('GITHUB_OUTPUT', process.env.GITHUB_OUTPUT)
  const lines = Object.entries(outputs).map(([name, value]) => {
    if (/[\r\n]/.test(value)) fail(`GitHub output ${name} must be single-line`)
    return `${name}=${value}`
  })
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

async function reuseForRun(args) {
  const fingerprintFile = requiredText('--fingerprint', args.fingerprint)
  const fingerprint = readJson(fingerprintFile, 'input fingerprint')
  const result = await findReusablePreviewImage({
    repository: args.repository ?? process.env.REPOSITORY,
    workflow: WORKFLOW_PATH,
    controlRevision: args['control-revision'] ?? process.env.CONTROL_REVISION,
    target: args.target ?? process.env.TARGET_ID,
    inputFingerprint: fingerprint?.fingerprint,
    configurationDigest:
      args['configuration-digest'] ?? process.env.CONFIGURATION_DIGEST,
    platform: args.platform ?? process.env.PLATFORM,
  })
  writeGithubOutputs({
    adopt: result ? 'true' : 'false',
    digest: result?.digest ?? '',
    image: result?.image ?? '',
  })
  return result
}

function parseArguments(argv) {
  const [command, ...rest] = argv
  const args = {}
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index]
    const value = rest[index + 1]
    if (!flag?.startsWith('--') || value === undefined) {
      fail(`unexpected argument ${flag ?? ''}`)
    }
    args[flag.slice(2)] = value
  }
  return { args, command }
}

function writeMetadataForRun(args) {
  const rawTargets = args['logical-targets'] ?? process.env.LOGICAL_TARGETS
  let logicalTargets
  try {
    logicalTargets = JSON.parse(requiredText('logical targets', rawTargets))
  } catch {
    fail('logical targets must contain JSON')
  }
  const metadata = buildMetadata({
    controlRevision: args['control-revision'] ?? process.env.CONTROL_REVISION,
    configurationDigest:
      args['configuration-digest'] ?? process.env.CONFIGURATION_DIGEST,
    id: args.id ?? process.env.TARGET_ID,
    image: args.image ?? process.env.IMAGE_NAME,
    imageDigest: args['image-digest'] ?? process.env.IMAGE_DIGEST,
    inputFingerprint:
      args['input-fingerprint'] ?? process.env.INPUT_FINGERPRINT,
    logicalTargets,
    platform: args.platform ?? process.env.PLATFORM,
    sourceRevision: args['source-revision'] ?? process.env.SOURCE_REVISION,
  })
  writeJson(requiredText('--output', args.output), metadata)
  return metadata
}

function finalizeForRun(args) {
  return finalizeReceipts({
    admissionPassed: args['admission-passed'] ?? process.env.ADMISSION_PASSED,
    attempt: args.attempt ?? process.env.RUN_ATTEMPT,
    buildArtifactsRoot: requiredText(
      '--build-artifacts',
      args['build-artifacts'] ?? process.env.BUILD_ARTIFACTS
    ),
    ciPassed: args['ci-passed'] ?? process.env.CI_PASSED,
    controlRevision: args['control-revision'] ?? process.env.CONTROL_REVISION,
    outputRoot: requiredText('--output', args.output),
    platform: args.platform ?? process.env.PLATFORM,
    repository: args.repository ?? process.env.REPOSITORY,
    runId: args['run-id'] ?? process.env.RUN_ID,
    scanArtifactsRoot: requiredText(
      '--scan-artifacts',
      args['scan-artifacts'] ?? process.env.SCAN_ARTIFACTS
    ),
    sourceRevision: args['source-revision'] ?? process.env.SOURCE_REVISION,
    targetMap: args['target-map'] ?? process.env.TARGET_MAP,
    workflow: args.workflow ?? process.env.WORKFLOW_PATH,
  })
}

async function main(argv = process.argv.slice(2)) {
  const { args, command } = parseArguments(argv)
  if (command === 'metadata') {
    const metadata = writeMetadataForRun(args)
    process.stdout.write(`${JSON.stringify(metadata)}\n`)
    return 0
  }
  if (command === 'finalize') {
    const envelope = finalizeForRun(args)
    process.stdout.write(
      `${JSON.stringify({ receipts: envelope.receipts.length })}\n`
    )
    return 0
  }
  if (command === 'reuse') {
    await reuseForRun(args)
    return 0
  }
  fail(`unknown command ${command ?? ''}`)
}

if (require.main === module) {
  main().then(
    (status) => {
      process.exitCode = status
    },
    (error) => {
      console.error(`::error::${error.message}`)
      process.exitCode = 1
    }
  )
}

module.exports = {
  RECEIPT_SCHEMA_VERSION,
  WORKFLOW_PATH,
  buildMetadata,
  finalizeReceipts,
  findReusablePreviewImage,
  parseTargetMap,
  publicReceipt,
  verifyScan,
}
