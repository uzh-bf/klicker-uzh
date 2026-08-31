const fs = require('node:fs')
const path = require('node:path')

const EXPECTED_CALL =
  'uses: uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3'
const EXPECTED_BUILD_ACTION =
  'uses: uzh-bf/klicker-uzh/.github/actions/playwright-build@refs/heads/v3'
const EXPECTED_SHARD_ACTION =
  'uses: uzh-bf/klicker-uzh/.github/actions/playwright-shard@refs/heads/v3'

function readWorkflow(root, name, issues) {
  const relativePath = `.github/workflows/${name}`
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8')
  } catch (error) {
    issues.push(
      `could not read required workflow ${relativePath}: ${error.message}`
    )
    return ''
  }
}

function readAction(root, name, issues) {
  const relativePath = `.github/actions/${name}/action.yml`
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8')
  } catch (error) {
    issues.push(
      `could not read required action ${relativePath}: ${error.message}`
    )
    return ''
  }
}

function namedSteps(text) {
  return text.split(/\n(?=\s+- name: )/)
}

function validatePublicPlaywrightWorkflow(root) {
  const issues = []
  const caller = readWorkflow(root, 'test-playwright.yml', issues)
  const publicWorkflow = readWorkflow(
    root,
    'public-pr-playwright-shards.yml',
    issues
  )
  const seedWorkflow = readWorkflow(root, 'playwright-cache-seed.yml', issues)
  const publicActions = [
    readAction(root, 'playwright-build', issues),
    readAction(root, 'playwright-shard', issues),
  ].join('\n')
  const publicCacheRestoreSteps = namedSteps(publicActions).filter((step) =>
    step.includes('uses: actions/cache/restore@v4')
  )
  const publicCacheContractSteps = namedSteps(publicActions).filter((step) =>
    step.includes('id: cache-contract')
  )
  if (!caller.includes(EXPECTED_CALL)) {
    issues.push(
      `caller must use the canonical reusable workflow ref: ${EXPECTED_CALL}`
    )
  }

  for (const forbidden of [
    'pull_request_target',
    '${{ secrets.',
    'TURBO_TOKEN',
    'TURBO_TEAM',
    'actions/cache@v4',
    'actions/cache/save@v4',
  ]) {
    if (
      publicWorkflow.includes(forbidden) ||
      publicActions.includes(forbidden)
    ) {
      issues.push(`public workflow contains forbidden boundary: ${forbidden}`)
    }
  }

  if (!/^permissions:\s*\n\s+contents:\s+read\s*$/m.test(publicWorkflow)) {
    issues.push('public workflow must grant only contents: read')
  }

  const checkoutCount = (
    `${publicWorkflow}\n${publicActions}`.match(/actions\/checkout@v4/g) ?? []
  ).length
  const nonPersistedCheckoutCount = (
    `${publicWorkflow}\n${publicActions}`.match(
      /persist-credentials:\s+false/g
    ) ?? []
  ).length
  if (checkoutCount !== nonPersistedCheckoutCount) {
    issues.push('every public checkout must set persist-credentials: false')
  }

  const trustedControl = `${publicWorkflow}\n${publicActions}`
  // The fixed shape has one preparation checkout and one checkout in each trusted action.
  const trustedRepositoryCount = (
    trustedControl.match(/repository: \$\{\{ job\.workflow_repository \}\}/g) ??
    []
  ).length
  const trustedRefCount = (
    trustedControl.match(/ref: \$\{\{ job\.workflow_sha \}\}/g) ?? []
  ).length
  if (trustedRepositoryCount !== 3 || trustedRefCount !== 3) {
    issues.push(
      'every trusted control checkout must use the called workflow repository and commit'
    )
  }

  const publicRunnerCount = (
    publicWorkflow.match(/group:\s+public-pr-arm64/g) ?? []
  ).length
  const publicLabelCount = (
    publicWorkflow.match(/public-pr-arm64, playwright/g) ?? []
  ).length
  if (publicRunnerCount !== 2 || publicLabelCount !== 2) {
    issues.push(
      'both public execution jobs must use the exact public-pr-arm64 labels'
    )
  }

  const buildActionCount = (
    publicWorkflow.match(
      /uses: uzh-bf\/klicker-uzh\/.github\/actions\/playwright-build@refs\/heads\/v3/g
    ) ?? []
  ).length
  const shardActionCount = (
    publicWorkflow.match(
      /uses: uzh-bf\/klicker-uzh\/.github\/actions\/playwright-shard@refs\/heads\/v3/g
    ) ?? []
  ).length
  if (
    buildActionCount !== 2 ||
    shardActionCount !== 2 ||
    publicWorkflow.includes('uses: ./.github/actions/') ||
    !publicActions.includes('rm -rf -- "$GITHUB_WORKSPACE/.ci-control"')
  ) {
    issues.push(
      'execution jobs must use the trusted v3 composite actions, not candidate-local actions'
    )
  }

  if ((publicWorkflow.match(/concurrency:/g) ?? []).length !== 0) {
    issues.push('called workflow must not define concurrency')
  }
  if (!publicWorkflow.includes('runs-on: ubuntu-latest')) {
    issues.push('the trusted preparation job must run on GitHub-hosted Ubuntu')
  }
  if (
    !publicWorkflow.includes('playwright-route.cjs') ||
    !publicWorkflow.includes('playwright-plan-metadata.cjs') ||
    !publicWorkflow.includes('playwright-execution-plan.json') ||
    !publicWorkflow.includes('fromJSON(needs.prepare.outputs.shard_matrix)')
  ) {
    issues.push('the reusable workflow must expose one trusted canonical plan')
  }
  if (
    !publicWorkflow.includes('Build draft selector shadow plan') ||
    !publicWorkflow.includes('playwright-selector-shadow.json')
  ) {
    issues.push(
      'draft selector shadow planning must remain in the trusted envelope'
    )
  }
  if (
    (
      caller.match(
        /uses: uzh-bf\/klicker-uzh\/.github\/workflows\/public-pr-playwright-shards\.yml@refs\/heads\/v3/g
      ) ?? []
    ).length !== 1 ||
    (caller.match(/concurrency:/g) ?? []).length !== 1 ||
    caller.includes('group: public-pr-arm64')
  ) {
    issues.push(
      'caller must have one route-neutral reusable invocation and no runner labels'
    )
  }

  const queueJobStart = caller.indexOf('  playwright-queue-telemetry:')
  if (queueJobStart === -1) {
    issues.push('caller must define the playwright-queue-telemetry job')
  } else {
    const queueJob = caller.slice(queueJobStart)
    if (!queueJob.includes('runs-on: ubuntu-latest')) {
      issues.push('queue telemetry must run on GitHub-hosted Ubuntu')
    }
    if (!queueJob.includes('permissions:\n      actions: read')) {
      issues.push('queue telemetry must have only actions: read permission')
    }
    if (queueJob.includes('actions/checkout@')) {
      issues.push('queue telemetry must not check out repository code')
    }
    if (queueJob.includes('public-pr-arm64')) {
      issues.push('queue telemetry must not target the public runner pool')
    }
  }

  if (
    publicWorkflow.includes('group: public-pr-arm64') &&
    publicWorkflow.includes('Build draft selector shadow plan') &&
    !publicWorkflow.includes(
      "if: github.event_name == 'pull_request' && github.event.pull_request.draft == true"
    )
  ) {
    issues.push(
      'selector shadow must be draft-only and hosted by the trusted preparation job'
    )
  }

  if (
    publicCacheRestoreSteps.length !== 3 ||
    publicCacheRestoreSteps.some(
      (step) => !step.includes('continue-on-error: true')
    )
  ) {
    issues.push(
      'public cache restores must fail open so cache-service errors do not fail Playwright'
    )
  }
  if (
    publicCacheContractSteps.length !== 2 ||
    publicCacheContractSteps.some(
      (step) => !step.includes('continue-on-error: true')
    )
  ) {
    issues.push(
      'public cache-contract computation must fail open so malformed candidate inputs use no cache'
    )
  }

  if (!seedWorkflow.includes('branches: [v3]')) {
    issues.push('cache seed must trigger only on the v3 branch')
  }
  if (seedWorkflow.includes('pull_request')) {
    issues.push('cache seed must not run pull-request code')
  }
  if (
    !seedWorkflow.includes(
      'Manual cache seeding must be dispatched from refs/heads/v3.'
    )
  ) {
    issues.push('cache seed must reject manual dispatches from other refs')
  }
  if (
    !seedWorkflow.includes('mcr.microsoft.com/playwright:v1.58.2-noble@sha256:')
  ) {
    issues.push('cache seed must use the immutable Playwright image digest')
  }
  if ((seedWorkflow.match(/actions\/cache\/save@v4/g) ?? []).length !== 2) {
    issues.push('cache seed must save exactly the pnpm and Turbo caches')
  }
  if (
    seedWorkflow.includes('${{ secrets.') ||
    seedWorkflow.includes('TURBO_TOKEN')
  ) {
    issues.push('cache seed must not use repository or Turbo secrets')
  }

  return { issues, ok: issues.length === 0 }
}

function main(argv = process.argv.slice(2)) {
  const root = argv[0] ?? path.join(__dirname, '../..')
  const result = validatePublicPlaywrightWorkflow(path.resolve(root))
  if (!result.ok) {
    for (const issue of result.issues) console.error(`ERROR: ${issue}`)
    process.exitCode = 1
    return
  }
  console.log('Public Playwright workflow policy passed')
}

if (require.main === module) main()

module.exports = {
  EXPECTED_BUILD_ACTION,
  EXPECTED_CALL,
  EXPECTED_SHARD_ACTION,
  validatePublicPlaywrightWorkflow,
}
