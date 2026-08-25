const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const FIXTURE_SCHEMA = 'qualification-fixture/v1'
const OCR_SCHEMA = 'ocr.run-manifest/v1'
const STACK_SCHEMA = 'final-ai-stack-manifest/v1'
const QUALIFICATION_MODEL = 'synthetic/model-v1'
const FINDING_CATEGORIES = new Set([
  'bug',
  'security',
  'performance',
  'maintainability',
  'test',
  'style',
  'documentation',
  'other',
])
const FINDING_SEVERITIES = new Set(['critical', 'high', 'medium', 'low'])
const OUTCOMES = new Set(['accepts', 'fails-closed'])
const ADJUDICATIONS = new Set(['blocker', 'follow-up', 'rejected', 'clean'])
const FINDING_DISPOSITIONS = new Set(['blocker', 'follow-up', 'rejected'])
const HEX_SHA = /^[0-9a-f]{40}$/

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function fail(reasons, message) {
  reasons.push(message)
  return false
}

function checkObject(value, reasons, label) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(reasons, `${label} must be an object`)
  }
  return true
}

function checkExactKeys(value, allowed, required, reasons, label) {
  if (!checkObject(value, reasons, label)) return false
  const allowedKeys = new Set(allowed)
  const unknown = Object.keys(value).find((key) => !allowedKeys.has(key))
  if (unknown != null) {
    return fail(reasons, `${label} has unknown property ${unknown}`)
  }
  const missing = required.find((key) => !Object.hasOwn(value, key))
  if (missing != null) {
    return fail(reasons, `${label} is missing ${missing}`)
  }
  return true
}

function checkString(value, reasons, label, { min = 1, max = Infinity } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    return fail(reasons, `${label} must be a string of length ${min}-${max}`)
  }
  return true
}

function checkInteger(value, reasons, label, { min = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    return fail(reasons, `${label} must be a safe integer >= ${min}`)
  }
  return true
}

function validateFindingComment(comment, index, reasons, { stack } = {}) {
  const requiredKeys = [
    'path',
    'start_line',
    'end_line',
    'category',
    'severity',
    'content',
    'expected_disposition',
  ]
  if (stack) requiredKeys.push('layer_numbers')
  if (
    !checkExactKeys(
      comment,
      [
        'path',
        'start_line',
        'end_line',
        'category',
        'severity',
        'content',
        'layer_numbers',
        'expected_disposition',
      ],
      requiredKeys,
      reasons,
      `comment ${index + 1}`
    )
  ) {
    return false
  }
  const filePath = comment.path
  const startLine = comment.start_line
  const endLine = comment.end_line
  const category = comment.category
  const severity = comment.severity
  const content = comment.content
  const layers = comment.layer_numbers
  if (
    !checkString(filePath, reasons, `comment ${index + 1} path`, {
      min: 1,
      max: 500,
    }) ||
    !checkInteger(startLine, reasons, `comment ${index + 1} start_line`, {
      min: 1,
    }) ||
    !checkInteger(endLine, reasons, `comment ${index + 1} end_line`, {
      min: 1,
    }) ||
    !checkString(content, reasons, `comment ${index + 1} content`, {
      min: 1,
      max: 12000,
    })
  ) {
    return false
  }
  if (!FINDING_CATEGORIES.has(category)) {
    return fail(reasons, `comment ${index + 1} has an unknown category`)
  }
  if (!FINDING_SEVERITIES.has(severity)) {
    return fail(reasons, `comment ${index + 1} has an unknown severity`)
  }
  if (!FINDING_DISPOSITIONS.has(comment.expected_disposition)) {
    return fail(
      reasons,
      `comment ${index + 1} has an unknown expected disposition`
    )
  }
  if (endLine < startLine) {
    return fail(reasons, `comment ${index + 1} has an inverted line range`)
  }
  if (stack) {
    const owners = stack.path_owners.get(filePath)
    if (!owners || owners.length === 0) {
      return fail(
        reasons,
        `comment ${index + 1} path is not owned by any stack layer`
      )
    }
    if (
      !Array.isArray(layers) ||
      layers.length === 0 ||
      new Set(layers).size !== layers.length ||
      layers.some(
        (layer) =>
          !Number.isSafeInteger(layer) ||
          layer < 1 ||
          layer > stack.layer_count ||
          !owners.includes(layer)
      )
    ) {
      return fail(reasons, `comment ${index + 1} names invalid layer owners`)
    }
  } else if (Object.hasOwn(comment, 'layer_numbers')) {
    return fail(
      reasons,
      `comment ${index + 1} has stack owners without a stack`
    )
  }
  return true
}

