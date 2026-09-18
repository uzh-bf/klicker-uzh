const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { parse } = require('yaml')
const {
  REQUIRED_CI_WORKFLOWS,
  STAGING_IMAGE_TARGETS,
  STAGING_TARGET_IDS,
  validateStagingWorkflow,
} = require('./stg-release-promoter.js')
const { SCAN_ADMISSION_INVENTORY } = require('./image-scan-admission.cjs')
const { planOutputs } = require('./staging-image-plan.cjs')
const {
  CONSOLIDATED_WORKFLOW_PATH,
  amdJobName,
  buildJobName,
  imageName,
  scanJobName,
} = require('./staging-image-targets.cjs')

const ROOT = path.join(__dirname, '../..')
const CHART_DIR = path.join(ROOT, 'deploy/charts/klicker-uzh-v3')
const REPOSITORY = 'uzh-bf/klicker-uzh'
const SENTINEL_TAG = 'stg-release-ref-sentinel'

const IMAGE_VALUES = {
  auth: 'auth-arm',
  frontendPWA: 'frontend-pwa-arm',
  frontendManage: 'frontend-manage-arm',
  frontendControl: 'frontend-control-arm',
  backendGraphql: 'backend-docker-arm',
  olatApi: 'olat-api-arm',
  lti: 'lti-arm',
  chat: 'chat-arm',
  responseApi: 'response-api-arm',
  mcpStudent: 'mcp-student-arm',
  mcpLecturer: 'mcp-lecturer-arm',
  migrator: 'backend-docker-migrator-arm',
  'assessment.frontendPWA': 'frontend-assessment-arm',
  'assessment.backendGraphql': 'backend-docker-arm',
  'assessment.responseApi': 'response-api-arm',
  'hatchet.workers.general': 'hatchet-worker-general-arm',
  'hatchet.workers.responseProcessor': 'hatchet-worker-response-processor-arm',
  'hatchet.workers.responseProcessorAssessment':
    'hatchet-worker-response-processor-arm',
}

const EXPECTED_RUNTIME_IMAGE_JOB_MAP = {
  'ghcr.io/uzh-bf/klicker-uzh/analytics-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-analytics',
  'ghcr.io/uzh-bf/klicker-uzh/auth-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-auth',
  'ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-backend-docker',
  'ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-backend-docker-migrator',
  'ghcr.io/uzh-bf/klicker-uzh/chat-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-chat',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-assessment-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-frontend-assessment',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-control-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-frontend-control',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-manage-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-frontend-manage',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-pwa-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-frontend-pwa',
  'ghcr.io/uzh-bf/klicker-uzh/hatchet-worker-general-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-hatchet-worker-general',
  'ghcr.io/uzh-bf/klicker-uzh/hatchet-worker-response-processor-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-hatchet-worker-response-processor',
  'ghcr.io/uzh-bf/klicker-uzh/lti-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-lti',
  'ghcr.io/uzh-bf/klicker-uzh/mcp-lecturer-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-mcp-lecturer',
  'ghcr.io/uzh-bf/klicker-uzh/mcp-student-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-mcp-student',
  'ghcr.io/uzh-bf/klicker-uzh/olat-api-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-olat-api',
  'ghcr.io/uzh-bf/klicker-uzh/response-api-arm':
    '.github/workflows/v3_images-stg.yml#build-arm-response-api',
}

function readYaml(relativePath) {
  return parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'))
}

function templateImageSources() {
  return fs
    .readdirSync(path.join(CHART_DIR, 'templates'))
    .filter((name) => name.endsWith('.yaml'))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(CHART_DIR, 'templates', name), 'utf8')
        .split('\n')
        .filter((line) => /^\s+image: "\{\{ \.Values\./u.test(line))
        .map((line) => ({ name, line: line.trim() }))
    )
}

function renderedImages(render) {
  return [...render.matchAll(/^\s+image:\s+"?([^"\s]+)"?\s*$/gmu)].map(
    (match) => match[1]
  )
}

function imageRepository(image) {
  return image.slice(0, image.lastIndexOf(':'))
}

