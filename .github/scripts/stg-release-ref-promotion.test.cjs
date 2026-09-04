const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { parse } = require('yaml')

const ROOT = path.join(__dirname, '../..')
const WORKFLOW_DIR = path.join(ROOT, '.github/workflows')
const CHART_DIR = path.join(ROOT, 'deploy/charts/klicker-uzh-v3')
const PARENT_SHA = '1765a2d6394fc9a3f18bddd330dda70438510e23'
const REPOSITORY = 'uzh-bf/klicker-uzh'
const SENTINEL_TAG = 'stg-release-ref-sentinel'

const BASELINE_RENDER_DIGESTS = {
  'deploy/env-uzh-prd/values.yaml':
    '0ec440b0e11ddea51a5c325a0b21d041ed3c51decb5780660d844724ccad0533',
  'deploy/env-uzh-stg/values.yaml':
    'a6ee9ad6b2353045b99a4054473867284d14c2b99d5cf7e388de1875b12911e0',
}

const EXPECTED_RUNTIME_IMAGE_JOB_MAP = {
  'ghcr.io/uzh-bf/klicker-uzh/analytics-arm':
    '.github/workflows/v3_analytics-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/auth-arm':
    '.github/workflows/v3_auth-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm':
    '.github/workflows/v3_backend-docker-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm':
    '.github/workflows/v3_backend-docker-stg.yml#build-migrator-arm',
  'ghcr.io/uzh-bf/klicker-uzh/chat-arm':
    '.github/workflows/v3_chat-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-assessment-arm':
    '.github/workflows/v3_frontend-pwa-docker-assessment-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-control-arm':
    '.github/workflows/v3_frontend-control-docker-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-manage-arm':
    '.github/workflows/v3_frontend-manage-docker-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/frontend-pwa-arm':
    '.github/workflows/v3_frontend-pwa-docker-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/hatchet-worker-general-arm':
    '.github/workflows/v3_hatchet-worker-general-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/hatchet-worker-response-processor-arm':
    '.github/workflows/v3_hatchet-worker-response-processor-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/lti-arm':
    '.github/workflows/v3_lti-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/mcp-lecturer-amd':
    '.github/workflows/v3_mcp-lecturer-stg.yml#build-amd',
  'ghcr.io/uzh-bf/klicker-uzh/mcp-lecturer-arm':
    '.github/workflows/v3_mcp-lecturer-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/mcp-student-amd':
    '.github/workflows/v3_mcp-student-stg.yml#build-amd',
  'ghcr.io/uzh-bf/klicker-uzh/mcp-student-arm':
    '.github/workflows/v3_mcp-student-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/olat-api-arm':
    '.github/workflows/v3_olat-api-stg.yml#build-arm',
  'ghcr.io/uzh-bf/klicker-uzh/response-api-arm':
    '.github/workflows/v3_response-api-stg.yml#build-arm',
}

function readYaml(relativePath) {
  return parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'))
}

function selectedWorkflowPaths() {
  return fs
    .readdirSync(WORKFLOW_DIR)
    .filter((name) => /^v3_.+-stg\.yml$/u.test(name))
    .sort()
    .map((name) => `.github/workflows/${name}`)
}