function validateReview(review, reasons) {
  if (
    !checkExactKeys(
      review,
      [
        'schema_version',
        'status',
        'llm',
        'finish_reason',
        'warnings',
        'summary',
        'manifest',
        'comments',
        'stack',
      ],
      [
        'schema_version',
        'status',
        'llm',
        'finish_reason',
        'warnings',
        'summary',
        'manifest',
        'comments',
      ],
      reasons,
      'review'
    )
  ) {
    return false
  }
  if (review?.schema_version !== OCR_SCHEMA) {
    return fail(reasons, `review schema_version must be ${OCR_SCHEMA}`)
  }
  if (review.status !== 'complete') {
    return fail(reasons, 'review status must be complete')
  }
  if (
    !checkExactKeys(review.llm, ['model'], ['model'], reasons, 'review llm')
  ) {
    return false
  }
  if (review.llm.model !== QUALIFICATION_MODEL) {
    return fail(reasons, `review llm model must be ${QUALIFICATION_MODEL}`)
  }
  if (review.finish_reason !== 'stop') {
    return fail(reasons, 'review finish_reason must be stop')
  }
  if (!Array.isArray(review.warnings) || review.warnings.length > 0) {
    return fail(reasons, 'review must not carry coverage warnings')
  }
  const summary = review.summary
  if (
    !checkExactKeys(
      summary,
      [
        'coverage',
        'comments',
        'files_reviewed',
        'elapsed',
        'input_tokens',
        'output_tokens',
        'total_tokens',
      ],
      [
        'coverage',
        'comments',
        'files_reviewed',
        'elapsed',
        'input_tokens',
        'output_tokens',
        'total_tokens',
      ],
      reasons,
      'review summary'
    )
  ) {
    return false
  }
  if (summary.coverage !== 'complete') {
    return fail(reasons, 'review coverage must be complete')
  }
  if (
    !checkExactKeys(
      review.manifest,
      ['schema_version', 'terminal_state'],
      ['schema_version', 'terminal_state'],
      reasons,
      'review manifest'
    )
  ) {
    return false
  }
  if (review.manifest.schema_version !== OCR_SCHEMA) {
    return fail(reasons, `review manifest schema_version must be ${OCR_SCHEMA}`)
  }
  if (review.manifest.terminal_state !== 'complete') {
    return fail(reasons, 'review manifest terminal_state must be complete')
  }
  const comments = review.comments
  if (!Array.isArray(comments)) {
    return fail(reasons, 'review comments must be an array')
  }
  if (comments.length > 100) {
    return fail(reasons, 'review comments exceed the bounded limit')
  }
  if (
    !checkInteger(summary.comments, reasons, 'summary comments') ||
    summary.comments !== comments.length
  ) {
    return fail(reasons, 'summary comments must match the comment count')
  }
  if (
    !checkInteger(summary.files_reviewed, reasons, 'summary files_reviewed', {
      min: 1,
    })
  ) {
    return false
  }
  if (!checkString(summary.elapsed, reasons, 'summary elapsed', { min: 1 })) {
    return false
  }
  for (const key of ['total_tokens', 'input_tokens', 'output_tokens']) {
    if (!checkInteger(summary[key], reasons, `summary ${key}`)) {
      return false
    }
  }
  if (summary.total_tokens !== summary.input_tokens + summary.output_tokens) {
    return fail(reasons, 'summary token counters do not add up')
  }
  return true
}