function renderChart(chartDir, valuesPath, extraArguments = []) {
  return execFileSync(
    'helm',
    ['template', 'klicker', chartDir, '-f', valuesPath, ...extraArguments],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  )
}

function runPublishGuard(inspectOutput, inspectStatus) {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'stg-image-publish-guard-')
  )
  const binDir = path.join(fixtureRoot, 'bin')
  const dockerPath = path.join(binDir, 'docker')
  const outputPath = path.join(fixtureRoot, 'github-output')
  const summaryPath = path.join(fixtureRoot, 'github-summary')
  const argsPath = path.join(fixtureRoot, 'docker-args')
  const image = 'ghcr.io/example/staging-image'
  const sha = 'a'.repeat(40)

  fs.mkdirSync(binDir)
  fs.writeFileSync(
    dockerPath,
    [
      '#!/usr/bin/env bash',
      'set -eu',
      `printf '%s\\n' "$*" >"\${DOCKER_ARGS_FILE}"`,
      `printf '%s\\n' "\${DOCKER_INSPECT_OUTPUT}"`,
      'exit "${DOCKER_INSPECT_STATUS}"',
      '',
    ].join('\n')
  )
  fs.chmodSync(dockerPath, 0o755)

  const result = spawnSync(
    'bash',
    [path.join(ROOT, '.github/scripts/stg-image-publish-guard.sh')],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        DOCKER_ARGS_FILE: argsPath,
        DOCKER_INSPECT_OUTPUT: inspectOutput,
        DOCKER_INSPECT_STATUS: String(inspectStatus),
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        IMAGE: image,
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
        SHA: sha,
      },
    }
  )

  const readIfPresent = (filePath) =>
    fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''

  return {
    args: readIfPresent(argsPath).trim(),
    cleanup: () => fs.rmSync(fixtureRoot, { recursive: true, force: true }),
    output: readIfPresent(outputPath),
    result,
    summary: readIfPresent(summaryPath),
  }
}

