import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { getChatbotsInfo } from '../src/services/chatbots.js'
import { getKbChatbotBindings } from '../src/services/knowledge.js'

const EDITOR_ID = '00000000-0000-4000-8000-000000000001'
const BOT_OWNER_ID = '00000000-0000-4000-8000-000000000002'
const CHATBOT_ID = '00000000-0000-4000-8000-000000000003'
const READABLE_KB_ID = '00000000-0000-4000-8000-000000000004'

type MockPermission = {
  userId: string
  permissionLevel: PermissionLevel
}

type MockKnowledgeBase = {
  id: string
  name: string
  ownerId: string
  deletedAt: Date | null
  permissions: MockPermission[]
}

type MockKnowledgeBaseBinding = {
  id: string
  isEnabled: boolean
  kb: MockKnowledgeBase
}

type ChatbotFindManyArgs = {
  select?: {
    ownerId?: boolean
    knowledgeBases?: {
      where?: {
        isEnabled?: boolean
      }
    }
  }
}

type KnowledgeBaseFindManyArgs = {
  select?: {
    storageLimitMiB?: boolean
  }
}

function knowledgeBase(
  id: string,
  name: string,
  ownerId: string,
  permissions: MockPermission[] = []
): MockKnowledgeBase {
  return { id, name, ownerId, deletedAt: null, permissions }
}

function binding(id: string, kb: MockKnowledgeBase): MockKnowledgeBaseBinding {
  return { id, kb, isEnabled: true }
}

function createMockChatbot(knowledgeBases: MockKnowledgeBaseBinding[]) {
  return {
    id: CHATBOT_ID,
    ownerId: BOT_OWNER_ID,
    owner: { shortname: 'bot-owner' },
    directPermissions: [{ id: 1, permissionLevel: PermissionLevel.WRITE }],
    name: 'Reader test chatbot',
    description: null,
    avatar: null,
    systemPrompts: null,
    standardModeConfig: null,
    customModeConfig: null,
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
    knowledgeBases,
  }
}

function createReaderContext(
  chatbot: ReturnType<typeof createMockChatbot>,
  pickerKnowledgeBases: MockKnowledgeBase[],
  readableKnowledgeBase: MockKnowledgeBase
) {
  const chatbotFindMany = vi.fn(async (args: ChatbotFindManyArgs) => {
    if (args.select?.ownerId && Object.keys(args.select).length === 1) {
      return [{ ownerId: chatbot.ownerId }]
    }
    if (args.select?.knowledgeBases?.where?.isEnabled !== true) {
      throw new Error(
        'Reader must filter disabled knowledge-base bindings before redaction'
      )
    }
    return [
      {
        ...chatbot,
        knowledgeBases: chatbot.knowledgeBases.filter(
          ({ isEnabled }) => isEnabled
        ),
      },
    ]
  })
  const knowledgeBaseFindMany = vi.fn(
    async (args: KnowledgeBaseFindManyArgs) => {
      if (args.select?.storageLimitMiB) {
        return pickerKnowledgeBases.map((kb) => ({
          id: kb.id,
          storageLimitMiB: null,
        }))
      }
      return pickerKnowledgeBases
    }
  )

  const ctx = {
    user: {
      sub: EDITOR_ID,
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
          ...readableKnowledgeBase,
          id: READABLE_KB_ID,
        })),
        findMany: knowledgeBaseFindMany,
      },
      kBResource: { groupBy: vi.fn(async () => []) },
      kBUploadTicket: { groupBy: vi.fn(async () => []) },
      kBChatbot: { groupBy: vi.fn(async () => []) },
      chatbot: { findMany: chatbotFindMany },
      chatUsageCredits: { groupBy: vi.fn(async () => []) },
      chatThread: { groupBy: vi.fn(async () => []) },
      $queryRaw: vi.fn(async () => []),
    },
  } as unknown as ContextWithUser

  return { chatbotFindMany, ctx }
}

describe('Chatbot knowledge-base reader projections', () => {
  it('redacts editor unreadable metadata and derives owner availability independently', async () => {
    const editorWritable = knowledgeBase(
      'kb-editor-writable',
      'Editor writable',
      EDITOR_ID,
      [{ userId: BOT_OWNER_ID, permissionLevel: PermissionLevel.READ }]
    )
    const editorReadOnly = knowledgeBase(
      'kb-editor-read-only',
      'Editor read only',
      BOT_OWNER_ID,
      [{ userId: EDITOR_ID, permissionLevel: PermissionLevel.READ }]
    )
    const ownerUnreadable = knowledgeBase(
      'kb-owner-unreadable',
      'Owner unreadable',
      EDITOR_ID
    )
    const editorUnreadable = knowledgeBase(
      'kb-editor-unreadable',
      'Must stay hidden',
      BOT_OWNER_ID
    )
    const chatbot = createMockChatbot([
      binding('binding-writable', editorWritable),
      binding('binding-read-only', editorReadOnly),
      binding('binding-owner-unreadable', ownerUnreadable),
      binding('binding-editor-unreadable', editorUnreadable),
    ])
    const { chatbotFindMany, ctx } = createReaderContext(
      chatbot,
      [editorWritable, editorReadOnly, ownerUnreadable],
      editorWritable
    )

    const [projectedChatbot] = (await getChatbotsInfo(ctx)) ?? []
    const [kbBinding] = await getKbChatbotBindings(
      { kbId: READABLE_KB_ID },
      ctx
    )

    expect(projectedChatbot?.enabledKnowledgeBases).toEqual([
      expect.objectContaining({
        bindingId: 'binding-writable',
        id: editorWritable.id,
        name: editorWritable.name,
        available: true,
        canEdit: true,
      }),
      expect.objectContaining({
        bindingId: 'binding-read-only',
        id: editorReadOnly.id,
        name: editorReadOnly.name,
        available: true,
        canEdit: false,
      }),
      expect.objectContaining({
        bindingId: 'binding-owner-unreadable',
        id: ownerUnreadable.id,
        name: ownerUnreadable.name,
        available: false,
        canEdit: true,
      }),
      {
        bindingId: 'binding-editor-unreadable',
        id: null,
        name: null,
        available: false,
        canEdit: false,
        metrics: null,
      },
    ])
    expect(projectedChatbot?.knowledgeBaseOptions).toEqual([
      { id: editorWritable.id, name: editorWritable.name, available: true },
      { id: editorReadOnly.id, name: editorReadOnly.name, available: true },
      {
        id: ownerUnreadable.id,
        name: ownerUnreadable.name,
        available: false,
      },
    ])
    expect(projectedChatbot?.enabledKnowledgeBase).toBeNull()

    expect(kbBinding).toEqual({
      chatbotId: CHATBOT_ID,
      chatbotName: 'Reader test chatbot',
      chatbotStatus: 'DRAFT',
      enabledKbs: projectedChatbot?.enabledKnowledgeBases?.map(
        ({ bindingId, id, name, available, canEdit }) => ({
          bindingId,
          id,
          name,
          available,
          canEdit,
        })
      ),
      enabledKbId: null,
      enabledKbName: null,
    })
    expect(chatbotFindMany).toHaveBeenCalledTimes(3)
  })
})
