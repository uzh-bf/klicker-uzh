import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { getChatbotsInfo } from '../src/services/chatbots.js'
import { getKbChatbotBindings } from '../src/services/knowledge.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const READER_KB_ID = '00000000-0000-4000-8000-000000000002'

type MockKnowledgeBase = {
  id: string
  name: string
  deletedAt: Date | null
}

type MockKnowledgeBaseBinding = {
  isEnabled: boolean
  kb: MockKnowledgeBase
}

type ChatbotFindManyArgs = {
  select?: {
    knowledgeBases?: {
      take?: number
      where?: {
        isEnabled?: boolean
        kb?: { deletedAt?: Date | null }
      }
    }
  }
}

function createMockChatbot(knowledgeBases: MockKnowledgeBaseBinding[]) {
  return {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Reader test chatbot',
    description: null,
    avatar: null,
    systemPrompts: null,
    standardModeConfig: null,
    draftConfig: null,
    modelSelection: true,
    allowedModelIds: ['auto'],
    allowedReasoningEffortsByModel: null,
    creditInitialCredits: 1,
    creditResetPeriod: 'WEEKLY',
    creditResetAmount: 1,
    creditMaxCredits: 1,
    status: 'DRAFT',
    publicationUseCase: null,
    expectedStudentCount: null,
    reviewComment: null,
    publishedAt: null,
    disclaimerId: null,
    revisionStatus: null,
    revisionVersion: 0,
    creditResetPeriodChangedAt: null,
    createdAt: new Date('2026-09-10T08:00:00.000Z'),
    updatedAt: new Date('2026-09-10T08:00:00.000Z'),
    course: null,
    disclaimer: null,
    mcpConfigurations: [],
    knowledgeBases,
  }
}

function createReaderContext(knowledgeBases: MockKnowledgeBaseBinding[]) {
  // Model the nested Prisma result so plural projections can be exercised
  // without weakening the database's one-enabled-binding constraint.
  const chatbotFindMany = vi.fn(async (args: ChatbotFindManyArgs) => {
    const knowledgeBaseQuery = args.select?.knowledgeBases
    if (knowledgeBaseQuery?.take !== undefined) {
      throw new Error(
        'Reader must not truncate knowledge-base attachments before projection'
      )
    }

    const where = knowledgeBaseQuery?.where
    if (where?.isEnabled !== true || where.kb?.deletedAt !== null) {
      throw new Error(
        'Reader must filter disabled and deleted knowledge-base bindings'
      )
    }

    const chatbot = createMockChatbot(knowledgeBases)
    return [
      {
        ...chatbot,
        knowledgeBases: chatbot.knowledgeBases
          .filter(({ isEnabled, kb }) => isEnabled && kb.deletedAt === null)
          .map(({ kb }) => ({ kb: { id: kb.id, name: kb.name } })),
      },
    ]
  })

  const ctx = {
    user: {
      sub: USER_ID,
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: true,
      catalystIndividual: true,
    },
    featureFlags: {
      isEnabled: vi.fn(() => true),
      getAiBetaDecision: vi.fn(() => 'enabled'),
      refresh: vi.fn(async () => undefined),
    },
    prisma: {
      user: {
        findUnique: vi.fn(async () => ({
          aiFeaturesEnabled: true,
          betaEnabled: true,
        })),
      },
      kB: {
        findFirst: vi.fn(async () => ({
          id: READER_KB_ID,
          ownerId: USER_ID,
          deletedAt: null,
        })),
      },
      chatbot: { findMany: chatbotFindMany },
      chatUsageCredits: { groupBy: vi.fn(async () => []) },
      chatThread: { groupBy: vi.fn(async () => []) },
      $queryRaw: vi.fn(async () => []),
    },
  } as unknown as ContextWithUser

  return { chatbotFindMany, ctx }
}

function knowledgeBaseBinding(
  id: string,
  name: string,
  options: { isEnabled?: boolean; deletedAt?: Date | null } = {}
): MockKnowledgeBaseBinding {
  return {
    isEnabled: options.isEnabled ?? true,
    kb: {
      id,
      name,
      deletedAt: options.deletedAt ?? null,
    },
  }
}

describe('Chatbot knowledge-base reader compatibility', () => {
  it.each([
    {
      name: 'zero eligible attachments',
      knowledgeBases: [
        knowledgeBaseBinding('kb-disabled', 'Disabled KB', {
          isEnabled: false,
        }),
        knowledgeBaseBinding('kb-deleted', 'Deleted KB', {
          deletedAt: new Date('2026-09-09T08:00:00.000Z'),
        }),
      ],
      expected: [],
      legacyId: null,
      legacyName: null,
    },
    {
      name: 'one eligible attachment',
      knowledgeBases: [
        knowledgeBaseBinding('kb-one', 'One KB'),
        knowledgeBaseBinding('kb-disabled', 'Disabled KB', {
          isEnabled: false,
        }),
        knowledgeBaseBinding('kb-deleted', 'Deleted KB', {
          deletedAt: new Date('2026-09-09T08:00:00.000Z'),
        }),
      ],
      expected: [{ id: 'kb-one', name: 'One KB' }],
      legacyId: 'kb-one',
      legacyName: 'One KB',
    },
    {
      name: 'many eligible attachments',
      knowledgeBases: [
        knowledgeBaseBinding('kb-one', 'One KB'),
        knowledgeBaseBinding('kb-two', 'Two KB'),
        knowledgeBaseBinding('kb-disabled', 'Disabled KB', {
          isEnabled: false,
        }),
        knowledgeBaseBinding('kb-deleted', 'Deleted KB', {
          deletedAt: new Date('2026-09-09T08:00:00.000Z'),
        }),
      ],
      expected: [
        { id: 'kb-one', name: 'One KB' },
        { id: 'kb-two', name: 'Two KB' },
      ],
      legacyId: null,
      legacyName: null,
    },
  ])('projects $name consistently in chatbot and KB-binding readers', async ({
    knowledgeBases,
    expected,
    legacyId,
    legacyName,
  }) => {
    const { chatbotFindMany, ctx } = createReaderContext(knowledgeBases)

    const [chatbot] = (await getChatbotsInfo(ctx)) ?? []
    const bindings = await getKbChatbotBindings({ kbId: READER_KB_ID }, ctx)

    expect(chatbot).toMatchObject({
      enabledKnowledgeBases: expected,
      enabledKnowledgeBase:
        expected.length === 1 ? (expected[0] ?? null) : null,
    })
    expect(bindings).toEqual([
      {
        chatbotId: '00000000-0000-4000-8000-000000000003',
        chatbotName: 'Reader test chatbot',
        enabledKbs: expected,
        enabledKbId: legacyId,
        enabledKbName: legacyName,
      },
    ])
    expect(chatbotFindMany).toHaveBeenCalledTimes(2)
  })
})
