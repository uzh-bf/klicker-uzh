import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { createChatbot, updateChatbot } from '../src/services/chatbots.js'
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
  })

  afterEach(async () => await testCleanup(prisma))

  describe('createChatbot', () => {
    it('creates a DRAFT tutor-only chatbot owned by the caller', async () => {
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
        allowedModelIds: ['gpt-5.6-luna'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
        ],
        courses: [{ id: course.id }],
      })

      // Row is persisted with the caller as owner, DRAFT, no custom modes
      // (systemPrompts null -> tutor-only default at runtime).
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
        allowedModelIds: ['gpt-5.6-luna'],
        allowedReasoningEffortsByModel: {
          'gpt-5.6-luna': ['low', 'medium'],
        },
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
    async function seedOwnedChatbot() {
      const course = await seedCourse({}, userOneCtx)
      const chatbot = await prisma.chatbot.create({
        data: {
          name: 'Original',
          description: 'before',
          courseId: course.id,
          ownerId: userOneCtx.user.sub,
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
  })
})
