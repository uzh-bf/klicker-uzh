import { createHmac, randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, extname, join, resolve } from 'path'

type CliArgs = Record<string, string | boolean>

type DialogTurn = {
  role: 'teacher' | 'student' | 'assistant' | 'system'
  content: string
}

type SourceMaterial = {
  id: string
  title?: string
  url?: string
  text: string
}

type RubricCriterion =
  | 'issue_diagnosis'
  | 'pedagogical_move'
  | 'scaffolding_quality'
  | 'question_quality'
  | 'answer_leakage_control'
  | 'correctness'
  | 'tone_and_clarity'
  | 'grounding'

type RubricItem = {
  criterion: RubricCriterion
  weight: number
  description?: string
}

type GenericTutorCase = {
  id: string
  source?: string
  domain: string
  subdomain?: string
  task: string
  sourceMaterial?: SourceMaterial[]
  dialogHistory: DialogTurn[]
  studentAttempt: string
  studentState?: string
  learningObjective: string
  expertSolution?: string
  expectedOutcome?: unknown
  goldDiagnosis?: {
    isCorrect?: boolean
    firstIssueStep?: number | null
    firstIssue?: string
    misconception?: string
    missingConcept?: string
  }
  goldNextMove?: string
  goldTutorResponse?: string
  allowedDisclosure: 'hint_only' | 'micro_step' | 'full_solution_allowed'
  constraints?: {
    language?: string
    maxQuestions?: number
    maxSentences?: number
    requiresCitation?: boolean
    forbidFinalAnswer?: boolean
    outputFormat?: string
  }
  rubric: RubricItem[]
  metadata?: Record<string, unknown>
}

type UiStreamPart = {
  type: string
  delta?: string
  text?: string
  errorText?: string
  messageMetadata?: {
    creditsUsed?: number | null
    modelId?: string | null
    chatMode?: string | null
    reasoningEffort?: string | null
  }
}

type RubricScore = {
  criterion: RubricCriterion
  weight: number
  score: number | null
  weightedScore: number | null
  status: 'scored' | 'manual_review'
  reason: string
}

type CaseResult = {
  caseId: string
  domain: string
  subdomain: string | null
  prompt: string
  response: string
  finishMetadata: UiStreamPart['messageMetadata'] | null
  userMessageId: string | null
  assistantMessageId: string | null
  score: ReturnType<typeof scoreRubric>
}

const DEFAULT_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const DEFAULT_PARTICIPANT_ID = '6f45065c-667f-4259-818c-c6f6b477eb48'

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {}
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
      existsSync(join(current, 'packages/prisma-data'))
    ) {
      return current
    }
    current = resolve(current, '..')
  }
  throw new Error('Could not find repository root')
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function envValue(name: string, fallback: string): string {
  return process.env[name] && process.env[name]!.length > 0
    ? process.env[name]!
    : fallback
}

