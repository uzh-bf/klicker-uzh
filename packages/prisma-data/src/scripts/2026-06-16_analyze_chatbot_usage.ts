import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '@klicker-uzh/prisma'
import type { Prisma } from '@klicker-uzh/prisma/client'
import { assertLegacyMessageContentExportDisabled } from '../chatbot-analysis/reports.js'
import type { SheetValue, WorkbookSheet } from './lib/simpleWorkbook.js'
import {
  formatDate,
  sanitizeFilename,
  writeWorkbookFile,
} from './lib/simpleWorkbook.js'

type CliOptions = {
  all: boolean
  query?: string
  chatbotId?: string
  courseId?: string
  scopeLabel: string
  semester: string
  from: Date
  to: Date
  outDir: string
  filePrefix: string
  minTopicMessages: number
  minTopicParticipants: number
}

type ChatContentItem = {
  type?: unknown
  text?: unknown
  result?: unknown
  toolName?: unknown
  toolCallId?: unknown
}

type ModelConfig = {
  id: string
  name: string
  deploymentId?: string
  fallback?: boolean
  cost?: {
    input?: number
    output?: number
  }
}

type MessageRecord = {
  courseId: string
  courseName: string
  courseDisplayName: string | null
  chatbotId: string
  chatbotKey: string
  chatbotName: string
  threadId: string
  threadKey: string
  participantId: string
  participantKey: string
  messageId: string
  messageKey: string
  parentId: string | null
  role: string
  content: Prisma.JsonValue
  text: string
  textCharCount: number
  textWordCount: number
  estimatedTextTokens: number
  reasoningCharCount: number
  estimatedReasoningTokens: number
  messageCreatedAt: Date
  threadCreatedAt: Date
  threadUpdatedAt: Date
  chatMode: string | null
  modelId: string | null
  reasoningEffort: string | null
  reasoningContent: string | null
  rating: 'UP' | 'DOWN' | null
  creditsUsed: number | null
  attachmentCount: number
}

type CourseActivityMetrics = {
  participantCount: number
  responseCount: number
  responseTrialCount: number
  respondingParticipantCount: number
  windowResponseCount: number
  windowResponseTrialCount: number
  windowRespondingParticipantCount: number
}

type CostAnalysisConfig = {
  currency: string
  calibratedTotalCost: number | null
  modelCostMultipliers: Map<string, number>
}

type TopicAssignment = {
  messageKey: string
  chatbotId: string
  clusterLabel: string
  clusterId: string
  topTerms: string
  clusterSimilarity: number | null
}

type TopicClusterRow = {
  chatbotId: string
  clusterId: string
  label: string
  userMessages: number
  participants: number
  threads: number
  firstMessageAt: Date | null
  lastMessageAt: Date | null
  avgUserMessageWords: number
  estimatedVisibleTokens: number
  avgClusterSimilarity: number | null
  topTerms: string
}

type TopicTermRow = {
  chatbotId: string
  clusterId: string
  clusterLabel: string
  term: string
  kind: string
  rank: number
  score: number
  userMessages: number
  participants: number
  threads: number
}

type TopicDocument = {
  message: MessageRecord
  weightedTerms: Map<string, number>
  labelTerms: Map<string, number>
  vector: Map<string, number>
}

type TopicCluster = {
  chatbotId: string
  clusterId: string
  label: string
  documents: TopicDocument[]
  centroid: Map<string, number>
  topTerms: ClusterTerm[]
}

type ClusterTerm = {
  termKey: string
  label: string
  kind: string
  score: number
  userMessages: number
  participants: number
  threads: number
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../../../..')
const todayPrefix = new Date().toISOString().slice(0, 10)
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const DEFAULT_MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'gpt-4.1',
    deploymentId: 'gpt-4.1',
    name: 'GPT-4.1',
    fallback: false,
    cost: { input: 2.0, output: 8.0 },
  },
  {
    id: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    fallback: true,
    cost: { input: 0.4, output: 1.6 },
  },
]

const STOPWORDS = new Set([
  'aber',
  'abschnitt',
  'about',
  'after',
  'again',
  'all',
  'alle',
  'aller',
  'als',
  'also',
  'auch',
  'an',
  'are',
  'and',
  'any',
  'anything',
  'answer',
  'average',
  'antwort',
  'antworten',
  'angaben',
  'auf',
  'aufgabe',
  'aufgaben',
  'aus',
  'bei',
  'beim',
  'beispiel',
  'beispiele',
  'beispielsweise',
  'beantwor',
  'bedeutet',
  'bekannt',
  'bekomme',
  'berechnen',
  'berechnet',
  'berechnung',
  'berechne',
  'berechn',
  'berech',
  'bestimmt',
  'bis',
  'bitte',
  'but',
  'because',
  'between',
  'both',
  'can',
  'chapter',
  'che',
  'come',
  'con',
  'could',
  'cosa',
  'das',
  'darf',
  'dass',
  'data',
  'daten',
  'dem',
  'den',
  'der',
  'des',
  'die',
  'dies',
  'diese',
  'dieser',
  'dieses',
  'different',
  'do',
  'does',
  'don',
  'dazu',
  'dann',
  'danke',
  'durch',
  'each',
  'ein',
  'eine',
  'einem',
  'einen',
  'einer',
  'eines',
  'einfach',
  'folgend',
  'folgende',
  'folgenden',
  'folge',
  'folg',
  'gegeben',
  'erkläre',
  'erklären',
  'erklar',
  'erklart',
  'erklär',
  'erklärt',
  'etwas',
  'equal',
  'every',
  'explain',
  'exercises',
  'falsch',
  'for',
  'frac',
  'formula',
  'formel',
  'formeln',
  'für',
  'from',
  'frage',
  'fragen',
  'finde',
  'find',
  'first',
  'ganz',
  'genau',
  'genauer',
  'gebe',
  'geben',
  'geht',
  'gehen',
  'gemacht',
  'get',
  'give',
  'gibt',
  'gib',
  'gross',
  'habe',
  'haben',
  'hat',
  'has',
  'have',
  'hätte',
  'hello',
  'heisst',
  'heißt',
  'help',
  'helfen',
  'hilf',
  'hier',
  'here',
  'how',
  'ich',
  'im',
  'in',
  'ihnen',
  'immer',
  'intuitiv',
  'ist',
  'just',
  'kann',
  'kannst',
  'kapitel',
  'kein',
  'keine',
  'keinen',
  'klein',
  'know',
  'kommt',
  'können',
  'könntest',
  'korrekt',
  'kurze',
  'left',
  'large',
  'let',
  'like',
  'lös',
  'löse',
  'lösung',
  'loesung',
  'lösen',
  'loese',
  'mal',
  'mathcal',
  'mache',
  'machen',
  'man',
  'mat',
  'macht',
  'mehr',
  'meine',
  'meinen',
  'meiner',
  'mir',
  'mit',
  'more',
  'muss',
  'nehme',
  'nächste',
  'nächsten',
  'need',
  'nein',
  'nicht',
  'noch',
  'non',
  'not',
  'nun',
  'nur',
  'nummer',
  'number',
  'now',
  'oder',
  'oben',
  'okay',
  'one',
  'only',
  'ora',
  'other',
  'per',
  'please',
  'point',
  'punkt',
  'prozent',
  'potresti',
  'quell',
  'quelle',
  'quellen',
  'quindi',
  'question',
  'reichen',
  'recht',
  'right',
  'richtig',
  'really',
  'sagt',
  'seconds',
  'sei',
  'sein',
  'seite',
  'script',
  'sich',
  'sie',
  'sind',
  'so',
  'soll',
  'sollen',
  'some',
  'sorry',
  'stimmt',
  'sqrt',
  'should',
  'solution',
  'tipp',
  'tipps',
  'test',
  'the',
  'that',
  'than',
  'them',
  'they',
  'then',
  'think',
  'this',
  'thema',
  'topic',
  'und',
  'unterschied',
  'unten',
  'una',
  'uns',
  'unter',
  'understand',
  'über',
  'use',
  'used',
  'value',
  'values',
  'verwendet',
  'versteh',
  'verstehe',
  'verstehen',
  'von',
  'was',
  'weiss',
  'wenn',
  'wer',
  'what',
  'which',
  'where',
  'why',
  'wie',
  'wieso',
  'wichtig',
  'wichtigsten',
  'wir',
  'with',
  'would',
  'würde',
  'wäre',
  'warum',
  'weshalb',
  'wert',
  'welche',
  'welcher',
  'welches',
  'wird',
  'werden',
  'wollen',
  'wurde',
  'weil',
  'wann',
  'zwischen',
  'zusammen',
  'zeichen',
  'zwei',
  'you',
  'zum',
  'zur',
  'zurück',
])

const chatbotSelect = {
  id: true,
  name: true,
  modelSelection: true,
  allowedModelIds: true,
  creditInitialCredits: true,
  creditResetPeriod: true,
  creditResetAmount: true,
  creditMaxCredits: true,
  createdAt: true,
  updatedAt: true,
  course: {
    select: {
      id: true,
      name: true,
      displayName: true,
      startDate: true,
      endDate: true,
    },
  },
} as const satisfies Prisma.ChatbotSelect

const threadMessageSelect = {
  id: true,
  parentId: true,
  role: true,
  content: true,
  chatMode: true,
  modelId: true,
  reasoningEffort: true,
  reasoningContent: true,
  rating: true,
  creditsUsed: true,
  createdAt: true,
  attachments: {
    select: { id: true },
  },
} as const satisfies Prisma.ChatMessageSelect

type ChatbotRecord = {
  id: string
  name: string
  modelSelection: boolean
  allowedModelIds: string[]
  creditInitialCredits: number
  creditResetPeriod: string
  creditResetAmount: number
  creditMaxCredits: number
  createdAt: Date
  updatedAt: Date
  course: {
    id: string
    name: string
    displayName: string
    startDate: Date
    endDate: Date
  }
}

type ThreadRecord = {
  id: string
  participantId: string
  chatbotId: string
  createdAt: Date
  updatedAt: Date
  messages: Array<{
    id: string
    parentId: string | null
    role: string
    content: Prisma.JsonValue
    chatMode: string | null
    modelId: string | null
    reasoningEffort: string | null
    reasoningContent: string | null
    rating: 'UP' | 'DOWN' | null
    creditsUsed: unknown
    createdAt: Date
    attachments: Array<{ id: string }>
  }>
}

