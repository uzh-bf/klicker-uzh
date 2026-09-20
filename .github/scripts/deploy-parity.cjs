// Deploy parity gate across the two integration branches.
//
// Production renders 'deploy/' from the 'v3' revision: ArgoCD 'app-klicker'
// tracks 'rev=v3', 'path=deploy/charts/klicker-uzh-v3', and the value file
// 'deploy/env-uzh-prd/values.yaml'. The production images are built and tagged
// from 'v3-ai' instead, so a 'deploy/' change that exists on only one of the two
// branches ships a release whose images never met those manifests: the lecturer
// and student MCP servers stayed out of production although their images were
// published, and a later promotion reverted the 'FASTMCP_STATELESS' fix, which
// only 'v3' carried.
//
// The gate compares the candidate revision with the other branch and fails on
// any difference under 'deploy/', except the image reference lines of
// 'deploy/env-<environment>/values.yaml'. That environment file is rendered from
// the branch that owns the environment ('v3' for production), so its pins roll
// with every release; the rest of the file must still match, so a promotion or
// a 'v3' integration merge cannot silently drop keys.
//
// A divergence between the two integration branches is a repository condition
// that most changes cannot influence. With '--base', the gate fails only a
// change that itself edits 'deploy/'; a candidate that leaves 'deploy/'
// untouched reports the existing divergence and passes. Without '--base' the
// strict whole-branch comparison applies.
//
// Usage: node .github/scripts/deploy-parity.cjs [--other <branch>]
//        [--candidate <ref>] [--base <ref>]
// Exit 0: parity, a divergence this change did not introduce, or the other
//         branch is no longer published.
// Exit 1: this change leaves the two branches divergent under deploy/.
// Exit 2: the comparison could not be evaluated.

const { execFileSync } = require('node:child_process')

const DEPLOY_PATH = 'deploy'
const ENV_VALUES_FILE_PATH = /^deploy\/env-[^/]+\/values\.yaml$/
const IMAGE_REFERENCE_LINE = /^([ \t]*)(tag|pullPolicy):[ \t]*.*$/gm
const ENVIRONMENT_OWNED_REFERENCE = '$1$2: <environment-owned>'
const GIT_MAX_BUFFER = 32 * 1024 * 1024
const DEFAULT_OTHER_BRANCH = 'v3-ai'
const DEFAULT_CANDIDATE = 'HEAD'
const USAGE =
  'usage: node .github/scripts/deploy-parity.cjs [--other <branch>] [--candidate <ref>] [--base <ref>]'

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function tryGit(args) {
  try {
    return git(args)
  } catch {
    return null
  }
}

// Environment values carry the image reference of the branch that renders the
// environment. Everything else in the file has to match.
function normalizeDeployFile(path, text) {
  if (!ENV_VALUES_FILE_PATH.test(path)) return text
  return text.replace(IMAGE_REFERENCE_LINE, ENVIRONMENT_OWNED_REFERENCE)
}

// The comparison is pure so the contract is covered without a network, a second
// branch checkout, or an Actions run.
function evaluateParity(changes) {
  const violations = []
  const environmentOwned = []
  for (const change of changes) {
    if (change.status === 'A' || change.status === 'D') {
      violations.push({
        path: change.path,
        kind: change.status === 'A' ? 'only-candidate' : 'only-other',
      })
      continue
    }
    const otherText = normalizeDeployFile(change.path, change.otherText ?? '')
    const candidateText = normalizeDeployFile(
      change.path,
      change.candidateText ?? ''
    )
    // Only the environment values file owns an image reference; every other
    // listed difference, including a type or mode change, is a divergence.
    if (ENV_VALUES_FILE_PATH.test(change.path) && otherText === candidateText) {
      environmentOwned.push(change.path)
    } else {
      violations.push({ path: change.path, kind: 'content' })
    }
  }
  return { violations, environmentOwned }
}

// A divergence is this change's responsibility only when the change itself
// edited 'deploy/'. Otherwise the candidate inherits whatever alignment the two
// integration branches already had, and failing it would block unrelated work
// on a repository condition it cannot influence.
function attributeDivergence(violations, touchesDeploy) {
  if (touchesDeploy) return { blocking: violations, preexisting: [] }
  return { blocking: [], preexisting: violations }
}

function parseNameStatus(output) {
  const fields = output.split('\0').filter((field) => field !== '')
  const changes = []
  for (let index = 0; index + 1 < fields.length; index += 2) {
    changes.push({ status: fields[index][0], path: fields[index + 1] })
  }
  return changes
}

function candidateTouchesDeploy(baseRef, candidate) {
  if (baseRef === null) return true
  const touched = parseNameStatus(
    git([
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      baseRef,
      candidate,
      '--',
      DEPLOY_PATH,
    ])
  )
  return touched.length > 0
}

function parseArguments(argv) {
  const options = {
    other: DEFAULT_OTHER_BRANCH,
    candidate: DEFAULT_CANDIDATE,
    base: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--other') {
      options.other = argv[index + 1]
      index += 1
    } else if (argument === '--candidate') {
      options.candidate = argv[index + 1]
      index += 1
    } else if (argument === '--base') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('missing value for --base\n' + USAGE)
      }
      options.base = value
      index += 1
    } else {
      throw new Error('unknown argument ' + argument + '\n' + USAGE)
    }
  }
  if (!options.other || !options.candidate) {
    throw new Error('missing value for an argument\n' + USAGE)
  }
  return options
}

