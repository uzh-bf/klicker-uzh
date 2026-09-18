'use strict'

// Structural validation for the consolidated staging image workflow.
//
// The promotion controller reads this workflow from the candidate tree but must
// never execute candidate code, so the architecture the promotion contract
// depends on is pinned here instead: one trusted name and trigger, the plan and
// matrix shape, the ARM runner, the full-SHA publish guard, the per-target
// digest handoff, the pinned scanner and the enforced scan policy, and the
// terminal job that owns the required status context.
//
// Which targets a candidate can build is resolved separately from the tree, and
// which targets were actually published is proved by the run's own job list.
// This module only establishes that the pipeline that produced those jobs still
// enforces the same guardrails.

// Regexes below use character classes such as [ ] and [$] rather than escaped
// shorthand, because this file is also read by humans who compare it against
// the workflow and by tests that build snippets from the same idioms.

const STAGING_WORKFLOW_NAME = 'Build staging images'
const STAGING_STATUS_JOB_ID = 'build-images-status'
const STAGING_PLAN_JOB_ID = 'plan'
const STAGING_SCAN_JOB_ID = 'scan'
const STAGING_AMD_JOB_ID = 'build-amd'
const STAGING_ARM_BUILD_JOB_IDS = Object.freeze([
  'build',
  'build-after-migrator',
  'build-migrator',
])
const STAGING_REQUIRED_JOB_IDS = Object.freeze([
  STAGING_PLAN_JOB_ID,
  ...STAGING_ARM_BUILD_JOB_IDS,
  STAGING_AMD_JOB_ID,
  STAGING_SCAN_JOB_ID,
  STAGING_STATUS_JOB_ID,
])
const APPROVED_PUSH_BRANCHES = Object.freeze(['v3', 'v3*'])
const APPROVED_PULL_REQUEST_TYPES = Object.freeze([
  'opened',
  'synchronize',
  'reopened',
  'edited',
  'ready_for_review',
])
const ARM_RUNNER = 'ubuntu-24.04-arm'
const AMD_RUNNER = 'ubuntu-latest'
const STAGING_DIGEST_ARTIFACT_PREFIX = 'build-digest-'
const TRIVY_ACTION = 'aquasecurity/trivy-action'
const PUBLISH_GUARD_SCRIPT = '.github/scripts/stg-image-publish-guard.sh'
const SCAN_POLICY_SCRIPT = '.github/scripts/image-scan-receipt.cjs'

function indentation(line) {
  const match = /^([ ]*)/.exec(line)
  return match ? match[1].length : 0
}

// Splits a top-level mapping into its direct child blocks. Enough YAML for a
// workflow file, and no dependency on a parser the controller cannot install.
function mappingEntries(content, key, indentationWidth) {
  const lines = String(content).split(/\r?\n/)
  const start = lines.findIndex(
    (line) =>
      indentation(line) === indentationWidth && line.trim() === key + ':'
  )
  if (start < 0) return null
  const entries = []
  let current = null
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '') continue
    const depth = indentation(line)
    if (depth < indentationWidth) break
    if (depth === indentationWidth + 2) {
      const header = /^[ ]{2}([A-Za-z0-9_.-]+):[ ]*$/.exec(line)
      if (header) {
        if (current) entries.push(current)
        current = { body: [], id: header[1] }
        continue
      }
    }
    if (current) current.body.push(line)
  }
  if (current) entries.push(current)
  return entries
}

function jobBlocks(content, path) {
  const entries = mappingEntries(content, 'jobs', 0)
  if (!entries) throw new Error(path + ' has no jobs block')
  if (entries.length === 0) throw new Error(path + ' declares no jobs')
  return new Map(entries.map((entry) => [entry.id, entry.body.join('\n')]))
}

// The quoted scalar items under a key path, for example
// ['on', 'push', 'branches']. A top-level key sits at indent 0, its child at 2,
// its grandchild at 4, and the list items at 6, so each step is found by
// matching its own indentation. Returns null when the path is absent.
function yamlList(content, keyPath) {
  const lines = String(content).split(/\r?\n/)
  let searchFrom = 0
  for (let depth = 0; depth < keyPath.length; depth += 1) {
    const wanted = keyPath[depth]
    const found = lines.findIndex(
      (line, index) =>
        index >= searchFrom &&
        indentation(line) === depth * 2 &&
        line.trim() === wanted + ':'
    )
    if (found < 0) return null
    searchFrom = found + 1
  }
  const values = []
  const itemIndentation = keyPath.length * 2
  for (let index = searchFrom; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '') continue
    const depth = indentation(line)
    if (depth < itemIndentation) break
    if (depth !== itemIndentation) continue
    const item = /^[ ]*-[ ]*'?([^']+?)'?[ ]*$/.exec(line)
    if (item) values.push(item[1])
  }
  return values
}

