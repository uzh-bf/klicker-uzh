import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import type { PrepareAuthoritativeConversationInput } from '../src/lib/server/authoritativeHistory'

const describePostgres =
  process.env.CHAT_CONVERSATION_HISTORY_INTEGRATION === '1'
    ? describe
    : describe.skip
const OWNER_ID = randomUUID()
const COURSE_ID = randomUUID()
const CHATBOT_ID = randomUUID()
const PARTICIPANT_ID = randomUUID()
const THREAD_ONE_ID = randomUUID()
const THREAD_TWO_ID = randomUUID()
const TEST_KEY = `authoritative-history-${OWNER_ID.slice(0, 8)}`

let prisma: PrismaClient
let history: typeof import('../src/lib/server/authoritativeHistory')

function triggerInput(
  id: string,
  parentId: string | null,
  text: string
): PrepareAuthoritativeConversationInput {
  return {
    participantId: PARTICIPANT_ID,
    ownerId: OWNER_ID,
    chatbotId: CHATBOT_ID,
    threadId: THREAD_ONE_ID,
    trigger: { id, parentId, text, hasAttachments: false },
    metadata: {
      chatMode: 'tutor',
      modelId: 'synthetic-model',
      reasoningEffort: null,
    },
  }
}

async function cleanup() {
  await prisma.participant.deleteMany({ where: { id: PARTICIPANT_ID } })
  await prisma.user.deleteMany({ where: { id: OWNER_ID } })
}