function validateStack(stack, reasons) {
  if (
    !checkExactKeys(
      stack,
      [
        'schema_version',
        'stack_id',
        'ultimate_base',
        'stack_order',
        'layers',
        'path_index',
      ],
      [
        'schema_version',
        'stack_id',
        'ultimate_base',
        'stack_order',
        'layers',
        'path_index',
      ],
      reasons,
      'review stack'
    )
  ) {
    return false
  }
  if (stack?.schema_version !== STACK_SCHEMA) {
    return fail(reasons, `stack schema_version must be ${STACK_SCHEMA}`)
  }
  if (!checkString(stack.stack_id, reasons, 'stack_id', { min: 1, max: 100 })) {
    return false
  }
  const order = stack.stack_order
  if (
    !Array.isArray(order) ||
    order.length < 2 ||
    new Set(order).size !== order.length ||
    order.some((entry) => !Number.isSafeInteger(entry) || entry < 1)
  ) {
    return fail(reasons, 'stack_order must be unique positive integers')
  }
  const layers = stack.layers
  if (!Array.isArray(layers) || layers.length !== order.length) {
    return fail(reasons, 'stack layers must match the stack_order length')
  }
  const ultimate = stack.ultimate_base
  if (
    !checkExactKeys(
      ultimate,
      ['ref', 'sha'],
      ['ref', 'sha'],
      reasons,
      'stack ultimate_base'
    )
  ) {
    return false
  }
  if (
    !ultimate ||
    !checkString(ultimate.ref, reasons, 'ultimate_base ref', { min: 1 }) ||
    !checkString(ultimate.sha, reasons, 'ultimate_base sha', {
      min: 40,
      max: 40,
    }) ||
    !HEX_SHA.test(ultimate.sha)
  ) {
    return fail(reasons, 'stack ultimate_base must carry a 40-hex sha')
  }
  const pathIndex = new Map()
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index]
    const position = index + 1
    if (
      !checkExactKeys(
        layer,
        [
          'position',
          'pull_request',
          'base_ref',
          'base_sha',
          'head_ref',
          'head_sha',
          'title',
          'files',
        ],
        [
          'position',
          'pull_request',
          'base_ref',
          'base_sha',
          'head_ref',
          'head_sha',
          'title',
          'files',
        ],
        reasons,
        `stack layer ${position}`
      )
    ) {
      return false
    }
    if (layer?.position !== position) {
      return fail(reasons, `layer ${position} position is not ${position}`)
    }
    if (layer?.pull_request !== order[index]) {
      return fail(
        reasons,
        `layer ${position} pull_request does not match stack_order`
      )
    }
    if (
      !checkInteger(
        layer?.pull_request,
        reasons,
        `layer ${position} pull_request`,
        {
          min: 1,
        }
      ) ||
      !checkString(layer?.base_ref, reasons, `layer ${position} base_ref`, {
        min: 1,
      }) ||
      !checkString(layer?.base_sha, reasons, `layer ${position} base_sha`, {
        min: 40,
        max: 40,
      }) ||
      !HEX_SHA.test(layer?.base_sha ?? '') ||
      !checkString(layer?.head_ref, reasons, `layer ${position} head_ref`, {
        min: 1,
      }) ||
      !checkString(layer?.head_sha, reasons, `layer ${position} head_sha`, {
        min: 40,
        max: 40,
      }) ||
      !HEX_SHA.test(layer?.head_sha ?? '') ||
      !checkString(layer?.title, reasons, `layer ${position} title`, {
        min: 1,
      })
    ) {
      return false
    }
    if (index === 0) {
      if (layer.base_ref !== ultimate.ref || layer.base_sha !== ultimate.sha) {
        return fail(
          reasons,
          'layer 1 must sit directly on the ultimate base ref and sha'
        )
      }
    } else if (
      layer.base_ref !== layers[index - 1].head_ref ||
      layer.base_sha !== layers[index - 1].head_sha
    ) {
      return fail(
        reasons,
        'layer ' +
          position +
          ' must sit exactly on layer ' +
          index +
          ' head ref and sha'
      )
    }
    const files = layer?.files
    if (!Array.isArray(files) || files.length === 0) {
      return fail(reasons, `layer ${position} must carry at least one file`)
    }
    for (const file of files) {
      if (
        !checkExactKeys(
          file,
          ['filename', 'status', 'additions', 'deletions'],
          ['filename', 'status', 'additions', 'deletions'],
          reasons,
          `stack layer ${position} file`
        )
      ) {
        return false
      }
      if (
        !checkString(file?.filename, reasons, `layer ${position} filename`, {
          min: 1,
          max: 500,
        }) ||
        !checkString(file?.status, reasons, `layer ${position} status`, {
          min: 1,
        }) ||
        !checkInteger(
          file?.additions,
          reasons,
          `layer ${position} additions`
        ) ||
        !checkInteger(file?.deletions, reasons, `layer ${position} deletions`)
      ) {
        return false
      }
      const entry = pathIndex.get(file.filename) ?? {
        additions: 0,
        deletions: 0,
        layers: [],
      }
      entry.additions += file.additions
      entry.deletions += file.deletions
      if (!entry.layers.includes(position)) entry.layers.push(position)
      pathIndex.set(file.filename, entry)
    }
  }
  if (!Array.isArray(stack.path_index) || stack.path_index.length === 0) {
    return fail(reasons, 'stack path_index must be a non-empty array')
  }
  if (stack.path_index.length !== pathIndex.size) {
    return fail(reasons, 'stack path_index must cover every changed path once')
  }
  const indexedFilenames = new Set()
  for (const entry of stack.path_index) {
    if (
      !checkExactKeys(
        entry,
        ['filename', 'additions', 'deletions', 'layers'],
        ['filename', 'additions', 'deletions', 'layers'],
        reasons,
        'stack path_index entry'
      )
    ) {
      return false
    }
    if (indexedFilenames.has(entry?.filename)) {
      return fail(reasons, `stack path_index repeats ${entry.filename}`)
    }
    indexedFilenames.add(entry?.filename)
    const computed = pathIndex.get(entry?.filename)
    if (
      !computed ||
      entry?.additions !== computed.additions ||
      entry?.deletions !== computed.deletions ||
      JSON.stringify(entry?.layers) !== JSON.stringify(computed.layers)
    ) {
      return fail(
        reasons,
        `stack path_index entry for ${entry?.filename} is inconsistent`
      )
    }
  }
  return {
    layer_count: layers.length,
    path_owners: new Map(
      [...pathIndex.entries()].map(([filename, entry]) => [
        filename,
        entry.layers,
      ])
    ),
  }
}