// One consolidated workflow owns every staging image, so the contract this
// test protects is the workflow's own matrix contract rather than the shape of
// fifteen per-image files. The trusted inventory is the single source of truth:
// every target it declares must appear as a build leg, and the promoter must
// derive its publisher set from that same inventory.
test('the consolidated workflow covers every trusted target and guard', () => {
  const workflowPath = CONSOLIDATED_WORKFLOW_PATH
  const content = fs.readFileSync(path.join(ROOT, workflowPath), 'utf8')
  const definition = parse(content)

  assert.equal(definition.name, 'Build staging images')
  assert.deepEqual(definition.on.push.branches, ['v3', 'v3*'])
  assert.equal(definition.on.push.paths, undefined)

  // The candidate branch the trusted controller promotes from still resolves
  // through the same structural validator the promoter runs.
  const incarnation = validateStagingWorkflow({
    content,
    path: workflowPath,
    repository: REPOSITORY,
    sourceBranch: 'v3-audit',
    targetIds: STAGING_TARGET_IDS,
  })
  assert.equal(incarnation.jobs.length, STAGING_IMAGE_TARGETS.length)
  assert.deepEqual(
    incarnation.jobs.map((job) => job.id).sort(),
    STAGING_IMAGE_TARGETS.map((target) => buildJobName(target)).sort()
  )
  assert.deepEqual(
    incarnation.jobs.map((job) => job.image).sort(),
    STAGING_IMAGE_TARGETS.map(
      (target) => 'ghcr.io/' + REPOSITORY + '/' + imageName(target) + '-arm'
    ).sort()
  )
  assert.equal(incarnation.path, CONSOLIDATED_WORKFLOW_PATH)
  assert.equal(incarnation.name, 'Build staging images')

  // A push selects every available target, so the emitted matrix is the full
  // inventory and each target keeps exactly one ARM build leg.
  const outputs = planOutputs({
    changedFileCount: STAGING_TARGET_IDS.length,
    mode: 'push-all',
    reason: 'push',
    selected: STAGING_TARGET_IDS,
    state: 'run',
    unavailable: [],
  })
  const independent = STAGING_IMAGE_TARGETS.filter(
    (target) => target.stage === 'independent'
  )
  const migrator = STAGING_IMAGE_TARGETS.filter(
    (target) => target.stage === 'migrator'
  )
  const afterMigrator = STAGING_IMAGE_TARGETS.filter(
    (target) => target.stage === 'after-migrator'
  )
  const scanTargets = STAGING_IMAGE_TARGETS.filter((target) => target.scan)
  const amdTargets = STAGING_IMAGE_TARGETS.filter((target) => target.amd)

  assert.deepEqual(
    JSON.parse(outputs['build-job-names']).sort(),
    STAGING_IMAGE_TARGETS.map((target) => buildJobName(target)).sort()
  )
  assert.deepEqual(
    JSON.parse(outputs.matrix)
      .map((entry) => entry.jobName)
      .sort(),
    independent.map((target) => buildJobName(target)).sort()
  )
  assert.deepEqual(
    JSON.parse(outputs['migrator-matrix']).map((entry) => entry.jobName),
    migrator.map((target) => buildJobName(target))
  )
  assert.deepEqual(
    JSON.parse(outputs['after-migrator-matrix']).map((entry) => entry.jobName),
    afterMigrator.map((target) => buildJobName(target))
  )
  assert.deepEqual(
    JSON.parse(outputs['scan-job-names']).sort(),
    scanTargets.map((target) => scanJobName(target)).sort()
  )
  assert.deepEqual(
    JSON.parse(outputs['amd-job-names']).sort(),
    amdTargets.map((target) => amdJobName(target)).sort()
  )

  // Every published image maps back to the one build leg the promoter names.
  // The registry path is what the chart renders, so it is what this map keys.
  const runtimeImageJobMap = {}
  for (const target of STAGING_IMAGE_TARGETS) {
    const repository =
      'ghcr.io/' + REPOSITORY + '/' + imageName(target) + '-arm'
    assert.equal(runtimeImageJobMap[repository], undefined)
    runtimeImageJobMap[repository] = workflowPath + '#' + buildJobName(target)
  }
  assert.deepEqual(runtimeImageJobMap, EXPECTED_RUNTIME_IMAGE_JOB_MAP)

  // The scan admission inventory is derived from the same targets, so a scan
  // leg can never name a build leg that does not exist.
  assert.equal(scanTargets.length, SCAN_ADMISSION_INVENTORY.length)
  for (const entry of SCAN_ADMISSION_INVENTORY) {
    assert.equal(entry.workflowPath, workflowPath)
    const target = STAGING_IMAGE_TARGETS.find(
      (candidate) => buildJobName(candidate) === entry.buildJob
    )
    assert.ok(target, entry.buildJob + ' is not a target build job')
    assert.equal(entry.scanJob, scanJobName(target))
    assert.equal(target.scan, true)
  }

  // Each matrix leg carries exactly one metadata and one build step with the
  // stable tagging, and every publishing leg keeps the publish-once guard
  // ordered before the build so a canonical digest is reused.
  for (const [jobName, job] of Object.entries(definition.jobs)) {
    if (!/^(build|scan)-arm-/u.test(jobName)) continue
    const metadataSteps = job.steps.filter((step) =>
      /^docker\/metadata-action@/u.test(step.uses ?? '')
    )
    const buildSteps = job.steps.filter((step) =>
      /^docker\/build-push-action@/u.test(step.uses ?? '')
    )
    assert.equal(metadataSteps.length, 1, jobName)
    assert.equal(buildSteps.length, 1, jobName)

    const metadata = metadataSteps[0]
    const build = buildSteps[0]
    assert.equal(metadata.id, 'meta')
    assert.deepEqual(metadata.with.tags.trim().split('\n'), [
      'type=ref,event=branch',
      'type=ref,event=pr',
      'type=raw,value=${{ github.sha }}',
    ])
    assert.equal(build.with.tags, '${{ steps.meta.outputs.tags }}')
    assert.equal(build.with.push, "${{ github.event_name != 'pull_request' }}")

    const guards = job.steps.filter((step) => step.id === 'publish_guard')
    assert.equal(guards.length, 1, jobName)
    const guard = guards[0]
    assert.equal(guard.if, "github.event_name != 'pull_request'")
    assert.equal(guard.env.IMAGE, metadata.with.images)
    assert.equal(guard.env.SHA, '${{ github.sha }}')
    assert.equal(guard.run, '.github/scripts/stg-image-publish-guard.sh')
    assert.equal(guard.shell, 'bash')
    assert.equal(
      build.if,
      "github.event_name == 'pull_request' || steps.publish_guard.outputs.publish == 'true'"
    )

    const loginIndex = job.steps.findIndex((step) =>
      /^docker\/login-action@/u.test(step.uses ?? '')
    )
    const metadataIndex = job.steps.indexOf(metadata)
    const guardIndex = job.steps.indexOf(guard)
    const buildIndex = job.steps.indexOf(build)
    assert.ok(loginIndex >= 0, jobName + ' must log in before publishing')
    assert.ok(loginIndex < metadataIndex)
    assert.ok(metadataIndex < guardIndex)
    assert.ok(guardIndex < buildIndex)
  }

  // The scan targets expose the guard-reused digest through an artifact,
  // because a matrix job reports only its last completed leg's outputs.
  for (const target of scanTargets) {
    const stageJob =
      target.stage === 'migrator'
        ? 'build-migrator'
        : target.stage === 'after-migrator'
          ? 'build-after-migrator'
          : 'build'
    const job = definition.jobs[stageJob]
    const upload = job.steps.find(
      (step) =>
        step.uses === 'actions/upload-artifact@v4' &&
        String(step.with?.name ?? '').startsWith('build-digest-')
    )
    assert.ok(upload, buildJobName(target) + ' must upload its digest')
    // The artifact name is a matrix expression so one job definition covers
    // every leg in that stage; the scan leg downloads it by the same id.
    assert.equal(upload.with.name, 'build-digest-\u0024{{ matrix.id }}')
    assert.equal(upload.with['if-no-files-found'], 'error')
  }

  // The migrator stage runs first and the dependent app stage waits for it.
  // Parsed YAML normalizes a single dependency to a scalar and a list to an
  // array, so both forms are read through the same text helper the structural
  // validator uses on the raw content.
  const asList = (value) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value]
  assert.deepEqual(asList(definition.jobs['build-migrator'].needs), ['plan'])
  assert.deepEqual(
    asList(definition.jobs['build-after-migrator'].needs).sort(),
    ['build-migrator', 'plan']
  )
  assert.equal(
    definition.jobs['build-images-status'].if,
    'always()',
    'the required context must always report'
  )

  const promoter = readYaml('.github/workflows/deploy-stg-promote.yml')
  const validationNames = REQUIRED_CI_WORKFLOWS.map(
    ({ path: requiredPath }) => readYaml(requiredPath).name
  )
  assert.deepEqual(
    [...promoter.on.workflow_run.workflows].sort(),
    [...new Set([definition.name, ...validationNames])].sort()
  )
  assert.deepEqual(promoter.on.workflow_run.types, ['completed'])
})

