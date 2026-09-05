import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ChatbotStatus,
  CreditResetPeriod,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'events'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createChatbot,
  getChatbotsInfo,
  saveChatbotDisclaimer,
  updateChatbot,
  updateChatbotCreditPolicy,
  updateChatbotModelPolicy,
  updateChatbotModelSettings,
  updateChatbotStandardModeConfig,
} from '../src/services/chatbots.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Integration tests for lecturer chatbot create/update', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      hatchet: newHatchet,
      emitter: newEmitter,
    } = await initializePrisma()
    prisma = newPrisma
    hatchet = newHatchet
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const { userOneCtx: ctx1, userTwoCtx: ctx2 } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )
    userOneCtx = ctx1
    userTwoCtx = ctx2
    await prisma.user.updateMany({
      where: { id: { in: [userOneCtx.user.sub, userTwoCtx.user.sub] } },
      data: { aiFeaturesEnabled: true },
    })
  })

  afterEach(async () => await testCleanup(prisma))

  function createConflictingTransaction() {
    const transaction = vi.fn(
      async (
        callback: (tx: {
          chatbot: {
            updateMany: () => Promise<{ count: number }>
            findUniqueOrThrow: () => Promise<never>
          }
        }) => Promise<unknown>
      ) =>
        await callback({
          chatbot: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            findUniqueOrThrow: vi.fn(),
          },
        })
    )
    const testPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        return property === '$transaction'
          ? transaction
          : Reflect.get(target, property, receiver)
      },
    })
    return { transaction, testPrisma }
  }

  describe('createChatbot', () => {
    it('creates a DRAFT chatbot with platform modes owned by the caller', async () => {
      const course = await seedCourse({}, userOneCtx)

      const chatbot = await createChatbot(
        { name: 'My Tutor', courseId: course.id },
        userOneCtx
      )

      expect(chatbot).toMatchObject({
        name: 'My Tutor',
        description: null,
        status: 'DRAFT',
        modelSelection: false,
        allowedModelIds: ['auto'],
        allowedReasoningEffortsByModel: [],
        courses: [{ id: course.id }],
      })

      // Row is persisted with the caller as owner, DRAFT, and no custom mode
      // overrides (systemPrompts null -> platform defaults at runtime).
      const row = await prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbot.id },
        select: {
          ownerId: true,
          courseId: true,
          status: true,
          systemPrompts: true,
          modelSelection: true,
          allowedModelIds: true,
          allowedReasoningEffortsByModel: true,
        },
      })
      expect(row).toEqual({
        ownerId: userOneCtx.user.sub,
        courseId: course.id,
        status: 'DRAFT',
        systemPrompts: null,
        modelSelection: false,
        allowedModelIds: ['auto'],
        allowedReasoningEffortsByModel: null,
      })
    })

    it('rejects creation against a course the caller does not own', async () => {
      const course = await seedCourse({}, userOneCtx)

      await expect(
        createChatbot({ name: 'Sneaky', courseId: course.id }, userTwoCtx)
      ).rejects.toThrow('Course not found')

      const count = await prisma.chatbot.count({
        where: { courseId: course.id },
      })
      expect(count).toBe(0)
    })

    it('rejects an empty name after checking course ownership', async () => {
      const course = await seedCourse({}, userOneCtx)

      await expect(
        createChatbot({ name: '', courseId: course.id }, userOneCtx)
      ).rejects.toThrow('Chatbot name must not be empty')
    })

    it('keeps the course ownership error for an empty name', async () => {
      const course = await seedCourse({}, userOneCtx)

      await expect(
        createChatbot({ name: '', courseId: course.id }, userTwoCtx)
      ).rejects.toThrow('Course not found')
    })
  })

  describe('updateChatbot', () => {
    async function seedOwnedChatbot(
      status: ChatbotStatus = ChatbotStatus.DRAFT
    ) {
      const course = await seedCourse({}, userOneCtx)
      const chatbot = await prisma.chatbot.create({
        data: {
          name: 'Original',
          description: 'before',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
        },
      })
      return { course, chatbot }
    }

    it('updates free knobs for the owner', async () => {
      const { chatbot } = await seedOwnedChatbot()

      const updated = await updateChatbot(
        { id: chatbot.id, name: 'Renamed', description: 'after' },
        userOneCtx
      )

      // update() returns the persisted row, so the return value is proof of
      // the write; the non-owner test below covers the no-write case.
      expect(updated).toMatchObject({
        id: chatbot.id,
        name: 'Renamed',
        description: 'after',
      })
    })

    it('rejects an empty name after checking chatbot ownership', async () => {
      const { chatbot } = await seedOwnedChatbot()

      await expect(
        updateChatbot({ id: chatbot.id, name: '' }, userOneCtx)
      ).rejects.toThrow('Chatbot name must not be empty')
    })

    it('returns null and makes no change for a non-owner', async () => {
      const { chatbot } = await seedOwnedChatbot()

      const result = await updateChatbot(
        { id: chatbot.id, name: '' },
        userTwoCtx
      )

      expect(result).toBeNull()

      const row = await prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbot.id },
        select: { name: true },
      })
      expect(row).toEqual({ name: 'Original' })
    })

    it.each([
      ChatbotStatus.DRAFT,
      ChatbotStatus.REJECTED,
      ChatbotStatus.PUBLISHED,
    ])('allows metadata changes while %s', async (status) => {
      const { chatbot } = await seedOwnedChatbot(status)

      await expect(
        updateChatbot({ id: chatbot.id, name: `Updated ${status}` }, userOneCtx)
      ).resolves.toMatchObject({ name: `Updated ${status}` })
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects metadata changes while %s', async (status) => {
      const { chatbot } = await seedOwnedChatbot(status)

      await expect(
        updateChatbot({ id: chatbot.id, name: 'Blocked' }, userOneCtx)
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })
  })

  describe('updateChatbotCreditPolicy', () => {
    async function seedOwnedChatbot(
      status: ChatbotStatus = ChatbotStatus.DRAFT
    ) {
      const course = await seedCourse({}, userOneCtx)
      return await prisma.chatbot.create({
        data: {
          name: `Credits ${status}`,
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
        },
      })
    }

    it.each([
      ChatbotStatus.DRAFT,
      ChatbotStatus.REJECTED,
    ])('updates all credit-policy fields while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotCreditPolicy(
          {
            chatbotId: chatbot.id,
            creditInitialCredits: 3,
            creditResetPeriod: CreditResetPeriod.MONTHLY,
            creditResetAmount: 4,
            creditMaxCredits: 7,
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        creditInitialCredits: 3,
        creditResetPeriod: CreditResetPeriod.MONTHLY,
        creditResetAmount: 4,
        creditMaxCredits: 7,
      })
    })

    it('normalizes reset amount to zero when resets are disabled', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        updateChatbotCreditPolicy(
          {
            chatbotId: chatbot.id,
            creditInitialCredits: 0,
            creditResetPeriod: CreditResetPeriod.NONE,
            creditResetAmount: 99,
            creditMaxCredits: 0,
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        creditInitialCredits: 0,
        creditResetPeriod: CreditResetPeriod.NONE,
        creditResetAmount: 0,
        creditMaxCredits: 0,
      })
    })

    it.each([
      {
        name: 'initial credits above the maximum',
        initial: 6,
        period: CreditResetPeriod.WEEKLY,
        reset: 1,
        max: 5,
      },
      {
        name: 'reset amount above the maximum',
        initial: 1,
        period: CreditResetPeriod.WEEKLY,
        reset: 6,
        max: 5,
      },
      {
        name: 'zero reset amount with recurring resets',
        initial: 0,
        period: CreditResetPeriod.WEEKLY,
        reset: 0,
        max: 5,
      },
      {
        name: 'negative credits',
        initial: -1,
        period: CreditResetPeriod.NONE,
        reset: 0,
        max: 1,
      },
    ])('rejects $name', async ({ initial, period, reset, max }) => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        updateChatbotCreditPolicy(
          {
            chatbotId: chatbot.id,
            creditInitialCredits: initial,
            creditResetPeriod: period,
            creditResetAmount: reset,
            creditMaxCredits: max,
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    })

    it('returns null and makes no change for a non-owner', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        updateChatbotCreditPolicy(
          {
            chatbotId: chatbot.id,
            creditInitialCredits: 2,
            creditResetPeriod: CreditResetPeriod.DAILY,
            creditResetAmount: 2,
            creditMaxCredits: 2,
          },
          userTwoCtx
        )
      ).resolves.toBeNull()

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: {
            creditInitialCredits: true,
            creditResetPeriod: true,
            creditResetAmount: true,
            creditMaxCredits: true,
          },
        })
      ).resolves.toEqual({
        creditInitialCredits: 1,
        creditResetPeriod: CreditResetPeriod.WEEKLY,
        creditResetAmount: 1,
        creditMaxCredits: 1,
      })
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PUBLISHED,
      ChatbotStatus.PAUSED,
    ])('rejects credit-policy changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotCreditPolicy(
          {
            chatbotId: chatbot.id,
            creditInitialCredits: 1,
            creditResetPeriod: CreditResetPeriod.WEEKLY,
            creditResetAmount: 1,
            creditMaxCredits: 1,
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })
  })

  describe('updateChatbotModelSettings', () => {
    async function seedOwnedChatbot(status: ChatbotStatus) {
      const course = await seedCourse({}, userOneCtx)
      return await prisma.chatbot.create({
        data: {
          name: `Model ${status}`,
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
        },
      })
    }

    it.each([
      ChatbotStatus.DRAFT,
      ChatbotStatus.REJECTED,
      ChatbotStatus.PUBLISHED,
    ])('allows model-policy changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotModelSettings(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['gpt-5.6-luna'],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
            ],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({ allowedModelIds: ['gpt-5.6-luna'] })
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects model-policy changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotModelSettings(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['gpt-5.6-luna'],
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })

    it('keeps ambiguous rolling-client payloads accepted', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.DRAFT)

      await expect(
        updateChatbotModelSettings(
          {
            chatbotId: chatbot.id,
            modelSelection: true,
            allowedModelIds: [],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
            ],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        modelSelection: true,
        allowedModelIds: [],
      })

      await expect(
        updateChatbotModelSettings(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['gpt-5.6-luna', 'gpt-4.1'],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
            ],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        modelSelection: false,
        allowedModelIds: ['gpt-5.6-luna', 'gpt-4.1'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
        ],
      })

      await expect(
        updateChatbotModelSettings(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: [],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        modelSelection: false,
        allowedModelIds: [],
      })

      await expect(
        updateChatbotModelSettings(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['gpt-4.1'],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['medium'] },
            ],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        modelSelection: false,
        allowedModelIds: ['gpt-4.1'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-5.6-luna', efforts: ['medium'] },
        ],
      })
    })
  })

  describe('updateChatbotModelPolicy', () => {
    async function seedOwnedChatbot(
      status: ChatbotStatus = ChatbotStatus.DRAFT
    ) {
      const course = await seedCourse({}, userOneCtx)
      return await prisma.chatbot.create({
        data: {
          name: `Strict model policy ${status}`,
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
          allowedModelIds: ['gpt-5.6-luna', 'gpt-4.1'],
          allowedReasoningEffortsByModel: {
            'gpt-5.6-luna': ['low', 'medium'],
          },
        },
      })
    }

    it('saves a fixed non-reasoning Auto policy without reasoning entries', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['auto'],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        modelSelection: false,
        allowedModelIds: ['auto'],
        allowedReasoningEffortsByModel: [],
      })

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: {
            modelSelection: true,
            allowedModelIds: true,
            allowedReasoningEffortsByModel: true,
          },
        })
      ).resolves.toEqual({
        modelSelection: false,
        allowedModelIds: ['auto'],
        allowedReasoningEffortsByModel: null,
      })
    })

    it('requires exactly one supported reasoning effort for a fixed reasoning model', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['gpt-5.6-luna'],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
            ],
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['gpt-5.6-luna'],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['high'] },
            ],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        allowedModelIds: ['gpt-5.6-luna'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-5.6-luna', efforts: ['high'] },
        ],
      })
    })

    it('requires explicit active models and reasoning entries in participant-choice mode', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: true,
            allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['medium', 'low'] },
            ],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        modelSelection: true,
        allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
        ],
      })

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: true,
            allowedModelIds: ['gpt-4.1'],
            allowedReasoningEffortsByModel: [
              { modelId: 'gpt-5.6-luna', efforts: ['medium'] },
            ],
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    })

    it('rejects an invalid policy without writing', async () => {
      const chatbot = await seedOwnedChatbot()
      const before = await prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbot.id },
        select: {
          modelSelection: true,
          allowedModelIds: true,
          allowedReasoningEffortsByModel: true,
        },
      })

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: [],
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: {
            modelSelection: true,
            allowedModelIds: true,
            allowedReasoningEffortsByModel: true,
          },
        })
      ).resolves.toEqual(before)
    })

    it('returns null without writing for a non-owner', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['auto'],
          },
          userTwoCtx
        )
      ).resolves.toBeNull()
    })

    it.each([
      ChatbotStatus.DRAFT,
      ChatbotStatus.REJECTED,
      ChatbotStatus.PUBLISHED,
    ])('allows strict model-policy changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['auto'],
          },
          userOneCtx
        )
      ).resolves.toMatchObject({ allowedModelIds: ['auto'] })
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects strict model-policy changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['auto'],
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })

    it('reports a compare-and-set conflict when status changes during save', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.DRAFT)
      const { transaction, testPrisma } = createConflictingTransaction()

      await expect(
        updateChatbotModelPolicy(
          {
            chatbotId: chatbot.id,
            modelSelection: false,
            allowedModelIds: ['auto'],
          },
          { ...userOneCtx, prisma: testPrisma }
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_EDIT_CONFLICT' },
      })
      expect(transaction).toHaveBeenCalledOnce()
    })
  })

  describe('updateChatbotStandardModeConfig', () => {
    async function seedOwnedChatbot(status: ChatbotStatus) {
      const course = await seedCourse({}, userOneCtx)
      return await prisma.chatbot.create({
        data: {
          name: `Standard modes ${status}`,
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
        },
      })
    }

    const config = {
      tutorEnabled: true,
      explainerEnabled: false,
      quizzerEnabled: true,
      courseName: '  Clinical pharmacology  ',
      subjectDomain: 'Medicine',
      languageOfInstruction: 'en' as const,
      scopeNote:
        'Use the course materials only.\r\nDo not provide medical advice.',
    }

    it.each([
      ChatbotStatus.DRAFT,
      ChatbotStatus.REJECTED,
      ChatbotStatus.PUBLISHED,
    ])('allows standard-mode changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotStandardModeConfig(
          { chatbotId: chatbot.id, config },
          userOneCtx
        )
      ).resolves.toMatchObject({
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: false,
          quizzerEnabled: true,
          courseName: 'Clinical pharmacology',
          subjectDomain: 'Medicine',
          languageOfInstruction: 'en',
          scopeNote:
            'Use the course materials only.\nDo not provide medical advice.',
        },
      })

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { standardModeConfig: true },
        })
      ).resolves.toMatchObject({
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: false,
          courseName: 'Clinical pharmacology',
        },
      })
    })

    it('rejects disabling both standard modes without writing', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.DRAFT)
      await prisma.chatbot.update({
        where: { id: chatbot.id },
        data: { standardModeConfig: config },
      })

      await expect(
        updateChatbotStandardModeConfig(
          {
            chatbotId: chatbot.id,
            config: {
              tutorEnabled: false,
              explainerEnabled: false,
              quizzerEnabled: false,
            },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'BAD_USER_INPUT' },
      })

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { standardModeConfig: true },
        })
      ).resolves.toMatchObject({ standardModeConfig: config })
    })

    it('preserves an existing long framing note through a mode-only save', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.DRAFT)
      const legacyScopeNote = 'Legacy framing. '.repeat(20).trim()
      expect(legacyScopeNote.length).toBeGreaterThan(200)

      const legacyConfig = {
        ...config,
        explainerEnabled: true,
        scopeNote: legacyScopeNote,
      }
      await prisma.chatbot.update({
        where: { id: chatbot.id },
        data: { standardModeConfig: legacyConfig },
      })

      await expect(
        updateChatbotStandardModeConfig(
          {
            chatbotId: chatbot.id,
            config: { ...legacyConfig, tutorEnabled: false },
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          scopeNote: legacyScopeNote,
        },
      })

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { standardModeConfig: true },
        })
      ).resolves.toMatchObject({
        standardModeConfig: {
          tutorEnabled: false,
          scopeNote: legacyScopeNote,
        },
      })
    })

    it('returns null and does not write for a non-owner', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.DRAFT)

      await expect(
        updateChatbotStandardModeConfig(
          { chatbotId: chatbot.id, config },
          userTwoCtx
        )
      ).resolves.toBeNull()

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { standardModeConfig: true },
        })
      ).resolves.toEqual({ standardModeConfig: null })
    })

    it('reports a compare-and-set conflict when status changes during save', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.DRAFT)
      const { transaction, testPrisma } = createConflictingTransaction()

      await expect(
        updateChatbotStandardModeConfig(
          { chatbotId: chatbot.id, config },
          { ...userOneCtx, prisma: testPrisma }
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_EDIT_CONFLICT' },
      })
      expect(transaction).toHaveBeenCalledOnce()
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects standard-mode changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        updateChatbotStandardModeConfig(
          { chatbotId: chatbot.id, config },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })
  })

  describe('saveChatbotDisclaimer', () => {
    async function seedChatbotWithDisclaimer(
      status: ChatbotStatus = ChatbotStatus.DRAFT,
      withDisclaimer = true
    ) {
      const course = await seedCourse({}, userOneCtx)
      const disclaimer = withDisclaimer
        ? await prisma.chatbotDisclaimer.create({
            data: {
              name: 'Internal name',
              description: 'Internal description',
              title: 'Original title',
              introText: 'Original introduction',
              mediaUrl: 'https://invalid.example/media',
              mediaType: 'video',
              ownerId: userOneCtx.user.sub,
            },
          })
        : null
      const chatbot = await prisma.chatbot.create({
        data: {
          name: 'Disclaimer Bot',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
          disclaimerId: disclaimer?.id,
        },
      })
      return { chatbot, disclaimer }
    }

    it('replaces and normalizes editable content while preserving the template metadata', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()

      await saveChatbotDisclaimer(
        {
          chatbotId: chatbot.id,
          expectedDisclaimerId: disclaimer?.id,
          title: '  Revised title\r\n',
          introText: '  First line\r\nSecond line\r  ',
        },
        userOneCtx
      )

      const updated = await prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbot.id },
        include: { disclaimer: true },
      })
      expect(updated.disclaimerId).not.toBe(disclaimer?.id)
      expect(updated.disclaimer).toMatchObject({
        name: 'Internal name',
        description: 'Internal description',
        title: 'Revised title',
        introText: 'First line\nSecond line',
        mediaUrl: 'https://invalid.example/media',
        mediaType: 'video',
      })
      await expect(
        prisma.chatbotDisclaimer.findUnique({ where: { id: disclaimer!.id } })
      ).resolves.toMatchObject({ title: 'Original title' })
    })

    it('accepts the basic disclaimer Markdown subset', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()
      const introText = [
        'A **bold** and *italic* paragraph.',
        '',
        '1. First ordered item',
        '2. Second ordered item',
        '',
        '- First unordered item',
      ].join('\n')

      await saveChatbotDisclaimer(
        {
          chatbotId: chatbot.id,
          expectedDisclaimerId: disclaimer?.id,
          title: 'Supported formatting',
          introText,
        },
        userOneCtx
      )

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { disclaimer: { select: { introText: true } } },
        })
      ).resolves.toMatchObject({ disclaimer: { introText } })
    })

    it('applies disclaimer length bounds after normalization', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()
      const title = 'x'.repeat(160)
      const introText = 'y'.repeat(10_000)

      await saveChatbotDisclaimer(
        {
          chatbotId: chatbot.id,
          expectedDisclaimerId: disclaimer?.id,
          title: ` ${title} `,
          introText: `\r\n${introText}\r\n`,
        },
        userOneCtx
      )

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: {
            disclaimer: { select: { title: true, introText: true } },
          },
        })
      ).resolves.toMatchObject({ disclaimer: { title, introText } })
    })

    it('creates the first disclaimer and does not create a row for a normalized no-op', async () => {
      const { chatbot } = await seedChatbotWithDisclaimer(
        ChatbotStatus.DRAFT,
        false
      )

      await saveChatbotDisclaimer(
        {
          chatbotId: chatbot.id,
          expectedDisclaimerId: null,
          title: ' Course terms ',
          introText: ' Introduction\r\n',
        },
        userOneCtx
      )
      const linked = await prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbot.id },
        select: { disclaimerId: true },
      })
      const countAfterCreate = await prisma.chatbotDisclaimer.count()

      await saveChatbotDisclaimer(
        {
          chatbotId: chatbot.id,
          expectedDisclaimerId: linked.disclaimerId,
          title: '\r\nCourse terms\r\n',
          introText: 'Introduction',
        },
        userOneCtx
      )

      await expect(prisma.chatbotDisclaimer.count()).resolves.toBe(
        countAfterCreate
      )
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { disclaimerId: true },
        })
      ).resolves.toEqual(linked)
    })

    it('requires the caller to state that no disclaimer is currently linked', async () => {
      const { chatbot } = await seedChatbotWithDisclaimer(
        ChatbotStatus.DRAFT,
        false
      )

      await expect(
        saveChatbotDisclaimer(
          {
            chatbotId: chatbot.id,
            title: 'Course terms',
            introText: 'Introduction',
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    })

    it('rejects a stale expected disclaimer without leaving an orphan row', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()

      await saveChatbotDisclaimer(
        {
          chatbotId: chatbot.id,
          expectedDisclaimerId: disclaimer?.id,
          title: 'First replacement',
          introText: 'First replacement introduction',
        },
        userOneCtx
      )
      const countBeforeStaleSave = await prisma.chatbotDisclaimer.count()

      await expect(
        saveChatbotDisclaimer(
          {
            chatbotId: chatbot.id,
            expectedDisclaimerId: disclaimer?.id,
            title: 'Stale replacement',
            introText: 'Stale replacement introduction',
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_DISCLAIMER_CONFLICT' },
      })
      await expect(prisma.chatbotDisclaimer.count()).resolves.toBe(
        countBeforeStaleSave
      )
    })

    it('allows only one concurrent save for the same expected disclaimer', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()
      const countBeforeSaves = await prisma.chatbotDisclaimer.count()

      const results = await Promise.allSettled([
        saveChatbotDisclaimer(
          {
            chatbotId: chatbot.id,
            expectedDisclaimerId: disclaimer?.id,
            title: 'Concurrent A',
            introText: 'Concurrent introduction A',
          },
          userOneCtx
        ),
        saveChatbotDisclaimer(
          {
            chatbotId: chatbot.id,
            expectedDisclaimerId: disclaimer?.id,
            title: 'Concurrent B',
            introText: 'Concurrent introduction B',
          },
          userOneCtx
        ),
      ])

      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1)
      expect(
        results.find((result) => result.status === 'rejected')?.reason
      ).toMatchObject({
        extensions: { code: 'CHATBOT_DISCLAIMER_CONFLICT' },
      })
      await expect(prisma.chatbotDisclaimer.count()).resolves.toBe(
        countBeforeSaves + 1
      )
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PUBLISHED,
      ChatbotStatus.PAUSED,
    ])('rejects disclaimer changes while %s', async (status) => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer(status)

      await expect(
        saveChatbotDisclaimer(
          {
            chatbotId: chatbot.id,
            expectedDisclaimerId: disclaimer?.id,
            title: 'Blocked',
            introText: 'Blocked introduction',
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })

    it.each([
      { title: ' ', introText: 'Introduction' },
      { title: 'Title', introText: '\r\n' },
      { title: 'x'.repeat(161), introText: 'Introduction' },
      { title: 'Title', introText: 'x'.repeat(10_001) },
    ])('rejects invalid normalized content %#', async (content) => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()

      await expect(
        saveChatbotDisclaimer(
          {
            chatbotId: chatbot.id,
            expectedDisclaimerId: disclaimer?.id,
            ...content,
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    })

    it.each([
      '# Heading',
      '[Link](https://invalid.example)',
      '![Image](https://invalid.example/image.png)',
      '`inline code`',
      '> Quote',
      '<strong>raw HTML</strong>',
      '~~strikethrough~~',
      '- [x] task list item',
      'Inline math: $x^2$',
      'Display math:\n\n$$\nx^2\n$$',
    ])('rejects unsupported disclaimer Markdown: %s', async (introText) => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()

      await expect(
        saveChatbotDisclaimer(
          {
            chatbotId: chatbot.id,
            expectedDisclaimerId: disclaimer?.id,
            title: 'Unsupported formatting',
            introText,
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    })

    it('counts only acceptance of the currently linked disclaimer', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()
      const participant = await prisma.participant.create({
        data: {
          username: 'historicalDisclaimerAcceptance',
          password: 'not-used',
        },
      })
      await prisma.chatUsageCredits.create({
        data: {
          participantId: participant.id,
          chatbotId: chatbot.id,
          acceptedDisclaimerId: disclaimer?.id,
        },
      })
      await saveChatbotDisclaimer(
        {
          chatbotId: chatbot.id,
          expectedDisclaimerId: disclaimer?.id,
          title: 'Current title',
          introText: 'Current introduction',
        },
        userOneCtx
      )

      const [result] = await getChatbotsInfo(userOneCtx)
      expect(result?.disclaimerSummary).toMatchObject({
        acceptedCount: 0,
        pendingCount: 1,
      })
    })
  })

  describe('getChatbotsInfo', () => {
    it('projects the normalized standard-mode configuration', async () => {
      const course = await seedCourse({}, userOneCtx)
      const chatbot = await prisma.chatbot.create({
        data: {
          name: 'Configured standard modes',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          standardModeConfig: {
            tutorEnabled: true,
            explainerEnabled: true,
            quizzerEnabled: true,
            courseName: '  Course  ',
            subjectDomain: null,
            languageOfInstruction: 'de',
            scopeNote: '  Scope  ',
          },
        },
      })

      const [info] = await getChatbotsInfo(userOneCtx)

      expect(info).toMatchObject({
        id: chatbot.id,
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: true,
          quizzerEnabled: true,
          courseName: 'Course',
          languageOfInstruction: 'de',
          scopeNote: 'Scope',
        },
      })
      expect(info).not.toHaveProperty('systemPrompts')
    })

    it('derives all effective flags from legacy prompts without exposing them', async () => {
      const course = await seedCourse({}, userOneCtx)
      const chatbot = await prisma.chatbot.create({
        data: {
          name: 'Legacy standard modes',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          systemPrompts: {
            tutor: { enabled: false, prompt: 'PRIVATE-TUTOR-PROMPT' },
            explainer: { enabled: true },
            quizzer: { enabled: false },
          },
        },
      })

      const [info] = await getChatbotsInfo(userOneCtx)

      expect(info).toMatchObject({
        id: chatbot.id,
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          quizzerEnabled: false,
        },
      })
      expect(info).not.toHaveProperty('systemPrompts')
      expect(JSON.stringify(info)).not.toContain('PRIVATE-TUTOR-PROMPT')
    })

    it('normalizes a retired allow-list for the owner without rewriting the row', async () => {
      const course = await seedCourse({}, userOneCtx)
      const chatbot = await prisma.chatbot.create({
        data: {
          name: 'Legacy model chatbot',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          allowedModelIds: ['gpt-4.1-mini'],
          allowedReasoningEffortsByModel: {
            'gpt-4.1-mini': ['medium'],
          },
        },
      })

      const [info] = await getChatbotsInfo(userOneCtx)

      expect(info).toMatchObject({
        id: chatbot.id,
        allowedModelIds: ['gpt-5.6-luna'],
        allowedReasoningEffortsByModel: [],
      })

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: {
            allowedModelIds: true,
            allowedReasoningEffortsByModel: true,
          },
        })
      ).resolves.toEqual({
        allowedModelIds: ['gpt-4.1-mini'],
        allowedReasoningEffortsByModel: {
          'gpt-4.1-mini': ['medium'],
        },
      })
    })

    it('projects legacy fixed model lists through the configured automatic primary', async () => {
      const course = await seedCourse({}, userOneCtx)
      const chatbot = await prisma.chatbot.create({
        data: {
          name: 'Legacy fixed model chatbot',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          modelSelection: false,
          allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
        },
      })
      const previousPrimary = process.env.CHAT_PRIMARY_MODEL_ID
      process.env.CHAT_PRIMARY_MODEL_ID = 'gpt-4.1'

      try {
        const [info] = await getChatbotsInfo(userOneCtx)
        expect(info).toMatchObject({
          id: chatbot.id,
          allowedModelIds: ['gpt-4.1'],
        })
      } finally {
        if (previousPrimary === undefined) {
          delete process.env.CHAT_PRIMARY_MODEL_ID
        } else {
          process.env.CHAT_PRIMARY_MODEL_ID = previousPrimary
        }
      }
    })
  })
})
