// One repository-owned classifier for the minimum validation envelope.
//
// Several validation lanes ask the same question: which checks can still
// falsify this change? Answering it inside each lane produced one selector per
// lane, so a change under docs/ or .github/ could pay for a full codebase
// install, a complete eight-shard Playwright wave, and a static analysis while
// every lane believed it was being careful on its own.
//
// This module answers that question once for the whole repository. It receives
// the merge-base diff as path records and returns exactly one change class
// together with the validation decisions the class requires:
//
//   documentation-and-planning  Files inside the repository's documentation and
//                               planning trees: docs/, project/, and
//                               .agents/skills/. Markdown files carry prose; a
//                               non-markdown asset in those trees is reviewed
//                               with the prose around it.
//   ci-orchestration            Repository CI definitions and CI-owned scripts.
//   application                 Everything else, including everything the
//                               classifier cannot prove about the diff.
//
// The classifier fails closed. An empty diff, an unresolvable path, a rename,
// a deletion, a copy, a path outside the class prefixes, a record kind the
// caller cannot interpret, or a file that carries executable or CI input all
// expand the envelope to the application class. A bounded class is a claim
// about the exact paths it names; the consuming lane still has to produce the
// bounded evidence that class requires, and a class boundary is a reviewable
// source change rather than a local path filter.
//
// The class names the change, not the coverage: the CI class still runs the CI
// contract suite, the bounded Playwright smoke selection, and the static
// analysis, because .github/scripts is analyzed source and a workflow file is
// analyzed input for the Actions analysis.

const fs = require('node:fs')

const CHANGE_CLASS = Object.freeze({
  documentationAndPlanning: 'documentation-and-planning',
  ciOrchestration: 'ci-orchestration',
  application: 'application',
})

const DECISION = Object.freeze({
  playwrightFull: 'full',
  playwrightBounded: 'bounded',
  playwrightSkip: 'skip',
  codebaseCheckFull: 'full',
  codebaseCheckBounded: 'bounded',
  staticAnalysisRun: 'run',
  staticAnalysisSkip: 'skip',
})

// The complete envelope per class. A lane reads only its own decision, so one
// class definition serves the codebase check, the Playwright envelope, and the
// static analysis without a per-lane copy of the rules.
const ENVELOPE = Object.freeze({
  [CHANGE_CLASS.documentationAndPlanning]: Object.freeze({
    playwright: DECISION.playwrightSkip,
    codebaseCheck: DECISION.codebaseCheckBounded,
    staticAnalysis: DECISION.staticAnalysisSkip,
  }),
  [CHANGE_CLASS.ciOrchestration]: Object.freeze({
    playwright: DECISION.playwrightBounded,
    codebaseCheck: DECISION.codebaseCheckBounded,
    staticAnalysis: DECISION.staticAnalysisRun,
  }),
  [CHANGE_CLASS.application]: Object.freeze({
    playwright: DECISION.playwrightFull,
    codebaseCheck: DECISION.codebaseCheckFull,
    staticAnalysis: DECISION.staticAnalysisRun,
  }),
})

const REASON = Object.freeze({
  documentationAndPlanning: 'documentation-and-planning',
  ciOrchestration: 'ci-orchestration',
  applicationSurface: 'application-surface',
  emptyDiff: 'empty-diff',
  unknownRecordKind: 'unknown-record-kind',
  malformedRecord: 'malformed-record',
  unsafePath: 'unsafe-path',
  mixedClasses: 'mixed-classes',
})

// Changed-path records the classifier accepts. A rename, copy, or deletion can
// remove a file another lane depends on, so those kinds never stay bounded.
const ADDITIVE_RECORD_KINDS = new Set(['A', 'M'])

const DOCUMENTATION_TREES = Object.freeze([
  '.agents/skills/',
  'docs/',
  'project/',
])
const DOCUMENTATION_EXTENSIONS = Object.freeze(['.md', '.mdx'])
const CI_TREES = Object.freeze(['.github/'])

// Files that carry behaviour rather than documentation. A path inside a
// documentation tree with one of these suffixes is not documentation-only, so
// the change expands instead of being validated as prose.
const EXECUTABLE_EXTENSIONS = Object.freeze([
  '.bash',
  '.cjs',
  '.env',
  '.go',
  '.java',
  '.js',
  '.json',
  '.mjs',
  '.py',
  '.rb',
  '.rs',
  '.sh',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
  '.zsh',
])

