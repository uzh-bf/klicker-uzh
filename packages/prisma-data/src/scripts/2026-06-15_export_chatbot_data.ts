import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

type CliOptions = {
  query: string
  from?: Date
  to?: Date
  outDir: string
  filePrefix: string
}

type ChatContentItem = {
  type?: unknown
  text?: unknown
  args?: unknown
  result?: unknown
  toolName?: unknown
  toolCallId?: unknown
}

type ChatbotExportMessage = {
  threadKey: string
  threadCreatedAt: Date
  threadUpdatedAt: Date
  participantKey: string
  courseId: string
  courseName: string
  chatbotId: string
  chatbotName: string
  role: string
  content: Prisma.JsonValue
  messageKey: string
  messageCreatedAt: Date
  chatMode: string | null
  creditsUsed: number | null
  modelId: string | null
  reasoningEffort: string | null
  attachmentCount: number
}

type CsvValue = string | number | boolean | Date | null | undefined

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../../../..')

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const getValue = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }

  const parseDate = (value: string | undefined) => {
    if (!value) return undefined
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date for export: ${value}`)
    }
    return date
  }

  const query = getValue('--query') ?? getValue('--course')
  if (!query) {
    throw new Error(
      'Missing required --query / --course value. Example: --query MAT183'
    )
  }

  const filePrefix =
    getValue('--filePrefix') ??
    `${new Date().toISOString().slice(0, 10)}_chatbot`

  return {
    query,
    from: parseDate(getValue('--from')),
    to: parseDate(getValue('--to')),
    outDir: resolve(getValue('--outDir') ?? repoRoot),
    filePrefix,
  }
}

function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return ''

  const stringValue =
    value instanceof Date ? formatDate(value) : String(value).replace(/\r/g, '')

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ].join('\n')
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '')
}

function asArray(value: Prisma.JsonValue): ChatContentItem[] {
  return Array.isArray(value) ? (value as ChatContentItem[]) : []
}

function textParts(value: Prisma.JsonValue): string[] {
  return asArray(value)
    .map((item) => (typeof item.text === 'string' ? item.text : null))
    .filter((text): text is string => Boolean(text))
}

function textCharCount(value: Prisma.JsonValue) {
  return textParts(value).join('\n\n').length
}

function textWordCount(value: Prisma.JsonValue) {
  const text = textParts(value).join(' ')
  return text.trim().length > 0 ? text.trim().split(/\s+/).length : 0
}

function contentTypes(value: Prisma.JsonValue) {
  return uniqueSorted(
    asArray(value).map((item) =>
      typeof item.type === 'string' ? item.type : null
    )
  ).join('|')
}

function toolCallCount(value: Prisma.JsonValue) {
  return asArray(value).filter((item) => item.type === 'tool-call').length
}

function extractToolCalls(message: ChatbotExportMessage) {
  return asArray(message.content)
    .filter((item) => item.type === 'tool-call')
    .map((item) => {
      const result =
        item.result && typeof item.result === 'object'
          ? (item.result as Record<string, unknown>)
          : null
      return {
        ...message,
        toolCallId:
          typeof item.toolCallId === 'string' ? item.toolCallId : null,
        toolName: typeof item.toolName === 'string' ? item.toolName : null,
        isError: typeof result?.isError === 'boolean' ? result.isError : null,
      }
    })
}

function countToolCalls(messages: ChatbotExportMessage[]) {
  return messages.reduce(
    (sum, message) => sum + toolCallCount(message.content),
    0
  )
}

function sumCredits(messages: ChatbotExportMessage[]) {
  return messages.reduce((sum, message) => sum + (message.creditsUsed ?? 0), 0)
}

function uniqueSorted(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort()
}

function createKeyMap(values: string[], prefix: string) {
  const uniqueValues = Array.from(new Set(values)).sort()
  return new Map(
    uniqueValues.map((value, index) => [
      value,
      `${prefix}_${String(index + 1).padStart(4, '0')}`,
    ])
  )
}

function groupBy<T>(values: T[], getKey: (value: T) => string) {
  const grouped = new Map<string, T[]>()
  for (const value of values) {
    const key = getKey(value)
    grouped.set(key, [...(grouped.get(key) ?? []), value])
  }
  return grouped
}

async function writeCsvFile(
  outDir: string,
  filename: string,
  headers: string[],
  rows: CsvValue[][]
) {
  const path = resolve(outDir, filename)
  await writeFile(path, `${toCsv(headers, rows)}\n`, 'utf8')
  console.log(`${filename}: ${rows.length} row(s)`)
}

async function main() {
  const options = parseArgs()

  const chatbots = await prisma.chatbot.findMany({
    where: {
      OR: [
        { name: { contains: options.query, mode: 'insensitive' } },
        { course: { name: { contains: options.query, mode: 'insensitive' } } },
        {
          course: {
            displayName: { contains: options.query, mode: 'insensitive' },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      creditInitialCredits: true,
      creditResetPeriod: true,
      creditResetAmount: true,
      creditMaxCredits: true,
      allowedModelIds: true,
      course: {
        select: {
          id: true,
          name: true,
          displayName: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
  })

  if (chatbots.length === 0) {
    throw new Error(`No chatbot/course found for query "${options.query}".`)
  }

  const now = new Date()
  const from =
    options.from ??
    new Date(
      Math.min(...chatbots.map((chatbot) => chatbot.course.startDate.getTime()))
    )
  const courseEnd = new Date(
    Math.max(...chatbots.map((chatbot) => chatbot.course.endDate.getTime()))
  )
  const to =
    options.to ?? (courseEnd.getTime() < now.getTime() ? courseEnd : now)

  const chatbotIds = chatbots.map((chatbot) => chatbot.id)
  const threads = await prisma.chatThread.findMany({
    where: {
      chatbotId: { in: chatbotIds },
      messages: {
        some: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
      },
    },
    select: {
      id: true,
      participantId: true,
      chatbot: {
        select: {
          id: true,
          name: true,
          course: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
      messages: {
        where: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: {
          id: true,
          role: true,
          content: true,
          chatMode: true,
          modelId: true,
          reasoningEffort: true,
          creditsUsed: true,
          createdAt: true,
          attachments: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const creditRows = await prisma.chatUsageCredits.findMany({
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

  const messages: ChatbotExportMessage[] = threads.flatMap((thread) =>
    thread.messages.map((message) => ({
      threadKey: threadKeyById.get(thread.id)!,
      threadCreatedAt: thread.createdAt,
      threadUpdatedAt: thread.updatedAt,
      participantKey: participantKeyById.get(thread.participantId)!,
      courseId: thread.chatbot.course.id,
      courseName: thread.chatbot.course.name,
      chatbotId: thread.chatbot.id,
      chatbotName: thread.chatbot.name,
      role: message.role,
      content: message.content as Prisma.JsonValue,
      messageKey: messageKeyById.get(message.id)!,
      messageCreatedAt: message.createdAt,
      chatMode: message.chatMode,
      creditsUsed: message.creditsUsed?.toNumber() ?? null,
      modelId: message.modelId,
      reasoningEffort: message.reasoningEffort,
      attachmentCount: message.attachments.length,
    }))
  )

  await mkdir(options.outDir, { recursive: true })

  console.log(`Query: ${options.query}`)
  console.log(`Chatbots: ${chatbots.map((chatbot) => chatbot.name).join(', ')}`)
  console.log(`Window: ${formatDate(from)} to ${formatDate(to)}`)
  console.log(`Output directory: ${options.outDir}`)
  console.log(`File prefix: ${options.filePrefix}`)

  await writeCsvFile(
    options.outDir,
    `${options.filePrefix}_export.csv`,
    [
      'courseName',
      'chatbotName',
      'threadKey',
      'participantKey',
      'messageKey',
      'role',
      'messageCreatedAt',
      'chatMode',
      'creditsUsed',
      'modelId',
      'reasoningEffort',
      'contentTypes',
      'textCharCount',
      'textWordCount',
      'toolCallCount',
      'attachmentCount',
    ],
    messages.map((message) => [
      message.courseName,
      message.chatbotName,
      message.threadKey,
      message.participantKey,
      message.messageKey,
      message.role,
      message.messageCreatedAt,
      message.chatMode,
      message.creditsUsed,
      message.modelId,
      message.reasoningEffort,
      contentTypes(message.content),
      textCharCount(message.content),
      textWordCount(message.content),
      toolCallCount(message.content),
      message.attachmentCount,
    ])
  )

  await writeCsvFile(
    options.outDir,
    `${options.filePrefix}_messages_enriched.csv`,
    [
      'courseName',
      'chatbotName',
      'threadKey',
      'messageKey',
      'participantKey',
      'role',
      'messageCreatedAt',
      'chatMode',
      'creditsUsed',
      'modelId',
      'reasoningEffort',
      'contentTypes',
      'textCharCount',
      'textWordCount',
      'toolCallCount',
      'attachmentCount',
    ],
    messages.map((message) => [
      message.courseName,
      message.chatbotName,
      message.threadKey,
      message.messageKey,
      message.participantKey,
      message.role,
      message.messageCreatedAt,
      message.chatMode,
      message.creditsUsed,
      message.modelId,
      message.reasoningEffort,
      contentTypes(message.content),
      textCharCount(message.content),
      textWordCount(message.content),
      toolCallCount(message.content),
      message.attachmentCount,
    ])
  )

  const messagesByThreadKey = groupBy(messages, (message) => message.threadKey)
  await writeCsvFile(
    options.outDir,
    `${options.filePrefix}_threads_summary.csv`,
    [
      'courseName',
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
      'chatModes',
      'modelIds',
    ],
    Array.from(messagesByThreadKey.values()).map((threadMessages) => {
      const first = threadMessages[0]!
      const last = threadMessages[threadMessages.length - 1]!
      return [
        first.courseName,
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
        countToolCalls(threadMessages),
        threadMessages.reduce(
          (sum, message) => sum + message.attachmentCount,
          0
        ),
        sumCredits(threadMessages),
        uniqueSorted(threadMessages.map((message) => message.chatMode)).join(
          '|'
        ),
        uniqueSorted(threadMessages.map((message) => message.modelId)).join(
          '|'
        ),
      ]
    })
  )

  const messagesByParticipantKey = groupBy(
    messages,
    (message) => message.participantKey
  )
  await writeCsvFile(
    options.outDir,
    `${options.filePrefix}_participants_summary.csv`,
    [
      'participantKey',
      'threads',
      'messages',
      'userMessages',
      'assistantMessages',
      'toolCalls',
      'attachments',
      'creditsUsed',
      'firstMessageAt',
      'lastMessageAt',
      'chatModes',
      'modelIds',
    ],
    Array.from(messagesByParticipantKey.values()).map((participantMessages) => {
      const first = participantMessages[0]!
      const last = participantMessages[participantMessages.length - 1]!
      return [
        first.participantKey,
        new Set(participantMessages.map((message) => message.threadKey)).size,
        participantMessages.length,
        participantMessages.filter((message) => message.role === 'user').length,
        participantMessages.filter((message) => message.role === 'assistant')
          .length,
        countToolCalls(participantMessages),
        participantMessages.reduce(
          (sum, message) => sum + message.attachmentCount,
          0
        ),
        sumCredits(participantMessages),
        first.messageCreatedAt,
        last.messageCreatedAt,
        uniqueSorted(
          participantMessages.map((message) => message.chatMode)
        ).join('|'),
        uniqueSorted(
          participantMessages.map((message) => message.modelId)
        ).join('|'),
      ]
    })
  )

  await writeCsvFile(
    options.outDir,
    `${options.filePrefix}_tool_calls.csv`,
    [
      'courseName',
      'chatbotName',
      'threadKey',
      'messageKey',
      'participantKey',
      'messageCreatedAt',
      'toolName',
      'isError',
    ],
    messages.flatMap((message) =>
      extractToolCalls(message).map((toolCall) => [
        toolCall.courseName,
        toolCall.chatbotName,
        toolCall.threadKey,
        toolCall.messageKey,
        toolCall.participantKey,
        toolCall.messageCreatedAt,
        toolCall.toolName,
        toolCall.isError,
      ])
    )
  )

  const chatbotById = new Map(chatbots.map((chatbot) => [chatbot.id, chatbot]))
  await writeCsvFile(
    options.outDir,
    `${options.filePrefix}_credits.csv`,
    [
      'courseName',
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
    creditRows.map((credit) => {
      const chatbot = chatbotById.get(credit.chatbotId)
      return [
        chatbot?.course.name,
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
    })
  )
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
