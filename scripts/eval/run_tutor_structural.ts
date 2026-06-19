import {
  evaluateTutorMemoryGate,
  runTutorVerifierPreflight,
  selectTutorMovePolicy,
  verifyTutorOutputText,
  type TutorPolicyState,
} from '@klicker-uzh/chat-engine'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

type EvalCase = {
  id: string
  suite: string
  kind: 'policy' | 'preflight' | 'verifier' | 'memory'
  state?: TutorPolicyState
  latestUserMessage?: string
  outputText?: string
  retrievedEvidenceIds?: string[]
  memoryGate?: Parameters<typeof evaluateTutorMemoryGate>[0]
  expectDirectiveIncludes?: string[]
  expectFailures?: string[]
  expectStatus?: string
  expectMissingRequirements?: string[]
}

type EvalResult = {
  id: string
  suite: string
  passed: boolean
  failures: string[]
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    i += 1
  }
  return args
}

function findRepoRoot(start: string): string {
  let current = resolve(start)
  while (current !== '/') {
    if (
      existsSync(join(current, 'package.json')) &&
      existsSync(join(current, 'packages/chat-engine'))
    ) {
      return current
    }
    current = resolve(current, '..')
  }
  throw new Error('Could not find repository root')
}

function assertState(testCase: EvalCase): TutorPolicyState {
  if (!testCase.state) throw new Error(`${testCase.id}: missing state`)
  return testCase.state
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function evaluateCase(testCase: EvalCase): EvalResult {
  const failures: string[] = []

  if (testCase.kind === 'policy') {
    const policy = selectTutorMovePolicy(assertState(testCase))
    for (const expected of testCase.expectDirectiveIncludes ?? []) {
      if (
        !policy.directives.some((directive) => directive.includes(expected))
      ) {
        failures.push(`missing directive: ${expected}`)
      }
    }
  }

  if (testCase.kind === 'preflight') {
    const result = runTutorVerifierPreflight({
      state: assertState(testCase),
      latestUserMessage: testCase.latestUserMessage ?? '',
    })
    for (const expected of testCase.expectFailures ?? []) {
      if (!result.failures.includes(expected as never)) {
        failures.push(`missing preflight failure: ${expected}`)
      }
    }
  }

  if (testCase.kind === 'verifier') {
    const result = verifyTutorOutputText({
      state: assertState(testCase),
      text: testCase.outputText ?? '',
      retrievedEvidenceIds: testCase.retrievedEvidenceIds ?? [],
    })
    for (const expected of testCase.expectFailures ?? []) {
      if (!result.failures.includes(expected as never)) {
        failures.push(`missing verifier failure: ${expected}`)
      }
    }
    if ((testCase.expectFailures ?? []).length === 0 && !result.passed) {
      failures.push(
        `unexpected verifier failures: ${result.failures.join(', ')}`
      )
    }
  }

  if (testCase.kind === 'memory') {
    if (!testCase.memoryGate)
      throw new Error(`${testCase.id}: missing memoryGate`)
    const decision = evaluateTutorMemoryGate(testCase.memoryGate)
    if (decision.status !== testCase.expectStatus) {
      failures.push(`status ${decision.status} !== ${testCase.expectStatus}`)
    }
    const expectedMissing = testCase.expectMissingRequirements ?? []
    if (!arraysEqual(decision.missingRequirements, expectedMissing)) {
      failures.push(
        `missing requirements ${decision.missingRequirements.join(',')} !== ${expectedMissing.join(',')}`
      )
    }
  }

  return {
    id: testCase.id,
    suite: testCase.suite,
    passed: failures.length === 0,
    failures,
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const repoRoot = findRepoRoot(process.cwd())
  const casesPath =
    typeof args.cases === 'string'
      ? resolve(args.cases)
      : join(repoRoot, 'project/evals/tutor-local/cases.json')
  const runId =
    typeof args['run-id'] === 'string'
      ? args['run-id']
      : new Date().toISOString().replace(/[:.]/g, '-')
  const cases = JSON.parse(readFileSync(casesPath, 'utf-8')) as EvalCase[]
  const results = cases.map(evaluateCase)
  const passed = results.filter((result) => result.passed).length
  const failed = results.length - passed
  const report = { runId, casesPath, passed, failed, results }

  if (args['no-write'] !== true) {
    const outputDir = join(repoRoot, 'project/evals/results')
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(
      join(outputDir, `tutor-structural-${runId}.json`),
      `${JSON.stringify(report, null, 2)}\n`
    )
  }

  console.log(JSON.stringify({ runId, passed, failed }, null, 2))
  if (failed > 0) process.exit(1)
}

main()
