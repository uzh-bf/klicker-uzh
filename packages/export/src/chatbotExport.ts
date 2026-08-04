import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import type { Prisma } from '@klicker-uzh/prisma/client'

import {
  buildChatbotExportDocument,
  type ChatbotExportDocument,
  type RawChatbotExportRow,
} from './chatbotTransform.js'
import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

const CHATBOT_EXPORT_SELECT = {
  id: true,
  name: true,
  description: true,
  systemPrompts: true,
  creditInitialCredits: true,
  creditResetPeriod: true,
  creditResetAmount: true,
  creditMaxCredits: true,
  modelSelection: true,
  allowedModelIds: true,
  allowedReasoningEffortsByModel: true,
  createdAt: true,
  updatedAt: true,
  threads: {
    select: {
      id: true,
      title: true,
      participantId: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        select: {
          id: true,
          parentId: true,
          role: true,
          content: true,
          chatMode: true,
          modelId: true,
          reasoningEffort: true,
          reasoningContent: true,
          creditsUsed: true,
          createdAt: true,
          updatedAt: true,
          attachments: {
            select: {
              id: true,
              type: true,
              position: true,
              imageDescription: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ChatbotSelect

export interface ChatbotExportResult {
  outputPath: string
  counts: ChatbotExportDocument['counts']
  document: ChatbotExportDocument
}

export interface ChatbotExportOptions {
  exportedAt?: string
}

function prepareOutputDirectory(outputDir: string) {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true, mode: 0o700 })
  }

  const outputDirectoryStats = lstatSync(outputDir)
  if (
    outputDirectoryStats.isSymbolicLink() ||
    !outputDirectoryStats.isDirectory()
  ) {
    throw new Error(`Output directory is not a regular directory: ${outputDir}`)
  }
  if ((outputDirectoryStats.mode & 0o077) !== 0) {
    throw new Error(
      `Output directory must be owner-only (0700 or stricter): ${outputDir}`
    )
  }
}

function writeOwnerOnlyFile(outputPath: string, content: string) {
  const temporaryPath = `${outputPath}.${process.pid}-${randomUUID()}.tmp`
  let fileDescriptor: number | undefined

  try {
    fileDescriptor = openSync(temporaryPath, 'wx', 0o600)
    writeFileSync(fileDescriptor, content, { encoding: 'utf8' })
    fsyncSync(fileDescriptor)
    closeSync(fileDescriptor)
    fileDescriptor = undefined

    try {
      linkSync(temporaryPath, outputPath)
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        throw new Error(`Output file already exists: ${outputPath}`)
      }
      throw error
    }
  } finally {
    if (fileDescriptor != null) closeSync(fileDescriptor)
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
  }
}

export async function exportChatbotData(
  prisma: ReadonlyPrismaClient,
  chatbotIds: string[],
  outputDir: string,
  options: ChatbotExportOptions = {}
): Promise<ChatbotExportResult> {
  const uniqueIds = [...new Set(chatbotIds)].sort()
  if (uniqueIds.length === 0) {
    throw new Error('At least one chatbot id is required')
  }

  const rows = await prisma.chatbot.findMany({
    where: { id: { in: uniqueIds } },
    select: CHATBOT_EXPORT_SELECT,
  })

  const returnedIds = new Set(rows.map((row) => row.id))
  const missingIds = uniqueIds.filter((id) => !returnedIds.has(id))
  if (missingIds.length > 0) {
    throw new Error(`Chatbots not found: ${missingIds.join(', ')}`)
  }

  const exportedAt = options.exportedAt ?? new Date().toISOString()
  const rawRows: RawChatbotExportRow[] = rows.map((row) => ({
    ...row,
    systemPrompts: row.systemPrompts as Prisma.JsonValue | null,
    allowedReasoningEffortsByModel:
      row.allowedReasoningEffortsByModel as Prisma.JsonValue | null,
    threads: row.threads.map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) => ({
        ...message,
        content: message.content as Prisma.JsonValue,
      })),
    })),
  }))
  const document = buildChatbotExportDocument(rawRows, exportedAt)
  const filename = `chatbot-export-${exportedAt.replace(/[^0-9A-Za-z-]/g, '-')}.json`

  prepareOutputDirectory(outputDir)
  const outputPath = join(outputDir, filename)
  writeOwnerOnlyFile(outputPath, `${JSON.stringify(document, null, 2)}\n`)

  return { outputPath, counts: document.counts, document }
}
