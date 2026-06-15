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

type SheetValue = string | number | boolean | Date | null | undefined

type WorkbookSheet = {
  name: string
  headers: string[]
  rows: SheetValue[][]
}

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
    outDir: resolve(getValue('--outDir') ?? resolve(repoRoot, 'output')),
    filePrefix,
  }
}

function sanitizeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeXmlText(value: string) {
  return value.replace(
    // XML 1.0 valid characters: tab, LF, CR, U+20-D7FF, E000-FFFD
    // eslint-disable-next-line no-control-regex
    /[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd]/g,
    ''
  )
}

function columnName(index: number) {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function safeSheetName(name: string) {
  return name.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31)
}

function cellXml(value: SheetValue, rowIndex: number, columnIndex: number) {
  const ref = `${columnName(columnIndex)}${rowIndex + 1}`
  if (value === null || value === undefined) return ''

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }

  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`
  }

  const text = sanitizeXmlText(
    value instanceof Date ? formatDate(value) : String(value)
  )
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`
}

function sheetXml(sheet: WorkbookSheet) {
  const rows = [sheet.headers, ...sheet.rows]
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetData>
${rows
  .map(
    (row, rowIndex) =>
      `    <row r="${rowIndex + 1}">${row
        .map((value, columnIndex) => cellXml(value, rowIndex, columnIndex))
        .join('')}</row>`
  )
  .join('\n')}
  </sheetData>
  <autoFilter ref="A1:${columnName(sheet.headers.length - 1)}${Math.max(rows.length, 1)}"/>
</worksheet>`
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

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i += 1) {
  let value = i
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  crcTable[i] = value >>> 0
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980)
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2)
  const day =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

function zip(entries: Array<{ name: string; content: string | Buffer }>) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  const { time, day } = dosDateTime()

  for (const entry of entries) {
    const name = Buffer.from(entry.name)
    const data = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8')
    const crc = crc32(data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(time, 10)
    localHeader.writeUInt16LE(day, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(data.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)
    localParts.push(localHeader, name, data)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(time, 12)
    centralHeader.writeUInt16LE(day, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(data.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, name)

    offset += localHeader.length + name.length + data.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

function buildWorkbook(sheets: WorkbookSheet[]) {
  const safeNames = sheets.map((sheet) => safeSheetName(sheet.name))
  const workbookSheets = safeNames
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join('')
  const workbookRels = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join('')
  const sheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('')

  return zip([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetOverrides}
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`,
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet),
    })),
  ])
}

async function writeWorkbookFile(
  outDir: string,
  filename: string,
  sheets: WorkbookSheet[]
) {
  const path = resolve(outDir, filename)
  await writeFile(path, buildWorkbook(sheets))
  console.log(`${filename}: ${sheets.length} sheet(s)`)
  for (const sheet of sheets) {
    console.log(`- ${sheet.name}: ${sheet.rows.length} row(s)`)
  }
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

  const sheets: WorkbookSheet[] = [
    {
      name: 'Messages',
      headers: [
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
      rows: messages.map((message) => [
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
      ]),
    },
  ]

  const messagesByThreadKey = groupBy(messages, (message) => message.threadKey)
  sheets.push({
    name: 'Threads',
    headers: [
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
    rows: Array.from(messagesByThreadKey.values()).map((threadMessages) => {
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
    }),
  })

  const messagesByParticipantKey = groupBy(
    messages,
    (message) => message.participantKey
  )
  sheets.push({
    name: 'Participants',
    headers: [
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
    rows: Array.from(messagesByParticipantKey.values()).map(
      (participantMessages) => {
        const first = participantMessages[0]!
        const last = participantMessages[participantMessages.length - 1]!
        return [
          first.participantKey,
          new Set(participantMessages.map((message) => message.threadKey)).size,
          participantMessages.length,
          participantMessages.filter((message) => message.role === 'user')
            .length,
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
      }
    ),
  })

  sheets.push({
    name: 'Tool Calls',
    headers: [
      'courseName',
      'chatbotName',
      'threadKey',
      'messageKey',
      'participantKey',
      'messageCreatedAt',
      'toolName',
      'isError',
    ],
    rows: messages.flatMap((message) =>
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
    ),
  })

  const chatbotById = new Map(chatbots.map((chatbot) => [chatbot.id, chatbot]))
  sheets.push({
    name: 'Credits',
    headers: [
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
    rows: creditRows.map((credit) => {
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
    }),
  })

  const filename = `${options.filePrefix}_${sanitizeFilename(options.query)}.xlsx`
  await writeWorkbookFile(options.outDir, filename, sheets)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
