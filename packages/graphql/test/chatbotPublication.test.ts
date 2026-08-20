import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ChatbotStatus,
  PrismaClient,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  approveChatbotPublication,
  rejectChatbotPublication,
  requestChatbotPublication,
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
    // A distinct ADMIN caller (same identity plumbing, elevated role).
    adminCtx = {
      ...userOneCtx,
      user: { ...userOneCtx.user, role: UserRole.ADMIN },
    }
  })

  afterEach(async () => await testCleanup(prisma))

  async function enablePublishing() {
    await prisma.user.update({
      where: { id: userOneCtx.user.sub },
      data: { aiChatbotPublishingEnabled: true },
    })
  }

  async function seedChatbot(
    status: ChatbotStatus,
    extra: Record<string, unknown> = {}
  ) {
    const course = await seedCourse({}, userOneCtx)
    return prisma.chatbot.create({
      data: {
        name: 'Bot',
        courseId: course.id,
        ownerId: userOneCtx.user.sub,
        status,
        ...extra,
      },
    })
  }

  describe('requestChatbotPublication', () => {
    it('moves a DRAFT bot to PENDING_APPROVAL and records the request', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      const result = await requestChatbotPublication(
        {
          id: bot.id,
          useCase: 'Course Q&A',
          expectedStudentCount: 120,
          proposedCredits: 50,
        },
        userOneCtx
      )

      expect(result).toMatchObject({
        status: 'PENDING_APPROVAL',
        publicationUseCase: 'Course Q&A',
        expectedStudentCount: 120,
        creditInitialCredits: 50,
        creditResetAmount: 50,
        creditMaxCredits: 50,
        reviewComment: null,
      })
    })

    it('clears the prior review comment when re-requesting from REJECTED', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.REJECTED, {
        reviewComment: 'needs a clearer scope',
      })

      const result = await requestChatbotPublication(
        {
          id: bot.id,
          useCase: 'Revised scope',
          expectedStudentCount: 30,
          proposedCredits: 10,
        },
        userOneCtx
      )

      expect(result?.status).toBe('PENDING_APPROVAL')
      expect(result?.reviewComment).toBeNull()
    })

    it('rejects a request from a non-requestable status (PUBLISHED)', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.PUBLISHED)

      await expect(
        requestChatbotPublication(
          { id: bot.id, useCase: 'x', expectedStudentCount: 1, proposedCredits: 1 },
          userOneCtx
        )
      ).rejects.toThrow('Cannot request publication from status PUBLISHED')
    })

    it('rejects when the account is not approved for publishing', async () => {
      // aiChatbotPublishingEnabled defaults to false — do not enable it.
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      await expect(
        requestChatbotPublication(
          { id: bot.id, useCase: 'x', expectedStudentCount: 1, proposedCredits: 1 },
          userOneCtx
        )
      ).rejects.toThrow('not approved')

      const row = await prisma.chatbot.findUniqueOrThrow({
        where: { id: bot.id },
        select: { status: true },
      })
      expect(row.status).toBe('DRAFT')
    })

    it('returns null and makes no change for a non-owner', async () => {
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      const result = await requestChatbotPublication(
        { id: bot.id, useCase: 'x', expectedStudentCount: 1, proposedCredits: 1 },
        userTwoCtx
      )

      expect(result).toBeNull()
      const row = await prisma.chatbot.findUniqueOrThrow({
        where: { id: bot.id },
        select: { status: true },
      })
      expect(row.status).toBe('DRAFT')
    })
  })

  describe('approveChatbotPublication', () => {
    it('publishes a PENDING bot and stamps publishedAt', async () => {
      // A real PENDING bot got there via a request, which required the owner's
      // capability; keep it enabled so the approval-time re-check passes.
      await enablePublishing()
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL, {
        reviewComment: null,
      })

      const result = await approveChatbotPublication({ id: bot.id }, adminCtx)

      expect(result?.status).toBe('PUBLISHED')
      expect(result?.publishedAt).toBeInstanceOf(Date)
    })

    it('refuses to publish when the owner lost publishing capability while pending', async () => {
      // The bot reached PENDING via a request that required the capability, but
      // ops revoked aiChatbotPublishingEnabled before the admin acted. The
      // account-level gate must still hold at the moment the bot goes live, so
      // enablePublishing() is deliberately NOT called here.
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      await expect(
        approveChatbotPublication({ id: bot.id }, adminCtx)
      ).rejects.toThrow('no longer approved')

      const row = await prisma.chatbot.findUniqueOrThrow({
        where: { id: bot.id },
        select: { status: true },
      })
      expect(row.status).toBe('PENDING_APPROVAL')
    })

    it('rejects approving a bot that is not pending (DRAFT)', async () => {
      const bot = await seedChatbot(ChatbotStatus.DRAFT)

      await expect(
        approveChatbotPublication({ id: bot.id }, adminCtx)
      ).rejects.toThrow('Cannot approve from status DRAFT')
    })

    it('rejects a non-admin caller and makes no change', async () => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      await expect(
        approveChatbotPublication({ id: bot.id }, userOneCtx)
      ).rejects.toThrow('Not authorized')

      const row = await prisma.chatbot.findUniqueOrThrow({
        where: { id: bot.id },
        select: { status: true },
      })
      expect(row.status).toBe('PENDING_APPROVAL')
    })
  })

  describe('rejectChatbotPublication', () => {
    it('moves a PENDING bot to REJECTED with a review comment', async () => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      const result = await rejectChatbotPublication(
        { id: bot.id, comment: 'scope too broad' },
        adminCtx
      )

      expect(result?.status).toBe('REJECTED')
      expect(result?.reviewComment).toBe('scope too broad')
    })

    it('rejects a non-admin caller', async () => {
      const bot = await seedChatbot(ChatbotStatus.PENDING_APPROVAL)

      await expect(
        rejectChatbotPublication({ id: bot.id, comment: 'no' }, userOneCtx)
      ).rejects.toThrow('Not authorized')
    })
  })
})
