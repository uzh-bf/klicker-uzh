// Doc Query scope-token ownership on 'v3-ai'.
//
// 'v3-ai' owns the KB-transport signer in '@klicker-uzh/doc-query-client', and
// 'apps/chat/src/lib/server/docQueryScopeToken.ts' only re-exports it from
// there. 'v3' still carries an app-local implementation of the same module,
// because the package does not exist on that branch yet.
//
// That split survives only as long as nothing edits the 'v3' copy. A later 'v3'
// change to the file applies cleanly onto 'v3-ai' in the next sync, with no
// conflict to review, and silently restores an app-local signer: the package
// keeps its tests and stops being used, so a package-side fix no longer reaches
// the transport. This gate turns that silent revert into a failed check.
//
// A change is responsible only for the guarded paths it edits. A pull request
// passes its base revision, and a candidate that leaves those paths untouched
// reports the state it inherited instead of failing work that cannot influence
// it. Without '--base' the strict candidate check applies.
//
// Usage: node .github/scripts/doc-query-token-ownership.cjs [--candidate <ref>]
//        [--base <ref>]
// Exit 0: the module re-exports the package signer, or the candidate did not
//         edit the guarded paths.
// Exit 1: this change leaves 'v3-ai' with a signer that is not the package one.
// Exit 2: the check could not be evaluated.

const { execFileSync } = require('node:child_process')

const OWNED_MODULE_PATH = 'apps/chat/src/lib/server/docQueryScopeToken.ts'
const PACKAGE_MODULE = '@klicker-uzh/doc-query-client'
const PACKAGE_PATH = 'packages/doc-query-client'
const REQUIRED_EXPORTS = [
  'DocQueryScopeTokenError',
  'createDocQueryScopedFetch',
  'signDocQueryScopeToken',
]
const GUARDED_PATHS = [OWNED_MODULE_PATH, PACKAGE_PATH]
const GIT_MAX_BUFFER = 32 * 1024 * 1024
const DEFAULT_CANDIDATE = 'HEAD'
const USAGE =
  'usage: node .github/scripts/doc-query-token-ownership.cjs [--candidate <ref>] [--base <ref>]'

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

function reExportPattern() {
  return /export\s*(?:\{([^}]*)\}|\*)\s*from\s*'([^']+)'/g
}

// The module is a few lines of TypeScript, so a textual scan is enough and
// keeps the contract testable without a compiler. Comments cannot carry an
// export, and neither branch writes a line comment containing '//'.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

// The comparison is pure so the contract is covered without a network, a second
// branch checkout, or an Actions run.
function evaluateOwnership(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return {
      ok: false,
      reasons: [{ kind: 'missing-module', detail: 'the module is missing' }],
    }
  }
  const body = withoutComments(text)
  const reasons = []
  const exported = new Set()
  let exportsEverything = false
  for (const match of body.matchAll(reExportPattern())) {
    const nameList = match[1]
    const moduleName = match[2]
    if (moduleName !== PACKAGE_MODULE) {
      reasons.push({ kind: 'foreign-module', detail: moduleName })
      continue
    }
    if (nameList === undefined) {
      exportsEverything = true
      continue
    }
    for (const name of nameList.split(',')) {
      const trimmed = name.trim()
      if (trimmed !== '') exported.add(trimmed)
    }
  }
  const remainder = body.replace(reExportPattern(), '')
  if (remainder.trim() !== '') {
    reasons.push({
      kind: 'local-code',
      detail: 'the module defines code of its own instead of re-exporting',
    })
  }
  if (!exportsEverything) {
    for (const name of REQUIRED_EXPORTS) {
      if (!exported.has(name)) {
        reasons.push({ kind: 'missing-export', detail: name })
      }
    }
  }
  return { ok: reasons.length === 0, reasons }
}

// A divergence is this change's responsibility only when it edited a guarded
// path. Otherwise the candidate inherits whatever the branch already carried.
function attributeDivergence(touchedGuardedPaths) {
  return touchedGuardedPaths
    ? { blocking: true, preexisting: false }
    : { blocking: false, preexisting: true }
}

function parseArguments(argv) {
  const options = { candidate: DEFAULT_CANDIDATE, base: null }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--candidate') {
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
  if (!options.candidate) {
    throw new Error('missing value for an argument\n' + USAGE)
  }
  return options
}

function refExists(ref) {
  return tryGit(['rev-parse', '--verify', '--quiet', ref]) !== null
}

// '--base' is the revision the candidate is responsible for. It is resolved
// locally only, and an unavailable base keeps the strict candidate check.
function resolveBaseRef(ref) {
  return ref === null ? null : refExists(ref) ? ref : null
}

function guardedPathsTouched(baseRef, candidate) {
  const output = git([
    'diff',
    '--name-only',
    '-z',
    baseRef,
    candidate,
    '--',
    ...GUARDED_PATHS,
  ])
  return output.split('\0').some((path) => path !== '')
}

function reportViolation(reasons, candidate) {
  const lines = [
    'doc query token ownership check failed: ' + candidate + ' leaves',
    OWNED_MODULE_PATH + ' without the ' + PACKAGE_MODULE + ' signer.',
    '',
    ...reasons.map((reason) => '  - ' + reason.kind + ': ' + reason.detail),
    '',
    "'v3-ai' owns the KB-transport signer in " +
      PACKAGE_MODULE +
      ', and v3 still',
    'carries an app-local copy of the same module. Integration flows v3 ->',
    'v3-ai, so a v3-side edit of the module merges cleanly here and silently',
    'restores the app-local signer that the package tests no longer cover:',
    '  - change ' + PACKAGE_PATH + '/src/docQueryScopeToken.ts instead, and',
    '  - keep this module as the re-export of ' + PACKAGE_MODULE + '.',
  ]
  for (const line of lines) console.error(line)
}

function reportPreexisting(reasons, candidate) {
  const lines = [
    '::warning::doc query token ownership: ' + candidate + ' leaves',
    OWNED_MODULE_PATH + ' without the ' + PACKAGE_MODULE + ' signer, but this',
    'change does not edit ' + GUARDED_PATHS.join(' or ') + ', so the state it',
    'inherited is reported here instead of failing it:',
    '',
    ...reasons.map((reason) => '  - ' + reason.kind + ': ' + reason.detail),
  ]
  for (const line of lines) console.log(line)
}

function main(argv) {
  const options = parseArguments(argv)
  const { ok, reasons } = evaluateOwnership(
    tryGit(['show', options.candidate + ':' + OWNED_MODULE_PATH])
  )
  if (ok) {
    console.log(
      'doc query token ownership ok: ' +
        options.candidate +
        ' re-exports ' +
        PACKAGE_MODULE +
        ' from ' +
        OWNED_MODULE_PATH +
        '.'
    )
    return 0
  }

  const baseRef = resolveBaseRef(options.base)
  if (options.base !== null && baseRef === null) {
    console.log(
      'doc query token ownership: base ' +
        options.base +
        ' is not present in this checkout; checking the candidate itself.'
    )
  }

  const { blocking } = attributeDivergence(
    baseRef === null ? true : guardedPathsTouched(baseRef, options.candidate)
  )
  if (!blocking) {
    reportPreexisting(reasons, options.candidate)
    return 0
  }

  reportViolation(reasons, options.candidate)
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
  GUARDED_PATHS,
  OWNED_MODULE_PATH,
  PACKAGE_MODULE,
  REQUIRED_EXPORTS,
  attributeDivergence,
  evaluateOwnership,
}
