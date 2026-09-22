import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ChatbotStatus,
  CreditResetPeriod,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createChatbot,
  getChatbotsInfo,
  saveChatbotRevision,
} from '../src/services/chatbots.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Integration tests for lecturer chatbot management', () => {
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
    userOneCtx.featureFlags = {
      refresh: async () => {},
      getAiBetaDecision: () => 'enabled',
      isEnabled: (key) => key === 'ai-beta',
    } as NonNullable<ContextWithUser['featureFlags']>
    userTwoCtx = ctx2
    await prisma.user.updateMany({
      where: { id: { in: [userOneCtx.user.sub, userTwoCtx.user.sub] } },
      data: { aiFeaturesEnabled: true },
    })
  })

  afterEach(async () => await testCleanup(prisma))

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
          knowledgeGraphVisible: true,
          knowledgeGraphRetrievalEnabled: true,
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
        knowledgeGraphVisible: false,
        knowledgeGraphRetrievalEnabled: false,
      })
    })

    it('rejects creation against a course the caller does not own', async () => {
      const course = await seedCourse({}, userOneCtx)

      await expect(
        createChatbot({ name: 'Sneaky', courseId: course.id }, userTwoCtx)
      ).rejects.toThrow('Course not found')

      await expect(
        prisma.chatbot.count({ where: { courseId: course.id } })
      ).resolves.toBe(0)
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

  describe('saveChatbotRevision metadata', () => {
    async function seedOwnedChatbot(
      status: ChatbotStatus = ChatbotStatus.DRAFT
    ) {
      const course = await seedCourse({}, userOneCtx)
      return prisma.chatbot.create({
        data: {
          name: 'Original',
          description: 'before',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
        },
      })
    }

    it('saves metadata and retains the draft snapshot', async () => {
      const chatbot = await seedOwnedChatbot()

      const result = await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: { metadata: { name: 'Renamed', description: 'after' } },
        },
        userOneCtx
      )

      expect(result).toMatchObject({
        id: chatbot.id,
        name: 'Renamed',
        description: 'after',
        revisionVersion: 1,
        authoringRevision: { name: 'Renamed', description: 'after' },
      })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { name: true, description: true, draftConfig: true },
        })
      ).resolves.toMatchObject({
        name: 'Renamed',
        description: 'after',
        draftConfig: { name: 'Renamed', description: 'after' },
      })
    })

    it('rejects an empty name without writing', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: { metadata: { name: '' } },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { name: true, revisionVersion: true, draftConfig: true },
        })
      ).resolves.toEqual({
        name: 'Original',
        revisionVersion: 0,
        draftConfig: null,
      })
    })

    it('returns null for a non-owner and rejects pending edits', async () => {
      const chatbot = await seedOwnedChatbot()
      const input = { metadata: { name: 'Changed' } }

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input,
          },
          userTwoCtx
        )
      ).resolves.toBeNull()
      await expect(
        saveChatbotRevision(
          { chatbotId: chatbot.id, expectedRevisionVersion: 0, input },
          userOneCtx
        )
      ).resolves.toMatchObject({ revisionVersion: 1 })
      await expect(
        saveChatbotRevision(
          { chatbotId: chatbot.id, expectedRevisionVersion: 0, input },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_EDIT_CONFLICT' },
      })

      const pending = await seedOwnedChatbot(ChatbotStatus.PENDING_APPROVAL)
      await expect(
        saveChatbotRevision(
          {
            chatbotId: pending.id,
            expectedRevisionVersion: pending.revisionVersion,
            input,
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })

    it('stages published metadata while keeping live fields unchanged', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.PUBLISHED)

      const result = await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: { metadata: { name: 'Preview' } },
        },
        userOneCtx
      )

      expect(result).toMatchObject({
        name: 'Original',
        revisionStatus: ChatbotStatus.DRAFT,
        revisionVersion: 1,
        authoringRevision: { name: 'Preview' },
      })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { name: true, draftConfig: true },
        })
      ).resolves.toMatchObject({
        name: 'Original',
        draftConfig: { name: 'Preview' },
      })
    })
  })

  describe('saveChatbotRevision credit policy', () => {
    async function seedOwnedChatbot(
      status: ChatbotStatus = ChatbotStatus.DRAFT
    ) {
      const course = await seedCourse({}, userOneCtx)
      return prisma.chatbot.create({
        data: {
          name: 'Credit policy bot',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
          status,
        },
      })
    }

    const policy = {
      creditInitialCredits: 3,
      creditResetPeriod: CreditResetPeriod.MONTHLY,
      creditResetAmount: 4,
      creditMaxCredits: 7,
    }

    it.each([
      ChatbotStatus.DRAFT,
      ChatbotStatus.REJECTED,
      ChatbotStatus.PUBLISHED,
    ])('saves all credit-policy fields while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      const result = await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: { creditPolicy: policy },
        },
        userOneCtx
      )

      if (status === ChatbotStatus.PUBLISHED) {
        expect(result).toMatchObject({
          creditInitialCredits: chatbot.creditInitialCredits,
          creditResetPeriod: chatbot.creditResetPeriod,
          creditResetAmount: chatbot.creditResetAmount,
          creditMaxCredits: chatbot.creditMaxCredits,
          revisionStatus: ChatbotStatus.DRAFT,
          revisionVersion: 1,
          authoringRevision: policy,
        })
      } else {
        expect(result).toMatchObject({ ...policy, revisionVersion: 1 })
      }
    })

    it('normalizes a disabled reset amount to zero', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              creditPolicy: {
                creditInitialCredits: 0,
                creditResetPeriod: CreditResetPeriod.NONE,
                creditResetAmount: 99,
                creditMaxCredits: 0,
              },
            },
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
        creditInitialCredits: 6,
        creditResetPeriod: CreditResetPeriod.WEEKLY,
        creditResetAmount: 1,
        creditMaxCredits: 5,
      },
      {
        creditInitialCredits: -1,
        creditResetPeriod: CreditResetPeriod.NONE,
        creditResetAmount: 0,
        creditMaxCredits: 1,
      },
    ])('rejects an invalid credit policy without writing', async (creditPolicy) => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: { creditPolicy },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { revisionVersion: true, draftConfig: true },
        })
      ).resolves.toEqual({ revisionVersion: 0, draftConfig: null })
    })

    it('returns null without writing for a non-owner', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: { creditPolicy: policy },
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
      ).resolves.toMatchObject({
        creditInitialCredits: 1,
        creditResetPeriod: CreditResetPeriod.WEEKLY,
        creditResetAmount: 1,
        creditMaxCredits: 1,
      })
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects credit-policy changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: { creditPolicy: policy },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })
  })

  describe('saveChatbotRevision model policy', () => {
    async function seedOwnedChatbot(
      status: ChatbotStatus = ChatbotStatus.DRAFT
    ) {
      const course = await seedCourse({}, userOneCtx)
      return prisma.chatbot.create({
        data: {
          name: 'Model policy bot',
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
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              modelPolicy: { modelSelection: false, allowedModelIds: ['auto'] },
            },
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        modelSelection: false,
        allowedModelIds: ['auto'],
        allowedReasoningEffortsByModel: [],
      })
    })

    it('requires exactly one supported reasoning effort for a fixed model', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              modelPolicy: {
                modelSelection: false,
                allowedModelIds: ['gpt-5.6-luna'],
                allowedReasoningEffortsByModel: [
                  { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
                ],
              },
            },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              modelPolicy: {
                modelSelection: false,
                allowedModelIds: ['gpt-5.6-luna'],
                allowedReasoningEffortsByModel: [
                  { modelId: 'gpt-5.6-luna', efforts: ['high'] },
                ],
              },
            },
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
      const input = {
        modelPolicy: {
          modelSelection: true,
          allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
          allowedReasoningEffortsByModel: [
            { modelId: 'gpt-5.6-luna', efforts: ['medium', 'low'] },
          ],
        },
      }

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input,
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
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: 1,
            input: {
              modelPolicy: {
                modelSelection: true,
                allowedModelIds: ['gpt-4.1'],
                allowedReasoningEffortsByModel: [
                  { modelId: 'gpt-5.6-luna', efforts: ['medium'] },
                ],
              },
            },
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
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              modelPolicy: { modelSelection: false, allowedModelIds: [] },
            },
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

    it('stages a published policy and reports a stale version conflict', async () => {
      const chatbot = await seedOwnedChatbot(ChatbotStatus.PUBLISHED)
      const input = {
        modelPolicy: { modelSelection: false, allowedModelIds: ['auto'] },
      }
      const beforeInfo = ((await getChatbotsInfo(userOneCtx)) ?? []).find(
        ({ id }) => id === chatbot.id
      )
      if (!beforeInfo) throw new Error('Chatbot projection not found')
      const liveBefore = await prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbot.id },
        select: {
          modelSelection: true,
          allowedModelIds: true,
          allowedReasoningEffortsByModel: true,
        },
      })

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input,
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        allowedModelIds: beforeInfo.allowedModelIds,
        revisionStatus: ChatbotStatus.DRAFT,
        revisionVersion: 1,
        authoringRevision: input.modelPolicy,
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
      ).resolves.toEqual(liveBefore)
      await expect(
        saveChatbotRevision(
          { chatbotId: chatbot.id, expectedRevisionVersion: 0, input },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_EDIT_CONFLICT' },
      })
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects model-policy changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              modelPolicy: { modelSelection: false, allowedModelIds: ['auto'] },
            },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })
  })

  describe('saveChatbotRevision standard modes', () => {
    async function seedOwnedChatbot(
      status: ChatbotStatus = ChatbotStatus.DRAFT
    ) {
      const course = await seedCourse({}, userOneCtx)
      return prisma.chatbot.create({
        data: {
          name: 'Standard modes bot',
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
    ])('normalizes standard-mode changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)
      const expected = {
        tutorEnabled: true,
        explainerEnabled: false,
        quizzerEnabled: true,
        courseName: 'Clinical pharmacology',
        subjectDomain: 'Medicine',
        languageOfInstruction: 'en',
        scopeNote:
          'Use the course materials only.\nDo not provide medical advice.',
      }
      const beforeInfo =
        status === ChatbotStatus.PUBLISHED
          ? ((await getChatbotsInfo(userOneCtx)) ?? []).find(
              ({ id }) => id === chatbot.id
            )
          : undefined
      const liveBefore =
        status === ChatbotStatus.PUBLISHED
          ? await prisma.chatbot.findUniqueOrThrow({
              where: { id: chatbot.id },
              select: { standardModeConfig: true },
            })
          : undefined
      if (status === ChatbotStatus.PUBLISHED) {
        if (!beforeInfo) throw new Error('Chatbot projection not found')
      }

      const result = await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: { standardModeConfig: config },
        },
        userOneCtx
      )

      if (status === ChatbotStatus.PUBLISHED) {
        expect(result).toMatchObject({
          standardModeConfig: beforeInfo!.standardModeConfig,
          revisionStatus: ChatbotStatus.DRAFT,
          revisionVersion: 1,
          authoringRevision: { standardModeConfig: expected },
        })
        await expect(
          prisma.chatbot.findUniqueOrThrow({
            where: { id: chatbot.id },
            select: { standardModeConfig: true },
          })
        ).resolves.toEqual(liveBefore)
      } else {
        expect(result).toMatchObject({ standardModeConfig: expected })
      }
    })

    it('rejects disabling all standard modes without writing', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              standardModeConfig: {
                ...config,
                tutorEnabled: false,
                explainerEnabled: false,
                quizzerEnabled: false,
              },
            },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { standardModeConfig: true, revisionVersion: true },
        })
      ).resolves.toEqual({ standardModeConfig: null, revisionVersion: 0 })
    })

    it('preserves an existing long framing note in a complete save', async () => {
      const chatbot = await seedOwnedChatbot()
      const scopeNote = 'Synthetic framing. '.repeat(20).trim()
      const legacyConfig = { ...config, scopeNote, explainerEnabled: true }
      await prisma.chatbot.update({
        where: { id: chatbot.id },
        data: { standardModeConfig: legacyConfig },
      })

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              standardModeConfig: { ...legacyConfig, tutorEnabled: false },
            },
          },
          userOneCtx
        )
      ).resolves.toMatchObject({
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          scopeNote,
        },
      })
    })

    it('returns null without writing for a non-owner', async () => {
      const chatbot = await seedOwnedChatbot()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: { standardModeConfig: config },
          },
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

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects standard-mode changes while %s', async (status) => {
      const chatbot = await seedOwnedChatbot(status)

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: { standardModeConfig: config },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
    })
  })

  describe('saveChatbotRevision disclaimer', () => {
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

    it('replaces and normalizes content while preserving template metadata', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()

      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: disclaimer?.id,
              title: '  Revised title\r\n',
              introText: '  First line\r\nSecond line\r  ',
            },
          },
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

      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: disclaimer?.id,
              title: 'Supported formatting',
              introText,
            },
          },
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

      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: disclaimer?.id,
              title: ` ${title} `,
              introText: `\r\n${introText}\r\n`,
            },
          },
        },
        userOneCtx
      )

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { disclaimer: { select: { title: true, introText: true } } },
        })
      ).resolves.toMatchObject({ disclaimer: { title, introText } })
    })

    it('creates the first disclaimer and does not create a row for a normalized no-op', async () => {
      const { chatbot } = await seedChatbotWithDisclaimer(
        ChatbotStatus.DRAFT,
        false
      )

      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: null,
              title: ' Course terms ',
              introText: ' Introduction\r\n',
            },
          },
        },
        userOneCtx
      )
      const linked = await prisma.chatbot.findUniqueOrThrow({
        where: { id: chatbot.id },
        select: { disclaimerId: true, revisionVersion: true },
      })
      const countAfterCreate = await prisma.chatbotDisclaimer.count()

      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: linked.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: linked.disclaimerId,
              title: '\r\nCourse terms\r\n',
              introText: 'Introduction',
            },
          },
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
      ).resolves.toEqual({ disclaimerId: linked.disclaimerId })
    })

    it('rejects a stale expected disclaimer without leaving an orphan row', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()

      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: disclaimer?.id,
              title: 'First replacement',
              introText: 'First replacement introduction',
            },
          },
        },
        userOneCtx
      )
      const countBeforeStaleSave = await prisma.chatbotDisclaimer.count()

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: 1,
            input: {
              disclaimer: {
                expectedDisclaimerId: disclaimer?.id,
                title: 'Stale replacement',
                introText: 'Stale replacement introduction',
              },
            },
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

    it('allows only one concurrent save for the same revision version', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer()
      const countBeforeSaves = await prisma.chatbotDisclaimer.count()
      const input = (title: string) => ({
        disclaimer: {
          expectedDisclaimerId: disclaimer?.id,
          title,
          introText: `${title} introduction`,
        },
      })

      const results = await Promise.allSettled([
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: input('Concurrent A'),
          },
          userOneCtx
        ),
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: input('Concurrent B'),
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
        extensions: { code: 'CHATBOT_EDIT_CONFLICT' },
      })
      await expect(prisma.chatbotDisclaimer.count()).resolves.toBe(
        countBeforeSaves + 1
      )
    })

    it('stages a published disclaimer until approval', async () => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer(
        ChatbotStatus.PUBLISHED
      )

      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: disclaimer?.id,
              title: 'Preview title',
              introText: 'Preview introduction',
            },
          },
        },
        userOneCtx
      )

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: chatbot.id },
          select: { disclaimerId: true, draftConfig: true },
        })
      ).resolves.toMatchObject({
        disclaimerId: disclaimer?.id,
        draftConfig: {
          disclaimerTitle: 'Preview title',
          disclaimerIntroText: 'Preview introduction',
        },
      })
    })

    it.each([
      ChatbotStatus.PENDING_APPROVAL,
      ChatbotStatus.PAUSED,
    ])('rejects disclaimer changes while %s', async (status) => {
      const { chatbot, disclaimer } = await seedChatbotWithDisclaimer(status)

      await expect(
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              disclaimer: {
                expectedDisclaimerId: disclaimer?.id,
                title: 'Blocked',
                introText: 'Blocked introduction',
              },
            },
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
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              disclaimer: { expectedDisclaimerId: disclaimer?.id, ...content },
            },
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
        saveChatbotRevision(
          {
            chatbotId: chatbot.id,
            expectedRevisionVersion: chatbot.revisionVersion,
            input: {
              disclaimer: {
                expectedDisclaimerId: disclaimer?.id,
                title: 'Unsupported formatting',
                introText,
              },
            },
          },
          userOneCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    })

    it('counts acceptance only for the currently linked disclaimer', async () => {
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
      await saveChatbotRevision(
        {
          chatbotId: chatbot.id,
          expectedRevisionVersion: chatbot.revisionVersion,
          input: {
            disclaimer: {
              expectedDisclaimerId: disclaimer?.id,
              title: 'Current title',
              introText: 'Current introduction',
            },
          },
        },
        userOneCtx
      )

      const [result] = (await getChatbotsInfo(userOneCtx)) ?? []
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

      const [info] = (await getChatbotsInfo(userOneCtx)) ?? []

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

      const [info] = (await getChatbotsInfo(userOneCtx)) ?? []

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

      const [info] = (await getChatbotsInfo(userOneCtx)) ?? []

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
        const [info] = (await getChatbotsInfo(userOneCtx)) ?? []
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
