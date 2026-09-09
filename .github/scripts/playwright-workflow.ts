import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

type WorkflowStep = { uses?: string; run?: string }
type WorkflowJob = {
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean }
  if?: string
  needs?: unknown
  'runs-on'?: string
  'timeout-minutes'?: number
  permissions?: Record<string, string>
  uses?: string
  container?: unknown
  services?: unknown
  steps?: WorkflowStep[]
}
type Workflow = {
  name?: string
  on?: { pull_request?: { types?: string[] } }
  concurrency?: unknown
  jobs?: Record<string, WorkflowJob>
}

const EXECUTION_GROUP =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression contract
  '${{ github.workflow }}-playwright-${{ github.event.pull_request.number || github.ref }}'
const OPEN_EVENT =
  "github.event_name != 'pull_request' || github.event.action != 'closed'"
const CLOSED_EVENT =
  "github.event_name == 'pull_request' && github.event.action == 'closed'"

function validateCallerLifecycle(caller: Workflow) {
  const issues: string[] = []
  const jobs = caller?.jobs ?? {}
  const execution = jobs['test-playwright-execution']
  const close = jobs['cancel-closed-pr']
  if (
    caller?.name !== 'Klicker automated testing with playwright' ||
    !caller?.on?.pull_request?.types?.includes('closed') ||
    caller.concurrency !== undefined
  ) {
    issues.push(
      'caller must preserve workflow identity and handle closed PRs without workflow concurrency'
    )
  }
  for (const [name, job] of Object.entries(jobs)) {
    if (['test-playwright-execution', 'cancel-closed-pr'].includes(name)) {
      if (
        job.concurrency?.group !== EXECUTION_GROUP ||
        job.concurrency?.['cancel-in-progress'] !== true
      ) {
        issues.push(`${name} must use the exact PR execution concurrency group`)
      }
    } else if (job.concurrency !== undefined) {
      issues.push(`${name} must remain outside execution concurrency`)
    }
  }
  if (execution?.if !== OPEN_EVENT) {
    issues.push('execution must exclude closed PR events')
  }
  for (const name of ['test-playwright-status', 'playwright-queue-telemetry']) {
    if (jobs[name]?.if !== `always() && (${OPEN_EVENT})`) {
      issues.push(`${name} must retain always() and exclude closed PR events`)
    }
  }
  if (
    close?.if !== CLOSED_EVENT ||
    close.needs !== undefined ||
    close['runs-on'] !== 'ubuntu-latest' ||
    close['timeout-minutes'] !== 5 ||
    JSON.stringify(close.permissions) !== '{}' ||
    close.uses !== undefined ||
    close.container !== undefined ||
    close.services !== undefined ||
    close.steps?.length !== 1 ||
    close.steps[0].uses !== undefined ||
    close.steps[0].run !== ':'
  ) {
    issues.push(
      'close cancellation must be an independent permission-free hosted no-op'
    )
  }
  return issues
}

const EXPECTED_CALL =
  'uses: uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@v3'
const EXPECTED_BUILD_ACTION =
  'uses: uzh-bf/klicker-uzh/.github/actions/playwright-build@refs/heads/v3'
const EXPECTED_SHARD_ACTION =
  'uses: uzh-bf/klicker-uzh/.github/actions/playwright-shard@refs/heads/v3'

function readWorkflow(root: string, name: string, issues: string[]) {
  const relativePath = `.github/workflows/${name}`
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8')
  } catch (error) {
    issues.push(
      `could not read required workflow ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
    )
    return ''
  }
}

function readAction(root: string, name: string, issues: string[]) {
  const relativePath = `.github/actions/${name}/action.yml`
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8')
  } catch (error) {
    issues.push(
      `could not read required action ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
    )
    return ''
  }
}

function namedSteps(text: string) {
  return text.split(/\n(?=\s+- name: )/)
}

function validatePublicPlaywrightWorkflow(root: string) {
  const issues: string[] = []
  const caller = readWorkflow(root, 'test-playwright.yml', issues)
  try {
    issues.push(...validateCallerLifecycle(YAML.parse(caller)))
  } catch {
    issues.push('caller lifecycle policy must be valid YAML')
  }
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
  // Planning and cache identity execute before dependency installation.
  for (const source of [
    publicWorkflow,
    ...['playwright-build', 'playwright-shard'].map((name) =>
      readAction(root, name, issues)
    ),
  ]) {
    const steps = namedSteps(source)
    const setup = steps.findIndex(
      (step) =>
        step.includes('uses: actions/setup-node@v4') &&
        step.includes('node-version-file: .ci-control/package.json')
    )
    const tooling = steps.findIndex((step) =>
      /node \.ci-control\/\.github\/scripts\/playwright-.*\.ts/.test(step)
    )
    if (setup < 0 || tooling < 0 || setup >= tooling)
      issues.push(
        'pre-install TypeScript tooling must follow trusted Node setup'
      )
  }
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
    !publicWorkflow.includes('playwright-plan.ts') ||
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
        /uses: uzh-bf\/klicker-uzh\/.github\/workflows\/public-pr-playwright-shards\.yml@v3/g
      ) ?? []
    ).length !== 1 ||
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
    !seedWorkflow.includes(
      'git config --global --add safe.directory "$GITHUB_WORKSPACE"'
    )
  ) {
    issues.push(
      'cache seed must trust only the exact checked-out workspace before Git operations'
    )
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
  const root = argv[0] ?? path.join(import.meta.dirname, '../..')
  const result = validatePublicPlaywrightWorkflow(path.resolve(root))
  if (!result.ok) {
    for (const issue of result.issues) console.error(`ERROR: ${issue}`)
    process.exitCode = 1
    return
  }
  console.log('Public Playwright workflow policy passed')
}

if (import.meta.main) main()

export {
  EXPECTED_BUILD_ACTION,
  EXPECTED_CALL,
  EXPECTED_SHARD_ACTION,
  validateCallerLifecycle,
  validatePublicPlaywrightWorkflow,
}