function refExists(ref) {
  return tryGit(['rev-parse', '--verify', '--quiet', ref]) !== null
}

// A branch that is no longer published retires the gate with it; ADR 0007 plans
// to retire 'v3-ai' once nothing targets it.
function remoteBranchExists(branch) {
  try {
    git([
      'ls-remote',
      '--exit-code',
      '--heads',
      'origin',
      'refs/heads/' + branch,
    ])
    return true
  } catch (error) {
    if (error.status === 2) return false
    throw error
  }
}

function resolveOtherRef(branch) {
  const ref = 'origin/' + branch
  if (refExists(ref)) return ref
  if (!remoteBranchExists(branch)) return null
  git([
    'fetch',
    '--no-tags',
    'origin',
    '+refs/heads/' + branch + ':refs/remotes/origin/' + branch,
  ])
  if (!refExists(ref)) {
    throw new Error('fetched ' + branch + ' but could not resolve ' + ref)
  }
  return ref
}

function readDeployFile(ref, path) {
  return tryGit(['show', ref + ':' + path])
}

// '--base' is the revision the candidate is responsible for. It is resolved
// locally only: the caller passes a revision its checkout already has, and an
// unavailable base keeps the strict whole-branch comparison.
function resolveBaseRef(ref) {
  return refExists(ref) ? ref : null
}

function describeViolation(violation, otherRef, candidate) {
  if (violation.kind === 'only-candidate') return 'only in ' + candidate
  if (violation.kind === 'only-other') return 'only in ' + otherRef
  return 'content differs'
}

function reportDivergence(violations, otherRef, candidate) {
  const lines = [
    'deploy parity check failed: ' +
      violations.length +
      ' path(s) under ' +
      DEPLOY_PATH +
      '/ differ between ' +
      otherRef +
      ' and ' +
      candidate +
      '.',
    '',
    ...violations.map(
      (violation) =>
        '  - ' +
        violation.path +
        ' (' +
        describeViolation(violation, otherRef, candidate) +
        ')'
    ),
    '',
    'Production renders deploy/ from v3 while the release images are tagged',
    'from v3-ai, so both branches must carry the same deploy/ revision:',
    '  - promote the v3-ai revision to v3 (chore(deploy): promote ...), or',
    "  - backport this revision's deploy/ change to v3-ai first.",
    '',
    'Image tag: and pullPolicy: lines in deploy/env-<environment>/values.yaml',
    'are environment-owned and are excluded from this comparison.',
  ]
  for (const line of lines) console.error(line)
}

function reportPreexisting(violations, otherRef, candidate) {
  const lines = [
    '::warning::deploy parity: ' +
      violations.length +
      ' path(s) under ' +
      DEPLOY_PATH +
      '/ differ between ' +
      otherRef +
      ' and ' +
      candidate +
      ', but this change does not edit ' +
      DEPLOY_PATH +
      '/.',
    'The divergence already exists between the integration branches, so it is',
    'reported here instead of failing a change that cannot influence it:',
    '',
    ...violations.map(
      (violation) =>
        '  - ' +
        violation.path +
        ' (' +
        describeViolation(violation, otherRef, candidate) +
        ')'
    ),
    '',
    'Resolve it on the branch that owns the drift; a change that edits',
    DEPLOY_PATH + '/ is still blocked until the two revisions match.',
  ]
  for (const line of lines) console.log(line)
}

function main(argv) {
  const options = parseArguments(argv)
  const otherRef = resolveOtherRef(options.other)
  if (otherRef === null) {
    console.log(
      'deploy parity: origin/' +
        options.other +
        ' is not published by this repository; the parity gate does not apply.'
    )
    return 0
  }

  const baseRef = options.base === null ? null : resolveBaseRef(options.base)
  if (options.base !== null && baseRef === null) {
    console.log(
      'deploy parity: base ' +
        options.base +
        ' is not present in this checkout; comparing the whole branch.'
    )
  }

  const changes = parseNameStatus(
    git([
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      otherRef,
      options.candidate,
      '--',
      DEPLOY_PATH,
    ])
  )
  for (const change of changes) {
    if (change.status === 'A' || change.status === 'D') continue
    change.otherText = readDeployFile(otherRef, change.path)
    change.candidateText = readDeployFile(options.candidate, change.path)
  }

  const { violations, environmentOwned } = evaluateParity(changes)
  if (environmentOwned.length > 0) {
    console.log(
      'deploy parity: environment-owned image reference lines differ in ' +
        environmentOwned.join(', ') +
        ' (not a divergence).'
    )
  }
  if (violations.length === 0) {
    console.log(
      'deploy parity ok: ' +
        options.candidate +
        ' matches ' +
        otherRef +
        ' under ' +
        DEPLOY_PATH +
        '/.'
    )
    return 0
  }

  const { blocking, preexisting } = attributeDivergence(
    violations,
    candidateTouchesDeploy(baseRef, options.candidate)
  )
  if (blocking.length === 0) {
    reportPreexisting(preexisting, otherRef, options.candidate)
    return 0
  }

  reportDivergence(blocking, otherRef, options.candidate)
  return 1
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (error) {
    console.error(String((error && error.message) || error))
    process.exit(2)
  }
}

module.exports = {
  ENV_VALUES_FILE_PATH,
  attributeDivergence,
  evaluateParity,
  normalizeDeployFile,
  parseNameStatus,
}
