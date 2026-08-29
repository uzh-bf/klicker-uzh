import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  appendChatbotModePromptVersion,
  ensureChatbotPromptCatalog,
  updateChatbotModePresentation,
  updateChatbotModeStatus,
} from '@klicker-uzh/prisma'
import {
  ChatbotModePromptStatus,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const DATABASE_URL = process.env.TEST_DATABASE_URL
const isDisposableDatabase =
  process.env.TEST_DATABASE_DISPOSABLE === '1' &&
  DATABASE_URL != null &&
  (() => {
    try {
      return ['postgres', 'localhost', '127.0.0.1', '::1'].includes(
        new URL(DATABASE_URL).hostname.toLowerCase().replace(/^\[|\]$/g, '')
      )
    } catch {
      return false
    }
  })()

if (
  process.env.TEST_DATABASE_DISPOSABLE_REQUIRED === '1' &&
  !isDisposableDatabase
) {
  throw new Error('disposable_test_database_required')
}

const testDescribe = isDisposableDatabase ? describe : describe.skip

testDescribe('chatbot prompt catalog transactional writers', () => {
  const adapter = new PrismaPg({ connectionString: DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })
  const ownerId = randomUUID()
  const courseId = randomUUID()

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: ownerId,
        email: 'prompt-catalog-' + ownerId + '@synthetic.invalid',
        shortname: 'promptcatalog' + ownerId.slice(0, 8),
      },
    })
    await prisma.course.create({
      data: {
        id: courseId,
        name: 'Synthetic prompt catalog course',
        displayName: 'Synthetic prompt catalog course',
        ownerId,
        pinCode: Math.floor(100000 + Math.random() * 900000),
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        groupDeadlineDate: new Date(Date.now() + 20 * 24 * 3600 * 1000),
      },
    })
  })

  afterAll(async () => {
    await prisma.chatbot.deleteMany({ where: { courseId } })
    await prisma.course.delete({ where: { id: courseId } })
    await prisma.user.delete({ where: { id: ownerId } })
    await prisma.$disconnect()
  })

  async function createCatalogBot() {
    return prisma.$transaction(async (tx) => {
      const chatbot = await tx.chatbot.create({
        data: {
          name: 'Synthetic prompt catalog bot ' + randomUUID(),
          ownerId,
          courseId,
          systemPrompts: {
            tutor: {
              prompt: 'Tutor version one',
              description: 'Tutor description',
              badge: 'preserve-me',
            },
            explainer: {
              prompt: 'Explainer version one',
              description: 'Explainer description',
              presentation: { tone: 'calm' },
            },
          },
        },
        select: { id: true },
      })
      await ensureChatbotPromptCatalog(tx, chatbot.id, [
        {
          key: 'tutor',
          prompt: 'Tutor version one',
          description: 'Tutor description',
        },
        {
          key: 'explainer',
          prompt: 'Explainer version one',
          description: 'Explainer description',
        },
      ])
      return chatbot
    })
  }

  test('serializes accepted changes and preserves unrelated JSON metadata', async () => {
    const chatbot = await createCatalogBot()

    const identical = await prisma.$transaction((tx) =>
      appendChatbotModePromptVersion(
        tx,
        chatbot.id,
        'tutor',
        'Tutor version one'
      )
    )
    expect(identical.version).toBe(2)

    const concurrent = await Promise.all([
      prisma.$transaction((tx) =>
        appendChatbotModePromptVersion(
          tx,
          chatbot.id,
          'tutor',
          'Concurrent prompt A'
        )
      ),
      prisma.$transaction((tx) =>
        appendChatbotModePromptVersion(
          tx,
          chatbot.id,
          'tutor',
          'Concurrent prompt B'
        )
      ),
    ])
    expect(concurrent.map((item) => item.version).sort()).toEqual([3, 4])

    const mode = await prisma.chatbotMode.findUniqueOrThrow({
      where: {
        chatbotId_key: { chatbotId: chatbot.id, key: 'tutor' },
      },
      select: {
        activePromptVersion: {
          select: { id: true, authoredPrompt: true },
        },
        versions: { orderBy: { version: 'asc' }, select: { version: true } },
      },
    })
    expect(mode.versions.map((item) => item.version)).toEqual([1, 2, 3, 4])

    const stored = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
      select: { systemPrompts: true },
    })
    const prompts = stored.systemPrompts as Record<
      string,
      Record<string, unknown>
    >
    expect(prompts.tutor!.prompt).toBe(mode.activePromptVersion!.authoredPrompt)
    expect(prompts.tutor!.description).toBe('Tutor description')
    expect(prompts.tutor!.badge).toBe('preserve-me')
    expect(prompts.explainer).toEqual({
      prompt: 'Explainer version one',
      description: 'Explainer description',
      presentation: { tone: 'calm' },
    })
  })

  test('keeps presentation and lifecycle updates outside prompt history', async () => {
    const chatbot = await createCatalogBot()
    const before = await prisma.chatbotModePromptVersion.count({
      where: { mode: { chatbotId: chatbot.id, key: 'tutor' } },
    })

    await prisma.$transaction(async (tx) => {
      await updateChatbotModePresentation(tx, chatbot.id, 'tutor', {
        name: 'Tutor display name',
        description: 'Updated tutor description',
      })
      await updateChatbotModeStatus(
        tx,
        chatbot.id,
        'tutor',
        ChatbotModePromptStatus.DISABLED
      )
    })

    const mode = await prisma.chatbotMode.findUniqueOrThrow({
      where: {
        chatbotId_key: { chatbotId: chatbot.id, key: 'tutor' },
      },
      select: { name: true, description: true, status: true },
    })
    expect(mode).toEqual({
      name: 'Tutor display name',
      description: 'Updated tutor description',
      status: ChatbotModePromptStatus.DISABLED,
    })
    expect(
      await prisma.chatbotModePromptVersion.count({
        where: { mode: { chatbotId: chatbot.id, key: 'tutor' } },
      })
    ).toBe(before)

    const stored = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
      select: { systemPrompts: true },
    })
    const tutor = (
      stored.systemPrompts as Record<string, Record<string, unknown>>
    ).tutor!
    expect(tutor).toMatchObject({
      prompt: 'Tutor version one',
      description: 'Updated tutor description',
      badge: 'preserve-me',
    })

    await prisma.$transaction((tx) =>
      updateChatbotModeStatus(
        tx,
        chatbot.id,
        'tutor',
        ChatbotModePromptStatus.RETIRED
      )
    )
    await expect(
      prisma.$transaction((tx) =>
        appendChatbotModePromptVersion(
          tx,
          chatbot.id,
          'tutor',
          'Rejected after retirement'
        )
      )
    ).rejects.toThrow('PROMPT_CATALOG_MODE_RETIRED')
    await expect(
      prisma.$transaction((tx) =>
        updateChatbotModeStatus(
          tx,
          chatbot.id,
          'tutor',
          ChatbotModePromptStatus.ENABLED
        )
      )
    ).rejects.toThrow('PROMPT_CATALOG_MODE_RETIRED')
  })

  test('rolls back catalog and projection changes together', async () => {
    const chatbot = await createCatalogBot()

    await expect(
      prisma.$transaction(async (tx) => {
        await appendChatbotModePromptVersion(
          tx,
          chatbot.id,
          'tutor',
          'Rolled back prompt'
        )
        throw new Error('synthetic_rollback')
      })
    ).rejects.toThrow('synthetic_rollback')

    const mode = await prisma.chatbotMode.findUniqueOrThrow({
      where: {
        chatbotId_key: { chatbotId: chatbot.id, key: 'tutor' },
      },
      select: {
        activePromptVersion: { select: { authoredPrompt: true } },
        versions: { select: { id: true } },
      },
    })
    expect(mode.activePromptVersion!.authoredPrompt).toBe('Tutor version one')
    expect(mode.versions).toHaveLength(1)

    const stored = await prisma.chatbot.findUniqueOrThrow({
      where: { id: chatbot.id },
      select: { systemPrompts: true },
    })
    const tutor = (
      stored.systemPrompts as Record<string, Record<string, unknown>>
    ).tutor!
    expect(tutor.prompt).toBe('Tutor version one')
  })

  test('rejects initializer projection or description disagreement', async () => {
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Synthetic mismatched catalog bot',
        ownerId,
        courseId,
        systemPrompts: {
          tutor: {
            prompt: 'Legacy prompt',
            description: 'Legacy description',
          },
        },
      },
      select: { id: true },
    })

    await expect(
      prisma.$transaction((tx) =>
        ensureChatbotPromptCatalog(tx, chatbot.id, [
          {
            key: 'tutor',
            prompt: 'Legacy prompt',
            description: 'Different description',
          },
        ])
      )
    ).rejects.toThrow('PROMPT_CATALOG_DISAGREEMENT')
    expect(
      await prisma.chatbotMode.count({ where: { chatbotId: chatbot.id } })
    ).toBe(0)
  })
})