test('the publish-once guard reuses a canonical digest and fails closed', (t) => {
  const digest = `sha256:${'b'.repeat(64)}`
  const existing = runPublishGuard(`Name: fixture\nDigest: ${digest}`, 0)
  t.after(existing.cleanup)

  assert.equal(existing.result.status, 0, existing.result.stderr)
  assert.equal(
    existing.args,
    `buildx imagetools inspect ghcr.io/example/staging-image:${'a'.repeat(40)}`
  )
  assert.equal(existing.output, `publish=false\ndigest=${digest}\n`)
  assert.match(existing.summary, /Reused staging image/u)

  for (const output of [
    `ERROR: ghcr.io/example/staging-image:${'a'.repeat(40)}: not found`,
    `ERROR: failed to solve: ghcr.io/example/staging-image:${'a'.repeat(40)}: not found`,
  ]) {
    const missing = runPublishGuard(output, 1)
    t.after(missing.cleanup)
    assert.equal(missing.result.status, 0, missing.result.stderr)
    assert.equal(missing.output, 'publish=true\n')
    assert.match(missing.summary, /Publish staging image/u)
  }

  for (const output of [
    'ERROR: unexpected status from HEAD request: 404 Not Found',
    'ERROR: resource not found',
    'ERROR: failed to solve: resource not found',
    `ERROR: failed to solve: ghcr.io/example/other-image:${'a'.repeat(40)}: not found`,
    'ERROR: manifest unknown',
    `ERROR: no such manifest: ghcr.io/example/staging-image:${'a'.repeat(40)}`,
    'unauthorized',
  ]) {
    const uncertain = runPublishGuard(output, 1)
    t.after(uncertain.cleanup)
    assert.notEqual(uncertain.result.status, 0)
    assert.equal(uncertain.output, '')
    assert.match(uncertain.result.stderr, /refusing to rebuild/u)
  }
})