function validateFixture(fixture, reasons) {
  if (
    !checkExactKeys(
      fixture,
      [
        'schema_version',
        'scenario',
        'expected_outcome',
        'expected_adjudication',
        'review',
        'notes',
      ],
      [
        'schema_version',
        'scenario',
        'expected_outcome',
        'expected_adjudication',
        'review',
        'notes',
      ],
      reasons,
      'fixture'
    )
  ) {
    return false
  }
  if (fixture?.schema_version !== FIXTURE_SCHEMA) {
    return fail(reasons, `fixture schema_version must be ${FIXTURE_SCHEMA}`)
  }
  if (
    !checkString(fixture.scenario, reasons, 'scenario', { min: 1, max: 80 })
  ) {
    return false
  }
  if (!OUTCOMES.has(fixture.expected_outcome)) {
    return fail(reasons, 'expected_outcome must be accepts or fails-closed')
  }
  if (
    fixture.expected_adjudication != null &&
    !ADJUDICATIONS.has(fixture.expected_adjudication)
  ) {
    return fail(reasons, 'expected_adjudication is not a known label')
  }
  if (!checkString(fixture.notes, reasons, 'notes', { min: 1 })) {
    return false
  }
  if (!validateReview(fixture.review, reasons)) {
    return false
  }
  const stack = fixture.review.stack
  if (
    Object.hasOwn(fixture.review, 'stack') &&
    !checkObject(stack, reasons, 'review stack')
  ) {
    return false
  }
  let stackContext = null
  if (stack != null) {
    stackContext = validateStack(stack, reasons)
    if (!stackContext) return false
  }
  const { comments } = fixture.review
  for (let index = 0; index < comments.length; index += 1) {
    if (
      !validateFindingComment(comments[index], index, reasons, {
        stack: stackContext,
      })
    ) {
      return false
    }
  }
  return true
}

function adjudicate(review) {
  const dispositions = new Set(
    review.comments.map((comment) => comment.expected_disposition)
  )
  if (dispositions.has('blocker')) return 'blocker'
  if (dispositions.has('follow-up')) return 'follow-up'
  if (dispositions.has('rejected')) return 'rejected'
  return 'clean'
}

function evaluate(fixture) {
  const reasons = []
  const valid = validateFixture(fixture, reasons)
  const review = fixture?.review ?? {}
  return {
    valid,
    reasons,
    adjudication: valid ? adjudicate(review) : null,
    expected_adjudication: fixture?.expected_adjudication ?? null,
    expected_outcome: fixture?.expected_outcome ?? null,
  }
}

