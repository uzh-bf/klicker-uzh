import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { WorkbookSheet } from './lib/simpleWorkbook.js'
import {
  formatDate,
  sanitizeFilename,
  writeWorkbookFile,
} from './lib/simpleWorkbook.js'

type CliOptions = {
  all: boolean
  query?: string
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
  creditsUsed: number | null
  attachmentCount: number
}

type TopicAssignment = {
  messageKey: string
  chatbotId: string
  clusterLabel: string
  clusterId: string
  topTerms: string
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
  topTerms: string
}

type TopicTermRow = {
  chatbotId: string
  term: string
  kind: string
  userMessages: number
  participants: number
  threads: number
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../../../..')
const todayPrefix = new Date().toISOString().slice(0, 10)

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
  'about',
  'after',
  'again',
  'all',
  'also',
  'and',
  'answer',
  'antwort',
  'auf',
  'aufgabe',
  'aus',
  'bei',
  'beim',
  'beispiel',
  'berechnen',
  'bitte',
  'can',
  'could',
  'das',
  'dass',
  'dem',
  'den',
  'der',
  'des',
  'die',
  'dies',
  'diese',
  'dieser',
  'dieses',
  'do',
  'does',
  'durch',
  'eine',
  'einem',
  'einen',
  'einer',
  'eines',
  'erkläre',
  'erklären',
  'explain',
  'für',
  'from',
  'frage',
  'fragen',
  'gibt',
  'habe',
  'haben',
  'hat',
  'hello',
  'help',
  'hier',
  'how',
  'ich',
  'im',
  'in',
  'ist',
  'kann',
  'kannst',
  'können',
  'machen',
  'man',
  'mit',
  'nicht',
  'oder',
  'please',
  'question',
  'sich',
  'sie',
  'sind',
  'so',
  'the',
  'this',
  'und',
  'uns',
  'von',
  'was',
  'wenn',
  'wer',
  'what',
  'wie',
  'wieso',
  'wir',
  'with',
  'would',
  'you',
  'zum',
  'zur',
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
  role: true,
  content: true,
  chatMode: true,
  modelId: true,
  reasoningEffort: true,
  reasoningContent: true,
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
    role: string
    content: Prisma.JsonValue
    chatMode: string | null
    modelId: string | null
    reasoningEffort: string | null
    reasoningContent: string | null
    creditsUsed: unknown
    createdAt: Date
    attachments: Array<{ id: string }>
  }>
}

function usage() {
  return [
    'Usage:',
    '  pnpm --filter @klicker-uzh/prisma-data script:prod src/scripts/2026-06-16_analyze_chatbot_usage.ts --all',
    '  pnpm --filter @klicker-uzh/prisma-data script:prod src/scripts/2026-06-16_analyze_chatbot_usage.ts --query MAT183',
    '',
    'Options:',
    '  --all                      Analyze all chatbots with activity in the date window.',
    '  --query, --course <text>    Restrict to matching course/chatbot names.',
    '  --semester <current|fs26>   Date window when --from/--to are omitted. Default: current.',
    '  --from YYYY-MM-DD           Inclusive start date.',
    '  --to YYYY-MM-DD             Inclusive end date.',
    '  --outDir <path>             Output directory. Default: output/.',
    '  --filePrefix <prefix>       Output filename prefix. Default: date + scope.',
    '  --minTopicMessages <n>      Minimum user messages for topic labels. Default: 5.',
    '  --minTopicParticipants <n>  Minimum participants for topic labels. Default: 3.',
  ].join('\n')
}