describePostgres('authoritative history PostgreSQL integration', () => {
  beforeAll(async () => {
    ;({ prisma } = await import('@klicker-uzh/prisma'))
    history = await import('../src/lib/server/authoritativeHistory')
    await prisma.$connect()
    await cleanup()

    await prisma.user.create({
      data: {
        id: OWNER_ID,
        email: `${TEST_KEY}@example.invalid`,
        shortname: TEST_KEY,
      },
    })
    await prisma.course.create({
      data: {
        id: COURSE_ID,
        name: TEST_KEY,
        displayName: 'Synthetic authoritative history course',
        authType: 'SSO',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2027-08-01T00:00:00.000Z'),
        groupDeadlineDate: new Date('2027-02-01T00:00:00.000Z'),
        ownerId: OWNER_ID,
      },
    })
    await prisma.chatbot.create({
      data: {
        id: CHATBOT_ID,
        name: 'Synthetic authoritative history chatbot',
        ownerId: OWNER_ID,
        courseId: COURSE_ID,
      },
    })
    await prisma.participant.create({
      data: {
        id: PARTICIPANT_ID,
        username: TEST_KEY,
        password: 'synthetic-not-a-login-secret',
      },
    })
    await prisma.chatThread.createMany({
      data: [
        {
          id: THREAD_ONE_ID,
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
        {
          id: THREAD_TWO_ID,
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      ],
    })
  }, 60_000)

  beforeEach(async () => {
    await prisma.chatMessage.deleteMany({
      where: { threadId: { in: [THREAD_ONE_ID, THREAD_TWO_ID] } },
    })
  })

  afterAll(async () => {
    if (!prisma) return
    await cleanup()
    await prisma.$disconnect()
  }, 60_000)

  test('creates once, accepts an exact retry, and rejects mutation', async () => {
    const triggerId = randomUUID()
    const input = triggerInput(triggerId, null, '  Synthetic question\r\n')

    await expect(
      history.prepareAuthoritativeConversation(input)
    ).resolves.toEqual({
      triggerId,
      triggerText: 'Synthetic question',
      modelMessages: [
        { id: triggerId, role: 'user', content: 'Synthetic question' },
      ],
      validatedRowCount: 1,
      modelRowCount: 1,
      truncated: false,
      createdTrigger: true,
    })
    await expect(
      history.prepareAuthoritativeConversation(input)
    ).resolves.toMatchObject({ createdTrigger: false })
    await expect(
      history.prepareAuthoritativeConversation({
        ...input,
        trigger: { ...input.trigger, text: 'Mutated question' },
      })
    ).rejects.toBeInstanceOf(history.AuthoritativeConversationError)

    await expect(
      prisma.chatMessage.findUniqueOrThrow({ where: { id: triggerId } })
    ).resolves.toMatchObject({
      threadId: THREAD_ONE_ID,
      parentId: null,
      role: 'user',
      content: [{ type: 'text', text: 'Synthetic question' }],
    })
  })

  test('follows parent depth instead of timestamps or sibling rows', async () => {
    const rootId = randomUUID()
    const assistantId = randomUUID()
    const siblingId = randomUUID()
    const triggerId = randomUUID()
    await prisma.chatMessage.createMany({
      data: [
        {
          id: rootId,
          threadId: THREAD_ONE_ID,
          parentId: null,
          role: 'user',
          content: [{ type: 'text', text: 'Root' }],
          createdAt: new Date('2026-08-04T00:00:00.000Z'),
        },
        {
          id: assistantId,
          threadId: THREAD_ONE_ID,
          parentId: rootId,
          role: 'assistant',
          content: [{ type: 'text', text: 'Answer' }],
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        {
          id: siblingId,
          threadId: THREAD_ONE_ID,
          parentId: assistantId,
          role: 'user',
          content: [{ type: 'text', text: 'Sibling injection' }],
          createdAt: new Date('2026-08-05T00:00:00.000Z'),
        },
      ],
    })

    const result = await history.prepareAuthoritativeConversation(
      triggerInput(triggerId, assistantId, 'Selected follow-up')
    )

    expect(result.modelMessages).toEqual([
      { id: rootId, role: 'user', content: 'Root' },
      { id: assistantId, role: 'assistant', content: 'Answer' },
      { id: triggerId, role: 'user', content: 'Selected follow-up' },
    ])
    expect(result.modelMessages.some(({ id }) => id === siblingId)).toBe(false)
  })

  test.each([
    'missing-parent',
    'cross-thread',
    'incomplete-parent',
    'same-role-edge',
    'assistant-root',
  ])('rolls back a new trigger for an invalid %s path', async (kind) => {
    const triggerId = randomUUID()
    const parentId = randomUUID()

    if (kind === 'cross-thread') {
      await prisma.chatMessage.create({
        data: {
          id: parentId,
          threadId: THREAD_TWO_ID,
          parentId: null,
          role: 'assistant',
          content: [{ type: 'text', text: 'Foreign parent' }],
        },
      })
    } else if (kind !== 'missing-parent') {
      await prisma.chatMessage.create({
        data: {
          id: parentId,
          threadId: THREAD_ONE_ID,
          parentId: null,
          role: kind === 'same-role-edge' ? 'user' : 'assistant',
          content: [{ type: 'text', text: 'Synthetic parent' }],
          lifecycleStatus:
            kind === 'incomplete-parent' ? 'IN_PROGRESS' : 'COMPLETED',
        },
      })
    }

    await expect(
      history.prepareAuthoritativeConversation(
        triggerInput(triggerId, parentId, 'Rejected trigger')
      )
    ).rejects.toBeInstanceOf(history.AuthoritativeConversationError)
    expect(await prisma.chatMessage.count({ where: { id: triggerId } })).toBe(0)
  })

  test('rejects a persisted cycle', async () => {
    const triggerId = randomUUID()
    const assistantId = randomUUID()
    await prisma.chatMessage.createMany({
      data: [
        {
          id: triggerId,
          threadId: THREAD_ONE_ID,
          parentId: assistantId,
          role: 'user',
          content: [{ type: 'text', text: 'Cycle trigger' }],
        },
        {
          id: assistantId,
          threadId: THREAD_ONE_ID,
          parentId: triggerId,
          role: 'assistant',
          content: [{ type: 'text', text: 'Cycle parent' }],
        },
      ],
    })

    await expect(
      history.prepareAuthoritativeConversation(
        triggerInput(triggerId, assistantId, 'Cycle trigger')
      )
    ).rejects.toBeInstanceOf(history.AuthoritativeConversationError)
  })

  test('accepts a 256-row effective root and projects the closest 64', async () => {
    const ids = Array.from(
      { length: history.MAX_VALIDATED_HISTORY_ROWS + 1 },
      () => randomUUID()
    )
    await prisma.chatMessage.createMany({
      data: ids.map((id, index) => ({
        id,
        threadId: THREAD_ONE_ID,
        parentId: index === 0 ? null : ids[index - 1],
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Message ${index}` }],
        createdAt: new Date(Date.UTC(2026, 7, 28, 0, 0, ids.length - index)),
      })),
    })
    const siblingId = randomUUID()
    await prisma.chatMessage.create({
      data: {
        id: siblingId,
        threadId: THREAD_ONE_ID,
        parentId: ids.at(-2)!,
        role: 'user',
        content: [{ type: 'text', text: 'Newest sibling' }],
        createdAt: new Date('2026-08-29T00:00:00.000Z'),
      },
    })

    const triggerId = ids.at(-1)!
    const result = await history.prepareAuthoritativeConversation(
      triggerInput(triggerId, ids.at(-2)!, `Message ${ids.length - 1}`)
    )

    expect(result).toMatchObject({
      validatedRowCount: history.MAX_VALIDATED_HISTORY_ROWS,
      modelRowCount: history.MAX_MODEL_HISTORY_ROWS,
      truncated: true,
      createdTrigger: false,
    })
    expect(result.modelMessages).toHaveLength(history.MAX_MODEL_HISTORY_ROWS)
    expect(result.modelMessages[0]).toMatchObject({
      id: ids[ids.length - history.MAX_MODEL_HISTORY_ROWS],
      role: 'assistant',
    })
    expect(result.modelMessages.at(-1)).toMatchObject({
      id: triggerId,
      role: 'user',
    })
    expect(result.modelMessages.some(({ id }) => id === siblingId)).toBe(false)
  })
})
