import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ChatbotStatus,
  type PrismaClient,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'events'
import { onTestFinished } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  approveChatbotRevision,
  getPendingChatbotPublications,
  rejectChatbotRevision,
  saveChatbotRevision,
  submitChatbotRevision,
} from '../src/services/chatbots.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Integration tests for the chatbot publication workflow', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let adminCtx: ContextWithUser

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
    adminCtx = {
      ...userOneCtx,
      user: { ...userOneCtx.user, role: UserRole.ADMIN },
    }
  })

  afterEach(async () => await testCleanup(prisma))

  async function enablePublishing() {
    await prisma.user.update({
      where: { id: userOneCtx.user.sub },
      data: { aiFeaturesEnabled: true },
    })
  }

  async function seedChatbot(
    status: ChatbotStatus,
    extra: Record<string, unknown> = {}
  ) {
    const course = await seedCourse({}, userOneCtx)
    const disclaimer =
      extra.disclaimerId === null
        ? null
        : await prisma.chatbotDisclaimer.create({
            data: {
              name: 'Publication disclaimer',
              title: 'Course chatbot disclaimer',
              introText: 'Course-specific introduction',
              ownerId: userOneCtx.user.sub,
            },
          })
    return prisma.chatbot.create({
      data: {
        name: 'Bot',
        courseId: course.id,
        ownerId: userOneCtx.user.sub,
        status,
        publicationUseCase:
          status === ChatbotStatus.PENDING_APPROVAL ? 'Course Q&A' : null,
        expectedStudentCount:
          status === ChatbotStatus.PENDING_APPROVAL ? 120 : null,
        disclaimerId: disclaimer?.id ?? null,
        ...extra,
      },
    })
  }

  function submit(
    bot: { id: string; revisionVersion: number },
    ctx: ContextWithUser = userOneCtx,
    useCase = 'Course Q&A',
    expectedStudentCount = 120,
    expectedRevisionVersion = bot.revisionVersion
  ) {
    return submitChatbotRevision(
      {
        chatbotId: bot.id,
        expectedRevisionVersion,
        useCase,
        expectedStudentCount,
      },
      ctx
    )
  }

  describe('getPendingChatbotPublications', () => {
    it('rejects non-admin callers', async () => {
      await seedChatbot(ChatbotStatus.PENDING_APPROVAL)
      await expect(getPendingChatbotPublications(userOneCtx)).rejects.toThrow(
        'Not authorized'
      )
      await expect(getPendingChatbotPublications(userTwoCtx)).rejects.toThrow(
        'Not authorized'
      )
    })

    it('lists pending requests across owners with review details but no credentials', async () => {
      await enablePublishing()
      const pending = await seedChatbot(ChatbotStatus.PENDING_APPROVAL, {
        name: 'Synthetic review bot',
        publicationUseCase: 'Practice course concepts',
        expectedStudentCount: 40,
        creditInitialCredits: 25,
        creditMaxCredits: 25,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        openaiApiKey: 'synthetic-secret-not-for-review',
        openaiBaseUrl: 'https://synthetic.invalid',
        standardModeConfig: {
          tutorEnabled: true,
          explainerEnabled: true,
          quizzerEnabled: false,
          scopeNote: 'Synthetic course framing',
        },
      })
      const server = await prisma.chatbotMCPServer.create({
        data: {
          name: `Synthetic review tools ${pending.id}`,
          url: 'https://synthetic-tool.invalid',
          authType: 'bearer',
          authSecret: 'synthetic-tool-secret-not-for-review',
          configurations: {
            create: {
              chatbotId: pending.id,
              chatMode: 'tutor',
              allowedTools: ['doc_query'],
            },
          },
        },
      })
      onTestFinished(async () => {
        await prisma.chatbotMCPServer.delete({ where: { id: server.id } })
      })
      const otherCourse = await seedCourse({}, userTwoCtx)
      const second = await prisma.chatbot.create({
        data: {
          name: 'Another owner request',
          updatedAt: new Date('2026-01-02T00:00:00Z'),
          courseId: otherCourse.id,
          ownerId: userTwoCtx.user.sub,
          status: ChatbotStatus.PENDING_APPROVAL,
        },
      })
      await seedChatbot(ChatbotStatus.DRAFT)
      await seedChatbot(ChatbotStatus.PUBLISHED)
      await seedChatbot(ChatbotStatus.REJECTED)
      await seedChatbot(ChatbotStatus.PAUSED)

      const reviews = await getPendingChatbotPublications(adminCtx)
      expect(reviews.map(({ chatbot }) => chatbot.id)).toEqual([
        pending.id,
        second.id,
      ])
      expect(reviews[0]).toMatchObject({
        ownerPublishingEnabled: true,
        tools: [
          {
            serverName: server.name,
            chatMode: 'tutor',
            enabled: true,
            allowedTools: ['doc_query'],
          },
        ],
        disclaimerTitle: 'Course chatbot disclaimer',
        disclaimerIntroText: 'Course-specific introduction',
        chatbot: {
          id: pending.id,
          name: 'Synthetic review bot',
          publicationUseCase: 'Practice course concepts',
          expectedStudentCount: 40,
          creditInitialCredits: 25,
          courses: [{ id: pending.courseId }],
          standardModeConfig: { scopeNote: 'Synthetic course framing' },
        },
      })
      expect(reviews[0]?.ownerShortname).toBeTruthy()
      expect(reviews[0]?.tools[0]).not.toHaveProperty('authSecret')
      expect(reviews[0]?.tools[0]).not.toHaveProperty('url')
      expect(reviews[0]?.chatbot).not.toHaveProperty('openaiApiKey')
      expect(reviews[0]?.chatbot).not.toHaveProperty('openaiBaseUrl')
      expect(reviews[0]?.chatbot).not.toHaveProperty('systemPrompts')
      expect(reviews[0]?.chatbot).not.toHaveProperty('threads')
      expect(reviews[1]?.ownerPublishingEnabled).toBe(false)

      await approveChatbotRevision(
        { id: pending.id, expectedRevisionVersion: pending.revisionVersion },
        adminCtx
      )
      const remaining = await getPendingChatbotPublications(adminCtx)
      expect(remaining.map(({ chatbot }) => chatbot.id)).toEqual([second.id])
    })

    it('reviews a published chatbot revision and rejects stale review decisions', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.PUBLISHED, {
        name: 'Live configuration',
      })
      const saved = await saveChatbotRevision(
        {
          chatbotId: bot.id,
          expectedRevisionVersion: bot.revisionVersion,
          input: {
            metadata: { name: 'Pending configuration' },
            disclaimer: {
              title: 'Pending disclaimer',
              introText: 'Synthetic revised introduction',
            },
          },
        },
        userOneCtx
      )
      const pending = await submit({
        id: bot.id,
        revisionVersion: saved!.revisionVersion,
      })
      const reviews = await getPendingChatbotPublications(adminCtx)
      expect(reviews).toHaveLength(1)
      expect(reviews[0]?.chatbot).toMatchObject({
        id: bot.id,
        status: ChatbotStatus.PUBLISHED,
        name: 'Live configuration',
        revisionVersion: pending!.revisionVersion,
        authoringRevision: {
          name: 'Pending configuration',
          status: ChatbotStatus.PENDING_APPROVAL,
          disclaimerTitle: 'Pending disclaimer',
          disclaimerIntroText: 'Synthetic revised introduction',
        },
      })
      await expect(
        approveChatbotRevision(
          { id: bot.id, expectedRevisionVersion: saved!.revisionVersion },
          adminCtx
        )
      ).rejects.toThrow()
      const rejected = await rejectChatbotRevision(
        {
          id: bot.id,
          expectedRevisionVersion: reviews[0]!.chatbot.revisionVersion,
          comment: 'Please revise the scope',
        },
        adminCtx
      )
      expect(rejected).toMatchObject({
        status: ChatbotStatus.PUBLISHED,
        revisionStatus: ChatbotStatus.REJECTED,
      })
      expect(await getPendingChatbotPublications(adminCtx)).toEqual([])
      const resubmitted = await submit({
        id: bot.id,
        revisionVersion: rejected!.revisionVersion,
      })
      await expect(
        rejectChatbotRevision(
          {
            id: bot.id,
            expectedRevisionVersion: pending!.revisionVersion,
            comment: 'Stale review',
          },
          adminCtx
        )
      ).rejects.toThrow()
      const approved = await approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: resubmitted!.revisionVersion },
        adminCtx
      )
      expect(approved).toMatchObject({
        name: 'Pending configuration',
        status: ChatbotStatus.PUBLISHED,
        revisionStatus: null,
      })
      expect(await getPendingChatbotPublications(adminCtx)).toEqual([])
    })

    it('excludes paused bots and non-legacy pending records without a pending revision', async () => {
      await seedChatbot(ChatbotStatus.PAUSED, {
        revisionStatus: ChatbotStatus.PENDING_APPROVAL,
      })
      await seedChatbot(ChatbotStatus.PENDING_APPROVAL, { revisionVersion: 1 })
      expect(await getPendingChatbotPublications(adminCtx)).toEqual([])
    })

    it('returns an empty queue when nothing is awaiting approval', async () => {
      expect(await getPendingChatbotPublications(adminCtx)).toEqual([])
    })
  })

  describe('submitChatbotRevision', () => {
    it('moves a DRAFT bot to PENDING_APPROVAL and records the request', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      const result = await submit(bot, userOneCtx, '  Course Q&A\n')

      expect(result).toMatchObject({
        status: 'PENDING_APPROVAL',
        publicationUseCase: 'Course Q&A',
        expectedStudentCount: 120,
        creditInitialCredits: 1,
        creditResetAmount: 1,
        creditMaxCredits: 1,
        reviewComment: null,
      })
    })

    it('preserves the saved four-field credit policy', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT, {
        creditInitialCredits: 2,
        creditResetPeriod: 'MONTHLY',
        creditResetAmount: 3,
        creditMaxCredits: 8,
      })

      const result = await submit(bot)

      expect(result).toMatchObject({
        status: 'PENDING_APPROVAL',
        creditInitialCredits: 2,
        creditResetPeriod: 'MONTHLY',
        creditResetAmount: 3,
        creditMaxCredits: 8,
      })
    })

    it('requires a linked, non-empty disclaimer before submission', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT, {
        disclaimerId: null,
      })

      await expect(submit(bot)).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_DISCLAIMER_REQUIRED' },
      })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true, revisionVersion: true },
        })
      ).resolves.toEqual({ status: ChatbotStatus.DRAFT, revisionVersion: 0 })
    })

    it('rejects a linked disclaimer with an empty introduction', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)
      await prisma.chatbotDisclaimer.update({
        where: { id: bot.disclaimerId! },
        data: { introText: '  ' },
      })

      await expect(submit(bot)).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_DISCLAIMER_REQUIRED' },
      })
    })

    it('clears the prior review comment when resubmitting from REJECTED', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.REJECTED, {
        reviewComment: 'needs a clearer scope',
      })

      const result = await submit(bot, userOneCtx, 'Revised scope', 30)

      expect(result?.status).toBe('PENDING_APPROVAL')
      expect(result?.reviewComment).toBeNull()
    })

    it('allows only one concurrent submission for the same revision version', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      const results = await Promise.allSettled([
        submit(bot, userOneCtx, 'Course Q&A', 10),
        submit(bot, userOneCtx, 'Course Q&A', 10),
      ])

      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1)
      expect(
        results.find((result) => result.status === 'rejected')?.reason
      ).toMatchObject({
        extensions: { code: 'CHATBOT_NOT_EDITABLE' },
      })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true },
        })
      ).resolves.toMatchObject({ status: ChatbotStatus.PENDING_APPROVAL })
    })

    it('rejects a stale revision version when submitting a PUBLISHED bot', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.PUBLISHED)

      await expect(
        submit(bot, userOneCtx, 'Course Q&A', 1, 1)
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_EDIT_CONFLICT' },
      })
    })

    it.each([
      ['empty', ''],
      ['blank', ' \n\t '],
      ['overlong', 'x'.repeat(2001)],
    ])('rejects a %s use case', async (_, useCase) => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      await expect(submit(bot, userOneCtx, useCase, 1)).rejects.toThrow(
        'useCase must be between 1 and 2000 characters long'
      )
    })

    it.each([
      ['zero', 0],
      ['negative', -1],
      ['non-integer', 1.5],
      ['overflow', 2_147_483_648],
    ])('rejects %s expected student count', async (_, value) => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      await expect(
        submit(bot, userOneCtx, 'Course Q&A', value)
      ).rejects.toThrow(
        'expectedStudentCount must be a positive signed 32-bit integer'
      )
    })

    it('rejects when the account is not approved for publishing', async () => {
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      await expect(submit(bot, userOneCtx, 'Course Q&A', 1)).rejects.toThrow(
        'not approved'
      )
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true },
        })
      ).resolves.toEqual({ status: ChatbotStatus.DRAFT })
    })

    it('returns null and makes no change for a non-owner', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      const result = await submit(bot, userTwoCtx, 'Course Q&A', 1)

      expect(result).toBeNull()
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true, revisionVersion: true },
        })
      ).resolves.toEqual({ status: ChatbotStatus.DRAFT, revisionVersion: 0 })
    })
  })

  describe('approveChatbotRevision', () => {
    it('publishes a PENDING bot and stamps publishedAt', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      const result = await approveChatbotRevision(
        { id: bot.id, expectedRevisionVersion: bot.revisionVersion },
        adminCtx
      )

      expect(result?.status).toBe('PUBLISHED')
      expect(result?.publishedAt).toBeInstanceOf(Date)
    })

    it('allows only one concurrent approval to publish a PENDING bot', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      const results = await Promise.allSettled([
        approveChatbotRevision(
          { id: bot.id, expectedRevisionVersion: bot.revisionVersion },
          adminCtx
        ),
        approveChatbotRevision(
          { id: bot.id, expectedRevisionVersion: bot.revisionVersion },
          adminCtx
        ),
      ])

      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1)
      expect(
        results.find((result) => result.status === 'rejected')?.reason
      ).toMatchObject({
        extensions: { code: 'CHATBOT_REVISION_NOT_PENDING' },
      })
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true },
        })
      ).resolves.toMatchObject({ status: ChatbotStatus.PUBLISHED })
    })

    it('refuses to publish when the owner lacks publishing capability', async () => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      await expect(
        approveChatbotRevision(
          { id: bot.id, expectedRevisionVersion: bot.revisionVersion },
          adminCtx
        )
      ).rejects.toThrow('no longer approved')

      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true },
        })
      ).resolves.toEqual({ status: ChatbotStatus.PENDING_APPROVAL })
    })

    it('rejects approving a bot that is not pending', async () => {
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      await expect(
        approveChatbotRevision(
          { id: bot.id, expectedRevisionVersion: bot.revisionVersion },
          adminCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'CHATBOT_REVISION_NOT_PENDING' },
      })
    })

    it('rejects a non-admin caller and makes no change', async () => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      await expect(
        approveChatbotRevision(
          { id: bot.id, expectedRevisionVersion: bot.revisionVersion },
          userOneCtx
        )
      ).rejects.toThrow('Not authorized')
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true },
        })
      ).resolves.toEqual({ status: ChatbotStatus.PENDING_APPROVAL })
    })
  })

  describe('rejectChatbotRevision', () => {
    it('moves a PENDING bot to REJECTED with a review comment', async () => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      const result = await rejectChatbotRevision(
        {
          id: bot.id,
          expectedRevisionVersion: bot.revisionVersion,
          comment: 'scope too broad',
        },
        adminCtx
      )

      expect(result?.status).toBe('REJECTED')
      expect(result?.reviewComment).toBe('scope too broad')
    })

    it.each([
      ['empty', ''],
      ['whitespace-only', ' \t\n'],
    ])('rejects a %s review comment without changing the bot', async (_, comment) => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      await expect(
        rejectChatbotRevision(
          {
            id: bot.id,
            expectedRevisionVersion: bot.revisionVersion,
            comment,
          },
          adminCtx
        )
      ).rejects.toThrow('Review comment must not be empty')
      await expect(
        prisma.chatbot.findUniqueOrThrow({
          where: { id: bot.id },
          select: { status: true, reviewComment: true },
        })
      ).resolves.toMatchObject({
        status: ChatbotStatus.PENDING_APPROVAL,
        reviewComment: null,
      })
    })

    it('rejects a non-admin caller', async () => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      await expect(
        rejectChatbotRevision(
          {
            id: bot.id,
            expectedRevisionVersion: bot.revisionVersion,
            comment: ' ',
          },
          userOneCtx
        )
      ).rejects.toThrow('Not authorized')
    })

    it('returns null for a missing bot before validating the comment', async () => {
      await expect(
        rejectChatbotRevision(
          {
            id: '00000000-0000-0000-0000-000000000000',
            expectedRevisionVersion: 0,
            comment: ' ',
          },
          adminCtx
        )
      ).resolves.toBeNull()
    })
  })
})
