import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { ChatbotStatus, type PrismaClient } from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createChatbot,
  getChatbotsInfo,
  saveChatbotDisclaimer,
  updateChatbot,
  updateChatbotModelSettings,
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
        allowedModelIds: ['gpt-5.6-luna'],
        allowedReasoningEffortsByModel: [
          { modelId: 'gpt-5.6-luna', efforts: ['low', 'medium'] },
        ],
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
})