function loadFixtures(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const file = path.join(directory, name)
      try {
        return { name, fixture: JSON.parse(fs.readFileSync(file, 'utf8')) }
      } catch (error) {
        return { name, error: String(error.message ?? error) }
      }
    })
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

function reviewTokenTotals(loaded) {
  return loaded.reduce(
    (totals, entry) => {
      const summary = entry.fixture?.review?.summary
      if (
        !summary ||
        !['input_tokens', 'output_tokens', 'total_tokens'].every(
          (key) => Number.isSafeInteger(summary[key]) && summary[key] >= 0
        )
      ) {
        return totals
      }
      totals.input_tokens += summary.input_tokens
      totals.output_tokens += summary.output_tokens
      totals.total_tokens += summary.total_tokens
      return totals
    },
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  )
}

function runQualification(directory) {
  const startedAt = process.hrtime.bigint()
  const loaded = loadFixtures(directory)
  const results = []
  let failed = 0
  for (const entry of loaded) {
    if (entry.fixture == null) {
      results.push({
        name: entry.name,
        valid: false,
        adjudication: null,
        reasons: [`fixture is not parseable JSON: ${entry.error}`],
        matched: false,
        expected_adjudication: null,
        expected_outcome: null,
        fixture_digest: null,
      })
      failed += 1
      continue
    }
    const evaluation = evaluate(entry.fixture)
    const outcomeMatched =
      (evaluation.expected_outcome === 'fails-closed' && !evaluation.valid) ||
      (evaluation.expected_outcome === 'accepts' && evaluation.valid)
    const adjudicationMatched =
      evaluation.adjudication === evaluation.expected_adjudication
    const matched = outcomeMatched && adjudicationMatched
    if (!matched) failed += 1
    results.push({
      name: entry.name,
      valid: evaluation.valid,
      adjudication: evaluation.adjudication,
      reasons: evaluation.reasons,
      matched,
      expected_adjudication: evaluation.expected_adjudication,
      expected_outcome: evaluation.expected_outcome,
      fixture_digest: sha256(canonicalJson(entry.fixture)),
    })
  }
  const runtimeMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
  const matchedCount = results.filter((result) => result.matched).length
  return {
    digest: suiteDigest(results),
    failed,
    metrics: {
      fixture_count: results.length,
      matched_count: matchedCount,
      false_blocker_fixtures: results.filter(
        (result) => result.expected_adjudication === 'rejected'
      ).length,
      runtime_ms: Math.round(runtimeMs * 1000) / 1000,
      token_totals: reviewTokenTotals(loaded),
      first_trigger_success: null,
      github_action_minutes: null,
      cost_usd: null,
    },
    results,
    total: results.length,
  }
}

function suiteDigest(results) {
  return sha256(
    canonicalJson(
      results.map((result) => ({
        adjudication: result.adjudication,
        expected_adjudication: result.expected_adjudication,
        expected_outcome: result.expected_outcome,
        fixture_digest: result.fixture_digest,
        matched: result.matched,
        name: result.name,
        reasons: result.reasons,
        valid: result.valid,
      }))
    )
  )
}

function render(results) {
  const lines = []
  for (const result of results) {
    lines.push(
      [
        result.name,
        result.valid ? 'valid' : 'invalid',
        result.adjudication ?? '-',
        result.matched ? 'ok' : 'MISMATCH',
      ].join(' ')
    )
    for (const reason of result.reasons ?? []) {
      lines.push(`  - ${reason}`)
    }
  }
  return lines.join('\n')
}

module.exports = {
  ADJUDICATIONS,
  FIXTURE_SCHEMA,
  OCR_SCHEMA,
  OUTCOMES,
  STACK_SCHEMA,
  adjudicate,
  evaluate,
  loadFixtures,
  render,
  runQualification,
  sha256,
  validateFixture,
  validateFindingComment,
  validateReview,
  validateStack,
}

if (require.main === module) {
  const directory = process.argv[2] ?? path.join(__dirname, 'fixtures')
  const suite = runQualification(directory)
  console.log(render(suite.results))
  console.log(
    'digest ' +
      suite.digest +
      ' fixtures ' +
      suite.total +
      ' failed ' +
      suite.failed
  )
  console.log(`metrics ${JSON.stringify(suite.metrics)}`)
  console.log(
    'live metrics unavailable: first_trigger_success, github_action_minutes, cost_usd'
  )
  process.exitCode = suite.failed > 0 ? 1 : 0
}
