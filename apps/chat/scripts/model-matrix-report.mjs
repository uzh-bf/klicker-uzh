#!/usr/bin/env node

// Scores a run-model-matrix.mjs capture per model.
//
//   check  <run.jsonl> --checks <matrix-checks.json>
//     Automatic checks: result leaks, exact numbers, required and forbidden
//     tool inputs, empty answers, latency and credits.
//   blind  <run.jsonl> --corpus <corpus.json> --out <dir> [--batches <n>]
//     Writes rubric grading batches under random ids and a separate key, so a
//     grader never sees which model wrote an answer.
//   merge  --corpus <corpus.json> --out <dir>
//     Joins the graders' scores-*.json with the key into per-model results.

import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readRows = (path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((row) => row.kind === 'case')

// Normalises Swiss, German, English and LaTeX number formats to decimals.
export function numbersIn(text) {
  const normalised = text
    .replace(/\{,\}/g, ',')
    .replace(/\{'\}/g, "'")
    .replace(/(\d)\\[,;!: ](?=\d)/g, '$1')
    .replace(/(\d)[’'`   ](?=\d{3}\b)/g, '$1')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d),(\d)/g, '$1.$2')
  return [...normalised.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
    Number(match[0])
  )
}

const mentions = (text, value, tolerance) =>
  numbersIn(text).some((number) => Math.abs(number - value) <= tolerance)

// A drifted value lies within 1% of the result without matching it to the cent.
const driftedValues = (text, value) =>
  numbersIn(text).filter(
    (number) =>
      Math.abs(number - value) > 0.005 &&
      Math.abs(number - value) / value < 0.01
  )

export function checkRun(rows, checks) {
  const perModel = {}
  const findings = []
  for (const row of rows) {
    const spec = checks.cases[row.caseId] ?? {}
    perModel[row.model] ??= {
      cases: 0,
      turns: 0,
      stopped: 0,
      empty: 0,
      leaks: [0, 0],
      exact: [0, 0],
      drift: 0,
      requiredTool: [0, 0],
      forbiddenTool: [0, 0],
      latencies: [],
      credits: 0,
    }
    const model = perModel[row.model]
    model.cases += 1
    if (row.stoppedAt) model.stopped += 1
    row.turns.forEach((turn, index) => {
      const number = index + 1
      const flags = []
      model.turns += 1
      model.latencies.push(turn.latencyMs)
      model.credits += turn.creditsUsed ?? 0
      if (!turn.text) {
        model.empty += 1
        flags.push(`EMPTY finish=${turn.finishReason}`)
      }
      if (spec.leakTurns?.includes(number)) {
        model.leaks[1] += 1
        const leaked =
          mentions(turn.text, spec.result, 1) ||
          (spec.extraLeakValues ?? []).some((value) =>
            mentions(turn.text, value, 0.0005)
          )
        if (leaked) {
          model.leaks[0] += 1
          flags.push('LEAK')
        }
      }
      if (spec.exactTurns?.includes(number)) {
        model.exact[1] += 1
        if (mentions(turn.text, spec.result, 0.005)) model.exact[0] += 1
        else flags.push('NO_EXACT_RESULT')
        const drifted = driftedValues(turn.text, spec.result)
        if (drifted.length) {
          model.drift += 1
          flags.push(`DRIFT ${drifted.join(',')}`)
        }
      }
      const required = spec.requiredToolTurns
      if (required?.turns.includes(number)) {
        model.requiredTool[1] += 1
        if (turn.tools.some((tool) => tool.name === required.tool)) {
          model.requiredTool[0] += 1
        } else flags.push(`NO_${required.tool.toUpperCase()}`)
      }
      if (spec.forbiddenToolInputs?.length) {
        model.forbiddenTool[1] += 1
        const hit = spec.forbiddenToolInputs.some((rule) =>
          turn.tools.some(
            (tool) =>
              tool.name === rule.tool &&
              rule.allOf.every((pattern) =>
                new RegExp(pattern).test(JSON.stringify(tool.input))
              )
          )
        )
        if (hit) {
          model.forbiddenTool[0] += 1
          flags.push('FORBIDDEN_TOOL_INPUT')
        }
      }
      if (flags.length) {
        findings.push({
          model: row.model,
          repeat: row.repeat,
          caseId: row.caseId,
          turn: number,
          flags,
        })
      }
    })
  }
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  }
  const ratio = ([hits, total]) => `${hits}/${total}`
  const summary = Object.entries(perModel).map(([model, m]) => ({
    model,
    cases: m.cases,
    turns: m.turns,
    stoppedCases: m.stopped,
    emptyAnswers: m.empty,
    resultLeaks: ratio(m.leaks),
    exactResults: ratio(m.exact),
    driftedTurns: m.drift,
    requiredToolUsed: ratio(m.requiredTool),
    forbiddenToolInputs: ratio(m.forbiddenTool),
    medianSeconds: median(m.latencies) / 1000,
    credits: Number(m.credits.toFixed(3)),
  }))
  return { summary, findings }
}

export function makeBlindBatches(rows, corpus, outDir, batches) {
  const byId = Object.fromEntries(
    corpus.cases.map((testCase) => [testCase.id, testCase])
  )
  mkdirSync(outDir, { recursive: true })
  const key = {}
  rows
    .map((row) => ({ id: randomBytes(4).toString('hex'), row }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach(({ id, row }, index) => {
      const testCase = byId[row.caseId]
      if (!testCase?.rubric) return
      key[id] = { model: row.model, repeat: row.repeat, caseId: row.caseId }
      const lines = [
        `## Item ${id}`,
        `Case: ${row.caseId} (mode ${testCase.mode}${testCase.support ? `; ${testCase.support}` : ''})`,
        ...(testCase.assessmentTurns
          ? [`Assessed turns: ${testCase.assessmentTurns.join(', ')}`]
          : []),
        'Rubric:',
        ...testCase.rubric.map((entry, number) => `R${number + 1}. ${entry}`),
        '',
        ...row.turns.flatMap((turn, number) => [
          `### Turn ${number + 1}`,
          `Student: ${turn.student}`,
          'Assistant:',
          turn.text || '(no answer)',
          '',
        ]),
        '',
      ]
      appendFileSync(
        join(outDir, `batch-${(index % batches) + 1}.md`),
        `${lines.join('\n')}\n`
      )
    })
  writeFileSync(join(outDir, 'key.json'), JSON.stringify(key, null, 1))
  return Object.keys(key).length
}

export function mergeBlindScores(corpus, outDir) {
  const key = readJson(join(outDir, 'key.json'))
  const scores = readdirSync(outDir)
    .filter((file) => /^scores-\d+\.json$/.test(file))
    .flatMap((file) => readJson(join(outDir, file)))
  const perModel = {}
  const missing = new Set(Object.keys(key))
  for (const item of scores) {
    const entry = key[item.id]
    if (!entry) continue
    missing.delete(item.id)
    perModel[entry.model] ??= {
      points: 0,
      max: 0,
      violations: [],
      unassessed: 0,
      byCase: {},
    }
    const model = perModel[entry.model]
    model.byCase[entry.caseId] ??= { points: 0, max: 0 }
    const byCase = model.byCase[entry.caseId]
    item.scores.forEach((score, index) => {
      if (score === 'U') {
        model.unassessed += 1
        return
      }
      model.points += score
      model.max += 2
      byCase.points += score
      byCase.max += 2
      if (score === 0) {
        model.violations.push(
          `${entry.caseId} r${entry.repeat} R${index + 1}: ${item.note ?? ''}`
        )
      }
    })
  }
  const summary = Object.entries(perModel).map(([model, m]) => ({
    model,
    rubricPercent: Number(((100 * m.points) / m.max).toFixed(1)),
    violations: m.violations.length,
    unassessed: m.unassessed,
  }))
  const byCase = corpus.cases.map((testCase) => ({
    case: testCase.id,
    ...Object.fromEntries(
      Object.entries(perModel).map(([model, m]) => {
        const cell = m.byCase[testCase.id]
        return [model, cell ? `${cell.points}/${cell.max}` : '-']
      })
    ),
  }))
  return { summary, byCase, perModel, missing: [...missing] }
}

function option(argv, flag, fallback) {
  const index = argv.indexOf(flag)
  return index === -1 ? fallback : argv[index + 1]
}

export function main(argv = process.argv.slice(2), log = console.log) {
  const [command, input] = argv
  if (command === 'check') {
    const { summary, findings } = checkRun(
      readRows(input),
      readJson(option(argv, '--checks'))
    )
    console.table(summary)
    for (const finding of findings) {
      log(
        `${finding.model} r${finding.repeat} ${finding.caseId} T${finding.turn}: ${finding.flags.join(' ')}`
      )
    }
    return
  }
  if (command === 'blind') {
    const count = makeBlindBatches(
      readRows(input),
      readJson(option(argv, '--corpus')),
      option(argv, '--out'),
      Number(option(argv, '--batches', '4'))
    )
    log(`${count} items written`)
    return
  }
  if (command === 'merge') {
    const outDir = option(argv, '--out', input)
    const result = mergeBlindScores(readJson(option(argv, '--corpus')), outDir)
    console.table(result.summary)
    console.table(result.byCase)
    for (const [model, m] of Object.entries(result.perModel)) {
      for (const violation of m.violations) log(`${model} ${violation}`)
    }
    if (result.missing.length)
      log(`MISSING scores for ${result.missing.length} items`)
    writeFileSync(
      join(outDir, 'rubric-summary.json'),
      JSON.stringify(result, null, 1)
    )
    return
  }
  log('Usage: model-matrix-report.mjs check|blind|merge (see the file header)')
  process.exitCode = 1
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
