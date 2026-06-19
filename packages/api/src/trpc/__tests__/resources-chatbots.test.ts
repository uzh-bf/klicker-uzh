import {
  CreditResetPeriod,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  resetChatModelRegistryCacheForTests,
  type getChatbotsInfo,
} from '../../services/chatbots.js'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  id: 'owner-1',
}

function createContext(prisma?: TRPCContext['prisma']): TRPCContext {
  return {
    prisma,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

describe('resources chatbot router', () => {
  const originalRegistry = process.env.CHAT_MODEL_REGISTRY_JSON

  beforeEach(() => {
    resetChatModelRegistryCacheForTests()
    delete process.env.CHAT_MODEL_REGISTRY_JSON
  })

  afterEach(() => {
    resetChatModelRegistryCacheForTests()
    if (originalRegistry === undefined) {
      delete process.env.CHAT_MODEL_REGISTRY_JSON
    } else {
      process.env.CHAT_MODEL_REGISTRY_JSON = originalRegistry
    }
  })

  test('returns the public chat model registry', async () => {
    const caller = appRouter.createCaller(createContext())

    await expect(caller.resources.chatModelRegistry()).resolves.toEqual({
      chatModelRegistry: [
        {
          id: 'gpt-4.1',
          name: 'GPT-4.1',
          description: 'OpenAI model',
          fallback: false,
          supportsReasoning: false,
          supportedReasoningEfforts: [],
        },
        {
          id: 'gpt-4.1-mini',
          name: 'GPT-4.1 Mini',
          description: 'Small OpenAI model',
          fallback: true,
          supportsReasoning: false,
          supportedReasoningEfforts: [],
        },
      ],
    })
  })

  test('maps chatbot info with usage, disclaimer, and MCP summaries', async () => {
    const chatbotId = '00000000-0000-0000-0000-000000000001'
    const createdAt = new Date('2026-01-01T10:00:00.000Z')
    const updatedAt = new Date('2026-01-02T10:00:00.000Z')
    const lastActivityAt = new Date('2026-01-03T10:00:00.000Z')
    const lastResetAt = new Date('2026-01-04T10:00:00.000Z')
    const findMany = vi.fn().mockResolvedValue([
      {
        id: chatbotId,
        name: 'Course Bot',
        description: 'Answers course questions',
        avatar: null,
        modelSelection: true,
        allowedModelIds: ['gpt-4.1'],
        allowedReasoningEffortsByModel: { reasoner: ['medium', 'medium'] },
        creditInitialCredits: 10,
        creditResetPeriod: CreditResetPeriod.WEEKLY,
        creditResetAmount: 5,
        creditMaxCredits: 20,
        createdAt,
        updatedAt,
        course: { id: 'course-1', name: 'Course 1' },
        disclaimer: {
          id: 'disclaimer-1',
          name: 'Default disclaimer',
          title: 'Terms',
        },
        mcpConfigurations: [
          {
            chatMode: 'COURSE',
            isEnabled: true,
            priority: 2,
            allowedTools: ['search', 'read'],
            mcpServer: {
              id: 'server-1',
              name: 'Knowledge Server',
              description: null,
              isActive: true,
            },
          },
        ],
      },
    ])
    const chatUsageCreditsGroupBy = vi
      .fn()
      .mockResolvedValueOnce([
        {
          chatbotId,
          _count: { _all: 5 },
          _sum: {
            total: { toNumber: () => 12.5 },
            current: '6.5',
            resetCount: 2,
          },
          _max: { lastResetAt },
        },
      ])
      .mockResolvedValueOnce([{ chatbotId, _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ chatbotId, _count: { _all: 1 } }])
    const chatThreadGroupBy = vi.fn().mockResolvedValue([
      {
        chatbotId,
        _count: { _all: 4 },
        _max: { updatedAt: lastActivityAt },
      },
    ])
    const queryRaw = vi.fn().mockResolvedValue([{ chatbotId, count: 9n }])
    const prisma = {
      chatbot: { findMany },
      chatUsageCredits: { groupBy: chatUsageCreditsGroupBy },
      chatThread: { groupBy: chatThreadGroupBy },
      $queryRaw: queryRaw,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    const result = await caller.resources.chatbotsInfo()
    const chatbot = result.chatbotsInfo[0] as Awaited<
      ReturnType<typeof getChatbotsInfo>
    >[number]

    expect(chatbot).toMatchObject({
      id: chatbotId,
      name: 'Course Bot',
      allowedReasoningEffortsByModel: [
        { modelId: 'reasoner', efforts: ['medium'] },
      ],
      courses: [{ id: 'course-1', name: 'Course 1' }],
      usageSummary: {
        threadCount: 4,
        messageCount: 9,
        participantCount: 5,
        lastActivityAt,
        totalCredits: 12.5,
        currentCredits: 6.5,
        totalResets: 2,
        lastResetAt,
      },
      disclaimerSummary: {
        id: 'disclaimer-1',
        name: 'Default disclaimer',
        title: 'Terms',
        acceptedCount: 3,
        declinedCount: 1,
        pendingCount: 1,
      },
      mcpConfigurations: [
        {
          serverId: 'server-1',
          serverName: 'Knowledge Server',
          serverDescription: null,
          serverIsActive: true,
          chatMode: 'COURSE',
          isEnabled: true,
          priority: 2,
          allowedToolsCount: 2,
        },
      ],
    })
    expect(chatbot).not.toHaveProperty('course')
    expect(chatbot).not.toHaveProperty('disclaimer')
  })

  test('updates chatbot model settings with normalized reasoning config', async () => {
    process.env.CHAT_MODEL_REGISTRY_JSON = JSON.stringify([
      {
        id: 'reasoner',
        deploymentId: 'reasoner',
        name: 'Reasoner',
        description: 'Reasoning model',
        fallback: true,
        supportsReasoning: true,
        supportedReasoningEfforts: ['low', 'medium', 'high'],
        cost: { input: 1, output: 2 },
      },
    ])
    resetChatModelRegistryCacheForTests()

    const chatbotId = '00000000-0000-0000-0000-000000000001'
    const updatedAt = new Date('2026-01-02T10:00:00.000Z')
    const findFirst = vi.fn().mockResolvedValue({ id: chatbotId })
    const update = vi.fn().mockResolvedValue({
      id: chatbotId,
      name: 'Course Bot',
      description: null,
      avatar: null,
      modelSelection: true,
      allowedModelIds: ['reasoner'],
      allowedReasoningEffortsByModel: { reasoner: ['medium', 'high'] },
      creditInitialCredits: 10,
      creditResetPeriod: CreditResetPeriod.WEEKLY,
      creditResetAmount: 5,
      creditMaxCredits: 20,
      createdAt: updatedAt,
      updatedAt,
      course: { id: 'course-1', name: 'Course 1' },
    })
    const prisma = {
      chatbot: { findFirst, update },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.updateChatbotModelSettings({
        chatbotId,
        modelSelection: true,
        allowedModelIds: ['reasoner', 'reasoner'],
        allowedReasoningEffortsByModel: [
          { modelId: 'reasoner', efforts: ['medium', 'high', 'medium'] },
        ],
      })
    ).resolves.toEqual({
      chatbot: {
        id: chatbotId,
        name: 'Course Bot',
        description: null,
        avatar: null,
        modelSelection: true,
        allowedModelIds: ['reasoner'],
        allowedReasoningEffortsByModel: [
          { modelId: 'reasoner', efforts: ['medium', 'high'] },
        ],
        creditInitialCredits: 10,
        creditResetPeriod: CreditResetPeriod.WEEKLY,
        creditResetAmount: 5,
        creditMaxCredits: 20,
        createdAt: updatedAt,
        updatedAt,
        courses: [{ id: 'course-1', name: 'Course 1' }],
      },
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: chatbotId },
        data: {
          modelSelection: true,
          allowedModelIds: ['reasoner'],
          allowedReasoningEffortsByModel: { reasoner: ['medium', 'high'] },
        },
      })
    )
  })

  test('rejects unknown allowed model ids', async () => {
    const chatbotId = '00000000-0000-0000-0000-000000000001'
    const update = vi.fn()
    const prisma = {
      chatbot: {
        findFirst: vi.fn().mockResolvedValue({ id: chatbotId }),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.updateChatbotModelSettings({
        chatbotId,
        modelSelection: true,
        allowedModelIds: ['missing-model'],
        allowedReasoningEffortsByModel: [],
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Unknown model id(s): missing-model',
    })
    expect(update).not.toHaveBeenCalled()
  })
})