// The same list as a YAML flow sequence on the key's own line, for example
// 'types: [opened, synchronize]'. Returns null when the key is absent.
function yamlFlowList(content, key, indentationWidth) {
  const lines = String(content).split(/\r?\n/)
  const line = lines.find(
    (candidate) =>
      indentation(candidate) === indentationWidth &&
      candidate.trim().startsWith(key + ':')
  )
  if (line === undefined) return null
  const match = /\[(.*)\]/.exec(line)
  if (!match) return []
  return match[1]
    .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
    .filter((value) => value.length > 0)
}

function workflowName(content) {
  const match = /^name:[ ]*(.+?)[ ]*$/m.exec(String(content))
  return match ? match[1].replace(/^['"]|['"]$/g, '') : null
}

function fail(path, jobId, message) {
  throw new Error(path + (jobId ? '/' + jobId : '') + ' ' + message)
}

function requireJob(jobs, path, jobId) {
  const block = jobs.get(jobId)
  if (block === undefined) fail(path, null, 'is missing the ' + jobId + ' job')
  return block
}

// A matrix leg must run only after the plan, name its check run after the
// target, build from the plan's matrix, publish under the full-SHA guard, and
// hand its digest to the scan leg.
function validateArmBuildJob(block, path, jobId) {
  if (!jobNeeds(block).includes(STAGING_PLAN_JOB_ID)) {
    fail(path, jobId, 'does not depend on the plan job')
  }
  if (
    !/^[ ]{4}name:[ ]*[$][{][{][ ]*matrix[.]jobName[ ]*[}][}][ ]*$/m.test(block)
  ) {
    fail(path, jobId, 'does not name itself from the matrix')
  }
  if (!/^[ ]{4}strategy:[ ]*$/m.test(block)) {
    fail(path, jobId, 'has no matrix strategy')
  }
  // The matrix source is read from the include line itself. A job reads several
  // plan outputs in its conditions, so the first match in the block would
  // otherwise bind to a condition instead of to the matrix.
  const includeLine = /^[ ]{8}include:[ ]*(.+?)[ ]*$/m.exec(block)
  if (!includeLine) fail(path, jobId, 'has no matrix include')
  const output = /needs[.]plan[.]outputs[.]([A-Za-z0-9_-]+)/.exec(
    includeLine[1]
  )
  if (!output) fail(path, jobId, 'does not read the plan outputs')
  if (
    !new RegExp(
      'include:[ ]*[$][{][{][ ]*fromJSON[(]needs[.]plan[.]outputs[.]' +
        output[1] +
        '[)][ ]*[}][}]',
      'm'
    ).test(block)
  ) {
    fail(path, jobId, 'does not build the plan matrix')
  }
  if (
    !new RegExp('^[ ]{4}runs-on:[ ]*' + ARM_RUNNER + '[ ]*$', 'm').test(block)
  ) {
    fail(path, jobId, 'is not pinned to the ARM runner')
  }
  // Draft pull requests must still defer their builds.
  if (!/github[.]event[.]pull_request[.]draft[ ]*==[ ]*false/.test(block)) {
    fail(path, jobId, 'does not defer draft builds')
  }
  // Each leg must publish its digest for the scan that judges that exact image.
  if (
    !new RegExp(
      'name:[ ]*' +
        STAGING_DIGEST_ARTIFACT_PREFIX +
        '[$][{][{][ ]*matrix[.]id[ ]*[}][}]',
      'm'
    ).test(block)
  ) {
    fail(path, jobId, 'publishes no per-target digest artifact')
  }
  // Action inputs sit at ten spaces under a step's `with:` block.
  if (
    !/^[ ]{10}push:[ ]*[$][{][{][ ]*github[.]event_name[ ]*!=[ ]*'pull_request'[ ]*[}][}][ ]*$/m.test(
      block
    )
  ) {
    fail(path, jobId, 'has an unsafe push condition')
  }
  // The guard is trusted controller content; the candidate must invoke it and
  // gate publication on its result.
  if (
    !new RegExp(
      'run:[ ]*' + escapeRegExp(PUBLISH_GUARD_SCRIPT) + '[ ]*$',
      'm'
    ).test(block)
  ) {
    fail(path, jobId, 'does not check the full-SHA tag before publishing')
  }
  if (
    !/steps[.]publish_guard[.]outputs[.]publish[ ]*==[ ]*'true'/.test(block) ||
    !/github[.]event_name[ ]*==[ ]*'pull_request'[ ]*[|][|]/.test(block)
  ) {
    fail(path, jobId, 'does not gate publication on the publish guard')
  }
  // The published image is resolved from the matrix, so a candidate cannot
  // retarget the build to an image outside the trusted inventory.
  if (!/matrix[.]image/.test(block)) {
    fail(path, jobId, 'does not publish the matrix image')
  }
  // Built with new RegExp so the path separators inside the brace groups stay
  // plain characters instead of terminating a literal.
  const matrixImage = new RegExp(
    "images:[ ]*[$][{][{][ ]*format[(]'[{]0[}]" +
      '/[{]1[}]/[{]2[}]-arm' +
      "',[ ]*'ghcr[.]io',[ ]*github[.]repository,[ ]*matrix[.]image[ ]*[)][ ]*[}][}]",
    'm'
  )
  if (!matrixImage.test(block)) {
    fail(path, jobId, 'does not derive the image from the matrix')
  }
  // A full-SHA tag is what makes the promoted reference immutable.
  if (
    !/type[ ]*=[ ]*raw[^\n#]*value[ ]*=[ ]*[$][{][{][ ]*github[.]sha[ ]*[}][}]/.test(
      block
    )
  ) {
    fail(path, jobId, 'does not publish a full source SHA tag')
  }
}

function validateAmdJob(block, path, jobId) {
  if (
    !new RegExp('^[ ]{4}runs-on:[ ]*' + AMD_RUNNER + '[ ]*$', 'm').test(block)
  ) {
    fail(path, jobId, 'is not pinned to the native AMD64 runner')
  }
  if (!/platforms:[ ]*linux.amd64/.test(block)) {
    fail(path, jobId, 'does not target the AMD64 platform')
  }
  if (
    !/steps[.]publish_guard[.]outputs[.]publish[ ]*==[ ]*'true'/.test(block)
  ) {
    fail(path, jobId, 'does not gate publication on the publish guard')
  }
}

function validateScanJob(block, path, jobId) {
  if (!/github[.]event_name[ ]*!=[ ]*'pull_request'/.test(block)) {
    fail(path, jobId, 'is not limited to publishing events')
  }
  const refs = [
    ...new Set(
      [
        ...String(block).matchAll(
          new RegExp(
            'uses:[ ]*' + escapeRegExp(TRIVY_ACTION) + '@([^ \\n#]+)',
            'g'
          )
        ),
      ].map((match) => match[1])
    ),
  ]
  if (refs.length !== 1 || !/^[0-9a-f]{40}$/.test(refs[0])) {
    fail(path, jobId, 'does not pin exactly one trivy action revision')
  }
  if (
    !new RegExp(
      'node[ ]+' + escapeRegExp(SCAN_POLICY_SCRIPT) + '[ ]+check',
      'm'
    ).test(block)
  ) {
    fail(path, jobId, 'does not enforce the scan policy')
  }
}

function validateStatusJob(block, path, jobId) {
  if (!/^[ ]{4}if:[ ]*always[(][)][ ]*$/m.test(block)) {
    fail(path, jobId, 'must report for every outcome')
  }
  const declared = new Set(jobNeeds(block))
  for (const required of STAGING_REQUIRED_JOB_IDS) {
    if (required === jobId) continue
    if (required === STAGING_STATUS_JOB_ID) continue
    if (!declared.has(required)) {
      fail(path, jobId, 'does not wait for the ' + required + ' job')
    }
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validateStagingWorkflow({
  content,
  expectedName = STAGING_WORKFLOW_NAME,
  path: workflowPath,
  sourceBranch,
}) {
  if (typeof workflowPath !== 'string' || workflowPath.length === 0) {
    throw new Error('the staging workflow path is unavailable')
  }
  const name = workflowName(content)
  if (name !== expectedName) {
    throw new Error(
      workflowPath + ' does not use the trusted workflow name: ' + String(name)
    )
  }
  // 'on' parses as the boolean true in a naive scanner, so the trigger keys are
  // matched as text under the literal 'on' line rather than as a parsed key.
  const branches = yamlList(content, ['on', 'push', 'branches'])
  if (branches === null) {
    throw new Error(workflowPath + ' has no push branch trigger')
  }
  // The exact branch list matters: a narrower or reordered set would stop
  // publishing on the candidate branches the controller promotes from, and the
  // 'v3*' entry is what covers v3-audit and v3-ai.
  const pushBranches = [...APPROVED_PUSH_BRANCHES].sort()
  if (branches.slice().sort().join(',') !== pushBranches.join(',')) {
    throw new Error(workflowPath + ' does not use the approved push triggers')
  }
  if (sourceBranch !== undefined && !matchesApproved(sourceBranch)) {
    throw new Error(
      sourceBranch + ' is not covered by the approved push triggers'
    )
  }
  // A workflow-level pull-request path filter would suppress the required
  // context on some changes, so the selection has to stay inside the run.
  if (yamlList(content, ['on', 'pull_request', 'paths']) !== null) {
    throw new Error(
      workflowPath + ' must not filter pull-request paths at the workflow level'
    )
  }
  const prTypes = yamlFlowList(content, 'types', 4)
  if (prTypes === null) {
    throw new Error(workflowPath + ' has no pull-request trigger types')
  }
  // 'edited' re-evaluates the selection after a retarget; ready_for_review is
  // where a draft pull request's deferred builds are restored.
  const approvedTypes = [...APPROVED_PULL_REQUEST_TYPES].sort()
  if (prTypes.slice().sort().join(',') !== approvedTypes.join(',')) {
    throw new Error(
      workflowPath + ' does not use the approved pull-request triggers'
    )
  }
  const jobs = jobBlocks(content, workflowPath)
  for (const jobId of STAGING_REQUIRED_JOB_IDS) {
    requireJob(jobs, workflowPath, jobId)
  }
  for (const jobId of STAGING_ARM_BUILD_JOB_IDS) {
    validateArmBuildJob(jobs.get(jobId), workflowPath, jobId)
  }
  validateAmdJob(jobs.get(STAGING_AMD_JOB_ID), workflowPath, STAGING_AMD_JOB_ID)
  validateScanJob(
    jobs.get(STAGING_SCAN_JOB_ID),
    workflowPath,
    STAGING_SCAN_JOB_ID
  )
  validateStatusJob(
    jobs.get(STAGING_STATUS_JOB_ID),
    workflowPath,
    STAGING_STATUS_JOB_ID
  )
  return { name, path: workflowPath }
}

function matchesApproved(sourceBranch) {
  const value = String(sourceBranch)
  return value === 'v3' || value.startsWith('v3')
}

// The job ids a job declares as dependencies. YAML allows the inline list
// `needs: [a, b]` and the block sequence `needs:` followed by '- a' items, and
// both are used by the consolidated workflow.
function jobNeeds(block) {
  const lines = String(block).split(/\r?\n/)
  const index = lines.findIndex((line) => /^[ ]{4}needs:[ ]*/.test(line))
  if (index < 0) return []
  const inline = /^[ ]{4}needs:[ ]*\[(.*)\][ ]*$/.exec(lines[index])
  if (inline) {
    return inline[1]
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  }
  const inlineScalar = /^[ ]{4}needs:[ ]*(\S+)[ ]*$/.exec(lines[index])
  if (inlineScalar) return [inlineScalar[1]]
  const values = []
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]
    if (line.trim() === '') continue
    if (indentation(line) <= 4) break
    const item = /^[ ]*-[ ]*(\S+)[ ]*$/.exec(line)
    if (item) values.push(item[1])
  }
  return values
}

module.exports = {
  APPROVED_PULL_REQUEST_TYPES,
  APPROVED_PUSH_BRANCHES,
  PUBLISH_GUARD_SCRIPT,
  SCAN_POLICY_SCRIPT,
  STAGING_AMD_JOB_ID,
  STAGING_ARM_BUILD_JOB_IDS,
  STAGING_DIGEST_ARTIFACT_PREFIX,
  STAGING_PLAN_JOB_ID,
  STAGING_REQUIRED_JOB_IDS,
  STAGING_SCAN_JOB_ID,
  STAGING_STATUS_JOB_ID,
  STAGING_WORKFLOW_NAME,
  TRIVY_ACTION,
  jobNeeds,
  mappingEntries,
  validateStagingWorkflow,
  workflowName,
  yamlList,
  yamlFlowList,
}
