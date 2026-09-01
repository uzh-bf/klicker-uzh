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
const FOREIGN_PARTICIPANT_ID = randomUUID()
const THREAD_ONE_ID = randomUUID()
const THREAD_TWO_ID = randomUUID()
const FOREIGN_THREAD_ID = randomUUID()
const TEST_KEY = `authoritative-history-${OWNER_ID.slice(0, 8)}`
const RAW_IMAGE_ONE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const RAW_IMAGE_TWO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='

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
    trigger: { id, parentId, text, attachments: [] },
    usedLegacyAdapter: false,
    metadata: {
      chatMode: 'tutor',
      modelId: 'synthetic-model',
      reasoningEffort: null,
    },
  }
}

async function cleanup() {
  await prisma.participant.deleteMany({
    where: { id: { in: [PARTICIPANT_ID, FOREIGN_PARTICIPANT_ID] } },
  })
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
    await prisma.participant.createMany({
      data: [
        {
          id: PARTICIPANT_ID,
          username: TEST_KEY,
          password: 'synthetic-not-a-login-secret',
        },
        {
          id: FOREIGN_PARTICIPANT_ID,
          username: `${TEST_KEY}-foreign`,
          password: 'synthetic-not-a-login-secret',
        },
      ],
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
        {
          id: FOREIGN_THREAD_ID,
          participantId: FOREIGN_PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      ],
    })
  }, 60_000)

  beforeEach(async () => {
    await prisma.chatMessage.deleteMany({
      where: {
        threadId: {
          in: [THREAD_ONE_ID, THREAD_TWO_ID, FOREIGN_THREAD_ID],
        },
      },
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
      triggerText: 'Synthetic question',
      modelMessages: [
        { id: triggerId, role: 'user', content: 'Synthetic question' },
      ],
      validatedRowCount: 1,
      modelRowCount: 1,
      truncated: false,
      createdTrigger: true,
      currentAttachments: [],
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

  test('serializes concurrent identical trigger creation into one exact row', async () => {
    const triggerId = randomUUID()
    const input = triggerInput(triggerId, null, 'Concurrent question')

    const results = await Promise.all([
      history.prepareAuthoritativeConversation(input),
      history.prepareAuthoritativeConversation(input),
    ])

    expect(results.map(({ createdTrigger }) => createdTrigger).sort()).toEqual([
      false,
      true,
    ])
    expect(await prisma.chatMessage.count({ where: { id: triggerId } })).toBe(1)
  })

  test('serializes concurrent raw-image binding creation into one ordered set', async () => {
    const triggerId = randomUUID()
    const input = {
      ...triggerInput(triggerId, null, 'Concurrent image question'),
      trigger: {
        ...triggerInput(triggerId, null, '').trigger,
        text: 'Concurrent image question',
        attachments: [
          { type: 'new-image' as const, imageBase64: RAW_IMAGE_ONE },
        ],
      },
    }

    const results = await Promise.all([
      history.prepareAuthoritativeConversation(input),
      history.prepareAuthoritativeConversation(input),
    ])

    expect(results.map(({ createdTrigger }) => createdTrigger).sort()).toEqual([
      false,
      true,
    ])
    expect(results[0].currentAttachments).toEqual(results[1].currentAttachments)
    expect(
      await prisma.chatAttachment.count({ where: { messageId: triggerId } })
    ).toBe(1)
  })

  test('keeps current raw-image bindings ordered and immutable across retries', async () => {
    const triggerId = randomUUID()
    const input = {
      ...triggerInput(triggerId, null, 'Image question'),
      trigger: {
        ...triggerInput(triggerId, null, '').trigger,
        text: 'Image question',
        attachments: [
          { type: 'new-image' as const, imageBase64: RAW_IMAGE_ONE },
          { type: 'new-image' as const, imageBase64: RAW_IMAGE_TWO },
        ],
      },
    }

    const created = await history.prepareAuthoritativeConversation(input)
    expect(created.currentAttachments).toHaveLength(2)
    expect(created.currentAttachments.map(({ position }) => position)).toEqual([
      0, 1,
    ])
    expect(
      created.currentAttachments.every(({ imagePreviewBase64 }) =>
        imagePreviewBase64?.startsWith('data:image/jpeg;base64,')
      )
    ).toBe(true)

    const regenerated = await history.prepareAuthoritativeConversation({
      ...input,
      trigger: {
        ...input.trigger,
        attachments: created.currentAttachments.map(({ id }) => ({
          type: 'persisted-image' as const,
          id,
        })),
      },
    })
    expect(regenerated).toMatchObject({ createdTrigger: false })
    expect(regenerated.currentAttachments).toEqual(created.currentAttachments)

    await expect(
      history.prepareAuthoritativeConversation(input)
    ).resolves.toMatchObject({ createdTrigger: false })
    await expect(
      history.prepareAuthoritativeConversation({
        ...input,
        trigger: { ...input.trigger, attachments: [] },
      })
    ).rejects.toBeInstanceOf(history.AuthoritativeConversationError)
    await expect(
      history.prepareAuthoritativeConversation({
        ...input,
        trigger: {
          ...input.trigger,
          attachments: [
            { type: 'new-image', imageBase64: RAW_IMAGE_TWO },
            { type: 'new-image', imageBase64: RAW_IMAGE_TWO },
          ],
        },
      })
    ).rejects.toBeInstanceOf(history.AuthoritativeConversationError)

    await expect(
      history.prepareAuthoritativeConversation({
        ...input,
        usedLegacyAdapter: true,
        trigger: {
          ...input.trigger,
          attachments: [{ type: 'new-image', imageBase64: RAW_IMAGE_TWO }],
        },
      })
    ).resolves.toMatchObject({
      createdTrigger: false,
      currentAttachments: created.currentAttachments,
    })
  })

  test('copies only selected same-thread bindings and leaves the source immutable', async () => {
    const sourceId = randomUUID()
    const source = await history.prepareAuthoritativeConversation({
      ...triggerInput(sourceId, null, 'Source images'),
      trigger: {
        ...triggerInput(sourceId, null, '').trigger,
        text: 'Source images',
        attachments: [
          { type: 'new-image', imageBase64: RAW_IMAGE_ONE },
          { type: 'new-image', imageBase64: RAW_IMAGE_TWO },
        ],
      },
    })
    await prisma.chatAttachment.update({
      where: { id: source.currentAttachments[0].id },
      data: { imageDescription: 'Synthetic source description' },
    })
    const sourceBefore = await prisma.chatAttachment.findMany({
      where: { messageId: sourceId },
      orderBy: { position: 'asc' },
    })

    const editedId = randomUUID()
    const edited = await history.prepareAuthoritativeConversation({
      ...triggerInput(editedId, null, 'Edited selection'),
      trigger: {
        ...triggerInput(editedId, null, '').trigger,
        text: 'Edited selection',
        attachments: [
          {
            type: 'persisted-image',
            id: source.currentAttachments[0].id,
          },
          { type: 'new-image', imageBase64: RAW_IMAGE_TWO },
        ],
      },
    })

    expect(edited.currentAttachments).toHaveLength(2)
    expect(edited.currentAttachments[0]).toMatchObject({
      position: 0,
      imageBase64: RAW_IMAGE_ONE,
      imageDescription: 'Synthetic source description',
    })
    expect(edited.currentAttachments[0].id).not.toBe(
      source.currentAttachments[0].id
    )
    expect(edited.currentAttachments[1]).toMatchObject({
      position: 1,
      imageBase64: RAW_IMAGE_TWO,
      imageDescription: null,
    })
    expect(
      await prisma.chatAttachment.findMany({
        where: { messageId: sourceId },
        orderBy: { position: 'asc' },
      })
    ).toEqual(sourceBefore)

    await expect(
      history.prepareAuthoritativeConversation({
        ...triggerInput(editedId, null, 'Edited selection'),
        trigger: {
          ...triggerInput(editedId, null, '').trigger,
          text: 'Edited selection',
          attachments: edited.currentAttachments.map(({ id }) => ({
            type: 'persisted-image' as const,
            id,
          })),
        },
      })
    ).resolves.toMatchObject({
      createdTrigger: false,
      currentAttachments: edited.currentAttachments,
    })
    expect(
      await prisma.chatAttachment.count({ where: { messageId: editedId } })
    ).toBe(2)
  })

  test('rejects missing, duplicate, assistant, cross-thread, foreign, and removed references', async () => {
    const validSourceId = randomUUID()
    const validSource = await history.prepareAuthoritativeConversation({
      ...triggerInput(validSourceId, null, 'Valid source'),
      trigger: {
        ...triggerInput(validSourceId, null, '').trigger,
        text: 'Valid source',
        attachments: [{ type: 'new-image', imageBase64: RAW_IMAGE_ONE }],
      },
    })

    const createSourceAttachment = async (
      threadId: string,
      role: 'user' | 'assistant'
    ) => {
      const message = await prisma.chatMessage.create({
        data: {
          id: randomUUID(),
          threadId,
          parentId: null,
          role,
          content: [{ type: 'text', text: 'Invalid source scope' }],
          attachments: {
            create: {
              type: 'IMAGE',
              position: 0,
              imageBase64: RAW_IMAGE_ONE,
              imagePreviewBase64: null,
            },
          },
        },
        include: { attachments: true },
      })
      return message.attachments[0].id
    }

    const assistantAttachmentId = await createSourceAttachment(
      THREAD_ONE_ID,
      'assistant'
    )
    const crossThreadAttachmentId = await createSourceAttachment(
      THREAD_TWO_ID,
      'user'
    )
    const foreignAttachmentId = await createSourceAttachment(
      FOREIGN_THREAD_ID,
      'user'
    )
    const removedAttachmentId = await createSourceAttachment(
      THREAD_ONE_ID,
      'user'
    )
    await prisma.chatAttachment.delete({ where: { id: removedAttachmentId } })

    const invalidInputs = [
      [{ type: 'persisted-image' as const, id: randomUUID() }],
      [
        {
          type: 'persisted-image' as const,
          id: validSource.currentAttachments[0].id,
        },
        {
          type: 'persisted-image' as const,
          id: validSource.currentAttachments[0].id,
        },
      ],
      [{ type: 'persisted-image' as const, id: assistantAttachmentId }],
      [{ type: 'persisted-image' as const, id: crossThreadAttachmentId }],
      [{ type: 'persisted-image' as const, id: foreignAttachmentId }],
      [{ type: 'persisted-image' as const, id: removedAttachmentId }],
    ]

    for (const attachments of invalidInputs) {
      const triggerId = randomUUID()
      await expect(
        history.prepareAuthoritativeConversation({
          ...triggerInput(triggerId, null, 'Rejected reference'),
          trigger: {
            ...triggerInput(triggerId, null, '').trigger,
            text: 'Rejected reference',
            attachments,
          },
        })
      ).rejects.toBeInstanceOf(history.AuthoritativeConversationError)
      expect(await prisma.chatMessage.count({ where: { id: triggerId } })).toBe(
        0
      )
    }
  })

  test.each([
    'parent',
    'role',
    'thread',
  ])('rejects an existing trigger with a conflicting %s', async (conflict) => {
    const triggerId = randomUUID()
    const input = triggerInput(triggerId, null, 'Immutable question')

    if (conflict === 'parent') {
      await history.prepareAuthoritativeConversation(input)
    } else {
      await prisma.chatMessage.create({
        data: {
          id: triggerId,
          threadId: conflict === 'thread' ? THREAD_TWO_ID : THREAD_ONE_ID,
          parentId: null,
          role: conflict === 'role' ? 'assistant' : 'user',
          content: [{ type: 'text', text: 'Immutable question' }],
        },
      })
    }

    await expect(
      history.prepareAuthoritativeConversation({
        ...input,
        trigger: {
          ...input.trigger,
          parentId: conflict === 'parent' ? randomUUID() : null,
        },
      })
    ).rejects.toBeInstanceOf(history.AuthoritativeConversationError)
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

  test('rejects a cycle that closes at the 256-row boundary', async () => {
    const ids = Array.from({ length: history.MAX_VALIDATED_HISTORY_ROWS }, () =>
      randomUUID()
    )
    await prisma.chatMessage.createMany({
      data: ids.map((id, index) => ({
        id,
        threadId: THREAD_ONE_ID,
        parentId: index === 0 ? ids[1] : ids[index - 1],
        role: index % 2 === 0 ? 'assistant' : 'user',
        content: [{ type: 'text', text: `Boundary cycle ${index}` }],
      })),
    })

    const triggerId = ids.at(-1)!
    await expect(
      history.prepareAuthoritativeConversation(
        triggerInput(triggerId, ids.at(-2)!, `Boundary cycle ${ids.length - 1}`)
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