function usage() {
  return [
    'Usage:',
    '  pnpm --filter @klicker-uzh/prisma-data script:prod src/scripts/2026-06-16_analyze_chatbot_usage.ts --all',
    '  pnpm --filter @klicker-uzh/prisma-data script:prod src/scripts/2026-06-16_analyze_chatbot_usage.ts --chatbotId <uuid>',
    '  pnpm --filter @klicker-uzh/prisma-data script:prod src/scripts/2026-06-16_analyze_chatbot_usage.ts --courseId <uuid>',
    '  pnpm --filter @klicker-uzh/prisma-data script:prod src/scripts/2026-06-16_analyze_chatbot_usage.ts --query MAT183',
    '',
    'Options:',
    '  --all                      Analyze all chatbots with activity in the date window.',
    '  --chatbotId <uuid>          Analyze one chatbot by database ID.',
    '  --courseId <uuid>           Analyze all chatbots for one course by database ID.',
    '  --query, --course <text>    Restrict to matching course/chatbot names.',
    '                              UUID values also match chatbotId/courseId.',
    '  --semester <current|fs26>   Date window when --from/--to are omitted. Default: current.',
    '  --from YYYY-MM-DD           Inclusive start date.',
    '  --to YYYY-MM-DD             Inclusive end date.',
    '  --outDir <path>             Output directory. Default: output/.',
    '  --filePrefix <prefix>       Output filename prefix. Default: date + scope.',
    '  --minTopicMessages <n>      Minimum user messages for topic labels. Default: 5.',
    '  --minTopicParticipants <n>  Minimum participants for topic labels. Default: 3.',
    '  --includeMessageContent     Rejected; no content-bearing export exists. See ADR-0005 for future governance.',
  ].join('\n')
}

function getArgValue(args: string[], name: string) {
  const index = args.indexOf(name)
  if (index < 0) return undefined

  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}.`)
  }
  return value
}

function hasFlag(args: string[], name: string) {
  return args.includes(name)
}

function validateArgs(args: string[]) {
  const knownFlags = new Set([
    '--help',
    '--all',
    '--query',
    '--course',
    '--chatbotId',
    '--courseId',
    '--semester',
    '--from',
    '--to',
    '--outDir',
    '--filePrefix',
    '--minTopicMessages',
    '--minTopicParticipants',
    '--includeMessageContent',
  ])

  for (const arg of args) {
    if (arg.startsWith('--') && !knownFlags.has(arg)) {
      throw new Error(`Unknown option: ${arg}.`)
    }
  }
}

function assertUuid(name: string, value: string | undefined) {
  if (value && !UUID_PATTERN.test(value)) {
    throw new Error(`Invalid UUID for ${name}: ${value}.`)
  }
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return undefined
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(
    isoDateOnly
      ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
      : value
  )

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }

  return date
}

function yearFromSemester(value: string) {
  const rawYear = value.slice(2)
  if (!/^\d{2}(\d{2})?$/.test(rawYear)) {
    throw new Error(`Invalid semester: ${value}`)
  }
  const year = Number(rawYear)
  return year < 100 ? 2000 + year : year
}

function semesterWindow(semester: string, now: Date) {
  const normalized = semester.toLowerCase()

  if (normalized === 'current') {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1
    if (month === 1) {
      return {
        label: `hs${String(year - 1).slice(2)}`,
        from: new Date(Date.UTC(year - 1, 7, 1)),
        to: now,
      }
    }
    if (month >= 2 && month <= 7) {
      return {
        label: `fs${String(year).slice(2)}`,
        from: new Date(Date.UTC(year, 1, 1)),
        to: now,
      }
    }
    return {
      label: `hs${String(year).slice(2)}`,
      from: new Date(Date.UTC(year, 7, 1)),
      to: now,
    }
  }

  if (normalized.startsWith('fs')) {
    const year = yearFromSemester(normalized)
    const end = new Date(Date.UTC(year, 7, 1))
    return {
      label: `fs${String(year).slice(2)}`,
      from: new Date(Date.UTC(year, 1, 1)),
      to: end.getTime() < now.getTime() ? end : now,
    }
  }

  if (normalized.startsWith('hs')) {
    const year = yearFromSemester(normalized)
    const end = new Date(Date.UTC(year + 1, 1, 1))
    return {
      label: `hs${String(year).slice(2)}`,
      from: new Date(Date.UTC(year, 7, 1)),
      to: end.getTime() < now.getTime() ? end : now,
    }
  }

  throw new Error(`Invalid semester: ${semester}`)
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got: ${value}`)
  }
  return parsed
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  if (hasFlag(args, '--help')) {
    console.log(usage())
    process.exit(0)
  }

  validateArgs(args)

  if (hasFlag(args, '--includeMessageContent')) {
    assertLegacyMessageContentExportDisabled(true)
  }

  const all = hasFlag(args, '--all')
  const query = getArgValue(args, '--query') ?? getArgValue(args, '--course')
  const chatbotId = getArgValue(args, '--chatbotId')
  const courseId = getArgValue(args, '--courseId')
  const selectors = [
    all ? 'all' : undefined,
    query,
    chatbotId,
    courseId,
  ].filter(Boolean)
  if (selectors.length === 0) {
    throw new Error(
      'Pass one selector: --all, --chatbotId, --courseId, or --query. No course is selected by default.'
    )
  }
  if (selectors.length > 1) {
    throw new Error(
      'Pass only one selector: --all, --chatbotId, --courseId, or --query.'
    )
  }

  assertUuid('--chatbotId', chatbotId)
  assertUuid('--courseId', courseId)

  const now = new Date()
  const semester = getArgValue(args, '--semester') ?? 'current'
  const defaultWindow = semesterWindow(semester, now)
  const from = parseDate(getArgValue(args, '--from')) ?? defaultWindow.from
  const to = parseDate(getArgValue(args, '--to'), true) ?? defaultWindow.to
  if (from.getTime() > to.getTime()) {
    throw new Error(
      `Invalid date window: ${formatDate(from)} > ${formatDate(to)}`
    )
  }

  const scopeLabel = all
    ? 'all_chatbots'
    : chatbotId
      ? `chatbot:${chatbotId}`
      : courseId
        ? `course:${courseId}`
        : `query:${query}`
  const scope = sanitizeFilename(scopeLabel.replace(':', '_'))
  const windowLabel = getArgValue(args, '--semester') ?? defaultWindow.label
  const filePrefix =
    getArgValue(args, '--filePrefix') ??
    `${todayPrefix}_chatbot_usage_analytics_${sanitizeFilename(windowLabel)}_${scope}`

  return {
    all,
    query,
    chatbotId,
    courseId,
    scopeLabel,
    semester: defaultWindow.label,
    from,
    to,
    outDir: resolve(
      getArgValue(args, '--outDir') ?? resolve(repoRoot, 'output')
    ),
    filePrefix,
    minTopicMessages: parsePositiveInt(
      getArgValue(args, '--minTopicMessages'),
      5
    ),
    minTopicParticipants: parsePositiveInt(
      getArgValue(args, '--minTopicParticipants'),
      3
    ),
  }
}

function asArray(value: Prisma.JsonValue): ChatContentItem[] {
  return Array.isArray(value) ? (value as ChatContentItem[]) : []
}

function textParts(value: Prisma.JsonValue): string[] {
  return asArray(value)
    .map((item) => (typeof item.text === 'string' ? item.text : null))
    .filter((text): text is string => Boolean(text))
}

function contentTypes(value: Prisma.JsonValue) {
  return uniqueSorted(
    asArray(value).map((item) =>
      typeof item.type === 'string' ? item.type : null
    )
  ).join('|')
}

function toolNames(value: Prisma.JsonValue) {
  return uniqueSorted(
    asArray(value)
      .filter((item) => item.type === 'tool-call')
      .map((item) => (typeof item.toolName === 'string' ? item.toolName : null))
  )
}

function toolCallCount(value: Prisma.JsonValue) {
  return asArray(value).filter((item) => item.type === 'tool-call').length
}

function toolCallDetailRows(message: MessageRecord): SheetValue[][] {
  return asArray(message.content)
    .filter((item) => item.type === 'tool-call')
    .map((item) => {
      const result =
        item.result && typeof item.result === 'object'
          ? (item.result as Record<string, unknown>)
          : null

      return [
        message.courseName,
        message.chatbotKey,
        message.chatbotName,
        message.threadKey,
        message.messageKey,
        message.participantKey,
        message.messageCreatedAt,
        typeof item.toolName === 'string' ? item.toolName : null,
        typeof item.toolCallId === 'string' ? item.toolCallId : null,
        typeof result?.isError === 'boolean' ? result.isError : null,
      ]
    })
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  const decimal = value as { toNumber?: () => number }
  if (typeof decimal.toNumber === 'function') return decimal.toNumber()
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function estimateTokensFromTextChars(chars: number) {
  return chars > 0 ? Math.ceil(chars / 4) : 0
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b))
}

function groupBy<T>(values: T[], getKey: (value: T) => string) {
  const grouped = new Map<string, T[]>()
  for (const value of values) {
    const key = getKey(value)
    grouped.set(key, [...(grouped.get(key) ?? []), value])
  }
  return grouped
}