function base64url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function signParticipantToken({
  appSecret,
  participantId,
}: {
  appSecret: string
  participantId: string
}) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      sub: participantId,
      role: 'PARTICIPANT',
      iat: now,
      exp: now + 7200,
    })
  )
  const signature = createHmac('sha256', appSecret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${header}.${payload}.${signature}`
}

function loadCases(path: string): GenericTutorCase[] {
  const source = readFileSync(path, 'utf-8').trim()
  if (!source) throw new Error(`Cases file is empty: ${path}`)

  const parsed =
    extname(path) === '.jsonl'
      ? source
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : JSON.parse(source)

  const cases = Array.isArray(parsed) ? parsed : [parsed]
  return cases.map((entry, index) => validateCase(entry, `${path}[${index}]`))
}

function validateCase(value: unknown, label: string): GenericTutorCase {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  const item = value as Partial<GenericTutorCase>
  const requiredStrings: Array<keyof GenericTutorCase> = [
    'id',
    'domain',
    'task',
    'studentAttempt',
    'learningObjective',
    'allowedDisclosure',
  ]
  for (const key of requiredStrings) {
    if (typeof item[key] !== 'string' || item[key].length === 0) {
      throw new Error(`${label}.${String(key)} must be a non-empty string`)
    }
  }
  if (!Array.isArray(item.dialogHistory)) {
    throw new Error(`${label}.dialogHistory must be an array`)
  }
  if (!Array.isArray(item.rubric) || item.rubric.length === 0) {
    throw new Error(`${label}.rubric must be a non-empty array`)
  }
  for (const [index, criterion] of item.rubric.entries()) {
    if (
      !criterion ||
      typeof criterion !== 'object' ||
      typeof criterion.criterion !== 'string' ||
      typeof criterion.weight !== 'number'
    ) {
      throw new Error(`${label}.rubric[${index}] is invalid`)
    }
  }
  return item as GenericTutorCase
}

function formatDialogHistory(turns: DialogTurn[]) {
  return turns
    .map((turn) => `${turn.role}: ${turn.content}`)
    .filter(Boolean)
    .join('\n')
}

function formatSourceMaterial(sourceMaterial: SourceMaterial[] | undefined) {
  if (!sourceMaterial || sourceMaterial.length === 0) return ''

  return sourceMaterial
    .map((source) => {
      const title = source.title ? ` (${source.title})` : ''
      const url = source.url ? `\nURL: ${source.url}` : ''
      return `Source ${source.id}${title}:${url}\n${source.text}`
    })
    .join('\n\n')
}

function disclosureInstruction(
  disclosure: GenericTutorCase['allowedDisclosure']
) {
  if (disclosure === 'full_solution_allowed') {
    return 'A complete solution is allowed if it best serves the learner.'
  }
  if (disclosure === 'micro_step') {
    return 'You may show one worked micro-step, but do not complete the whole task.'
  }
  return 'Give a hint or scaffold only; do not reveal the final answer.'
}

function buildTutorRuntimeMessage(testCase: GenericTutorCase) {
  const constraints = testCase.constraints ?? {}
  const parts = [
    'TutorBench evaluation case. Respond as the student-facing tutor, not as a grader.',
    `Domain: ${testCase.domain}${testCase.subdomain ? ` / ${testCase.subdomain}` : ''}`,
    `Learning objective: ${testCase.learningObjective}`,
    `Allowed disclosure: ${testCase.allowedDisclosure}. ${disclosureInstruction(
      testCase.allowedDisclosure
    )}`,
    constraints.language ? `Required language: ${constraints.language}` : '',
    Number.isFinite(constraints.maxQuestions)
      ? `Ask at most ${constraints.maxQuestions} question(s).`
      : '',
    Number.isFinite(constraints.maxSentences)
      ? `Use at most ${constraints.maxSentences} sentence(s).`
      : '',
    constraints.requiresCitation
      ? 'Use the provided source material and cite it.'
      : '',
    constraints.outputFormat
      ? `Output format: ${constraints.outputFormat}`
      : '',
    '',
    'Task:',
    testCase.task,
    '',
    testCase.sourceMaterial && testCase.sourceMaterial.length > 0
      ? [
          'Source material:',
          formatSourceMaterial(testCase.sourceMaterial),
        ].join('\n')
      : '',
    '',
    'Dialogue so far:',
    formatDialogHistory(testCase.dialogHistory),
    '',
    'Current student attempt or request:',
    testCase.studentAttempt,
    '',
    'Tutor response:',
  ]

  return parts.filter((part) => part.length > 0).join('\n')
}

async function readUiStream(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('chat-api response body is missing')

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let finish: UiStreamPart | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim() || line === 'data: [DONE]') continue
      const raw = line.startsWith('data: ') ? line.slice(6) : line
      const part = JSON.parse(raw) as UiStreamPart
      if (part.type === 'text-delta') {
        text += part.delta ?? part.text ?? ''
      } else if (part.type === 'finish') {
        finish = part
      } else if (part.type === 'error') {
        throw new Error(part.errorText ?? 'chat-api stream returned an error')
      }
    }
  }

  return { text, finish }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function callChatApi({
  chatApiBaseUrl,
  chatbotId,
  participantId,
  selectedModel,
  selectedMode,
  appSecret,
  message,
  timeoutMs,
}: {
  chatApiBaseUrl: string
  chatbotId: string
  participantId: string
  selectedModel: string
  selectedMode: string
  appSecret: string
  message: string
  timeoutMs: number
}) {
  const userMessageId = randomUUID()
  const assistantMessageId = randomUUID()
  const response = await fetchWithTimeout(
    `${chatApiBaseUrl.replace(/\/$/, '')}/api/chatbots/${chatbotId}/chat`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `participant_token=${signParticipantToken({
          appSecret,
          participantId,
        })}`,
      },
      body: JSON.stringify({
        messages: [
          {
            id: userMessageId,
            role: 'user',
            content: message,
          },
        ],
        threadId: null,
        selectedModel,
        selectedMode,
        reasoningEffort: 'none',
        assistantMessageId,
        images: [],
      }),
    },
    timeoutMs
  )

  if (!response.ok) {
    throw new Error(
      `chat-api returned HTTP ${response.status}: ${await response.text()}`
    )
  }

  return {
    userMessageId,
    assistantMessageId,
    ...(await readUiStream(response)),
  }
}

function countQuestions(text: string) {
  return (text.match(/\?/g) ?? []).length
}

function countSentences(text: string) {
  const matches = text.trim().match(/[^.!?]+[.!?]+/g)
  if (!matches || matches.length === 0) return text.trim() ? 1 : 0
  return matches.length
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function metadataStringArray(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const raw = metadata?.[key]
  return Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === 'string')
    : []
}

function containsExpectedOutcome(testCase: GenericTutorCase, text: string) {
  if (testCase.constraints?.forbidFinalAnswer !== true) return false
  const expected = testCase.expectedOutcome
  if (typeof expected === 'number' && Number.isFinite(expected)) {
    const escaped = String(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^\\d.])${escaped}([^\\d.]|$)`).test(text)
  }
  if (typeof expected === 'string' && expected.trim().length >= 2) {
    return normalizeText(text).includes(normalizeText(expected))
  }
  return false
}