function getArgValue(args: string[], name: string) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function hasFlag(args: string[], name: string) {
  return args.includes(name)
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

  const all = hasFlag(args, '--all')
  const query = getArgValue(args, '--query') ?? getArgValue(args, '--course')
  if (!all && !query) {
    throw new Error(
      'Pass either --all or --query. No course is selected by default.'
    )
  }

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

  const scope = query ? sanitizeFilename(query) : 'all_chatbots'
  const windowLabel = getArgValue(args, '--semester') ?? defaultWindow.label
  const filePrefix =
    getArgValue(args, '--filePrefix') ??
    `${todayPrefix}_chatbot_usage_analytics_${sanitizeFilename(windowLabel)}_${scope}`

  return {
    all,
    query,
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

function normalizeTermText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S+@\S+\.\S+/g, ' ')
    .replace(/[’']/g, ' ')
}

function tokenizeForTopics(text: string) {
  const tokens =
    normalizeTermText(text).match(/\p{L}[\p{L}\p{M}-]{2,31}/gu) ?? []

  return tokens
    .map((token) => token.replace(/^-+|-+$/g, ''))
    .filter((token) => {
      if (token.length < 3 || token.length > 32) return false
      if (STOPWORDS.has(token)) return false
      if (/\d/.test(token)) return false
      if (/^[-]+$/.test(token)) return false
      return true
    })
}

function topicTermsForMessage(text: string) {
  const tokens = tokenizeForTopics(text)
  const terms = new Set<string>()

  for (const token of tokens) {
    terms.add(`unigram:${token}`)
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index]
    const second = tokens[index + 1]
    if (first && second && first !== second) {
      terms.add(`bigram:${first} ${second}`)
    }
  }

  return Array.from(terms)
}

function topicLabel(termKey: string) {
  return termKey.replace(/^(unigram|bigram):/, '')
}

function topicKind(termKey: string) {
  return termKey.startsWith('bigram:') ? 'bigram' : 'unigram'
}

function buildTopicAnalysis(
  messages: MessageRecord[],
  options: Pick<CliOptions, 'minTopicMessages' | 'minTopicParticipants'>
) {
  const userMessages = messages.filter(
    (message) => message.role === 'user' && message.text.trim().length > 0
  )
  const termStats = new Map<
    string,
    {
      chatbotId: string
      termKey: string
      messageKeys: Set<string>
      participantKeys: Set<string>
      threadKeys: Set<string>
      count: number
    }
  >()
  const termsByMessageKey = new Map<string, string[]>()

  for (const message of userMessages) {
    const terms = topicTermsForMessage(message.text)
    termsByMessageKey.set(message.messageKey, terms)

    for (const term of terms) {
      const key = `${message.chatbotId}:${term}`
      const stats = termStats.get(key) ?? {
        chatbotId: message.chatbotId,
        termKey: term,
        messageKeys: new Set<string>(),
        participantKeys: new Set<string>(),
        threadKeys: new Set<string>(),
        count: 0,
      }
      stats.messageKeys.add(message.messageKey)
      stats.participantKeys.add(message.participantKey)
      stats.threadKeys.add(message.threadKey)
      stats.count += 1
      termStats.set(key, stats)
    }
  }

  const eligibleTerms = Array.from(termStats.values()).filter(
    (stats) =>
      stats.messageKeys.size >= options.minTopicMessages &&
      stats.participantKeys.size >= options.minTopicParticipants
  )
  const eligibleTermByChatbot = groupBy(
    eligibleTerms,
    (stats) => stats.chatbotId
  )
  const initialAssignments = new Map<string, string | null>()

  for (const message of userMessages) {
    const terms = new Set(termsByMessageKey.get(message.messageKey) ?? [])
    const candidates = eligibleTermByChatbot
      .get(message.chatbotId)
      ?.filter((stats) => terms.has(stats.termKey))

    if (!candidates || candidates.length === 0) {
      initialAssignments.set(message.messageKey, null)
      continue
    }

    candidates.sort((a, b) => {
      const scoreA =
        a.messageKeys.size * 2 +
        a.participantKeys.size * 3 +
        (topicKind(a.termKey) === 'bigram' ? 5 : 0)
      const scoreB =
        b.messageKeys.size * 2 +
        b.participantKeys.size * 3 +
        (topicKind(b.termKey) === 'bigram' ? 5 : 0)
      if (scoreA !== scoreB) return scoreB - scoreA
      return topicLabel(a.termKey).localeCompare(topicLabel(b.termKey))
    })

    initialAssignments.set(message.messageKey, candidates[0]!.termKey)
  }

  const clusterStats = new Map<
    string,
    {
      chatbotId: string
      termKey: string | null
      messages: MessageRecord[]
    }
  >()

  for (const message of userMessages) {
    const term = initialAssignments.get(message.messageKey) ?? null
    const key = `${message.chatbotId}:${term ?? 'unclustered'}`
    const stats = clusterStats.get(key) ?? {
      chatbotId: message.chatbotId,
      termKey: term,
      messages: [],
    }
    stats.messages.push(message)
    clusterStats.set(key, stats)
  }

  const eligibleClusterTerms = new Set(
    Array.from(clusterStats.values())
      .filter((cluster) => cluster.termKey !== null)
      .filter((cluster) => {
        const participantCount = new Set(
          cluster.messages.map((message) => message.participantKey)
        ).size
        return (
          cluster.messages.length >= options.minTopicMessages &&
          participantCount >= options.minTopicParticipants
        )
      })
      .map((cluster) => `${cluster.chatbotId}:${cluster.termKey}`)
  )

  const assignments: TopicAssignment[] = []
  const finalClusterStats = new Map<
    string,
    {
      chatbotId: string
      label: string
      messages: MessageRecord[]
    }
  >()

  for (const message of userMessages) {
    const term = initialAssignments.get(message.messageKey) ?? null
    const isEligible =
      term !== null && eligibleClusterTerms.has(`${message.chatbotId}:${term}`)
    const label = isEligible
      ? topicLabel(term)
      : 'unclustered_or_below_threshold'
    const key = `${message.chatbotId}:${label}`
    const stats = finalClusterStats.get(key) ?? {
      chatbotId: message.chatbotId,
      label,
      messages: [],
    }
    stats.messages.push(message)
    finalClusterStats.set(key, stats)
  }

  const clustersByChatbot = groupBy(
    Array.from(finalClusterStats.values()),
    (cluster) => cluster.chatbotId
  )
  const clusterIdByKey = new Map<string, string>()
  const clusters: TopicClusterRow[] = []

  for (const [chatbotId, chatbotClusters] of clustersByChatbot.entries()) {
    chatbotClusters.sort((a, b) => {
      if (a.label === 'unclustered_or_below_threshold') return 1
      if (b.label === 'unclustered_or_below_threshold') return -1
      if (a.messages.length !== b.messages.length) {
        return b.messages.length - a.messages.length
      }
      return a.label.localeCompare(b.label)
    })

    chatbotClusters.forEach((cluster, index) => {
      const clusterId =
        cluster.label === 'unclustered_or_below_threshold'
          ? 'unclustered'
          : `topic_${String(index + 1).padStart(3, '0')}`
      clusterIdByKey.set(`${chatbotId}:${cluster.label}`, clusterId)

      const participants = new Set(
        cluster.messages.map((message) => message.participantKey)
      )
      const threads = new Set(
        cluster.messages.map((message) => message.threadKey)
      )
      const dates = cluster.messages.map((message) =>
        message.messageCreatedAt.getTime()
      )
      const topTerms = topTermsForMessages(cluster.messages, eligibleTerms)

      clusters.push({
        chatbotId,
        clusterId,
        label: cluster.label,
        userMessages: cluster.messages.length,
        participants: participants.size,
        threads: threads.size,
        firstMessageAt: dates.length > 0 ? new Date(Math.min(...dates)) : null,
        lastMessageAt: dates.length > 0 ? new Date(Math.max(...dates)) : null,
        avgUserMessageWords: round(
          average(cluster.messages.map((message) => message.textWordCount)),
          2
        ),
        estimatedVisibleTokens: sum(
          cluster.messages.map((message) => message.estimatedTextTokens)
        ),
        topTerms: cluster.label.startsWith('unclustered')
          ? ''
          : topTerms.join('|'),
      })
    })
  }

  for (const message of userMessages) {
    const term = initialAssignments.get(message.messageKey) ?? null
    const isEligible =
      term !== null && eligibleClusterTerms.has(`${message.chatbotId}:${term}`)
    const label = isEligible
      ? topicLabel(term)
      : 'unclustered_or_below_threshold'
    const clusterId =
      clusterIdByKey.get(`${message.chatbotId}:${label}`) ?? 'unclustered'
    assignments.push({
      messageKey: message.messageKey,
      chatbotId: message.chatbotId,
      clusterLabel: label,
      clusterId,
      topTerms:
        label === 'unclustered_or_below_threshold'
          ? ''
          : topTermsForMessages([message], eligibleTerms).join('|'),
    })
  }

  const terms: TopicTermRow[] = eligibleTerms
    .map((stats) => ({
      chatbotId: stats.chatbotId,
      term: topicLabel(stats.termKey),
      kind: topicKind(stats.termKey),
      userMessages: stats.messageKeys.size,
      participants: stats.participantKeys.size,
      threads: stats.threadKeys.size,
    }))
    .sort((a, b) => {
      if (a.chatbotId !== b.chatbotId)
        return a.chatbotId.localeCompare(b.chatbotId)
      if (a.userMessages !== b.userMessages)
        return b.userMessages - a.userMessages
      return a.term.localeCompare(b.term)
    })

  return { assignments, clusters, terms }
}

function topTermsForMessages(
  messages: MessageRecord[],
  eligibleTerms: Array<{
    chatbotId: string
    termKey: string
    messageKeys: Set<string>
    participantKeys: Set<string>
  }>
) {
  const messageKeys = new Set(messages.map((message) => message.messageKey))
  return eligibleTerms
    .map((term) => ({
      label: topicLabel(term.termKey),
      kind: topicKind(term.termKey),
      count: Array.from(term.messageKeys).filter((key) => messageKeys.has(key))
        .length,
      participants: Array.from(term.participantKeys).length,
    }))
    .filter((term) => term.count > 0)
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count
      if (a.kind !== b.kind) return a.kind === 'bigram' ? -1 : 1
      return a.label.localeCompare(b.label)
    })
    .slice(0, 8)
    .map((term) => term.label)
}