function createKeyMap(values: string[], prefix: string) {
  const uniqueValues = Array.from(new Set(values)).sort()
  return new Map(
    uniqueValues.map((value, index) => [
      value,
      `${prefix}_${String(index + 1).padStart(5, '0')}`,
    ])
  )
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function average(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0
}

function safeDivide(numerator: number, denominator: number, digits = 6) {
  return denominator > 0 ? round(numerator / denominator, digits) : 0
}

function safePercent(numerator: number, denominator: number) {
  return safeDivide(numerator * 100, denominator, 2)
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isoWeekKey(date: Date) {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function parseModelRegistry() {
  const raw = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!raw) return DEFAULT_MODEL_REGISTRY

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_MODEL_REGISTRY
    return parsed
      .filter(
        (model): model is ModelConfig =>
          model &&
          typeof model === 'object' &&
          typeof model.id === 'string' &&
          typeof model.name === 'string'
      )
      .map((model) => ({
        id: model.id,
        name: model.name,
        deploymentId:
          typeof model.deploymentId === 'string'
            ? model.deploymentId
            : undefined,
        fallback:
          typeof model.fallback === 'boolean' ? model.fallback : undefined,
        cost:
          model.cost && typeof model.cost === 'object'
            ? {
                input:
                  typeof model.cost.input === 'number'
                    ? model.cost.input
                    : undefined,
                output:
                  typeof model.cost.output === 'number'
                    ? model.cost.output
                    : undefined,
              }
            : undefined,
      }))
  } catch {
    return DEFAULT_MODEL_REGISTRY
  }
}

function parsePositiveNumberEnv(name: string) {
  const raw = process.env[name]
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a positive number, got: ${raw}`)
  }
  return parsed
}

function parseModelCostMultipliers() {
  const raw = process.env.CHATBOT_ANALYSIS_MODEL_COST_MULTIPLIERS_JSON
  if (!raw) return new Map<string, number>()

  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'CHATBOT_ANALYSIS_MODEL_COST_MULTIPLIERS_JSON must be a JSON object.'
    )
  }

  return new Map(
    Object.entries(parsed).map(([modelId, multiplier]) => {
      if (typeof multiplier !== 'number' || multiplier < 0) {
        throw new Error(
          `Invalid cost multiplier for ${modelId}: ${String(multiplier)}`
        )
      }
      return [modelId, multiplier]
    })
  )
}

function parseCostAnalysisConfig(): CostAnalysisConfig {
  return {
    currency: process.env.CHATBOT_ANALYSIS_COST_CURRENCY ?? 'configured',
    calibratedTotalCost: parsePositiveNumberEnv(
      'CHATBOT_ANALYSIS_CALIBRATED_TOTAL_COST'
    ),
    modelCostMultipliers: parseModelCostMultipliers(),
  }
}

function adjustedMessageCost(
  message: MessageRecord,
  costConfig: CostAnalysisConfig
) {
  const rawCost = message.creditsUsed ?? 0
  const multiplier = message.modelId
    ? (costConfig.modelCostMultipliers.get(message.modelId) ?? 1)
    : 1
  return rawCost * multiplier
}

function adjustedCost(
  messages: MessageRecord[],
  costConfig: CostAnalysisConfig
) {
  return sum(
    messages.map((message) => adjustedMessageCost(message, costConfig))
  )
}

function allocateCost(
  localAdjustedCost: number,
  totalAdjustedCost: number,
  costConfig: CostAnalysisConfig
) {
  if (
    costConfig.calibratedTotalCost !== null &&
    totalAdjustedCost > 0 &&
    localAdjustedCost > 0
  ) {
    return (
      (localAdjustedCost / totalAdjustedCost) * costConfig.calibratedTotalCost
    )
  }
  return localAdjustedCost
}

function formatModelMessageShares(
  messages: MessageRecord[],
  role: 'assistant' | 'user' | null = 'assistant'
) {
  const filteredMessages = role
    ? messages.filter((message) => message.role === role)
    : messages
  const denominator = filteredMessages.length
  const counts = new Map<string, number>()

  for (const message of filteredMessages) {
    const modelId = message.modelId ?? 'no-model'
    counts.set(modelId, (counts.get(modelId) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(
      ([modelId, count]) =>
        `${modelId} ${denominator > 0 ? round((count / denominator) * 100, 1) : 0}%`
    )
    .join('|')
}

function modelMessageShare(
  messages: MessageRecord[],
  modelId: string,
  role: 'assistant' | 'user' | null = 'assistant'
) {
  const filteredMessages = role
    ? messages.filter((message) => message.role === role)
    : messages
  return safePercent(
    filteredMessages.filter((message) => message.modelId === modelId).length,
    filteredMessages.length
  )
}

const TOPIC_MAX_FEATURES = 4500
const TOPIC_CANDIDATE_NEIGHBORS = 18
const TOPIC_GRAPH_NEIGHBORS = 8
const TOPIC_SIMILARITY_THRESHOLD = 0.22
const TOPIC_LABEL_ITERATIONS = 14

function normalizeTermText(value: string) {
  return value
    .toLowerCase()
    .replace(/\\"a/g, 'ä')
    .replace(/\\"o/g, 'ö')
    .replace(/\\"u/g, 'ü')
    .replace(/\\"s/g, 'ss')
    .replace(/(\p{L})"a/gu, '$1ä')
    .replace(/(\p{L})"o/gu, '$1ö')
    .replace(/(\p{L})"u/gu, '$1ü')
    .replace(/(\p{L})"s/gu, '$1ss')
    .replace(/\\([äöü])/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/[’']/g, ' ')
    .replace(/[^\p{L}\p{M}\s-]/gu, ' ')
}

function stemTopicToken(value: string) {
  return value.replace(/^-+|-+$/g, '')
}

function mergeBrokenTopicTokens(tokens: string[]) {
  const merged: string[] = []
  const phraseMerges = new Map([
    ['gr osse', 'grösse'],
    ['gr ossen', 'grössen'],
    ['gr osser', 'grösser'],
    ['l osung', 'lösung'],
    ['m oglich', 'möglich'],
    ['zufallsgr osse', 'zufallsgrösse'],
    ['zufallsgr ossen', 'zufallsgrössen'],
    ['zufallsgr osser', 'zufallsgrösser'],
    ['unabh angig', 'unabhängig'],
    ['unabh angige', 'unabhängige'],
    ['zuf allig', 'zufällig'],
    ['wahrschein lichkeit', 'wahrscheinlichkeit'],
    ['wahrschein lichkeiten', 'wahrscheinlichkeiten'],
  ])

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]
    const mergedToken =
      token && next ? phraseMerges.get(`${token} ${next}`) : undefined

    if (mergedToken) {
      merged.push(mergedToken)
      index += 1
      continue
    }

    if (token) merged.push(token)
  }

  return merged
}

function tokenizeForTopics(text: string) {
  const rawTokens =
    normalizeTermText(text).match(/\p{L}[\p{L}\p{M}-]{1,31}/gu) ?? []
  const tokens = mergeBrokenTopicTokens(
    rawTokens.map((token) => stemTopicToken(token))
  )

  return tokens.filter((token) => {
    if (token.length < 3 || token.length > 32) return false
    if (STOPWORDS.has(token)) return false
    if (/\d/.test(token)) return false
    if (/^[-]+$/.test(token)) return false
    return true
  })
}

function topicTermsForText(text: string) {
  const tokens = tokenizeForTopics(text)
  const terms: string[] = []

  for (const token of tokens) {
    terms.push(`unigram:${token}`)
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index]
    const second = tokens[index + 1]
    if (first && second && first !== second) {
      terms.push(`bigram:${first} ${second}`)
    }
  }

  for (let index = 0; index < tokens.length - 2; index += 1) {
    const first = tokens[index]
    const second = tokens[index + 1]
    const third = tokens[index + 2]
    if (
      first &&
      second &&
      third &&
      new Set([first, second, third]).size === 3
    ) {
      terms.push(`trigram:${first} ${second} ${third}`)
    }
  }

  return terms
}

function topicLabel(termKey: string) {
  return termKey.replace(/^(unigram|bigram|trigram):/, '')
}

function topicKind(termKey: string) {
  if (termKey.startsWith('trigram:')) return 'trigram'
  return termKey.startsWith('bigram:') ? 'bigram' : 'unigram'
}

function termKindBoost(termKey: string) {
  if (termKey.startsWith('trigram:')) return 1.65
  if (termKey.startsWith('bigram:')) return 1.35
  return 1
}

function termKindRank(kind: string) {
  if (kind === 'trigram') return 3
  if (kind === 'bigram') return 2
  return 1
}

function addWeightedTerms(
  target: Map<string, number>,
  text: string,
  weight: number
) {
  const counts = new Map<string, number>()
  for (const term of topicTermsForText(text)) {
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }

  for (const [term, count] of counts.entries()) {
    target.set(term, (target.get(term) ?? 0) + count * weight)
  }
}

function topThreadTerms(messages: MessageRecord[]) {
  const counts = new Map<string, number>()
  for (const message of messages) {
    if (message.role !== 'user') continue
    addWeightedTerms(counts, message.text, 1)
  }

  return Array.from(counts.entries())
    .filter(([term]) => topicKind(term) !== 'trigram')
    .sort(
      (a, b) => b[1] - a[1] || topicLabel(a[0]).localeCompare(topicLabel(b[0]))
    )
    .slice(0, 18)
}

function buildTopicDocuments(messages: MessageRecord[]) {
  const allMessagesByThread = groupBy(messages, (message) => message.threadKey)
  const documents: TopicDocument[] = []

  for (const threadMessages of allMessagesByThread.values()) {
    const ordered = [...threadMessages].sort(
      (a, b) =>
        a.messageCreatedAt.getTime() - b.messageCreatedAt.getTime() ||
        a.messageKey.localeCompare(b.messageKey)
    )
    const userMessages = ordered.filter(
      (message) => message.role === 'user' && message.text.trim().length > 0
    )
    const threadTerms = topThreadTerms(ordered)

    for (const [userIndex, message] of userMessages.entries()) {
      const weightedTerms = new Map<string, number>()
      const labelTerms = new Map<string, number>()
      addWeightedTerms(weightedTerms, message.text, 4)
      addWeightedTerms(labelTerms, message.text, 1)

      for (let offset = 1; offset <= 2; offset += 1) {
        const previous = userMessages[userIndex - offset]
        if (previous) {
          addWeightedTerms(weightedTerms, previous.text, offset === 1 ? 1.8 : 1)
        }
      }

      const next = userMessages[userIndex + 1]
      if (next) {
        addWeightedTerms(weightedTerms, next.text, 0.75)
      }

      const lowerBound =
        userMessages[Math.max(0, userIndex - 2)]?.messageCreatedAt ??
        message.messageCreatedAt
      const upperBound =
        userMessages[Math.min(userMessages.length - 1, userIndex + 1)]
          ?.messageCreatedAt ?? message.messageCreatedAt

      for (const nearby of ordered) {
        if (nearby.role !== 'assistant' || nearby.text.trim().length === 0) {
          continue
        }
        if (
          nearby.messageCreatedAt.getTime() < lowerBound.getTime() ||
          nearby.messageCreatedAt.getTime() > upperBound.getTime()
        ) {
          continue
        }
        addWeightedTerms(weightedTerms, nearby.text.slice(0, 1200), 0.05)
      }

      for (const [term, count] of threadTerms) {
        weightedTerms.set(term, (weightedTerms.get(term) ?? 0) + count * 0.04)
      }

      documents.push({
        message,
        weightedTerms,
        labelTerms,
        vector: new Map<string, number>(),
      })
    }
  }

  return documents
}

function selectTopicFeatures(documents: TopicDocument[]) {
  const documentFrequency = new Map<string, number>()
  const totalWeight = new Map<string, number>()

  for (const document of documents) {
    for (const term of document.weightedTerms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
    for (const [term, weight] of document.weightedTerms.entries()) {
      totalWeight.set(term, (totalWeight.get(term) ?? 0) + weight)
    }
  }

  const maxDocumentFrequency = Math.max(3, Math.floor(documents.length * 0.55))
  const features = Array.from(documentFrequency.entries())
    .filter(([, df]) => df >= 2 && df <= maxDocumentFrequency)
    .map(([term, df]) => {
      const idf = Math.log((documents.length + 1) / (df + 1)) + 1
      const score =
        idf *
        Math.sqrt(df) *
        Math.log1p(totalWeight.get(term) ?? 0) *
        termKindBoost(term)
      return { term, df, idf, score }
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        topicLabel(a.term).localeCompare(topicLabel(b.term))
    )
    .slice(0, TOPIC_MAX_FEATURES)

  return {
    features: new Set(features.map((feature) => feature.term)),
    idfByTerm: new Map(features.map((feature) => [feature.term, feature.idf])),
    documentFrequency,
  }
}

function normalizeVector(vector: Map<string, number>) {
  const norm = Math.sqrt(
    Array.from(vector.values()).reduce((total, value) => total + value ** 2, 0)
  )
  if (norm === 0) return vector

  for (const [term, value] of vector.entries()) {
    vector.set(term, value / norm)
  }
  return vector
}

function vectorizeTopicDocuments(documents: TopicDocument[]) {
  const { features, idfByTerm, documentFrequency } =
    selectTopicFeatures(documents)

  for (const document of documents) {
    const vector = new Map<string, number>()

    for (const [term, count] of document.weightedTerms.entries()) {
      if (!features.has(term)) continue

      const idf = idfByTerm.get(term) ?? 1
      const value = Math.log1p(count) * idf * termKindBoost(term)
      if (value > 0) {
        vector.set(term, value)
      }
    }

    document.vector = normalizeVector(vector)
  }

  return { documentFrequency }
}

function dotVectors(a: Map<string, number>, b: Map<string, number>) {
  let score = 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]

  for (const [term, value] of small.entries()) {
    score += value * (large.get(term) ?? 0)
  }

  return score
}

function buildSimilarityGraph(documents: TopicDocument[]) {
  const candidates = documents.map(() => new Map<number, number>())
  const postings = new Map<string, Array<{ index: number; weight: number }>>()

  for (const [index, document] of documents.entries()) {
    const scores = new Map<number, number>()

    for (const [term, weight] of document.vector.entries()) {
      const termPostings = postings.get(term) ?? []
      for (const posting of termPostings) {
        scores.set(
          posting.index,
          (scores.get(posting.index) ?? 0) + weight * posting.weight
        )
      }
    }

    const topNeighbors = Array.from(scores.entries())
      .filter(([, score]) => score >= TOPIC_SIMILARITY_THRESHOLD)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, TOPIC_CANDIDATE_NEIGHBORS)

    for (const [neighbor, weight] of topNeighbors) {
      candidates[index]!.set(
        neighbor,
        Math.max(candidates[index]!.get(neighbor) ?? 0, weight)
      )
      candidates[neighbor]!.set(
        index,
        Math.max(candidates[neighbor]!.get(index) ?? 0, weight)
      )
    }

    for (const [term, weight] of document.vector.entries()) {
      const termPostings = postings.get(term) ?? []
      termPostings.push({ index, weight })
      postings.set(term, termPostings)
    }
  }

  const topByDocument = candidates.map(
    (candidate) =>
      new Map(
        Array.from(candidate.entries())
          .sort((a, b) => b[1] - a[1] || a[0] - b[0])
          .slice(0, TOPIC_GRAPH_NEIGHBORS)
      )
  )
  const edges = documents.map(() => [] as Array<{ to: number; weight: number }>)
  const addedEdges = new Set<string>()

  for (const [index, neighbors] of topByDocument.entries()) {
    for (const [neighbor, weight] of neighbors.entries()) {
      const from = Math.min(index, neighbor)
      const to = Math.max(index, neighbor)
      const edgeKey = `${from}:${to}`

      if (from === to || addedEdges.has(edgeKey)) {
        continue
      }

      const edgeWeight = Math.max(
        weight,
        topByDocument[neighbor]?.get(index) ?? 0
      )
      edges[from]!.push({ to, weight: edgeWeight })
      edges[to]!.push({ to: from, weight: edgeWeight })
      addedEdges.add(edgeKey)
    }
  }

  return edges
}

function clusterLabelsWithChineseWhispers(
  documents: TopicDocument[],
  edges: Array<Array<{ to: number; weight: number }>>
) {
  const labels = documents.map((_, index) => index)

  for (let iteration = 0; iteration < TOPIC_LABEL_ITERATIONS; iteration += 1) {
    let changed = 0
    const order = documents.map((_, index) => index)
    if (iteration % 2 === 1) order.reverse()

    for (const index of order) {
      if (edges[index]!.length === 0) continue

      const scores = new Map<number, number>([[labels[index]!, 0.08]])
      for (const edge of edges[index]!) {
        const label = labels[edge.to]!
        scores.set(label, (scores.get(label) ?? 0) + edge.weight)
      }

      const [bestLabel] = Array.from(scores.entries()).sort(
        (a, b) => b[1] - a[1] || a[0] - b[0]
      )[0]!

      if (bestLabel !== labels[index]) {
        labels[index] = bestLabel
        changed += 1
      }
    }

    if (changed === 0) break
  }

  return labels
}

function centroidForDocuments(documents: TopicDocument[]) {
  const centroid = new Map<string, number>()

  for (const document of documents) {
    for (const [term, value] of document.vector.entries()) {
      centroid.set(term, (centroid.get(term) ?? 0) + value)
    }
  }

  if (documents.length > 0) {
    for (const [term, value] of centroid.entries()) {
      centroid.set(term, value / documents.length)
    }
  }

  return normalizeVector(centroid)
}

function clusterSimilarity(document: TopicDocument, cluster: TopicCluster) {
  const similarity = dotVectors(document.vector, cluster.centroid)
  return Number.isFinite(similarity) ? round(similarity, 4) : null
}

function clusterTopTerms(
  documents: TopicDocument[],
  centroid: Map<string, number>,
  allDocumentFrequency: Map<string, number>,
  totalDocuments: number
) {
  const clusterParticipants = new Set(
    documents.map((document) => document.message.participantKey)
  )
  const minTermParticipants = Math.min(2, clusterParticipants.size)
  const termDocuments = new Map<string, Set<string>>()
  const termParticipants = new Map<string, Set<string>>()
  const termThreads = new Map<string, Set<string>>()
  const termScores = new Map<string, number>()

  for (const document of documents) {
    for (const [term, value] of document.labelTerms.entries()) {
      const centroidWeight = centroid.get(term) ?? 0.03

      termScores.set(
        term,
        (termScores.get(term) ?? 0) + Math.log1p(value) * centroidWeight
      )
      const documentKeys = termDocuments.get(term) ?? new Set<string>()
      documentKeys.add(document.message.messageKey)
      termDocuments.set(term, documentKeys)

      const participants = termParticipants.get(term) ?? new Set<string>()
      participants.add(document.message.participantKey)
      termParticipants.set(term, participants)

      const threads = termThreads.get(term) ?? new Set<string>()
      threads.add(document.message.threadKey)
      termThreads.set(term, threads)
    }
  }

  return Array.from(termScores.entries())
    .map(([termKey, score]) => {
      const df = allDocumentFrequency.get(termKey) ?? 0
      const idf = Math.log((totalDocuments + 1) / (df + 1)) + 1
      const userMessages = termDocuments.get(termKey)?.size ?? 0
      return {
        termKey,
        label: topicLabel(termKey),
        kind: topicKind(termKey),
        score: round(
          (score / Math.max(documents.length, 1)) *
            idf *
            termKindBoost(termKey) *
            Math.log1p(userMessages),
          4
        ),
        userMessages,
        participants: termParticipants.get(termKey)?.size ?? 0,
        threads: termThreads.get(termKey)?.size ?? 0,
      }
    })
    .filter(
      (term) =>
        term.userMessages >= Math.min(3, documents.length) &&
        term.participants >= minTermParticipants
    )
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.kind !== b.kind) {
        return termKindRank(b.kind) - termKindRank(a.kind)
      }
      return a.label.localeCompare(b.label)
    })
}

function selectReadableTopicTerms(terms: ClusterTerm[], limit: number) {
  const selected: ClusterTerm[] = []

  for (const term of terms) {
    if (
      selected.some(
        (existing) =>
          existing.label.includes(term.label) ||
          term.label.includes(existing.label)
      )
    ) {
      continue
    }

    selected.push(term)
    if (selected.length >= limit) break
  }

  return selected
}

function buildTopicAnalysis(
  messages: MessageRecord[],
  options: Pick<CliOptions, 'minTopicMessages' | 'minTopicParticipants'>
) {
  const documentsByChatbot = groupBy(
    buildTopicDocuments(messages),
    (document) => document.message.chatbotId
  )
  const assignments: TopicAssignment[] = []
  const clusters: TopicClusterRow[] = []
  const terms: TopicTermRow[] = []

  for (const [chatbotId, documents] of documentsByChatbot.entries()) {
    if (documents.length === 0) continue

    const { documentFrequency } = vectorizeTopicDocuments(documents)
    const graph = buildSimilarityGraph(documents)
    const labels = clusterLabelsWithChineseWhispers(documents, graph)
    const documentsByLabel = new Map<number, TopicDocument[]>()

    labels.forEach((label, index) => {
      const clusterDocuments = documentsByLabel.get(label) ?? []
      clusterDocuments.push(documents[index]!)
      documentsByLabel.set(label, clusterDocuments)
    })

    const eligibleClusters: TopicCluster[] = []
    const unclusteredDocuments: TopicDocument[] = []

    for (const clusterDocuments of documentsByLabel.values()) {
      const participants = new Set(
        clusterDocuments.map((document) => document.message.participantKey)
      )
      if (
        clusterDocuments.length < options.minTopicMessages ||
        participants.size < options.minTopicParticipants
      ) {
        unclusteredDocuments.push(...clusterDocuments)
        continue
      }

      const centroid = centroidForDocuments(clusterDocuments)
      const topTerms = selectReadableTopicTerms(
        clusterTopTerms(
          clusterDocuments,
          centroid,
          documentFrequency,
          documents.length
        ),
        12
      )
      if (topTerms.length === 0) {
        unclusteredDocuments.push(...clusterDocuments)
        continue
      }

      const label =
        topTerms
          .slice(0, 3)
          .map((term) => term.label)
          .join(' / ') || 'topic'

      eligibleClusters.push({
        chatbotId,
        clusterId: '',
        label,
        documents: clusterDocuments,
        centroid,
        topTerms,
      })
    }

    eligibleClusters.sort((a, b) => {
      if (a.documents.length !== b.documents.length) {
        return b.documents.length - a.documents.length
      }
      return a.label.localeCompare(b.label)
    })

    eligibleClusters.forEach((cluster, index) => {
      cluster.clusterId = `topic_${String(index + 1).padStart(3, '0')}`
      const clusterMessages = cluster.documents.map(
        (document) => document.message
      )
      const participants = new Set(
        clusterMessages.map((message) => message.participantKey)
      )
      const threads = new Set(
        clusterMessages.map((message) => message.threadKey)
      )
      const dates = clusterMessages.map((message) =>
        message.messageCreatedAt.getTime()
      )
      const similarities = cluster.documents
        .map((document) => clusterSimilarity(document, cluster))
        .filter((value): value is number => value !== null)

      clusters.push({
        chatbotId,
        clusterId: cluster.clusterId,
        label: cluster.label,
        userMessages: cluster.documents.length,
        participants: participants.size,
        threads: threads.size,
        firstMessageAt: dates.length > 0 ? new Date(Math.min(...dates)) : null,
        lastMessageAt: dates.length > 0 ? new Date(Math.max(...dates)) : null,
        avgUserMessageWords: round(
          average(clusterMessages.map((message) => message.textWordCount)),
          2
        ),
        estimatedVisibleTokens: sum(
          clusterMessages.map((message) => message.estimatedTextTokens)
        ),
        avgClusterSimilarity:
          similarities.length > 0 ? round(average(similarities), 4) : null,
        topTerms: cluster.topTerms.map((term) => term.label).join('|'),
      })

      cluster.topTerms.forEach((term, termIndex) => {
        terms.push({
          chatbotId,
          clusterId: cluster.clusterId,
          clusterLabel: cluster.label,
          term: term.label,
          kind: term.kind,
          rank: termIndex + 1,
          score: term.score,
          userMessages: term.userMessages,
          participants: term.participants,
          threads: term.threads,
        })
      })

      for (const document of cluster.documents) {
        assignments.push({
          messageKey: document.message.messageKey,
          chatbotId,
          clusterLabel: cluster.label,
          clusterId: cluster.clusterId,
          topTerms: cluster.topTerms.map((term) => term.label).join('|'),
          clusterSimilarity: clusterSimilarity(document, cluster),
        })
      }
    })

    if (unclusteredDocuments.length > 0) {
      const clusterMessages = unclusteredDocuments.map(
        (document) => document.message
      )
      const participants = new Set(
        clusterMessages.map((message) => message.participantKey)
      )
      const threads = new Set(
        clusterMessages.map((message) => message.threadKey)
      )
      const dates = clusterMessages.map((message) =>
        message.messageCreatedAt.getTime()
      )

      clusters.push({
        chatbotId,
        clusterId: 'unclustered',
        label: 'unclustered_or_below_threshold',
        userMessages: unclusteredDocuments.length,
        participants: participants.size,
        threads: threads.size,
        firstMessageAt: dates.length > 0 ? new Date(Math.min(...dates)) : null,
        lastMessageAt: dates.length > 0 ? new Date(Math.max(...dates)) : null,
        avgUserMessageWords: round(
          average(clusterMessages.map((message) => message.textWordCount)),
          2
        ),
        estimatedVisibleTokens: sum(
          clusterMessages.map((message) => message.estimatedTextTokens)
        ),
        avgClusterSimilarity: null,
        topTerms: '',
      })

      for (const document of unclusteredDocuments) {
        assignments.push({
          messageKey: document.message.messageKey,
          chatbotId,
          clusterLabel: 'unclustered_or_below_threshold',
          clusterId: 'unclustered',
          topTerms: '',
          clusterSimilarity: null,
        })
      }
    }
  }

  clusters.sort((a, b) => {
    if (a.chatbotId !== b.chatbotId)
      return a.chatbotId.localeCompare(b.chatbotId)
    if (a.clusterId === 'unclustered') return 1
    if (b.clusterId === 'unclustered') return -1
    return a.clusterId.localeCompare(b.clusterId)
  })

  terms.sort((a, b) => {
    if (a.chatbotId !== b.chatbotId)
      return a.chatbotId.localeCompare(b.chatbotId)
    if (a.clusterId !== b.clusterId)
      return a.clusterId.localeCompare(b.clusterId)
    return a.rank - b.rank
  })

  return { assignments, clusters, terms }
}

async function loadChatbots(options: CliOptions) {
  const activeWindowFilter: Prisma.ChatbotWhereInput = options.all
    ? {
        threads: {
          some: {
            messages: {
              some: {
                createdAt: {
                  gte: options.from,
                  lte: options.to,
                },
              },
            },
          },
        },
      }
    : {}
  const queryFilter: Prisma.ChatbotWhereInput = options.chatbotId
    ? { id: options.chatbotId }
    : options.courseId
      ? { courseId: options.courseId }
      : options.query
        ? {
            OR: [
              { name: { contains: options.query, mode: 'insensitive' } },
              ...(UUID_PATTERN.test(options.query)
                ? [{ id: options.query }, { courseId: options.query }]
                : []),
              {
                course: {
                  name: { contains: options.query, mode: 'insensitive' },
                },
              },
              {
                course: {
                  displayName: {
                    contains: options.query,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}

  return prisma.chatbot.findMany({
    where: {
      AND: [activeWindowFilter, queryFilter],
    },
    select: chatbotSelect,
    orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
  }) as Promise<ChatbotRecord[]>
}

async function loadThreads(chatbotIds: string[], options: CliOptions) {
  return prisma.chatThread.findMany({
    where: {
      chatbotId: { in: chatbotIds },
      messages: {
        some: {
          createdAt: {
            gte: options.from,
            lte: options.to,
          },
        },
      },
    },
    select: {
      id: true,
      participantId: true,
      chatbotId: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        where: {
          createdAt: {
            gte: options.from,
            lte: options.to,
          },
        },
        select: threadMessageSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  }) as Promise<ThreadRecord[]>
}

async function loadCreditRows(chatbotIds: string[]) {
  return prisma.chatUsageCredits.findMany({
    where: { chatbotId: { in: chatbotIds } },
    select: {
      participantId: true,
      chatbotId: true,
      current: true,
      total: true,
      resetCount: true,
      periodStartedAt: true,
      lastResetAt: true,
      disclaimerAcceptedAt: true,
      disclaimerDeclined: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ chatbotId: 'asc' }, { participantId: 'asc' }],
  })
}

function emptyCourseActivityMetrics(): CourseActivityMetrics {
  return {
    participantCount: 0,
    responseCount: 0,
    responseTrialCount: 0,
    respondingParticipantCount: 0,
    windowResponseCount: 0,
    windowResponseTrialCount: 0,
    windowRespondingParticipantCount: 0,
  }
}

function ensureCourseActivityMetrics(
  metricsByCourseId: Map<string, CourseActivityMetrics>,
  courseId: string
) {
  let metrics = metricsByCourseId.get(courseId)
  if (!metrics) {
    metrics = emptyCourseActivityMetrics()
    metricsByCourseId.set(courseId, metrics)
  }
  return metrics
}

async function loadCourseActivity(courseIds: string[], options: CliOptions) {
  const uniqueCourseIds = Array.from(new Set(courseIds))
  const metricsByCourseId = new Map(
    uniqueCourseIds.map((courseId) => [courseId, emptyCourseActivityMetrics()])
  )

  const responseWindowWhere = {
    courseId: { in: uniqueCourseIds },
    OR: [
      {
        lastAnsweredAt: {
          gte: options.from,
          lte: options.to,
        },
      },
      {
        createdAt: {
          gte: options.from,
          lte: options.to,
        },
      },
    ],
  } satisfies Prisma.QuestionResponseWhereInput

  const [
    participantCounts,
    responseCounts,
    respondingParticipants,
    windowResponseCounts,
    windowRespondingParticipants,
  ] = await Promise.all([
    prisma.participation.groupBy({
      by: ['courseId'],
      where: { courseId: { in: uniqueCourseIds } },
      _count: { _all: true },
    }),
    prisma.questionResponse.groupBy({
      by: ['courseId'],
      where: { courseId: { in: uniqueCourseIds } },
      _count: { _all: true },
      _sum: { trialsCount: true },
    }),
    prisma.questionResponse.groupBy({
      by: ['courseId', 'participantId'],
      where: { courseId: { in: uniqueCourseIds } },
      _count: { _all: true },
    }),
    prisma.questionResponse.groupBy({
      by: ['courseId'],
      where: responseWindowWhere,
      _count: { _all: true },
      _sum: { trialsCount: true },
    }),
    prisma.questionResponse.groupBy({
      by: ['courseId', 'participantId'],
      where: responseWindowWhere,
      _count: { _all: true },
    }),
  ])

  for (const row of participantCounts) {
    ensureCourseActivityMetrics(
      metricsByCourseId,
      row.courseId
    ).participantCount = row._count._all
  }

  for (const row of responseCounts) {
    const metrics = ensureCourseActivityMetrics(metricsByCourseId, row.courseId)
    metrics.responseCount = row._count._all
    metrics.responseTrialCount = row._sum.trialsCount ?? 0
  }

  for (const row of respondingParticipants) {
    ensureCourseActivityMetrics(
      metricsByCourseId,
      row.courseId
    ).respondingParticipantCount += 1
  }

  for (const row of windowResponseCounts) {
    const metrics = ensureCourseActivityMetrics(metricsByCourseId, row.courseId)
    metrics.windowResponseCount = row._count._all
    metrics.windowResponseTrialCount = row._sum.trialsCount ?? 0
  }

  for (const row of windowRespondingParticipants) {
    ensureCourseActivityMetrics(
      metricsByCourseId,
      row.courseId
    ).windowRespondingParticipantCount += 1
  }

  return metricsByCourseId
}

function flattenMessages(
  chatbots: ChatbotRecord[],
  threads: ThreadRecord[],
  chatbotKeyById: Map<string, string>,
  participantKeyById: Map<string, string>,
  threadKeyById: Map<string, string>,
  messageKeyById: Map<string, string>
): MessageRecord[] {
  const chatbotById = new Map(chatbots.map((chatbot) => [chatbot.id, chatbot]))

  return threads.flatMap((thread) => {
    const chatbot = chatbotById.get(thread.chatbotId)
    if (!chatbot) return []

    return thread.messages.map((message) => {
      const text = textParts(message.content as Prisma.JsonValue).join('\n\n')
      const textCharCount = text.length
      const reasoningCharCount = message.reasoningContent?.length ?? 0

      return {
        courseId: chatbot.course.id,
        courseName: chatbot.course.name,
        courseDisplayName: chatbot.course.displayName,
        chatbotId: chatbot.id,
        chatbotKey: chatbotKeyById.get(chatbot.id)!,
        chatbotName: chatbot.name,
        threadId: thread.id,
        threadKey: threadKeyById.get(thread.id)!,
        participantId: thread.participantId,
        participantKey: participantKeyById.get(thread.participantId)!,
        messageId: message.id,
        messageKey: messageKeyById.get(message.id)!,
        parentId: message.parentId,
        role: message.role,
        content: message.content as Prisma.JsonValue,
        text,
        textCharCount,
        textWordCount:
          text.trim().length > 0 ? text.trim().split(/\s+/).length : 0,
        estimatedTextTokens: estimateTokensFromTextChars(textCharCount),
        reasoningCharCount,
        estimatedReasoningTokens:
          estimateTokensFromTextChars(reasoningCharCount),
        messageCreatedAt: message.createdAt,
        threadCreatedAt: thread.createdAt,
        threadUpdatedAt: thread.updatedAt,
        chatMode: message.chatMode,
        modelId: message.modelId,
        reasoningEffort: message.reasoningEffort,
        reasoningContent: message.reasoningContent,
        rating: message.rating,
        creditsUsed: decimalToNumber(message.creditsUsed),
        attachmentCount: message.attachments.length,
      }
    })
  })
}

function sortMessages(messages: MessageRecord[]) {
  return messages.sort((a, b) => {
    const timestampDiff =
      a.messageCreatedAt.getTime() - b.messageCreatedAt.getTime()
    if (timestampDiff !== 0) return timestampDiff
    return a.messageKey.localeCompare(b.messageKey)
  })
}

function buildSheets(
  options: CliOptions,
  chatbots: ChatbotRecord[],
  chatbotKeyById: Map<string, string>,
  messages: MessageRecord[],
  creditRows: Awaited<ReturnType<typeof loadCreditRows>>,
  courseActivityById: Map<string, CourseActivityMetrics>,
  topicAnalysis: ReturnType<typeof buildTopicAnalysis>,
  modelRegistry: ModelConfig[],
  costConfig: CostAnalysisConfig
): WorkbookSheet[] {
  const chatbotById = new Map(chatbots.map((chatbot) => [chatbot.id, chatbot]))
  const modelById = new Map(modelRegistry.map((model) => [model.id, model]))
  const creditByParticipantChatbot = new Map(
    creditRows.map((credit) => [
      `${credit.chatbotId}:${credit.participantId}`,
      credit,
    ])
  )
  const participantKeyById = createKeyMap(
    [
      ...messages.map((message) => message.participantId),
      ...creditRows.map((credit) => credit.participantId),
    ],
    'participant'
  )
  const topicAssignmentByMessageKey = new Map(
    topicAnalysis.assignments.map((assignment) => [
      assignment.messageKey,
      assignment,
    ])
  )
  const messageKeyById = new Map(
    messages.map((message) => [message.messageId, message.messageKey])
  )

  const activeParticipantKeys = new Set(
    messages.map((message) => message.participantKey)
  )
  const threadKeys = new Set(messages.map((message) => message.threadKey))
  const totalCredits = sum(messages.map((message) => message.creditsUsed ?? 0))
  const totalAdjustedCost = adjustedCost(messages, costConfig)
  const totalAllocatedCost = allocateCost(
    totalAdjustedCost,
    totalAdjustedCost,
    costConfig
  )
  const userMessages = messages.filter((message) => message.role === 'user')
  const assistantMessages = messages.filter(
    (message) => message.role === 'assistant'
  )

  const sheets: WorkbookSheet[] = [
    {
      name: 'Notes',
      headers: ['field', 'value'],
      rows: [
        ['generatedAt', formatDate(new Date())],
        ['semester', options.semester],
        ['from', formatDate(options.from)],
        ['to', formatDate(options.to)],
        ['scope', options.scopeLabel],
        ['chatbots', chatbots.length],
        [
          'privacy',
          'Legacy operational workbook is not a governed aggregate or restricted export. It must not be shared as a personal-data download.',
        ],
        [
          'participants',
          'Participant, thread, and message keys are report-local pseudonyms and are not stable across runs.',
        ],
        [
          'tokens',
          'Provider token counts are not persisted; token columns are rough visible-text estimates from stored message text only.',
        ],
        [
          'cost',
          `Cost columns use stored creditsUsed, optional CHATBOT_ANALYSIS_MODEL_COST_MULTIPLIERS_JSON, and optional CHATBOT_ANALYSIS_CALIBRATED_TOTAL_COST. Currency label: ${costConfig.currency}.`,
        ],
        [
          'courseActivity',
          'courseParticipants counts Participation rows. Response activity counts QuestionResponse rows and trialsCount; window response activity uses lastAnsweredAt or createdAt inside the export window.',
        ],
        [
          'topics',
          `Context-window TF-IDF clustering over current user turns, nearby conversation turns, and lightweight thread terms; labels require at least ${options.minTopicMessages} user messages and ${options.minTopicParticipants} participants.`,
        ],
        [
          'costMultipliers',
          JSON.stringify(Object.fromEntries(costConfig.modelCostMultipliers)),
        ],
        ['calibratedTotalCost', costConfig.calibratedTotalCost],
      ],
    },
    {
      name: 'Summary',
      headers: [
        'chatbots',
        'activeParticipants',
        'conversations',
        'messages',
        'userMessages',
        'assistantMessages',
        'toolCalls',
        'attachments',
        'creditsUsed',
        'adjustedCost',
        'allocatedCost',
        'costCurrency',
        'costPerActiveParticipant',
        'costPerConversation',
        'costPerMessage',
        'assistantModelMessageShare',
        'estimatedVisibleTextTokens',
        'estimatedReasoningTokens',
        'firstActivityAt',
        'lastActivityAt',
      ],
      rows: [
        [
          chatbots.length,
          activeParticipantKeys.size,
          threadKeys.size,
          messages.length,
          userMessages.length,
          assistantMessages.length,
          sum(messages.map((message) => toolCallCount(message.content))),
          sum(messages.map((message) => message.attachmentCount)),
          round(totalCredits),
          round(totalAdjustedCost),
          round(totalAllocatedCost),
          costConfig.currency,
          safeDivide(totalAllocatedCost, activeParticipantKeys.size),
          safeDivide(totalAllocatedCost, threadKeys.size),
          safeDivide(totalAllocatedCost, messages.length),
          formatModelMessageShares(messages),
          sum(messages.map((message) => message.estimatedTextTokens)),
          sum(messages.map((message) => message.estimatedReasoningTokens)),
          messages.length > 0
            ? new Date(
                Math.min(
                  ...messages.map((message) =>
                    message.messageCreatedAt.getTime()
                  )
                )
              )
            : null,
          messages.length > 0
            ? new Date(
                Math.max(
                  ...messages.map((message) =>
                    message.messageCreatedAt.getTime()
                  )
                )
              )
            : null,
        ],
      ],
    },
  ]

  const chatbotsByCourseId = groupBy(chatbots, (chatbot) => chatbot.course.id)
  const messagesByCourseId = groupBy(messages, (message) => message.courseId)

  sheets.push({
    name: 'Courses',
    headers: [
      'courseName',
      'courseDisplayName',
      'courseStartDate',
      'courseEndDate',
      'chatbots',
      'courseParticipants',
      'respondingCourseParticipants',
      'courseResponses',
      'courseResponseTrials',
      'windowRespondingCourseParticipants',
      'windowCourseResponses',
      'windowCourseResponseTrials',
      'responsesPerCourseParticipant',
      'windowResponsesPerCourseParticipant',
      'chatbotParticipants',
      'chatbotParticipantSharePct',
      'conversations',
      'messages',
      'userMessages',
      'assistantMessages',
      'avgMessagesPerConversation',
      'avgMessagesPerChatbotParticipant',
      'toolCalls',
      'images',
      'creditsUsed',
      'adjustedCost',
      'allocatedCost',
      'costCurrency',
      'costPerCourseParticipant',
      'costPerChatbotParticipant',
      'costPerConversation',
      'costPerMessage',
      'assistantModelMessageShare',
      'gpt55AssistantMessageSharePct',
      'estimatedVisibleTextTokens',
      'estimatedReasoningTokens',
      'firstActivityAt',
      'lastActivityAt',
    ],
    rows: Array.from(chatbotsByCourseId.entries()).map(
      ([courseId, courseChatbots]) => {
        const firstChatbot = courseChatbots[0]!
        const courseMessages = messagesByCourseId.get(courseId) ?? []
        const courseUserMessages = courseMessages.filter(
          (message) => message.role === 'user'
        )
        const courseAssistantMessages = courseMessages.filter(
          (message) => message.role === 'assistant'
        )
        const participantKeys = new Set(
          courseMessages.map((message) => message.participantKey)
        )
        const conversationKeys = new Set(
          courseMessages.map((message) => message.threadKey)
        )
        const dates = courseMessages.map((message) =>
          message.messageCreatedAt.getTime()
        )
        const activity =
          courseActivityById.get(courseId) ?? emptyCourseActivityMetrics()
        const localAdjustedCost = adjustedCost(courseMessages, costConfig)
        const localAllocatedCost = allocateCost(
          localAdjustedCost,
          totalAdjustedCost,
          costConfig
        )

        return [
          firstChatbot.course.name,
          firstChatbot.course.displayName,
          firstChatbot.course.startDate,
          firstChatbot.course.endDate,
          courseChatbots.length,
          activity.participantCount,
          activity.respondingParticipantCount,
          activity.responseCount,
          activity.responseTrialCount,
          activity.windowRespondingParticipantCount,
          activity.windowResponseCount,
          activity.windowResponseTrialCount,
          safeDivide(activity.responseCount, activity.participantCount),
          safeDivide(activity.windowResponseCount, activity.participantCount),
          participantKeys.size,
          safePercent(participantKeys.size, activity.participantCount),
          conversationKeys.size,
          courseMessages.length,
          courseUserMessages.length,
          courseAssistantMessages.length,
          safeDivide(courseMessages.length, conversationKeys.size, 2),
          safeDivide(courseMessages.length, participantKeys.size, 2),
          sum(courseMessages.map((message) => toolCallCount(message.content))),
          sum(courseMessages.map((message) => message.attachmentCount)),
          round(sum(courseMessages.map((message) => message.creditsUsed ?? 0))),
          round(localAdjustedCost),
          round(localAllocatedCost),
          costConfig.currency,
          safeDivide(localAllocatedCost, activity.participantCount),
          safeDivide(localAllocatedCost, participantKeys.size),
          safeDivide(localAllocatedCost, conversationKeys.size),
          safeDivide(localAllocatedCost, courseMessages.length),
          formatModelMessageShares(courseMessages),
          modelMessageShare(courseMessages, 'gpt-5.5'),
          sum(courseMessages.map((message) => message.estimatedTextTokens)),
          sum(
            courseMessages.map((message) => message.estimatedReasoningTokens)
          ),
          dates.length > 0 ? new Date(Math.min(...dates)) : null,
          dates.length > 0 ? new Date(Math.max(...dates)) : null,
        ]
      }
    ),
  })

  const messagesByChatbot = groupBy(messages, (message) => message.chatbotId)
  sheets.push({
    name: 'Chatbots',
    headers: [
      'courseName',
      'courseDisplayName',
      'chatbotKey',
      'chatbotName',
      'courseStartDate',
      'courseEndDate',
      'modelSelection',
      'allowedModelIds',
      'creditInitialCredits',
      'creditResetPeriod',
      'creditResetAmount',
      'creditMaxCredits',
      'courseParticipants',
      'courseResponses',
      'windowCourseResponses',
      'activeParticipants',
      'chatbotParticipantSharePct',
      'conversations',
      'messages',
      'userMessages',
      'assistantMessages',
      'avgMessagesPerConversation',
      'avgMessagesPerParticipant',
      'toolCalls',
      'attachments',
      'creditsUsed',
      'adjustedCost',
      'allocatedCost',
      'costCurrency',
      'costPerParticipant',
      'costPerConversation',
      'costPerMessage',
      'estimatedVisibleTextTokens',
      'estimatedReasoningTokens',
      'modelsUsed',
      'assistantModelMessageShare',
      'gpt55AssistantMessageSharePct',
      'chatModes',
      'firstActivityAt',
      'lastActivityAt',
      'zeroCreditRows',
      'creditRows',
    ],
    rows: chatbots.map((chatbot) => {
      const chatbotMessages = messagesByChatbot.get(chatbot.id) ?? []
      const participantKeys = new Set(
        chatbotMessages.map((message) => message.participantKey)
      )
      const chatbotThreadKeys = new Set(
        chatbotMessages.map((message) => message.threadKey)
      )
      const chatbotCreditRows = creditRows.filter(
        (credit) => credit.chatbotId === chatbot.id
      )
      const dates = chatbotMessages.map((message) =>
        message.messageCreatedAt.getTime()
      )
      const activity =
        courseActivityById.get(chatbot.course.id) ??
        emptyCourseActivityMetrics()
      const localAdjustedCost = adjustedCost(chatbotMessages, costConfig)
      const localAllocatedCost = allocateCost(
        localAdjustedCost,
        totalAdjustedCost,
        costConfig
      )
      return [
        chatbot.course.name,
        chatbot.course.displayName,
        chatbotKeyById.get(chatbot.id),
        chatbot.name,
        chatbot.course.startDate,
        chatbot.course.endDate,
        chatbot.modelSelection,
        chatbot.allowedModelIds.join('|'),
        chatbot.creditInitialCredits,
        chatbot.creditResetPeriod,
        chatbot.creditResetAmount,
        chatbot.creditMaxCredits,
        activity.participantCount,
        activity.responseCount,
        activity.windowResponseCount,
        participantKeys.size,
        safePercent(participantKeys.size, activity.participantCount),
        chatbotThreadKeys.size,
        chatbotMessages.length,
        chatbotMessages.filter((message) => message.role === 'user').length,
        chatbotMessages.filter((message) => message.role === 'assistant')
          .length,
        safeDivide(chatbotMessages.length, chatbotThreadKeys.size, 2),
        participantKeys.size > 0
          ? round(chatbotMessages.length / participantKeys.size, 2)
          : 0,
        sum(chatbotMessages.map((message) => toolCallCount(message.content))),
        sum(chatbotMessages.map((message) => message.attachmentCount)),
        round(sum(chatbotMessages.map((message) => message.creditsUsed ?? 0))),
        round(localAdjustedCost),
        round(localAllocatedCost),
        costConfig.currency,
        safeDivide(localAllocatedCost, participantKeys.size),
        safeDivide(localAllocatedCost, chatbotThreadKeys.size),
        safeDivide(localAllocatedCost, chatbotMessages.length),
        sum(chatbotMessages.map((message) => message.estimatedTextTokens)),
        sum(chatbotMessages.map((message) => message.estimatedReasoningTokens)),
        uniqueSorted(chatbotMessages.map((message) => message.modelId)).join(
          '|'
        ),
        formatModelMessageShares(chatbotMessages),
        modelMessageShare(chatbotMessages, 'gpt-5.5'),
        uniqueSorted(chatbotMessages.map((message) => message.chatMode)).join(
          '|'
        ),
        dates.length > 0 ? new Date(Math.min(...dates)) : null,
        dates.length > 0 ? new Date(Math.max(...dates)) : null,
        chatbotCreditRows.filter((credit) => credit.current.toNumber() <= 0)
          .length,
        chatbotCreditRows.length,
      ]
    }),
  })

  const messagesByThread = groupBy(messages, (message) => message.threadKey)
  sheets.push({
    name: 'Conversations',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'threadKey',
      'participantKey',
      'threadCreatedAt',
      'threadUpdatedAt',
      'firstMessageAt',
      'lastMessageAt',
      'messages',
      'userMessages',
      'assistantMessages',
      'toolCalls',
      'attachments',
      'creditsUsed',
      'estimatedVisibleTextTokens',
      'estimatedReasoningTokens',
      'chatModes',
      'modelsUsed',
      'topicClusters',
    ],
    rows: Array.from(messagesByThread.values()).map((threadMessages) => {
      const first = threadMessages[0]!
      const last = threadMessages[threadMessages.length - 1]!
      return [
        first.courseName,
        first.chatbotKey,
        first.chatbotName,
        first.threadKey,
        first.participantKey,
        first.threadCreatedAt,
        first.threadUpdatedAt,
        first.messageCreatedAt,
        last.messageCreatedAt,
        threadMessages.length,
        threadMessages.filter((message) => message.role === 'user').length,
        threadMessages.filter((message) => message.role === 'assistant').length,
        sum(threadMessages.map((message) => toolCallCount(message.content))),
        sum(threadMessages.map((message) => message.attachmentCount)),
        round(sum(threadMessages.map((message) => message.creditsUsed ?? 0))),
        sum(threadMessages.map((message) => message.estimatedTextTokens)),
        sum(threadMessages.map((message) => message.estimatedReasoningTokens)),
        uniqueSorted(threadMessages.map((message) => message.chatMode)).join(
          '|'
        ),
        uniqueSorted(threadMessages.map((message) => message.modelId)).join(
          '|'
        ),
        uniqueSorted(
          threadMessages
            .map((message) =>
              topicAssignmentByMessageKey.get(message.messageKey)
            )
            .filter(Boolean)
            .map((assignment) => assignment!.clusterId)
        ).join('|'),
      ]
    }),
  })

  const messagesByParticipantChatbot = groupBy(
    messages,
    (message) => `${message.chatbotId}:${message.participantKey}`
  )
  sheets.push({
    name: 'Participants',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'participantKey',
      'conversations',
      'activeDays',
      'messages',
      'userMessages',
      'assistantMessages',
      'creditsUsed',
      'estimatedVisibleTextTokens',
      'firstMessageAt',
      'lastMessageAt',
      'currentCredits',
      'totalCredits',
      'resetCount',
      'lastResetAt',
      'modelsUsed',
      'topicClusters',
    ],
    rows: Array.from(messagesByParticipantChatbot.values()).map(
      (participantMessages) => {
        const first = participantMessages[0]!
        const last = participantMessages[participantMessages.length - 1]!
        const credit = creditByParticipantChatbot.get(
          `${first.chatbotId}:${first.participantId}`
        )
        return [
          first.courseName,
          first.chatbotKey,
          first.chatbotName,
          first.participantKey,
          new Set(participantMessages.map((message) => message.threadKey)).size,
          new Set(
            participantMessages.map((message) =>
              toDateKey(message.messageCreatedAt)
            )
          ).size,
          participantMessages.length,
          participantMessages.filter((message) => message.role === 'user')
            .length,
          participantMessages.filter((message) => message.role === 'assistant')
            .length,
          round(
            sum(participantMessages.map((message) => message.creditsUsed ?? 0))
          ),
          sum(
            participantMessages.map((message) => message.estimatedTextTokens)
          ),
          first.messageCreatedAt,
          last.messageCreatedAt,
          credit?.current.toNumber() ?? null,
          credit?.total.toNumber() ?? null,
          credit?.resetCount ?? null,
          credit?.lastResetAt ?? null,
          uniqueSorted(
            participantMessages.map((message) => message.modelId)
          ).join('|'),
          uniqueSorted(
            participantMessages
              .map((message) =>
                topicAssignmentByMessageKey.get(message.messageKey)
              )
              .filter(Boolean)
              .map((assignment) => assignment!.clusterId)
          ).join('|'),
        ]
      }
    ),
  })

  sheets.push({
    name: 'Credits',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'participantKey',
      'current',
      'total',
      'resetCount',
      'periodStartedAt',
      'lastResetAt',
      'disclaimerAcceptedAt',
      'disclaimerDeclined',
      'createdAt',
      'updatedAt',
    ],
    rows: creditRows.map((credit) => {
      const chatbot = chatbotById.get(credit.chatbotId)
      return [
        chatbot?.course.name,
        chatbot ? chatbotKeyById.get(chatbot.id) : null,
        chatbot?.name,
        participantKeyById.get(credit.participantId),
        credit.current.toNumber(),
        credit.total.toNumber(),
        credit.resetCount,
        credit.periodStartedAt,
        credit.lastResetAt,
        credit.disclaimerAcceptedAt,
        credit.disclaimerDeclined,
        credit.createdAt,
        credit.updatedAt,
      ]
    }),
  })

  const dailyGroups = groupBy(
    messages,
    (message) => `${toDateKey(message.messageCreatedAt)}:${message.chatbotId}`
  )
  sheets.push({
    name: 'Daily Usage',
    headers: [
      'date',
      'courseName',
      'chatbotKey',
      'chatbotName',
      'activeParticipants',
      'conversations',
      'messages',
      'userMessages',
      'assistantMessages',
      'creditsUsed',
      'estimatedVisibleTextTokens',
      'toolCalls',
      'attachments',
    ],
    rows: Array.from(dailyGroups.values()).map((dailyMessages) => {
      const first = dailyMessages[0]!
      return [
        toDateKey(first.messageCreatedAt),
        first.courseName,
        first.chatbotKey,
        first.chatbotName,
        new Set(dailyMessages.map((message) => message.participantKey)).size,
        new Set(dailyMessages.map((message) => message.threadKey)).size,
        dailyMessages.length,
        dailyMessages.filter((message) => message.role === 'user').length,
        dailyMessages.filter((message) => message.role === 'assistant').length,
        round(sum(dailyMessages.map((message) => message.creditsUsed ?? 0))),
        sum(dailyMessages.map((message) => message.estimatedTextTokens)),
        sum(dailyMessages.map((message) => toolCallCount(message.content))),
        sum(dailyMessages.map((message) => message.attachmentCount)),
      ]
    }),
  })

  const weeklyGroups = groupBy(
    messages,
    (message) => `${isoWeekKey(message.messageCreatedAt)}:${message.chatbotId}`
  )
  sheets.push({
    name: 'Weekly Usage',
    headers: [
      'week',
      'courseName',
      'chatbotKey',
      'chatbotName',
      'activeParticipants',
      'conversations',
      'messages',
      'userMessages',
      'assistantMessages',
      'creditsUsed',
      'estimatedVisibleTextTokens',
    ],
    rows: Array.from(weeklyGroups.values()).map((weeklyMessages) => {
      const first = weeklyMessages[0]!
      return [
        isoWeekKey(first.messageCreatedAt),
        first.courseName,
        first.chatbotKey,
        first.chatbotName,
        new Set(weeklyMessages.map((message) => message.participantKey)).size,
        new Set(weeklyMessages.map((message) => message.threadKey)).size,
        weeklyMessages.length,
        weeklyMessages.filter((message) => message.role === 'user').length,
        weeklyMessages.filter((message) => message.role === 'assistant').length,
        round(sum(weeklyMessages.map((message) => message.creditsUsed ?? 0))),
        sum(weeklyMessages.map((message) => message.estimatedTextTokens)),
      ]
    }),
  })

  const assistantByModel = groupBy(
    assistantMessages.filter((message) => message.modelId),
    (message) =>
      `${message.chatbotId}:${message.modelId}:${message.reasoningEffort ?? ''}`
  )
  sheets.push({
    name: 'Models',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'modelId',
      'modelName',
      'deploymentId',
      'fallbackModel',
      'reasoningEffort',
      'assistantMessages',
      'participants',
      'conversations',
      'creditsUsed',
      'avgCreditsPerAssistantMessage',
      'estimatedVisibleOutputTokens',
      'estimatedReasoningTokens',
      'inputCostPerMillion',
      'outputCostPerMillion',
    ],
    rows: Array.from(assistantByModel.values()).map((modelMessages) => {
      const first = modelMessages[0]!
      const model = first.modelId ? modelById.get(first.modelId) : undefined
      const credits = sum(
        modelMessages.map((message) => message.creditsUsed ?? 0)
      )
      return [
        first.courseName,
        first.chatbotKey,
        first.chatbotName,
        first.modelId,
        model?.name ?? null,
        model?.deploymentId ?? null,
        model?.fallback ?? null,
        first.reasoningEffort,
        modelMessages.length,
        new Set(modelMessages.map((message) => message.participantKey)).size,
        new Set(modelMessages.map((message) => message.threadKey)).size,
        round(credits),
        modelMessages.length > 0 ? round(credits / modelMessages.length) : 0,
        sum(modelMessages.map((message) => message.estimatedTextTokens)),
        sum(modelMessages.map((message) => message.estimatedReasoningTokens)),
        model?.cost?.input ?? null,
        model?.cost?.output ?? null,
      ]
    }),
  })

  const toolRows = new Map<
    string,
    {
      courseName: string
      chatbotKey: string
      chatbotName: string
      toolName: string
      messages: Set<string>
      participants: Set<string>
      threads: Set<string>
      calls: number
    }
  >()
  for (const message of messages) {
    for (const toolName of toolNames(message.content)) {
      const key = `${message.chatbotId}:${toolName}`
      const row = toolRows.get(key) ?? {
        courseName: message.courseName,
        chatbotKey: message.chatbotKey,
        chatbotName: message.chatbotName,
        toolName,
        messages: new Set<string>(),
        participants: new Set<string>(),
        threads: new Set<string>(),
        calls: 0,
      }
      row.messages.add(message.messageKey)
      row.participants.add(message.participantKey)
      row.threads.add(message.threadKey)
      row.calls += asArray(message.content).filter(
        (item) => item.type === 'tool-call' && item.toolName === toolName
      ).length
      toolRows.set(key, row)
    }
  }
  sheets.push({
    name: 'Tool Calls',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'toolName',
      'calls',
      'messages',
      'participants',
      'conversations',
    ],
    rows: Array.from(toolRows.values()).map((row) => [
      row.courseName,
      row.chatbotKey,
      row.chatbotName,
      row.toolName,
      row.calls,
      row.messages.size,
      row.participants.size,
      row.threads.size,
    ]),
  })

  sheets.push({
    name: 'Tool Call Details',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'threadKey',
      'messageKey',
      'participantKey',
      'messageCreatedAt',
      'toolName',
      'toolCallId',
      'isError',
    ],
    rows: messages.flatMap(toolCallDetailRows),
  })

  sheets.push({
    name: 'Topic Clusters',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'clusterId',
      'topicLabel',
      'userMessages',
      'participants',
      'conversations',
      'firstMessageAt',
      'lastMessageAt',
      'avgUserMessageWords',
      'estimatedVisibleUserTokens',
      'avgClusterSimilarity',
      'topTerms',
    ],
    rows: topicAnalysis.clusters.map((cluster) => {
      const chatbot = chatbotById.get(cluster.chatbotId)
      return [
        chatbot?.course.name,
        chatbot ? chatbotKeyById.get(chatbot.id) : null,
        chatbot?.name,
        cluster.clusterId,
        cluster.label,
        cluster.userMessages,
        cluster.participants,
        cluster.threads,
        cluster.firstMessageAt,
        cluster.lastMessageAt,
        cluster.avgUserMessageWords,
        cluster.estimatedVisibleTokens,
        cluster.avgClusterSimilarity,
        cluster.topTerms,
      ]
    }),
  })

  sheets.push({
    name: 'Topic Terms',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'clusterId',
      'clusterLabel',
      'rank',
      'term',
      'kind',
      'score',
      'userMessages',
      'participants',
      'conversations',
    ],
    rows: topicAnalysis.terms.map((term) => {
      const chatbot = chatbotById.get(term.chatbotId)
      return [
        chatbot?.course.name,
        chatbot ? chatbotKeyById.get(chatbot.id) : null,
        chatbot?.name,
        term.clusterId,
        term.clusterLabel,
        term.rank,
        term.term,
        term.kind,
        term.score,
        term.userMessages,
        term.participants,
        term.threads,
      ]
    }),
  })

  sheets.push({
    name: 'Topic Assignments',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'messageKey',
      'threadKey',
      'participantKey',
      'messageCreatedAt',
      'clusterId',
      'topicLabel',
      'userMessageWords',
      'estimatedVisibleUserTokens',
      'clusterSimilarity',
      'topTerms',
    ],
    rows: userMessages.map((message) => {
      const assignment = topicAssignmentByMessageKey.get(message.messageKey)
      return [
        message.courseName,
        message.chatbotKey,
        message.chatbotName,
        message.messageKey,
        message.threadKey,
        message.participantKey,
        message.messageCreatedAt,
        assignment?.clusterId ?? 'unclustered',
        assignment?.clusterLabel ?? 'unclustered_or_below_threshold',
        message.textWordCount,
        message.estimatedTextTokens,
        assignment?.clusterSimilarity ?? null,
        assignment?.topTerms ?? '',
      ]
    }),
  })

  const messageMetadataHeaders = [
    'courseName',
    'chatbotKey',
    'chatbotName',
    'threadKey',
    'participantKey',
    'messageKey',
    'parentMessageKey',
    'role',
    'messageCreatedAt',
    'chatMode',
    'modelId',
    'reasoningEffort',
    'rating',
    'creditsUsed',
    'contentTypes',
    'textCharCount',
    'textWordCount',
    'estimatedTextTokens',
    'reasoningCharCount',
    'estimatedReasoningTokens',
    'toolCallCount',
    'attachmentCount',
    'topicClusterId',
  ]
  sheets.push({
    name: 'Message Metadata',
    headers: messageMetadataHeaders,
    rows: messages.map((message) => {
      const assignment = topicAssignmentByMessageKey.get(message.messageKey)
      const row = [
        message.courseName,
        message.chatbotKey,
        message.chatbotName,
        message.threadKey,
        message.participantKey,
        message.messageKey,
        message.parentId
          ? (messageKeyById.get(message.parentId) ?? null)
          : null,
        message.role,
        message.messageCreatedAt,
        message.chatMode,
        message.modelId,
        message.reasoningEffort,
        message.rating,
        message.creditsUsed,
        contentTypes(message.content),
        message.textCharCount,
        message.textWordCount,
        message.estimatedTextTokens,
        message.reasoningCharCount,
        message.estimatedReasoningTokens,
        toolCallCount(message.content),
        message.attachmentCount,
        assignment?.clusterId ?? null,
      ]

      return row
    }),
  })

  return sheets
}

async function main() {
  const options = parseArgs()
  const modelRegistry = parseModelRegistry()
  const costConfig = parseCostAnalysisConfig()
  const chatbots = await loadChatbots(options)

  if (chatbots.length === 0) {
    throw new Error(
      options.all
        ? `No chatbot activity found between ${formatDate(options.from)} and ${formatDate(options.to)}.`
        : `No chatbot/course found for ${options.scopeLabel}.`
    )
  }

  const chatbotIds = chatbots.map((chatbot) => chatbot.id)
  const courseIds = chatbots.map((chatbot) => chatbot.course.id)
  const [threads, creditRows, courseActivityById] = await Promise.all([
    loadThreads(chatbotIds, options),
    loadCreditRows(chatbotIds),
    loadCourseActivity(courseIds, options),
  ])
  const participantKeyById = createKeyMap(
    [
      ...threads.map((thread) => thread.participantId),
      ...creditRows.map((credit) => credit.participantId),
    ],
    'participant'
  )
  const threadKeyById = createKeyMap(
    threads.map((thread) => thread.id),
    'thread'
  )
  const messageKeyById = createKeyMap(
    threads.flatMap((thread) => thread.messages.map((message) => message.id)),
    'message'
  )
  const chatbotKeyById = createKeyMap(chatbotIds, 'chatbot')
  const messages = sortMessages(
    flattenMessages(
      chatbots,
      threads,
      chatbotKeyById,
      participantKeyById,
      threadKeyById,
      messageKeyById
    )
  )
  const topicAnalysis = buildTopicAnalysis(messages, options)
  const sheets = buildSheets(
    options,
    chatbots,
    chatbotKeyById,
    messages,
    creditRows,
    courseActivityById,
    topicAnalysis,
    modelRegistry,
    costConfig
  )
  const filename = `${sanitizeFilename(options.filePrefix)}.xlsx`
  const path = await writeWorkbookFile(options.outDir, filename, sheets)
  console.log(
    `Window: ${formatDate(options.from)} to ${formatDate(options.to)}`
  )
  console.log(`Chatbots: ${chatbots.length}`)
  console.log(
    `Active participants: ${
      new Set(messages.map((message) => message.participantKey)).size
    }`
  )
  console.log(
    `Conversations: ${new Set(messages.map((message) => message.threadKey)).size}`
  )
  console.log(`Messages: ${messages.length}`)
  console.log(
    `Credits used: ${round(sum(messages.map((message) => message.creditsUsed ?? 0)))}`
  )
  console.log(
    `Adjusted cost: ${round(adjustedCost(messages, costConfig))} ${costConfig.currency}`
  )
  if (costConfig.calibratedTotalCost !== null) {
    console.log(
      `Allocated cost: ${round(costConfig.calibratedTotalCost)} ${costConfig.currency}`
    )
  }
  console.log(`Output: ${path}`)
}

try {
  await main()
} catch (error) {
  console.error(
    `ERROR: ${error instanceof Error ? error.message : String(error)}`
  )
  console.error('Run with --help to see valid selectors and options.')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