function languageLooksOk(language: string | undefined, text: string) {
  if (!language) return true
  const normalized = language.toLowerCase()
  if (normalized.startsWith('en')) {
    return !/\b(lass|dein|deine|nicht|schritt|rechenweg|kerzen|fahrr|wie viele|lösung)\b/i.test(
      text
    )
  }
  if (normalized.startsWith('de')) {
    return /\b(der|die|das|und|nicht|wie|was|schritt|lösung)\b/i.test(text)
  }
  return true
}

function citationLooksOk(testCase: GenericTutorCase, text: string) {
  if (testCase.constraints?.requiresCitation !== true) return true
  return /https?:\/\/|\bsource\b|\breference\b|\bquelle\b|\[[^\]]+\]/i.test(
    text
  )
}

function keywordCoverage(expectedKeywords: string[], text: string) {
  if (expectedKeywords.length === 0) return null
  const normalized = normalizeText(text)
  const matches = expectedKeywords.filter((keyword) =>
    normalized.includes(normalizeText(keyword))
  )
  return matches.length / expectedKeywords.length
}

function forbiddenKeywordPenalty(forbiddenKeywords: string[], text: string) {
  if (forbiddenKeywords.length === 0) return null
  const normalized = normalizeText(text)
  const hits = forbiddenKeywords.filter((keyword) =>
    normalized.includes(normalizeText(keyword))
  )
  return hits.length === 0 ? 1 : 0
}