function resolveImageExpression(expression, workflowEnv) {
  let result = expression.replaceAll('${{ github.repository }}', REPOSITORY)

  for (let pass = 0; pass < 4; pass += 1) {
    const next = result.replace(
      /\$\{\{\s*env\.([A-Z0-9_]+)\s*\}\}/gu,
      (_match, name) => {
        assert.ok(name in workflowEnv, `missing workflow env ${name}`)
        return String(workflowEnv[name]).replaceAll(
          '${{ github.repository }}',
          REPOSITORY
        )
      }
    )
    if (next === result) break
    result = next
  }

  assert.doesNotMatch(result, /\$\{\{/u)
  return result
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

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function parentFile(relativePath) {
  return execFileSync('git', ['show', `${PARENT_SHA}:${relativePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
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

test('selected-source workflows retain all tags and guard every active image', () => {
  const workflowPaths = selectedWorkflowPaths()
  assert.equal(workflowPaths.length, 15)

  const workflows = workflowPaths.map((workflowPath) => ({
    definition: readYaml(workflowPath),
    workflowPath,
  }))
  const workflowNames = workflows.map(({ definition }) => definition.name)
  assert.equal(new Set(workflowNames).size, 15)

  const promoter = readYaml('.github/workflows/deploy-stg-promote.yml')
  assert.deepEqual(
    [...promoter.on.workflow_run.workflows].sort(),
    [...workflowNames].sort()
  )
  assert.deepEqual(promoter.on.workflow_run.types, ['completed'])

  let metadataBuildPairs = 0
  let activeBuilds = 0
  let disabledBuilds = 0
  const runtimeImageJobMap = {}

  for (const { definition, workflowPath } of workflows) {
    assert.deepEqual(definition.on.push.branches, ['v3', 'v3*'])
    assert.equal(definition.on.push.paths, undefined)

    for (const [jobName, job] of Object.entries(definition.jobs)) {
      const metadataSteps = job.steps.filter((step) =>
        /^docker\/metadata-action@/u.test(step.uses ?? '')
      )
      const buildSteps = job.steps.filter((step) =>
        /^docker\/build-push-action@/u.test(step.uses ?? '')
      )

      assert.equal(metadataSteps.length, 1, `${workflowPath}#${jobName}`)
      assert.equal(buildSteps.length, 1, `${workflowPath}#${jobName}`)
      metadataBuildPairs += 1

      const metadata = metadataSteps[0]
      const build = buildSteps[0]
      assert.equal(metadata.id, 'meta')
      assert.deepEqual(metadata.with.tags.trim().split('\n'), [
        'type=ref,event=branch',
        'type=ref,event=pr',
        'type=raw,value=${{ github.sha }}',
      ])
      assert.equal(build.with.tags, '${{ steps.meta.outputs.tags }}')
      assert.equal(
        build.with.push,
        "${{ github.event_name != 'pull_request' }}"
      )

      const guards = job.steps.filter((step) => step.id === 'publish_guard')
      if (job.if === '${{ false }}') {
        disabledBuilds += 1
        assert.match(jobName, /amd$/u)
        assert.equal(guards.length, 0)
        assert.equal(build.if, undefined)
        continue
      }

      activeBuilds += 1
      assert.equal(guards.length, 1, `${workflowPath}#${jobName}`)
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
      assert.ok(loginIndex >= 0)
      assert.ok(loginIndex < metadataIndex)
      assert.ok(metadataIndex < guardIndex)
      assert.ok(guardIndex < buildIndex)

      const repository = resolveImageExpression(
        metadata.with.images,
        definition.env
      )
      assert.equal(runtimeImageJobMap[repository], undefined)
      runtimeImageJobMap[repository] = `${workflowPath}#${jobName}`
    }
  }

  assert.equal(metadataBuildPairs, 32)
  assert.equal(activeBuilds, 18)
  assert.equal(disabledBuilds, 14)
  assert.deepEqual(runtimeImageJobMap, EXPECTED_RUNTIME_IMAGE_JOB_MAP)

  const backend = workflows.find(
    ({ workflowPath }) =>
      workflowPath === '.github/workflows/v3_backend-docker-stg.yml'
  ).definition
  assert.deepEqual(Object.keys(backend.jobs), [
    'build-arm',
    'build-amd',
    'build-migrator-arm',
    'build-migrator-amd',
  ])
  assert.equal(backend.jobs['build-arm'].needs, 'build-migrator-arm')
  assert.equal(backend.jobs['build-amd'].needs, 'build-migrator-amd')
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

  const missing = runPublishGuard('manifest unknown', 1)
  t.after(missing.cleanup)
  assert.equal(missing.result.status, 0, missing.result.stderr)
  assert.equal(missing.output, 'publish=true\n')
  assert.match(missing.summary, /Publish staging image/u)

  const uncertain = runPublishGuard('unauthorized', 1)
  t.after(uncertain.cleanup)
  assert.notEqual(uncertain.result.status, 0)
  assert.equal(uncertain.output, '')
  assert.match(uncertain.result.stderr, /refusing to rebuild/u)
})

test('all first-party chart images prefer the optional global tag', () => {
  const values = readYaml('deploy/charts/klicker-uzh-v3/values.yaml')
  assert.equal(values.global.imageTag, '')

  const imageSources = templateImageSources()
  assert.equal(imageSources.length, 18)
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

  const stagingValues = fs.readFileSync(
    path.join(ROOT, 'deploy/env-uzh-stg/values.yaml'),
    'utf8'
  )
  const productionValues = fs.readFileSync(
    path.join(ROOT, 'deploy/env-uzh-prd/values.yaml'),
    'utf8'
  )
  assert.equal(
    (stagingValues.match(/rollout\.klicker\.uzh\.ch\/release:/gu) ?? []).length,
    16
  )
  assert.equal(
    (productionValues.match(/rollout\.klicker\.uzh\.ch\/release:/gu) ?? [])
      .length,
    0
  )
})

test('sentinel coverage is complete and no-override renders match the parent', (t) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'stg-release-chart-baseline-')
  )
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }))

  const chartArchive = execFileSync(
    'git',
    [
      'archive',
      '--format=tar',
      PARENT_SHA,
      '--',
      'deploy/charts/klicker-uzh-v3',
    ],
    { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 }
  )
  execFileSync('tar', ['-x', '-f', '-', '-C', fixtureRoot], {
    input: chartArchive,
    maxBuffer: 16 * 1024 * 1024,
  })
  const parentChartDir = path.join(fixtureRoot, 'deploy/charts/klicker-uzh-v3')

  for (const [valuesRelativePath, expectedDigest] of Object.entries(
    BASELINE_RENDER_DIGESTS
  )) {
    const frozenValues = parentFile(valuesRelativePath)
    const currentValuesPath = path.join(ROOT, valuesRelativePath)
    assert.equal(fs.readFileSync(currentValuesPath, 'utf8'), frozenValues)

    const fixtureValuesPath = path.join(
      fixtureRoot,
      path.basename(path.dirname(valuesRelativePath)) + '-values.yaml'
    )
    fs.writeFileSync(fixtureValuesPath, frozenValues)

    const frozenRender = renderChart(parentChartDir, fixtureValuesPath)
    assert.equal(sha256(frozenRender), expectedDigest)
    assert.equal(
      renderChart(CHART_DIR, currentValuesPath),
      frozenRender,
      `${valuesRelativePath} changed without global.imageTag`
    )
  }

  const stagingValuesPath = path.join(ROOT, 'deploy/env-uzh-stg/values.yaml')
  const sentinelRender = renderChart(CHART_DIR, stagingValuesPath, [
    '--set-string',
    `global.imageTag=${SENTINEL_TAG}`,
  ])
  const images = renderedImages(sentinelRender).filter((image) =>
    image.startsWith('ghcr.io/uzh-bf/klicker-uzh/')
  )
  assert.equal(images.length, 18)
  assert.ok(images.every((image) => image.endsWith(`:${SENTINEL_TAG}`)))

  for (const repository of images.map(imageRepository)) {
    assert.ok(
      repository in EXPECTED_RUNTIME_IMAGE_JOB_MAP,
      `no active selected-source build publishes ${repository}`
    )
  }
})
