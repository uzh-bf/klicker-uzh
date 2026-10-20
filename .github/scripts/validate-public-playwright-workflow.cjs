const fs = require('node:fs')
const path = require('node:path')
const { isDeepStrictEqual } = require('node:util')
const YAML = require('yaml')

const EXECUTION_GROUP =
  '${{ github.workflow }}-playwright-${{ github.event.pull_request.number || github.ref }}'
// Lifecycle events on a merged or closed pull request must launch neither
// execution nor reporting; the open-state guard subsumes the closed action.
const OPEN_EVENT =
  "github.event_name != 'pull_request' || github.event.pull_request.state == 'open'"
const EXECUTION_EVENT = OPEN_EVENT
const CANCEL_EVENT =
  "github.event_name == 'pull_request' && github.event.action == 'closed'"

function hasExactPermissions(actual, expected) {
  if (actual === null || actual === undefined || typeof actual !== 'object')
    return false
  const actualKeys = Object.keys(actual).sort()
  const expectedKeys = Object.keys(expected).sort()
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key, index) =>
        key === expectedKeys[index] && actual[key] === expected[key]
    )
  )
}

function validateCallerLifecycle(caller) {
  const issues = []
  const jobs = caller?.jobs ?? {}
  const execution = jobs['test-playwright-execution']
  const close = jobs['cancel-closed-pr']
  if (
    caller?.name !== 'Klicker automated testing with playwright' ||
    !caller?.on?.pull_request?.types?.includes('closed') ||
    caller.on.pull_request.types.includes('converted_to_draft') ||
    caller.concurrency !== undefined
  ) {
    issues.push(
      'caller must preserve workflow identity, handle closed PRs, and omit draft-conversion triggers and workflow concurrency'
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
  if (execution?.if !== EXECUTION_EVENT) {
    issues.push('execution must run only for open pull requests or pushes')
  }
  const status = jobs['test-playwright-status']
  const statusEnv = status?.steps?.find(
    (step) => step.name === 'Check result'
  )?.env
  if (
    statusEnv?.PROVIDER !==
      `\${{ needs.test-playwright-execution.outputs.provider }}` ||
    statusEnv?.ADMISSION_ATTEMPT !==
      `\${{ needs.test-playwright-execution.outputs.admission_attempt }}` ||
    statusEnv?.CURRENT_ATTEMPT !== `\${{ github.run_attempt }}`
  ) {
    issues.push('cloud-capable caller must report the exact admitted attempt')
  }
  // Unconditional for open events: a skipped required context can count as
  // acceptable, so the reporter must run and fail on cancellation itself.
  const expectedStatusIf = `always() && (${OPEN_EVENT})`
  if (status?.if !== expectedStatusIf) {
    issues.push('status must run unconditionally for open events')
  }
  if (
    !hasExactPermissions(status?.permissions, { actions: 'read' }) ||
    status?.['runs-on'] !== 'ubuntu-latest' ||
    status?.container !== undefined ||
    status?.services !== undefined ||
    status?.steps?.some((step) => step.uses?.startsWith('actions/checkout@'))
  ) {
    issues.push(
      'status must be hosted, checkout-free, and have only actions: read permission'
    )
  }
  const queueStep = status?.steps?.find((step) => step.id === 'queue_telemetry')
  if (queueStep?.if !== 'always() && !cancelled()') {
    issues.push(
      'queue telemetry must run for every non-cancelled status report'
    )
  }
  if (queueStep?.['continue-on-error'] !== true) {
    issues.push('queue telemetry must be best effort')
  }
  const queueUpload = status?.steps?.find(
    (step) => step.name === 'Upload queue telemetry'
  )
  if (
    queueUpload?.if !==
    "always() && !cancelled() && steps.queue_telemetry.outcome != 'skipped'"
  ) {
    issues.push('queue telemetry upload must be cancellation-aware')
  }
  if (queueUpload?.['continue-on-error'] !== true) {
    issues.push('queue telemetry upload must be best effort')
  }
  if (queueUpload?.with?.['if-no-files-found'] !== 'ignore') {
    issues.push('queue telemetry upload must ignore a missing report')
  }
  if (jobs['playwright-queue-telemetry'] !== undefined) {
    issues.push('queue telemetry must be part of the status job')
  }
  if (
    close?.if !== CANCEL_EVENT ||
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
      'close cancellation must be an independent permission-free hosted no-op that never cancels a draft'
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
// The build artifact must cover every workspace package, not a hand-maintained
// list that silently drops a package with its own build output (for example
// packages/audit/dist). The wildcard keeps full coverage as packages are added.
const PACKAGE_DIST_WILDCARD = 'packages/*/dist'
const INDIVIDUAL_PACKAGE_DIST = /packages\/[^/*\s]+\/dist/

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

function validatePublicRunnerRoles(workflow) {
  const issues = []
  const roles = {
    'build-and-compile-public-pr': 'build_runner',
    'test-playwright-public-pr': 'shard_runner',
  }
  const jobs = workflow?.jobs ?? {}
  for (const [name, output] of Object.entries(roles)) {
    const runner = jobs[name]?.['runs-on']
    if (
      runner?.group !==
        `\${{ fromJSON(needs.prepare.outputs.${output}).group }}` ||
      runner?.labels !==
        `\${{ fromJSON(needs.prepare.outputs.${output}).labels }}` ||
      jobs[name]?.['timeout-minutes'] !==
        `\${{ fromJSON(needs.prepare.outputs.job_timeout) }}` ||
      jobs[name]?.if !==
        "needs.prepare.outputs.duplicate_run_id == '' && needs.prepare.outputs.should_run == 'true' && needs.prepare.outputs.route == 'public-pr' && (needs.prepare.outputs.provider != 'warpbuild' || needs.prepare.outputs.admission_attempt == format('{0}', github.run_attempt))"
    ) {
      issues.push(
        `${name} must use trusted role outputs and guard the admitted attempt`
      )
    }
  }
  const prepareSteps = jobs.prepare?.steps ?? []
  for (const output of [
    'provider',
    'admission_attempt',
    'build_runner',
    'shard_runner',
    'job_timeout',
  ]) {
    if (
      jobs.prepare?.outputs?.[output] !==
      `\${{ steps.metadata.outputs.${output} }}`
    ) {
      issues.push(`prepare must expose trusted ${output} metadata`)
    }
  }
  for (const output of ['provider', 'admission_attempt']) {
    if (
      workflow?.on?.workflow_call?.outputs?.[output]?.value !==
      `\${{ jobs.prepare.outputs.${output} }}`
    ) {
      issues.push(`reusable workflow must expose ${output} to its reporter`)
    }
  }
  if (
    Object.keys(workflow?.env ?? {}).length !== 1 ||
    workflow?.env?.PLAYWRIGHT_CACHE_ENABLED !==
      `\${{ github.event_name != 'pull_request' || vars.PUBLIC_PR_PLAYWRIGHT_CACHE_ENABLED == 'true' || vars.PUBLIC_PR_PLAYWRIGHT_CACHE_CANARY_PR == format('{0}', github.event.pull_request.number) }}` ||
    Object.keys(jobs.prepare?.env ?? {}).length > 0 ||
    workflow?.defaults?.run?.['working-directory'] !== undefined ||
    jobs.prepare?.defaults?.run?.['working-directory'] !== undefined ||
    jobs.prepare?.container !== undefined ||
    jobs.prepare?.services !== undefined
  ) {
    issues.push('preparation must retain its hosted execution environment')
  }
  const expectedEnv = {
    EVENT_NAME: `\${{ github.event_name }}`,
    REPOSITORY: `\${{ github.repository }}`,
    REPOSITORY_PRIVATE: `\${{ github.event.repository.private }}`,
    HEAD_REPOSITORY: `\${{ github.event.pull_request.head.repo.full_name }}`,
    PR_AUTHOR: `\${{ github.event.pull_request.user.login }}`,
    PR_DRAFT: `\${{ github.event.pull_request.draft }}`,
    HEAD_REF: `\${{ github.event.pull_request.head.ref }}`,
    PR_NUMBER: `\${{ github.event.pull_request.number }}`,
    PUBLIC_ROLLOUT_ENABLED: `\${{ vars.PUBLIC_PR_ARM64_PLAYWRIGHT_ENABLED }}`,
    PUBLIC_ROLLOUT_CANARY_PR: `\${{ vars.PUBLIC_PR_ARM64_PLAYWRIGHT_CANARY_PR }}`,
    SMART_DRAFT_ENABLED: `\${{ vars.PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_ENABLED }}`,
    SMART_DRAFT_CANARY_PR: `\${{ vars.PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_CANARY_PR }}`,
    FORCE_HOSTED_CANARY_PR: `\${{ vars.PUBLIC_PR_ARM64_PLAYWRIGHT_FORCE_HOSTED_CANARY_PR }}`,
    ROUTE_HINT: `\${{ inputs.route_hint }}`,
    WARPBUILD_ADMISSIONS: `\${{ vars.PUBLIC_PR_PLAYWRIGHT_WARPBUILD_ADMISSIONS }}`,
    WARPBUILD_ADMISSION_URL: `\${{ vars.PUBLIC_PR_PLAYWRIGHT_WARPBUILD_ADMISSION_URL }}`,
    HEAD_SHA: `\${{ github.event.pull_request.head.sha }}`,
    BASE_SHA: `\${{ github.event.pull_request.base.sha }}`,
    CONTROL_SHA: `\${{ job.workflow_sha }}`,
  }
  const baseSha = `\${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.sha }}`
  const headSha = `\${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`
  // Step names and summary display text are not execution policy. Commands,
  // expressions, action inputs and step order are part of the trusted boundary.
  const expectedSteps = [
    {
      uses: 'actions/checkout@v4',
      with: {
        repository: `\${{ job.workflow_repository }}`,
        ref: `\${{ job.workflow_sha }}`,
        path: '.ci-control',
        'persist-credentials': false,
      },
    },
    {
      uses: 'actions/checkout@v4',
      with: {
        repository: `\${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name || github.repository }}`,
        ref: headSha,
        path: '.candidate',
        'fetch-depth': 0,
        'persist-credentials': false,
      },
    },
    {
      id: 'route',
      shell: 'bash',
      env: expectedEnv,
      run: 'node .ci-control/.github/scripts/playwright-route.cjs --output route.json',
    },
    {
      shell: 'bash',
      env: {
        EVENT_NAME: `\${{ github.event_name }}`,
        BASE_REPOSITORY: `\${{ github.repository }}`,
        BASE_SHA: baseSha,
        HEAD_SHA: headSha,
      },
      run: [
        'set -euo pipefail',
        'if [ "$EVENT_NAME" = \'pull_request\' ]; then',
        '  git -C .candidate remote add base "https://github.com/$BASE_REPOSITORY.git"',
        '  git -C .candidate fetch --no-tags base "$BASE_SHA"',
        'fi',
        'test "$(git -C .candidate rev-parse HEAD)" = "$HEAD_SHA"',
      ].join('\n'),
    },
    {
      shell: 'bash',
      env: { BASE_SHA: baseSha, HEAD_SHA: headSha },
      run: [
        'set -euo pipefail',
        'PR_STATE=$(node -e \'process.stdout.write(JSON.parse(require("fs").readFileSync("route.json", "utf8")).selectorPrState)\')',
        'node .ci-control/.github/scripts/playwright-selector.cjs --control-root .ci-control --candidate-root .candidate --base-sha "$BASE_SHA" --head-sha "$HEAD_SHA" --pr-state "$PR_STATE" --output playwright-execution-plan.json',
      ].join('\n'),
    },
    {
      if: "github.event_name == 'pull_request' && github.event.pull_request.draft == true",
      shell: 'bash',
      env: {
        BASE_SHA: `\${{ github.event.pull_request.base.sha }}`,
        HEAD_SHA: `\${{ github.event.pull_request.head.sha }}`,
      },
      run: [
        'set -euo pipefail',
        'RAN_STATE=$(node -e \'process.stdout.write(JSON.parse(require("node:fs").readFileSync("route.json", "utf8")).selectorPrState)\')',
        'if [ "$RAN_STATE" = \'draft\' ]; then SHADOW_STATE=ready; else SHADOW_STATE=draft; fi',
        'node .ci-control/.github/scripts/playwright-selector.cjs --control-root .ci-control --candidate-root .candidate --base-sha "$BASE_SHA" --head-sha "$HEAD_SHA" --pr-state "$SHADOW_STATE" --output playwright-selector-shadow.json',
      ].join('\n'),
    },
    {
      id: 'metadata',
      shell: 'bash',
      run: 'node .ci-control/.github/scripts/playwright-plan-metadata.cjs --plan playwright-execution-plan.json --route route.json --output "$GITHUB_OUTPUT"',
    },
    {
      id: 'equivalent',
      if: `steps.metadata.outputs.provider != 'warpbuild' && ((github.event_name == 'push' && github.ref != 'refs/heads/v3') || (github.event_name == 'pull_request' && contains(fromJSON('["ready_for_review","edited","reopened"]'), github.event.action)))`,
      'continue-on-error': true,
      uses: 'actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3',
      env: {
        CONTROL_SHA: `\${{ job.workflow_sha }}`,
        ALLOW_PUSH_REUSE: `\${{ inputs.allow_push_reuse }}`,
        STG_SOURCE_BRANCH: `\${{ vars.STG_SOURCE_BRANCH }}`,
      },
      with: {
        script: [
          "const fs = require('node:fs')",
          "await require('./.ci-control/.github/scripts/ci-equivalent-run.cjs').reportEquivalentRun({",
          "  github, context, core, kind: 'playwright',",
          '  controlSha: process.env.CONTROL_SHA,',
          "  allowPushReuse: process.env.ALLOW_PUSH_REUSE === 'true',",
          '  stagingSourceBranch: process.env.STG_SOURCE_BRANCH,',
          "  plan: JSON.parse(fs.readFileSync('playwright-execution-plan.json', 'utf8')),",
          "  route: JSON.parse(fs.readFileSync('route.json', 'utf8')).route,",
          '})',
        ].join('\n'),
      },
    },
    {
      shell: 'bash',
      run: [
        "node - <<'NODE'",
        "const fs = require('node:fs')",
        "const route = JSON.parse(fs.readFileSync('route.json', 'utf8'))",
        "const plan = JSON.parse(fs.readFileSync('playwright-execution-plan.json', 'utf8'))",
        'const summary = [',
        "'<display>',",
        "'<display>',",
        ...[
          'route.route',
          "route.provider || (route.route === 'hosted' ? 'github' : 'public-pool')",
          'route.selectorPrState',
          'plan.mode',
          'plan.envelopeClass',
          "plan.reasonCodes.join(',')",
          'plan.candidateSpecs.length',
          'plan.selectedSpecs.length',
          'plan.shardCount',
        ].map((expression) => `  \`<display>\\\`\${${expression}}\\\`\`,`),
        "'<display>',",
        "'<display>',",
        ']',
        `fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, \`\${summary.join('\\n')}\\n\`)`,
        'NODE',
      ].join('\n'),
    },
    ...[
      ['playwright-execution-plan', 'playwright-execution-plan.json'],
      ['playwright-route-metadata', 'route.json'],
      ['playwright-selector-shadow', 'playwright-selector-shadow.json'],
    ].map(([name, artifactPath]) => ({
      ...(name === 'playwright-selector-shadow'
        ? {
            if: "github.event_name == 'pull_request' && github.event.pull_request.draft == true",
          }
        : {}),
      uses: 'actions/upload-artifact@v4',
      with: {
        name,
        path: artifactPath,
        'if-no-files-found': 'error',
        'retention-days': 7,
      },
    })),
  ]
  if (
    prepareSteps.some(
      (step) => typeof step.run === 'string' && step.run.includes(`\${{`)
    )
  ) {
    issues.push('preparation commands must receive expressions through env')
  }
  const actualSteps = prepareSteps.map(({ name, ...step }) => ({
    ...step,
    ...(step.with ? { with: { ...step.with } } : {}),
  }))
  for (const steps of [actualSteps, expectedSteps]) {
    for (const step of steps) {
      if (typeof step.run === 'string') {
        step.run = step.run
          .replace(/^[ \t]*#.*\r?\n/gm, '')
          .replace(/\\\r?\n[ \t]*/g, ' ')
          .replace(/^[ \t]*'(?:[^'\\\r\n]|\\[^\r\n])*',$/gm, "'<display>',")
          .replace(
            /^([ \t]*`)(?:[^`$\\\r\n]|\$(?!\{)|\\[^\r\n])*(?=\\`\$\{)/gm,
            '$1<display>'
          )
          .replace(/[ \t]+/g, ' ')
          .trim()
      }
      if (typeof step.with?.script === 'string') {
        step.with.script = step.with.script.trim()
      }
    }
  }
  if (!isDeepStrictEqual(actualSteps, expectedSteps)) {
    issues.push('every preparation step must preserve trusted execution')
  }
  if (
    workflow?.on?.workflow_call?.outputs?.should_run?.value !==
    `\${{ (jobs.prepare.outputs.provider != 'warpbuild' || jobs.prepare.outputs.admission_attempt == format('{0}', github.run_attempt)) && jobs.prepare.outputs.should_run || 'false' }}`
  ) {
    issues.push(
      'stale paid attempts must invalidate required coverage for older callers'
    )
  }
  if (
    jobs['test-playwright-public-pr']?.steps?.find(
      (step) => step.name === 'Run shared Playwright shard'
    )?.with?.workers !==
    `\${{ needs.prepare.outputs.provider == 'warpbuild' && '1' || vars.PUBLIC_PR_PLAYWRIGHT_WORKERS || '1' }}`
  ) {
    issues.push('cloud shards must retain one worker')
  }
  for (const [name, job] of Object.entries(jobs)) {
    if (Object.hasOwn(roles, name)) continue
    const runner = job?.['runs-on']
    // Dynamic selectors and generic labels can reach the pool without spelling
    // its name. Every other job stays on a known GitHub-hosted selector.
    if (!['ubuntu-latest', 'ubuntu-24.04'].includes(runner)) {
      issues.push(`${name} is an unknown self-hosted pool job`)
    }
  }
  return issues
}

function validatePublicPlaywrightWorkflow(root) {
  const issues = []
  const caller = readWorkflow(root, 'test-playwright.yml', issues)
  let callerParsed
  try {
    callerParsed = YAML.parse(caller)
    issues.push(...validateCallerLifecycle(callerParsed))
  } catch {
    issues.push('caller lifecycle policy must be valid YAML')
  }
  const publicWorkflow = readWorkflow(
    root,
    'public-pr-playwright-shards.yml',
    issues
  )
  let publicParsed
  try {
    publicParsed = YAML.parse(publicWorkflow)
  } catch {
    issues.push('public reusable workflow policy must be valid YAML')
  }
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
  // The trusted routing only accepts the automatic hint, so any other value
  // would fail the reusable workflow instead of selecting a route.
  if (
    callerParsed?.jobs?.['test-playwright-execution']?.with?.route_hint !==
    'auto'
  ) {
    issues.push(
      'caller must pass route_hint: auto; the trusted routing rejects every other hint'
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

  if (
    publicParsed?.permissions !== undefined ||
    publicParsed?.jobs?.prepare?.permissions !== undefined
  ) {
    issues.push(
      'trusted preparation must inherit caller permissions for compatibility'
    )
  }
  for (const name of [
    'build-and-compile-hosted',
    'build-and-compile-public-pr',
    'test-playwright-hosted',
    'test-playwright-public-pr',
  ]) {
    if (
      !hasExactPermissions(publicParsed?.jobs?.[name]?.permissions, {
        contents: 'read',
      })
    ) {
      issues.push(`${name} must have only contents: read permission`)
    }
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

  issues.push(...validatePublicRunnerRoles(publicParsed))

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
  const buildActionText = readAction(root, 'playwright-build', issues)
  const buildArtifactUpload = namedSteps(buildActionText).find((step) =>
    step.includes('name: playwright-build-artifact')
  )
  const archivesWildcard = buildArtifactUpload
    ?.split('\n')
    .some((line) => line.trim() === PACKAGE_DIST_WILDCARD)
  if (!archivesWildcard) {
    issues.push(
      'the build artifact must archive ' +
        PACKAGE_DIST_WILDCARD +
        ' so every workspace package dist is covered'
    )
  }
  if (
    buildArtifactUpload &&
    INDIVIDUAL_PACKAGE_DIST.test(buildArtifactUpload)
  ) {
    issues.push(
      'the build artifact must not list individual package dist paths; ' +
        PACKAGE_DIST_WILDCARD +
        ' keeps coverage as packages are added'
    )
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
    !publicWorkflow.includes('Build opposite-state selector shadow plan') ||
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

  const executionPermissions =
    callerParsed?.jobs?.['test-playwright-execution']?.permissions
  if (
    !hasExactPermissions(executionPermissions, {
      contents: 'read',
      actions: 'read',
      'pull-requests': 'read',
      'id-token': 'write',
    })
  ) {
    issues.push(
      'caller execution must forward read permissions and the preparation identity token'
    )
  }

  if (
    publicParsed?.jobs?.['test-playwright-public-pr'] &&
    publicWorkflow.includes('Build opposite-state selector shadow plan') &&
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
  validateCallerLifecycle,
  validatePublicRunnerRoles,
  EXPECTED_BUILD_ACTION,
  EXPECTED_CALL,
  EXPECTED_SHARD_ACTION,
  validatePublicPlaywrightWorkflow,
}