test('all first-party chart images prefer the optional global tag', () => {
  const values = readYaml('deploy/charts/klicker-uzh-v3/values.yaml')
  assert.equal(values.global.imageTag, '')

  const imageSources = templateImageSources()
  for (const template of [
    'deployment-audit-workers.yaml',
    'deployment-audit-media-policy-worker.yaml',
  ]) {
    assert.ok(
      imageSources.some(({ name }) => name === template),
      `${template} image must be checked`
    )
  }
  for (const { name, line } of imageSources) {
    assert.match(
      line,
      /:\{\{ \.Values\.global\.imageTag \| default /u,
      `${name}: ${line}`
    )
  }

  const migrator = imageSources.find(({ name }) => name === 'job-migrate.yaml')
  assert.match(
    migrator.line,
    /global\.imageTag \| default \.Values\.migrator\.image\.tag \| default \.Values\.backendGraphql\.image\.tag/u
  )
})

test('rendered images preserve per-image fallbacks and prefer the global tag', () => {
  const imageArguments = Object.entries(IMAGE_VALUES).flatMap(([key, name]) => [
    '--set-string',
    `${key}.image.repository=ghcr.io/uzh-bf/klicker-uzh/${name}`,
    '--set-string',
    `${key}.image.tag=release-${key.replaceAll('.', '-')}`,
  ])
  const renderImages = (extraArguments = []) =>
    renderedImages(
      renderChart(CHART_DIR, path.join(CHART_DIR, 'values.yaml'), [
        '--set',
        'mcpStudent.enabled=true,mcpLecturer.enabled=true,migrator.enabled=true',
        ...imageArguments,
        ...extraArguments,
      ])
    ).sort()
  const expected = Object.entries(IMAGE_VALUES)
    .map(
      ([key, name]) =>
        `ghcr.io/uzh-bf/klicker-uzh/${name}:release-${key.replaceAll('.', '-')}`
    )
    .sort()

  assert.deepEqual(renderImages(), expected)
  assert.deepEqual(renderImages(['--set-string', 'global.imageTag=']), expected)
  for (const tag of [SENTINEL_TAG, '0'.repeat(40)]) {
    const images = renderImages(['--set-string', `global.imageTag=${tag}`])
    assert.deepEqual(
      images,
      expected.map((image) => `${imageRepository(image)}:${tag}`).sort()
    )
    for (const repository of images.map(imageRepository)) {
      assert.ok(
        repository in EXPECTED_RUNTIME_IMAGE_JOB_MAP,
        `no active selected-source build publishes ${repository}`
      )
    }
  }

  const migratorRepository =
    'ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm'
  assert.ok(
    renderImages(['--set-string', 'migrator.image.tag=']).includes(
      `${migratorRepository}:release-backendGraphql`
    )
  )
  const appVersion = readYaml(
    'deploy/charts/klicker-uzh-v3/Chart.yaml'
  ).appVersion
  const untagged = Object.keys(IMAGE_VALUES).flatMap((key) => [
    '--set-string',
    `${key}.image.tag=`,
  ])
  assert.deepEqual(
    renderImages(untagged),
    expected.map((image) => `${imageRepository(image)}:${appVersion}`).sort()
  )
})