function fail(message) {
  throw new Error(message)
}

// A repository-relative path only: no absolute path, no traversal, no newline,
// no empty segment. Anything else is unresolvable input and expands.
function isSafeRepoPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) {
    return false
  }
  if (
    value.startsWith('/') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.includes('\u0000')
  ) {
    return false
  }
  return value
    .split('/')
    .every(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..'
    )
}

function matchesTree(value, tree) {
  const normalized = tree.endsWith('/') ? tree.slice(0, -1) : tree
  return value === normalized || value.startsWith(`${normalized}/`)
}

function hasExtension(value, extensions) {
  return extensions.some((extension) => value.endsWith(extension))
}

// Documentation membership is proven by the tree, never by the extension alone.
// A root-level README.md or AGENTS.md stays outside the bounded class: those
// files state repository policy and an installed agent's instructions, so a
// change there is not reviewed like a page under docs/.
function isDocumentationPath(value) {
  if (!DOCUMENTATION_TREES.some((tree) => matchesTree(value, tree)))
    return false
  if (hasExtension(value, DOCUMENTATION_EXTENSIONS)) return true
  return !hasExtension(value, EXECUTABLE_EXTENSIONS)
}

function isCiPath(value) {
  return CI_TREES.some((tree) => matchesTree(value, tree))
}

// Turn an arbitrary changed-file listing into records. A missing or empty list
// is an unresolvable diff, and the caller receives the empty record set so the
// envelope expands instead of reading an absent list as a bounded change.
function parsePathList(source) {
  if (typeof source !== 'string' || source.trim().length === 0) return []
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((changedPath) => ({ kind: 'M', paths: [changedPath] }))
}

// Parse `git diff --name-status -z` output. Rename and copy records carry two
// paths, and every record carries the status letter the classifier rejects
// unless the change is purely additive. The selector and the codebase check
// both read their records through this one parser, so the two lanes cannot
// disagree about what a diff contained.
function parseNameStatusRecords(raw) {
  if (raw === '') return []

  const fields = raw.split('\0')
  if (fields.at(-1) === '') fields.pop()

  const changes = []
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++]
    if (!/^[A-Z](?:[0-9]{1,3})?$/.test(status)) {
      fail(`malformed diff status ${JSON.stringify(status)}`)
    }

    const kind = status[0]
    const paths = []
    const pathCount = kind === 'R' || kind === 'C' ? 2 : 1
    for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
      const changedPath = fields[index++]
      if (!isSafeRepoPath(changedPath)) {
        fail('malformed diff path')
      }
      paths.push(changedPath)
    }

    changes.push({ status, kind, paths })
  }

  return changes
}

function recordPaths(record) {
  if (!record || typeof record !== 'object') return null
  const paths = Array.isArray(record.paths) ? record.paths : null
  if (!paths || paths.length === 0) return null
  if (typeof record.kind !== 'string' || record.kind.length === 0) return null
  return paths
}

function expand(reason, paths) {
  return {
    changeClass: CHANGE_CLASS.application,
    reason,
    decisions: ENVELOPE[CHANGE_CLASS.application],
    paths,
  }
}

// Classify one diff. Every record must be interpretable and every path must
// resolve to the same bounded class; otherwise the envelope expands.
function classifyRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return expand(REASON.emptyDiff, [])
  }

  const documentationPaths = []
  const ciPaths = []

  for (const record of records) {
    const paths = recordPaths(record)
    if (!paths) return expand(REASON.malformedRecord, [])
    if (!ADDITIVE_RECORD_KINDS.has(record.kind)) {
      return expand(REASON.unknownRecordKind, paths)
    }
    for (const changedPath of paths) {
      if (!isSafeRepoPath(changedPath)) {
        return expand(REASON.unsafePath, [changedPath])
      }
      if (isDocumentationPath(changedPath)) {
        documentationPaths.push(changedPath)
        continue
      }
      if (isCiPath(changedPath)) {
        ciPaths.push(changedPath)
        continue
      }
      return expand(REASON.applicationSurface, [changedPath])
    }
  }

  if (documentationPaths.length > 0 && ciPaths.length > 0) {
    // One mixed pull request is not two bounded pull requests: the union needs
    // the wider envelope, and the class that would hide half of it must not win.
    return expand(REASON.mixedClasses, [...documentationPaths, ...ciPaths])
  }

  if (documentationPaths.length > 0) {
    return {
      changeClass: CHANGE_CLASS.documentationAndPlanning,
      reason: REASON.documentationAndPlanning,
      decisions: ENVELOPE[CHANGE_CLASS.documentationAndPlanning],
      paths: documentationPaths,
    }
  }

  return {
    changeClass: CHANGE_CLASS.ciOrchestration,
    reason: REASON.ciOrchestration,
    decisions: ENVELOPE[CHANGE_CLASS.ciOrchestration],
    paths: ciPaths,
  }
}