function scoreRubric(testCase: GenericTutorCase, responseText: string) {
  const questionCount = countQuestions(responseText)
  const sentenceCount = countSentences(responseText)
  const leakedFinalAnswer = containsExpectedOutcome(testCase, responseText)
  const languageOk = languageLooksOk(
    testCase.constraints?.language,
    responseText
  )
  const citationOk = citationLooksOk(testCase, responseText)
  const expectedKeywords = metadataStringArray(
    testCase.metadata,
    'expectedResponseKeywords'
  )
  const forbiddenKeywords = metadataStringArray(
    testCase.metadata,
    'forbiddenResponseKeywords'
  )

  const scores: RubricScore[] = testCase.rubric.map((item) => {
    let score: number | null = null
    let reason = 'Needs semantic review.'

    if (item.criterion === 'question_quality') {
      const maxQuestions = testCase.constraints?.maxQuestions
      if (maxQuestions === 0) {
        score = questionCount === 0 ? 1 : 0
      } else if (typeof maxQuestions === 'number') {
        score = questionCount > 0 && questionCount <= maxQuestions ? 1 : 0
      } else {
        score = questionCount > 0 ? 1 : 0
      }
      reason = `questionCount=${questionCount}`
    } else if (item.criterion === 'answer_leakage_control') {
      score = leakedFinalAnswer ? 0 : 1
      reason = leakedFinalAnswer
        ? 'Response appears to reveal the expected final answer.'
        : 'No expected final-answer leakage detected.'
    } else if (item.criterion === 'tone_and_clarity') {
      const maxSentences = testCase.constraints?.maxSentences
      score =
        responseText.trim().length > 0 &&
        (typeof maxSentences !== 'number' || sentenceCount <= maxSentences)
          ? 1
          : 0
      reason = `sentenceCount=${sentenceCount}`
    } else if (item.criterion === 'grounding') {
      score = citationOk ? 1 : 0
      reason = citationOk
        ? 'Citation requirement satisfied or not required.'
        : 'Citation required but not detected.'
    } else if (
      ['issue_diagnosis', 'scaffolding_quality', 'pedagogical_move'].includes(
        item.criterion
      )
    ) {
      const coverage = keywordCoverage(expectedKeywords, responseText)
      if (coverage !== null) {
        score = coverage
        reason = `expected keyword coverage=${coverage.toFixed(2)}`
      }
    } else if (item.criterion === 'correctness') {
      const penalty = forbiddenKeywordPenalty(forbiddenKeywords, responseText)
      if (penalty !== null) {
        score = penalty
        reason =
          penalty === 1
            ? 'No forbidden correctness keywords detected.'
            : 'Forbidden correctness keyword detected.'
      }
    }

    if (score !== null && item.criterion !== 'grounding' && !languageOk) {
      score = Math.min(score, 0.5)
      reason += '; language constraint may be violated.'
    }

    return {
      criterion: item.criterion,
      weight: item.weight,
      score,
      weightedScore: score === null ? null : score * item.weight,
      status: score === null ? 'manual_review' : 'scored',
      reason,
    }
  })

  const scoredWeight = scores.reduce(
    (sum, score) => sum + (score.score === null ? 0 : score.weight),
    0
  )
  const pendingWeight = scores.reduce(
    (sum, score) => sum + (score.score === null ? score.weight : 0),
    0
  )
  const weightedScore = scores.reduce(
    (sum, score) => sum + (score.weightedScore ?? 0),
    0
  )

  return {
    deterministic: {
      questionCount,
      sentenceCount,
      leakedFinalAnswer,
      languageOk,
      citationOk,
    },
    rubricScores: scores,
    totals: {
      scoredWeight,
      pendingWeight,
      weightedScore,
      normalizedScore: scoredWeight > 0 ? weightedScore / scoredWeight : null,
    },
  }
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repoRoot = findRepoRoot(process.cwd())
  const dryRun = args['dry-run'] === true
  const casesPath =
    typeof args.cases === 'string'
      ? resolve(args.cases)
      : join(repoRoot, 'project/evals/tutor-generic/cases.json')
  const runId =
    typeof args['run-id'] === 'string' && args['run-id'].length > 0
      ? args['run-id']
      : timestamp()
  const outputRoot = resolve(
    repoRoot,
    typeof args['output-dir'] === 'string'
      ? args['output-dir']
      : join('project/evals/results', runId, 'generic-tutorbench')
  )
  const maxCases =
    typeof args['max-cases'] === 'string' ? Number(args['max-cases']) : null
  const timeoutMs =
    typeof args['timeout-ms'] === 'string' ? Number(args['timeout-ms']) : 180000

  if (maxCases !== null && (!Number.isInteger(maxCases) || maxCases < 1)) {
    throw new Error('--max-cases must be a positive integer')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) {
    throw new Error('--timeout-ms must be an integer >= 1000')
  }

  const cases = loadCases(casesPath).slice(0, maxCases ?? undefined)
  mkdirSync(outputRoot, { recursive: true })

  const chatApiBaseUrl = envValue(
    'TUTORBENCH_CHAT_API_BASE_URL',
    'http://127.0.0.1:3305'
  )
  const chatbotId = envValue('TUTORBENCH_CHATBOT_ID', DEFAULT_CHATBOT_ID)
  const participantId = envValue(
    'TUTORBENCH_PARTICIPANT_ID',
    DEFAULT_PARTICIPANT_ID
  )
  const selectedModel = envValue('TUTORBENCH_SELECTED_MODEL', 'local-e2e-model')
  const selectedMode = envValue('TUTORBENCH_SELECTED_MODE', 'tutor')
  const appSecret = dryRun ? null : requireEnv('APP_SECRET')

  const caseResults: CaseResult[] = []
  for (const testCase of cases) {
    const prompt = buildTutorRuntimeMessage(testCase)
    const response = dryRun
      ? {
          userMessageId: null,
          assistantMessageId: null,
          text: '',
          finish: null,
        }
      : await callChatApi({
          chatApiBaseUrl,
          chatbotId,
          participantId,
          selectedModel,
          selectedMode,
          appSecret: appSecret!,
          message: prompt,
          timeoutMs,
        })

    const score = scoreRubric(testCase, response.text)
    caseResults.push({
      caseId: testCase.id,
      domain: testCase.domain,
      subdomain: testCase.subdomain ?? null,
      prompt,
      response: response.text,
      finishMetadata: response.finish?.messageMetadata ?? null,
      userMessageId: response.userMessageId,
      assistantMessageId: response.assistantMessageId,
      score,
    })
  }

  const scored = caseResults.filter(
    (result) => result.score.totals.normalizedScore !== null
  )
  const summary = {
    runId,
    dryRun,
    casesPath,
    caseCount: caseResults.length,
    scoredCaseCount: scored.length,
    averageNormalizedScore:
      scored.length > 0
        ? scored.reduce(
            (sum, result) => sum + result.score.totals.normalizedScore!,
            0
          ) / scored.length
        : null,
    byDomain: Object.fromEntries(
      Array.from(new Set(caseResults.map((result) => result.domain))).map(
        (domain) => {
          const domainResults = caseResults.filter(
            (result) => result.domain === domain
          )
          const domainScored = domainResults.filter(
            (result) => result.score.totals.normalizedScore !== null
          )
          return [
            domain,
            {
              caseCount: domainResults.length,
              averageNormalizedScore:
                domainScored.length > 0
                  ? domainScored.reduce(
                      (sum, result) =>
                        sum + result.score.totals.normalizedScore!,
                      0
                    ) / domainScored.length
                  : null,
            },
          ]
        }
      )
    ),
  }

  writeJson(join(outputRoot, 'manifest.json'), {
    runId,
    dryRun,
    casesPath,
    caseFile: basename(casesPath),
    chatApiBaseUrl,
    chatbotId,
    participantId,
    selectedModel,
    selectedMode,
    timeoutMs,
    command: process.argv.map((part) =>
      part.toLowerCase().includes('key') ? '<redacted>' : part
    ),
  })
  writeFileSync(
    join(outputRoot, 'cases.jsonl'),
    `${caseResults.map((result) => JSON.stringify(result)).join('\n')}\n`,
    'utf-8'
  )
  writeJson(join(outputRoot, 'summary.json'), summary)

  console.log(`Generic TutorBench ${dryRun ? 'dry run' : 'run'} complete`)
  console.log(outputRoot)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
