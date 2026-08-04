import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { exportChatbotData } from '../src/chatbotExport.js'
import type { RawChatbotExportRow } from '../src/chatbotTransform.js'
import type { ReadonlyPrismaClient } from '../src/readonlyPrisma.js'

const exportedAt = '2026-08-04T12:00:00.000Z'

function rawChatbot(id: string): RawChatbotExportRow {
  const createdAt = new Date('2026-08-04T10:00:00.000Z')
  const updatedAt = new Date('2026-08-04T11:00:00.000Z')

  return {
    id,
    name: `Chatbot ${id}`,
    description: null,
    systemPrompts: null,
    creditInitialCredits: 1,
    creditResetPeriod: 'WEEKLY',
    creditResetAmount: 1,
    creditMaxCredits: 5,
    modelSelection: true,
    allowedModelIds: ['evaluation-model'],
    allowedReasoningEffortsByModel: null,
    createdAt,
    updatedAt,
    threads: [
      {
        id: `thread-${id}`,
        title: 'Evaluation thread',
        participantId: 'source-participant',
        createdAt,
        updatedAt,
        messages: [
          {
            id: `message-${id}`,
            parentId: null,
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
            chatMode: 'tutor',
            modelId: 'evaluation-model',
            reasoningEffort: null,
            reasoningContent: null,
            creditsUsed: null,
            createdAt,
            updatedAt,
            attachments: [
              {
                id: `attachment-${id}`,
                type: 'IMAGE',
                position: 0,
                imageDescription: 'A chart',
                createdAt,
                updatedAt,
              },
            ],
          },
        ],
      },
    ],
  }
}

function fakeReadonlyPrisma(
  rows: RawChatbotExportRow[],
  onFindMany?: (args: unknown) => void
): ReadonlyPrismaClient {
  return {
    chatbot: {
      findMany: async (args: unknown) => {
        onFindMany?.(args)
        return rows
      },
    },
  } as unknown as ReadonlyPrismaClient
}

describe('chatbot export service', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true }))
    )
  })

  async function makeOutputDirectory() {
    const root = await mkdtemp(join(tmpdir(), 'chatbot-export-test-'))
    temporaryDirectories.push(root)
    return join(root, 'nested-output')
  }

  it('rejects an empty chatbot selection before querying or writing', async () => {
    const outputDir = await makeOutputDirectory()
    let queried = false

    await expect(
      exportChatbotData(
        fakeReadonlyPrisma([], () => {
          queried = true
        }),
        [],
        outputDir,
        { exportedAt }
      )
    ).rejects.toThrow('At least one chatbot id is required')
    expect(queried).toBe(false)
    await expect(readdir(outputDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('queries an explicit safe projection and writes owner-only JSON', async () => {
    const outputDir = await makeOutputDirectory()
    let query: unknown

    const result = await exportChatbotData(
      fakeReadonlyPrisma([rawChatbot('source-chatbot-a')], (args) => {
        query = args
      }),
      ['source-chatbot-a'],
      outputDir,
      { exportedAt }
    )

    expect(query).toMatchObject({
      where: { id: { in: ['source-chatbot-a'] } },
      select: {
        id: true,
        name: true,
        threads: {
          select: {
            id: true,
            participantId: true,
            messages: {
              select: {
                id: true,
                content: true,
                attachments: {
                  select: {
                    id: true,
                    type: true,
                    position: true,
                    imageDescription: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    expect(JSON.stringify(query)).not.toMatch(
      /openaiApiKey|openaiBaseUrl|ownerId|courseId|disclaimerId|avatar|mcp|usageCredits|participant\W|imageBase64|imagePreviewBase64/
    )
    expect(result.outputPath).toBe(
      join(outputDir, 'chatbot-export-2026-08-04T12-00-00-000Z.json')
    )
    expect((await stat(outputDir)).mode & 0o777).toBe(0o700)
    expect((await stat(result.outputPath)).mode & 0o777).toBe(0o600)
    expect(await readFile(result.outputPath, 'utf8')).toBe(
      `${JSON.stringify(result.document, null, 2)}\n`
    )
    expect(result.counts).toEqual(result.document.counts)
  })

  it('deduplicates and sorts ids before querying', async () => {
    const outputDir = await makeOutputDirectory()
    let query: unknown

    await exportChatbotData(
      fakeReadonlyPrisma(
        [rawChatbot('source-chatbot-a'), rawChatbot('source-chatbot-b')],
        (args) => {
          query = args
        }
      ),
      ['source-chatbot-b', 'source-chatbot-a', 'source-chatbot-b'],
      outputDir,
      { exportedAt }
    )

    expect(query).toMatchObject({
      where: {
        id: { in: ['source-chatbot-a', 'source-chatbot-b'] },
      },
    })
  })

  it('names every missing chatbot and does not touch the filesystem', async () => {
    const outputDir = await makeOutputDirectory()

    await expect(
      exportChatbotData(
        fakeReadonlyPrisma([rawChatbot('source-chatbot-a')]),
        ['source-chatbot-c', 'source-chatbot-a', 'source-chatbot-b'],
        outputDir,
        { exportedAt }
      )
    ).rejects.toThrow('Chatbots not found: source-chatbot-b, source-chatbot-c')
    await expect(readdir(outputDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('builds the document before touching the filesystem', async () => {
    const outputDir = await makeOutputDirectory()
    const row = rawChatbot('source-chatbot-a')
    row.threads[0]!.messages[0]!.parentId = row.threads[0]!.messages[0]!.id

    await expect(
      exportChatbotData(
        fakeReadonlyPrisma([row]),
        ['source-chatbot-a'],
        outputDir,
        { exportedAt }
      )
    ).rejects.toThrow('Self-referencing parent message id')
    await expect(readdir(outputDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects an insecure existing output directory without changing it', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'chatbot-export-test-'))
    temporaryDirectories.push(outputDir)
    await chmod(outputDir, 0o750)

    await expect(
      exportChatbotData(
        fakeReadonlyPrisma([rawChatbot('source-chatbot-a')]),
        ['source-chatbot-a'],
        outputDir,
        { exportedAt }
      )
    ).rejects.toThrow('Output directory must be owner-only')
    expect((await stat(outputDir)).mode & 0o777).toBe(0o750)
    expect(await readdir(outputDir)).toEqual([])
  })

  it('does not follow or overwrite an existing output-file symlink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chatbot-export-test-'))
    temporaryDirectories.push(root)
    const outputDir = join(root, 'output')
    const targetPath = join(root, 'target.json')
    const outputPath = join(
      outputDir,
      'chatbot-export-2026-08-04T12-00-00-000Z.json'
    )
    await mkdir(outputDir, { mode: 0o700 })
    await writeFile(targetPath, 'keep me', { mode: 0o600 })
    await symlink(targetPath, outputPath)

    await expect(
      exportChatbotData(
        fakeReadonlyPrisma([rawChatbot('source-chatbot-a')]),
        ['source-chatbot-a'],
        outputDir,
        { exportedAt }
      )
    ).rejects.toThrow(`Output file already exists: ${outputPath}`)
    expect(await readFile(targetPath, 'utf8')).toBe('keep me')
    expect(await readdir(outputDir)).toEqual([
      'chatbot-export-2026-08-04T12-00-00-000Z.json',
    ])
  })
})