function classifyPaths(paths) {
  return classifyRecords(
    (Array.isArray(paths) ? paths : []).map((changedPath) => ({
      kind: 'M',
      paths: [changedPath],
    }))
  )
}

// Every consumer accepts an unknown class as the full envelope, so a lane that
// cannot read a class can never silently narrow itself.
function decisionsFor(changeClass) {
  return ENVELOPE[changeClass] ?? ENVELOPE[CHANGE_CLASS.application]
}

function isKnownClass(changeClass) {
  return Object.hasOwn(ENVELOPE, changeClass)
}

function formatSummary(classification) {
  const lines = [
    '### Minimum validation envelope',
    '',
    `- Class: \`${classification.changeClass}\``,
    `- Reason: \`${classification.reason}\``,
    `- Changed paths: \`${classification.paths.length}\``,
    `- Playwright: \`${classification.decisions.playwright}\``,
    `- Codebase check: \`${classification.decisions.codebaseCheck}\``,
    `- Static analysis: \`${classification.decisions.staticAnalysis}\``,
    '',
    'A bounded class is proven by the paths above. Anything the classifier',
    'cannot resolve expands to the application envelope.',
  ]
  return lines.join('\n')
}

// The classification receipt records the class, the exact paths that justified
// it, and the decisions it produced, so a bounded lane is auditable after the
// run instead of being inferred from which jobs happened to execute.
function buildReceipt(classification, input = {}) {
  return {
    schemaVersion: 1,
    changeClass: classification.changeClass,
    reason: classification.reason,
    decisions: { ...classification.decisions },
    changedPaths: [...classification.paths],
    event: input.eventName ?? null,
  }
}

function emit(classification, env = process.env) {
  const outputs = [
    `change_class=${classification.changeClass}`,
    `change_class_reason=${classification.reason}`,
    `changed_path_count=${classification.paths.length}`,
    `playwright=${classification.decisions.playwright}`,
    `codebase_check=${classification.decisions.codebaseCheck}`,
    `static_analysis=${classification.decisions.staticAnalysis}`,
  ]
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `${outputs.join('\n')}\n`)
  }
  const summary = formatSummary(classification)
  process.stdout.write(`${summary}\n`)
  if (env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]
    if (!option.startsWith('--') || index + 1 >= argv.length) {
      fail(`expected option value, got ${option}`)
    }
    args[option.slice(2)] = argv[++index]
  }
  return args
}

function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv)
  const records = args['name-status-z']
    ? parseNameStatusRecords(fs.readFileSync(args['name-status-z'], 'utf8'))
    : parsePathList(
        args['changed-paths-file']
          ? fs.readFileSync(args['changed-paths-file'], 'utf8')
          : (env.CHANGED_PATHS ?? '')
      )
  const classification = classifyRecords(records)
  emit(classification, env)
  if (args.receipt) {
    fs.writeFileSync(
      args.receipt,
      `${JSON.stringify(
        buildReceipt(classification, { eventName: env.EVENT_NAME }),
        null,
        2
      )}\n`
    )
  }
  return classification
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Minimum validation classification failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  CHANGE_CLASS,
  DECISION,
  ENVELOPE,
  REASON,
  classifyPaths,
  classifyRecords,
  decisionsFor,
  emit,
  buildReceipt,
  formatSummary,
  isKnownClass,
  isSafeRepoPath,
  main,
  parsePathList,
  parseNameStatusRecords,
}
