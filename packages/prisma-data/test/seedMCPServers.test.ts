import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { seedChatbotMCPConfigurations } from '../src/data/seedMCPServers.js'

const KB_SERVER = {
  id: 'kb-server',
  name: 'KB',
}

function createPrismaMock({
  enabledKbIds,
  hasExistingConfig,
  existingParameters = null,
}: {
  enabledKbIds: string[]
  hasExistingConfig: boolean
  existingParameters?: unknown
}) {
  const updates: Array<Record<string, unknown>> = []
  const creates: Array<Record<string, unknown>> = []

  const prisma = {
    kBChatbot: {
      findMany: async () => enabledKbIds.map((kbId) => ({ kbId })),
    },
    chatbotMCPConfig: {
      findUnique: async ({
        where,
      }: {
        where: {
          chatbotId_mcpServerId_chatMode: { chatMode: string }
        }
      }) =>
        hasExistingConfig
          ? {
              id: `config-${where.chatbotId_mcpServerId_chatMode.chatMode}`,
              parameters: existingParameters,
            }
          : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data)
        return data
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creates.push(data)
        return data
      },
    },
  } as unknown as PrismaClient

  return { prisma, updates, creates }
}

describe('KB chatbot MCP seed reconciliation', () => {
  for (const [enabledKbIds, expectedKbIds] of [
    [[], []],
    [['kb-single'], ['kb-single']],
    [
      ['kb-z', 'kb-a', 'kb-z'],
      ['kb-a', 'kb-z'],
    ],
  ]) {
    for (const hasExistingConfig of [true, false]) {
      test(`${hasExistingConfig ? 'updates' : 'creates'} ${enabledKbIds.length} KB configs`, async () => {
        const existingParameters = {
          unrelated: 'preserved',
          required: true,
          toolAlias: 'doc_query',
          kb_id: 'legacy-kb',
          kb_ids: ['stale-kb'],
        }
        const { prisma, updates, creates } = createPrismaMock({
          enabledKbIds,
          hasExistingConfig,
          existingParameters,
        })

        await seedChatbotMCPConfigurations(prisma, [KB_SERVER] as Awaited<
          ReturnType<
            typeof import('../src/data/seedMCPServers.js').seedMCPServers
          >
        >)

        const writes = hasExistingConfig ? updates : creates
        assert.equal(writes.length, 2)
        for (const data of writes) {
          assert.deepEqual(data.allowedTools, ['doc_query'])
          assert.equal(data.priority, 0)
          assert.equal(data.isEnabled, enabledKbIds.length > 0)
          assert.deepEqual(
            data.parameters,
            hasExistingConfig
              ? enabledKbIds.length > 0
                ? {
                    unrelated: 'preserved',
                    required: true,
                    toolAlias: 'doc_query',
                    kb_ids: expectedKbIds,
                  }
                : {
                    unrelated: 'preserved',
                    required: true,
                    toolAlias: 'doc_query',
                  }
              : enabledKbIds.length > 0
                ? {
                    required: true,
                    toolAlias: 'doc_query',
                    kb_ids: expectedKbIds,
                  }
                : {}
          )
        }
      })
    }
  }
})