async function loadChatbots(options: CliOptions) {
  const activeWindowFilter = {
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
  const queryFilter = options.query
    ? {
        OR: [
          { name: { contains: options.query, mode: 'insensitive' as const } },
          {
            course: {
              name: { contains: options.query, mode: 'insensitive' as const },
            },
          },
          {
            course: {
              displayName: {
                contains: options.query,
                mode: 'insensitive' as const,
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
  topicAnalysis: ReturnType<typeof buildTopicAnalysis>,
  modelRegistry: ModelConfig[]
): WorkbookSheet[] {
  const chatbotById = new Map(chatbots.map((chatbot) => [chatbot.id, chatbot]))
  const modelById = new Map(modelRegistry.map((model) => [model.id, model]))
  const creditByParticipantChatbot = new Map(
    creditRows.map((credit) => [
      `${credit.chatbotId}:${credit.participantId}`,
      credit,
    ])
  )
  const topicAssignmentByMessageKey = new Map(
    topicAnalysis.assignments.map((assignment) => [
      assignment.messageKey,
      assignment,
    ])
  )

  const activeParticipantKeys = new Set(
    messages.map((message) => message.participantKey)
  )
  const threadKeys = new Set(messages.map((message) => message.threadKey))
  const totalCredits = sum(messages.map((message) => message.creditsUsed ?? 0))
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
        ['scope', options.query ? `query:${options.query}` : 'all chatbots'],
        ['chatbots', chatbots.length],
        [
          'privacy',
          'No raw message text, participant names, emails, LMS identifiers, or database ids are included.',
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
          'topics',
          `Keyword-based local topic clustering; labels require at least ${options.minTopicMessages} user messages and ${options.minTopicParticipants} participants.`,
        ],
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
      'activeParticipants',
      'conversations',
      'messages',
      'userMessages',
      'assistantMessages',
      'avgMessagesPerParticipant',
      'toolCalls',
      'attachments',
      'creditsUsed',
      'estimatedVisibleTextTokens',
      'estimatedReasoningTokens',
      'modelsUsed',
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
        participantKeys.size,
        chatbotThreadKeys.size,
        chatbotMessages.length,
        chatbotMessages.filter((message) => message.role === 'user').length,
        chatbotMessages.filter((message) => message.role === 'assistant')
          .length,
        participantKeys.size > 0
          ? round(chatbotMessages.length / participantKeys.size, 2)
          : 0,
        sum(chatbotMessages.map((message) => toolCallCount(message.content))),
        sum(chatbotMessages.map((message) => message.attachmentCount)),
        round(sum(chatbotMessages.map((message) => message.creditsUsed ?? 0))),
        sum(chatbotMessages.map((message) => message.estimatedTextTokens)),
        sum(chatbotMessages.map((message) => message.estimatedReasoningTokens)),
        uniqueSorted(chatbotMessages.map((message) => message.modelId)).join(
          '|'
        ),
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
      'term',
      'kind',
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
        term.term,
        term.kind,
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
        assignment?.topTerms ?? '',
      ]
    }),
  })

  sheets.push({
    name: 'Message Metadata',
    headers: [
      'courseName',
      'chatbotKey',
      'chatbotName',
      'threadKey',
      'participantKey',
      'messageKey',
      'role',
      'messageCreatedAt',
      'chatMode',
      'modelId',
      'reasoningEffort',
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
    ],
    rows: messages.map((message) => {
      const assignment = topicAssignmentByMessageKey.get(message.messageKey)
      return [
        message.courseName,
        message.chatbotKey,
        message.chatbotName,
        message.threadKey,
        message.participantKey,
        message.messageKey,
        message.role,
        message.messageCreatedAt,
        message.chatMode,
        message.modelId,
        message.reasoningEffort,
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
    }),
  })

  return sheets
}

async function main() {
  const options = parseArgs()
  const modelRegistry = parseModelRegistry()
  const chatbots = await loadChatbots(options)

  if (chatbots.length === 0) {
    throw new Error(
      `No chatbot activity found for the selected scope between ${formatDate(options.from)} and ${formatDate(options.to)}.`
    )
  }

  const chatbotIds = chatbots.map((chatbot) => chatbot.id)
  const [threads, creditRows] = await Promise.all([
    loadThreads(chatbotIds, options),
    loadCreditRows(chatbotIds),
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
    topicAnalysis,
    modelRegistry
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
  console.log(`Output: ${path}`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
