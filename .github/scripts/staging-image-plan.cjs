'use strict'

const fs = require('node:fs')

const {
  STAGING_IMAGE_TARGETS,
  amdJobName,
  buildJobName,
  legacyImageWorkflows,
  imageName,
  scanJobName,
  selectStagingTargets,
  unavailableTargetIds,
} = require('./staging-image-targets.cjs')

const PLAN_SCHEMA_VERSION = 1

// The changed-file list is produced by the workflow's diff step. An absent or
// unreadable list means the selection is unknown, which must block instead of
// passing as an empty change set.
function readChangedFiles(changedFilesPath) {
  if (!changedFilesPath) {
    throw new Error('no changed-file selection path is configured')
  }
  let raw
  try {
    raw = fs.readFileSync(changedFilesPath, 'utf8')
  } catch (error) {
    throw new Error(changedFilesPath + ' is unavailable: ' + error.message)
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// The plan decides what the matrix builds. A failing state never stops the plan
// job itself: the terminal build-images-status job owns the required context,
// so a determined block is reported there with evidence instead of as a
// missing check.
function planStagingImages({
  changedFilesPath,
  draft = false,
  eventName,
  rootDirectory,
}) {
  const unavailable = unavailableTargetIds(rootDirectory)
  const legacy = legacyImageWorkflows(rootDirectory)
  if (legacy.length > 0) {
    return {
      changedFileCount: 0,
      mode: 'unavailable',
      reason:
        'unreplaced staging workflow(s) are still present: ' +
        legacy.join(', '),
      schemaVersion: PLAN_SCHEMA_VERSION,
      selected: [],
      state: 'unavailable',
      unavailable,
    }
  }
  let changedFiles = []
  let changedFileCount = 0
  try {
    if (eventName === 'pull_request') {
      changedFiles = readChangedFiles(changedFilesPath)
      changedFileCount = changedFiles.length
    }
  } catch (error) {
    return {
      changedFileCount,
      mode: 'unavailable',
      reason: 'changed-file selection is unavailable: ' + error.message,
      schemaVersion: PLAN_SCHEMA_VERSION,
      selected: [],
      state: 'unavailable',
      unavailable,
    }
  }
  const { expected, mode } = selectStagingTargets({
    changedFiles,
    eventName,
    rootDirectory,
  })
  const selected = expected.map((target) => target.id)
  const state =
    eventName === 'pull_request' && draft === true
      ? 'draft'
      : selected.length === 0
        ? 'no-change'
        : 'run'
  let reason = {
    'no-change': 'no affected image targets for this change',
    draft: 'draft pull request defers the image builds',
    run: 'affected target(s): ' + selected.join(', '),
  }[state]
  if (state === 'run' && mode === 'push-all') {
    reason = 'a push publishes every target present on the branch'
  }
  if (state === 'run' && mode === 'workflow-change') {
    reason =
      'the consolidated image workflow changed, so every available target rebuilds'
  }
  return {
    changedFileCount,
    mode,
    reason,
    schemaVersion: PLAN_SCHEMA_VERSION,
    selected,
    state,
    unavailable,
  }
}

// Only the fields a matrix leg needs reach the workflow: the runner resolves
// the matrix from JSON, so an inventory field that is not listed here cannot
// influence a build.
function matrixEntry(target, jobName = buildJobName(target)) {
  return {
    dockerfile: target.dockerfile,
    id: target.id,
    image: imageName(target),
    jobBase: target.jobBase,
    jobName,
    prep: (target.prep ?? []).join('\n'),
    publishGuard: target.publishGuard === true,
    syncSchema: target.syncSchema === true,
  }
}

function planOutputs(plan) {
  const known = new Set(STAGING_IMAGE_TARGETS.map((entry) => entry.id))
  const unknown = (plan.selected ?? []).filter((id) => !known.has(id))
  if (unknown.length > 0) {
    throw new Error(
      'plan selected unknown image target(s): ' + unknown.join(', ')
    )
  }
  const running = plan.state === 'run'
  const selected = running
    ? STAGING_IMAGE_TARGETS.filter((target) =>
        (plan.selected ?? []).includes(target.id)
      )
    : []
  // Only a push publishes images, so a pull request has no scan or AMD64 legs
  // and the required status must not expect them.
  const publishing = running && plan.mode === 'push-all'
  const scanTargets = publishing
    ? selected.filter((target) => target.scan)
    : []
  const amdTargets = publishing
    ? selected.filter((target) => target.amd)
    : []
  // Each target belongs to exactly one build job. The migrator stage runs
  // first, the dependent app stage waits for it, and everything else is
  // independent.
  const migratorTargets = selected.filter(
    (target) => target.stage === 'migrator'
  )
  const afterMigratorTargets = selected.filter(
    (target) => target.stage === 'after-migrator'
  )
  const buildTargets = selected.filter(
    (target) => target.stage === 'independent'
  )
  return {
    'amd-build': amdTargets.length > 0 ? 'true' : 'false',
    'amd-job-names': JSON.stringify(amdTargets.map((t) => amdJobName(t))),
    'amd-matrix': JSON.stringify(
      amdTargets.map((target) => matrixEntry(target, amdJobName(target)))
    ),
    'after-migrator-build':
      afterMigratorTargets.length > 0 ? 'true' : 'false',
    'after-migrator-matrix': JSON.stringify(
      afterMigratorTargets.map((target) =>
        matrixEntry(target, buildJobName(target))
      )
    ),
    build: buildTargets.length > 0 ? 'true' : 'false',
    'build-job-names': JSON.stringify(
      selected.map((target) => buildJobName(target))
    ),
    'changed-file-count': String(plan.changedFileCount ?? 0),
    matrix: JSON.stringify(
      buildTargets.map((target) => matrixEntry(target, buildJobName(target)))
    ),
    'migrator-build': migratorTargets.length > 0 ? 'true' : 'false',
    'migrator-matrix': JSON.stringify(
      migratorTargets.map((target) => matrixEntry(target, buildJobName(target)))
    ),
    mode: plan.mode,
    reason: plan.reason,
    'scan-build': scanTargets.length > 0 ? 'true' : 'false',
    'scan-job-names': JSON.stringify(scanTargets.map((t) => scanJobName(t))),
    'scan-matrix': JSON.stringify(
      scanTargets.map((target) => matrixEntry(target, scanJobName(target)))
    ),
    selected: JSON.stringify(selected.map((target) => target.id)),
    state: plan.state,
    unavailable: JSON.stringify(plan.unavailable ?? []),
  }
}

function formatSummary(plan) {
  const lines = [
    '## Staging image plan',
    '',
    '- State: ' + plan.state,
    '- Reason: ' + plan.reason,
    '- Changed files: ' + plan.changedFileCount,
    '- Selected targets: ' + ((plan.selected ?? []).join(', ') || 'none'),
  ]
  if ((plan.unavailable ?? []).length > 0) {
    lines.push('- Unavailable targets: ' + plan.unavailable.join(', '))
  }
  return lines.join('\n') + '\n'
}

function runPlanCli() {
  const plan = planStagingImages({
    changedFilesPath: process.env.CHANGED_FILES_PATH,
    draft: process.env.PULL_REQUEST_DRAFT === 'true',
    eventName: process.env.EVENT_NAME,
    rootDirectory: process.cwd(),
  })
  // The selection is published through the step outputs; the optional JSON file
  // is a debugging artifact for the run, so an unset path is not an error.
  if (process.env.PLAN_PATH) {
    fs.writeFileSync(
      process.env.PLAN_PATH,
      JSON.stringify(plan, null, 2) + '\n'
    )
  }
  const outputs = planOutputs(plan)
  if (process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(outputs).map(
      ([name, value]) => name + '=' + value
    )
    fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(plan))
  }
  process.stdout.write(JSON.stringify(outputs) + '\n')
}

if (require.main === module) runPlanCli()

module.exports = {
  PLAN_SCHEMA_VERSION,
  formatSummary,
  matrixEntry,
  planOutputs,
  planStagingImages,
  readChangedFiles,
}
