import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import type {
  FinalizeChatTurnInput,
  FinalizeChatTurnResult,
} from '../src/services/accountUsage'

const describePostgres =
  process.env.CHAT_ACCOUNT_USAGE_INTEGRATION === '1' ? describe : describe.skip
const NOW = new Date('2026-08-15T12:00:00.000Z')
const MONTH_START = new Date('2026-08-01T00:00:00.000Z')
const PREVIOUS_MONTH_START = new Date('2026-07-01T00:00:00.000Z')
const OWNER_ID = randomUUID()
const COURSE_ID = randomUUID()
const CHATBOT_ID = randomUUID()
const PARTICIPANT_ID = randomUUID()
const EXAM_PARTICIPANT_ID = randomUUID()
const THREAD_ONE_ID = randomUUID()
const THREAD_TWO_ID = randomUUID()
const TEST_KEY = `u2-account-${OWNER_ID.slice(0, 8)}`
const initialEnforcement = process.env.CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED
const initialLifecycleWrites = process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED
const initialAssessmentMode = process.env.CHAT_ASSESSMENT_MODE

let prisma: PrismaClient
let accountUsage: typeof import('../src/services/accountUsage')
let threadService: typeof import('../src/services/threads')

type UnclaimedTurnInput = Omit<FinalizeChatTurnInput, 'lifecycleAttemptId'>

function turnInput(
  assistantMessageId: string,
  overrides: Partial<UnclaimedTurnInput> = {}
): UnclaimedTurnInput {
  return {
    ownerId: OWNER_ID,
    chatbotId: CHATBOT_ID,
    participantId: PARTICIPANT_ID,
    usageClass: 'BASE',
    threadId: THREAD_ONE_ID,
    assistantMessageId,
    parentId: null,
    content: [{ type: 'text', text: 'synthetic U2 answer' }],
    chatMode: 'tutor',
    modelId: 'synthetic-base-model',
    reasoningEffort: null,
    reasoningContent: null,
    rawCreditsUsed: 0.25,
    now: NOW,
    ...overrides,
  }
}

async function claimedTurnInput(
  assistantMessageId: string,
  overrides: Partial<UnclaimedTurnInput> = {}
): Promise<FinalizeChatTurnInput> {
  const input = turnInput(assistantMessageId, overrides)
  const claim = await accountUsage.claimChatTurn({
    ownerId: input.ownerId,
    chatbotId: input.chatbotId,
    threadId: input.threadId,
    assistantMessageId: input.assistantMessageId,
    parentId: input.parentId,
  })
  if (claim.outcome !== 'claimed') {
    throw new Error(`Expected a new turn claim, received ${claim.outcome}`)
  }
  return { ...input, lifecycleAttemptId: claim.lifecycleAttemptId }
}

async function resetUsage(usedCredits = 0, budgetCredits = 10) {
  await prisma.chatMessage.deleteMany({
    where: { threadId: { in: [THREAD_ONE_ID, THREAD_TWO_ID] } },
  })
  await prisma.chatUsageCredits.deleteMany({
    where: { participantId: PARTICIPANT_ID, chatbotId: CHATBOT_ID },
  })
  await prisma.user.update({
    where: { id: OWNER_ID },
    data: { aiFeaturesEnabled: true },
  })
  await prisma.chatAccountUsage.upsert({
    where: {
      ownerId_usageClass_monthStart: {
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        monthStart: MONTH_START,
      },
    },
    create: {
      ownerId: OWNER_ID,
      usageClass: 'BASE',
      monthStart: MONTH_START,
      budgetCredits,
      usedCredits,
    },
    update: { budgetCredits, usedCredits },
  })
}

async function resetToPreviousUsage(usedCredits = 0, budgetCredits = 10) {
  await prisma.chatAccountUsage.deleteMany({
    where: { ownerId: OWNER_ID, usageClass: 'BASE' },
  })
  await prisma.chatAccountUsage.create({
    data: {
      ownerId: OWNER_ID,
      usageClass: 'BASE',
      monthStart: PREVIOUS_MONTH_START,
      budgetCredits,
      usedCredits,
    },
  })
}

async function cleanup() {
  const { requireDisposableDatabase } = await import('@klicker-uzh/prisma')
  await requireDisposableDatabase(prisma)
  await prisma.participant.deleteMany({
    where: { id: { in: [PARTICIPANT_ID, EXAM_PARTICIPANT_ID] } },
  })
  await prisma.user.deleteMany({ where: { id: OWNER_ID } })
}

describePostgres('account usage PostgreSQL integration', () => {
  beforeAll(async () => {
    ;({ prisma } = await import('@klicker-uzh/prisma'))
    accountUsage = await import('../src/services/accountUsage')
    threadService = await import('../src/services/threads')
    await cleanup()

    await prisma.user.create({
      data: {
        id: OWNER_ID,
        email: `${TEST_KEY}@example.invalid`,
        shortname: TEST_KEY,
        aiFeaturesEnabled: true,
      },
    })
    await prisma.course.create({
      data: {
        id: COURSE_ID,
        name: TEST_KEY,
        displayName: 'Synthetic U2 account usage course',
        authType: 'SSO',
        startDate: NOW,
        endDate: new Date('2027-08-15T12:00:00.000Z'),
        groupDeadlineDate: new Date('2027-02-15T12:00:00.000Z'),
        ownerId: OWNER_ID,
      },
    })
    await prisma.chatbot.create({
      data: {
        id: CHATBOT_ID,
        name: 'Synthetic U2 account usage chatbot',
        ownerId: OWNER_ID,
        courseId: COURSE_ID,
      },
    })
    await prisma.participant.create({
      data: {
        id: PARTICIPANT_ID,
        username: TEST_KEY,
        password: randomUUID(),
      },
    })
    const { id: _id, ...examParticipant } =
      await prisma.participant.findUniqueOrThrow({
        where: { id: PARTICIPANT_ID },
      })
    await prisma.participant.create({
      data: {
        ...examParticipant,
        id: EXAM_PARTICIPANT_ID,
        username: `${TEST_KEY}-exam`,
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
    process.env.CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED = 'false'
    process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = 'true'
    await resetUsage()
  })

  afterAll(async () => {
    if (!prisma) return
    await cleanup()
    await prisma.$disconnect()
    if (initialEnforcement === undefined) {
      delete process.env.CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED
    } else {
      process.env.CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED = initialEnforcement
    }
    if (initialLifecycleWrites === undefined) {
      delete process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED
    } else {
      process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = initialLifecycleWrites
    }
    if (initialAssessmentMode === undefined) {
      delete process.env.CHAT_ASSESSMENT_MODE
    } else {
      process.env.CHAT_ASSESSMENT_MODE = initialAssessmentMode
    }
  }, 60_000)

  test('fails closed for disabled, missing, zero, and exhausted usage', async () => {
    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(true)

    await prisma.user.update({
      where: { id: OWNER_ID },
      data: { aiFeaturesEnabled: false },
    })
    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(false)

    await prisma.user.update({
      where: { id: OWNER_ID },
      data: { aiFeaturesEnabled: true },
    })
    await prisma.chatAccountUsage.deleteMany({
      where: { ownerId: OWNER_ID, usageClass: 'BASE' },
    })
    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(false)

    await resetUsage(0, 0)
    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(false)

    await resetUsage(1, 1)
    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(false)
  })

  test('carries a prior budget with zero effective usage at precheck', async () => {
    await resetToPreviousUsage(10, 10)

    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(true)
    expect(
      await prisma.chatAccountUsage.findUnique({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: MONTH_START,
          },
        },
      })
    ).toBeNull()
  })

  test('persists missing reliable usage without charging the account', async () => {
    const messageId = randomUUID()
    const result = await accountUsage.finalizeChatTurn(
      await claimedTurnInput(messageId, { rawCreditsUsed: null })
    )

    expect(result).toEqual({ outcome: 'completed', creditsUsed: null })

    const [message, usage] = await Promise.all([
      prisma.chatMessage.findUniqueOrThrow({ where: { id: messageId } }),
      prisma.chatAccountUsage.findUniqueOrThrow({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: MONTH_START,
          },
        },
      }),
    ])
    expect(message.creditsUsed).toBeNull()
    expect(usage.usedCredits.toString()).toBe('0')
  })

  test('persists reliable usage without an account row when enforcement is disabled', async () => {
    const messageId = randomUUID()
    await prisma.chatAccountUsage.deleteMany({
      where: { ownerId: OWNER_ID, usageClass: 'BASE' },
    })

    const result = await accountUsage.finalizeChatTurn(
      await claimedTurnInput(messageId, { rawCreditsUsed: 0.25 })
    )

    expect(result).toEqual({ outcome: 'completed', creditsUsed: 0.25 })
    const message = await prisma.chatMessage.findUniqueOrThrow({
      where: { id: messageId },
    })
    expect(message.lifecycleStatus).toBe('COMPLETED')
    expect(message.creditsUsed?.toString()).toBe('0.25')
    expect(
      await prisma.chatAccountUsage.count({
        where: { ownerId: OWNER_ID, usageClass: 'BASE' },
      })
    ).toBe(0)
  })

  test('debits participant credits in the finalization transaction once', async () => {
    const messageId = randomUUID()
    const input = await claimedTurnInput(messageId)

    await expect(accountUsage.finalizeChatTurn(input)).resolves.toEqual({
      outcome: 'completed',
      creditsUsed: 0.25,
    })

    const firstBalance = await prisma.chatUsageCredits.findUniqueOrThrow({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    expect(firstBalance.current.toString()).toBe('0.75')

    await expect(
      accountUsage.finalizeChatTurn({ ...input, rawCreditsUsed: 9 })
    ).resolves.toEqual({ outcome: 'duplicate', creditsUsed: 0.25 })

    const duplicateBalance = await prisma.chatUsageCredits.findUniqueOrThrow({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    expect(duplicateBalance.current.toString()).toBe('0.75')
  })

  test('claims one message key and charges a retry only once', async () => {
    const messageId = randomUUID()
    const claimedInput = await claimedTurnInput(messageId, {
      rawCreditsUsed: 0.3333336,
    })
    const first = await accountUsage.finalizeChatTurn(claimedInput)
    const duplicate = await accountUsage.finalizeChatTurn({
      ...claimedInput,
      rawCreditsUsed: 9,
    })

    expect(first).toEqual({ outcome: 'completed', creditsUsed: 0.333334 })
    expect(duplicate).toEqual({
      outcome: 'duplicate',
      creditsUsed: 0.333334,
    })

    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('0.333334')
  })

  test('keeps writer-off turns invisible until complete finalization', async () => {
    process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = 'false'
    const messageId = randomUUID()
    const input = turnInput(messageId)

    const claim = await accountUsage.claimChatTurn({
      ownerId: input.ownerId,
      chatbotId: input.chatbotId,
      threadId: input.threadId,
      assistantMessageId: input.assistantMessageId,
      parentId: input.parentId,
    })
    expect(claim).toEqual({ outcome: 'claimed', lifecycleAttemptId: null })
    expect(
      await prisma.chatMessage.findUnique({ where: { id: messageId } })
    ).toMatchObject({
      lifecycleStatus: 'IN_PROGRESS',
      lifecycleAttemptId: null,
    })
    expect(
      await prisma.chatMessage.count({
        where: {
          id: messageId,
          lifecycleStatus: 'COMPLETED',
        },
      })
    ).toBe(0)

    await expect(
      accountUsage.finalizeChatTurn({ ...input, lifecycleAttemptId: null })
    ).resolves.toEqual({ outcome: 'completed', creditsUsed: 0.25 })

    const [message, usage] = await Promise.all([
      prisma.chatMessage.findUniqueOrThrow({ where: { id: messageId } }),
      prisma.chatAccountUsage.findUniqueOrThrow({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: MONTH_START,
          },
        },
      }),
    ])
    expect(message.lifecycleStatus).toBe('COMPLETED')
    expect(message.content).toEqual(input.content)
    expect(usage.usedCredits.toString()).toBe('0.25')
  })

  test('charges one concurrent writer-off finalization', async () => {
    process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = 'false'
    const messageId = randomUUID()
    const claim = await accountUsage.claimChatTurn({
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      threadId: THREAD_ONE_ID,
      assistantMessageId: messageId,
      parentId: null,
    })
    expect(claim).toEqual({ outcome: 'claimed', lifecycleAttemptId: null })
    const input = {
      ...turnInput(messageId),
      lifecycleAttemptId: claim.lifecycleAttemptId,
    }

    const results = await Promise.all([
      accountUsage.finalizeChatTurn(input),
      accountUsage.finalizeChatTurn(input),
    ])

    expect(results.map((result) => result.outcome).sort()).toEqual([
      'completed',
      'duplicate',
    ])
    const [messageCount, usage] = await Promise.all([
      prisma.chatMessage.count({ where: { id: messageId } }),
      prisma.chatAccountUsage.findUniqueOrThrow({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: MONTH_START,
          },
        },
      }),
    ])
    expect(messageCount).toBe(1)
    expect(usage.usedCredits.toString()).toBe('0.25')
  })

  test('does not persist or charge an empty writer-off completion', async () => {
    process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = 'false'
    const messageId = randomUUID()

    await expect(
      accountUsage.finalizeChatTurn({
        ...turnInput(messageId, { content: [] }),
        lifecycleAttemptId: null,
      })
    ).resolves.toEqual({ outcome: 'empty', creditsUsed: null })

    const [messageCount, usage] = await Promise.all([
      prisma.chatMessage.count({ where: { id: messageId } }),
      prisma.chatAccountUsage.findUniqueOrThrow({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: MONTH_START,
          },
        },
      }),
    ])
    expect(messageCount).toBe(0)
    expect(usage.usedCredits.toString()).toBe('0')
  })

  test('leaves no row when a writer-off provider attempt fails', async () => {
    process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = 'false'
    const messageId = randomUUID()
    const claim = await accountUsage.claimChatTurn({
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      threadId: THREAD_ONE_ID,
      assistantMessageId: messageId,
      parentId: null,
    })
    expect(claim).toEqual({ outcome: 'claimed', lifecycleAttemptId: null })
    expect(
      await prisma.chatMessage.findUnique({ where: { id: messageId } })
    ).toMatchObject({ lifecycleStatus: 'IN_PROGRESS' })

    await accountUsage.failChatTurn({
      assistantMessageId: messageId,
      threadId: THREAD_ONE_ID,
      lifecycleAttemptId: claim.lifecycleAttemptId,
    })

    expect(
      await prisma.chatMessage.findUnique({ where: { id: messageId } })
    ).toBeNull()
    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('0')
  })

  test('claims one writer-off turn per parent and allows explicit regeneration', async () => {
    process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = 'false'
    const parentId = randomUUID()
    const firstMessageId = randomUUID()
    const secondMessageId = randomUUID()

    const claims = await Promise.all([
      accountUsage.claimChatTurn({
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        threadId: THREAD_ONE_ID,
        assistantMessageId: firstMessageId,
        parentId,
      }),
      accountUsage.claimChatTurn({
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        threadId: THREAD_ONE_ID,
        assistantMessageId: secondMessageId,
        parentId,
      }),
    ])

    expect(claims.map((claim) => claim.outcome).sort()).toEqual([
      'claimed',
      'in_progress',
    ])
    const winnerIndex = claims.findIndex((claim) => claim.outcome === 'claimed')
    const winnerMessageId = [firstMessageId, secondMessageId][winnerIndex]
    if (!winnerMessageId) throw new Error('Expected a winning turn claim')

    await expect(
      accountUsage.finalizeChatTurn({
        ...turnInput(winnerMessageId, { parentId }),
        lifecycleAttemptId: null,
      })
    ).resolves.toEqual({ outcome: 'completed', creditsUsed: 0.25 })

    const regenerationMessageId = randomUUID()
    await expect(
      accountUsage.claimChatTurn({
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        threadId: THREAD_ONE_ID,
        assistantMessageId: regenerationMessageId,
        parentId,
        allowRegeneration: true,
      })
    ).resolves.toEqual({ outcome: 'claimed', lifecycleAttemptId: null })

    await accountUsage.finalizeChatTurn({
      ...turnInput(regenerationMessageId, { parentId }),
      lifecycleAttemptId: null,
    })

    expect(
      await prisma.chatMessage.count({
        where: {
          threadId: THREAD_ONE_ID,
          parentId,
          role: 'assistant',
          lifecycleStatus: 'COMPLETED',
        },
      })
    ).toBe(2)
    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('0.5')
  })

  test('blocks a distinct normal claim after the parent is completed', async () => {
    const parentId = randomUUID()
    const firstMessageId = randomUUID()
    const firstInput = await claimedTurnInput(firstMessageId, { parentId })

    await expect(accountUsage.finalizeChatTurn(firstInput)).resolves.toEqual({
      outcome: 'completed',
      creditsUsed: 0.25,
    })

    const secondMessageId = randomUUID()
    const secondClaim = await accountUsage.claimChatTurn({
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      threadId: THREAD_ONE_ID,
      assistantMessageId: secondMessageId,
      parentId,
    })

    expect(secondClaim).toEqual({
      outcome: 'completed',
      lifecycleAttemptId: null,
    })
    expect(
      await prisma.chatMessage.count({
        where: {
          threadId: THREAD_ONE_ID,
          parentId,
          role: 'assistant',
          lifecycleStatus: 'COMPLETED',
        },
      })
    ).toBe(1)
    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('0.25')
  })

  test('allows only one concurrent provider-work claim for one key', async () => {
    const messageId = randomUUID()
    const claimInput = {
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      threadId: THREAD_ONE_ID,
      assistantMessageId: messageId,
      parentId: null,
    }

    const claims = await Promise.all([
      accountUsage.claimChatTurn(claimInput),
      accountUsage.claimChatTurn(claimInput),
    ])
    expect(claims.filter((claim) => claim.outcome === 'claimed')).toHaveLength(
      1
    )
    expect(
      claims.filter((claim) => claim.outcome === 'in_progress')
    ).toHaveLength(1)

    const winner = claims.find((claim) => claim.outcome === 'claimed')
    if (winner?.outcome !== 'claimed') {
      throw new Error('Expected one winning lifecycle claim')
    }
    await accountUsage.finalizeChatTurn({
      ...turnInput(messageId),
      lifecycleAttemptId: winner.lifecycleAttemptId,
    })

    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('0.25')
  })

  test('atomically discards a transient claim during a concurrent retry', async () => {
    const threadId = randomUUID()
    const messageId = randomUUID()
    await prisma.chatThread.create({
      data: {
        id: threadId,
        participantId: PARTICIPANT_ID,
        chatbotId: CHATBOT_ID,
      },
    })
    const initialClaim = await accountUsage.claimChatTurn({
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      threadId,
      assistantMessageId: messageId,
      parentId: null,
    })
    expect(initialClaim.outcome).toBe('claimed')

    const [deletion, retry] = await Promise.allSettled([
      threadService.ThreadService.deleteThread(
        threadId,
        PARTICIPANT_ID,
        CHATBOT_ID
      ),
      accountUsage.claimChatTurn({
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        threadId,
        assistantMessageId: messageId,
        parentId: null,
      }),
    ])

    expect(deletion).toEqual({ status: 'fulfilled', value: true })
    if (retry.status === 'fulfilled') {
      expect(retry.value.outcome).not.toBe('claimed')
    }
    expect(await prisma.chatThread.count({ where: { id: threadId } })).toBe(0)
    expect(await prisma.chatMessage.count({ where: { id: messageId } })).toBe(0)
  })

  test('rejects a late callback after a failed turn is reclaimed', async () => {
    const messageId = randomUUID()
    const firstInput = await claimedTurnInput(messageId)
    await accountUsage.failChatTurn({
      assistantMessageId: messageId,
      threadId: THREAD_ONE_ID,
      lifecycleAttemptId: firstInput.lifecycleAttemptId,
    })

    const retryInput = await claimedTurnInput(messageId)
    expect(retryInput.lifecycleAttemptId).not.toBe(
      firstInput.lifecycleAttemptId
    )
    await expect(
      accountUsage.finalizeChatTurn(firstInput)
    ).rejects.toBeInstanceOf(accountUsage.ChatTurnConflictError)
    await expect(accountUsage.finalizeChatTurn(retryInput)).resolves.toEqual({
      outcome: 'completed',
      creditsUsed: 0.25,
    })

    const [message, usage] = await Promise.all([
      prisma.chatMessage.findUniqueOrThrow({ where: { id: messageId } }),
      prisma.chatAccountUsage.findUniqueOrThrow({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: MONTH_START,
          },
        },
      }),
    ])
    expect(message.lifecycleStatus).toBe('COMPLETED')
    expect(usage.usedCredits.toString()).toBe('0.25')
  })

  test('invalidates a late callback when a failed sibling is retried', async () => {
    const parentId = randomUUID()
    const firstMessageId = randomUUID()
    const firstInput = await claimedTurnInput(firstMessageId, { parentId })
    await accountUsage.failChatTurn({
      assistantMessageId: firstMessageId,
      threadId: THREAD_ONE_ID,
      lifecycleAttemptId: firstInput.lifecycleAttemptId,
    })

    const secondMessageId = randomUUID()
    const secondClaim = await accountUsage.claimChatTurn({
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      threadId: THREAD_ONE_ID,
      assistantMessageId: secondMessageId,
      parentId,
    })
    if (secondClaim.outcome !== 'claimed') {
      throw new Error(
        `Expected a new turn claim, received ${secondClaim.outcome}`
      )
    }

    await expect(
      accountUsage.finalizeChatTurn(firstInput)
    ).rejects.toBeInstanceOf(accountUsage.ChatTurnConflictError)
    await expect(
      accountUsage.finalizeChatTurn({
        ...turnInput(secondMessageId, { parentId }),
        lifecycleAttemptId: secondClaim.lifecycleAttemptId,
      })
    ).resolves.toEqual({ outcome: 'completed', creditsUsed: 0.25 })

    expect(
      await prisma.chatMessage.count({
        where: {
          threadId: THREAD_ONE_ID,
          parentId,
          role: 'assistant',
          lifecycleStatus: 'COMPLETED',
        },
      })
    ).toBe(1)
    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('0.25')
  })

  test('materializes the current month from the carried budget', async () => {
    await resetToPreviousUsage(8, 10)

    await accountUsage.finalizeChatTurn(await claimedTurnInput(randomUUID()))

    const [previousUsage, currentUsage] = await Promise.all([
      prisma.chatAccountUsage.findUniqueOrThrow({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: PREVIOUS_MONTH_START,
          },
        },
      }),
      prisma.chatAccountUsage.findUniqueOrThrow({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: OWNER_ID,
            usageClass: 'BASE',
            monthStart: MONTH_START,
          },
        },
      }),
    ])
    expect(previousUsage.usedCredits.toString()).toBe('8')
    expect(currentUsage.budgetCredits.toString()).toBe('10')
    expect(currentUsage.usedCredits.toString()).toBe('0.25')
  })

  test('rolls back the assistant message when no budget was configured', async () => {
    process.env.CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED = 'true'
    const messageId = randomUUID()
    await prisma.chatAccountUsage.deleteMany({
      where: { ownerId: OWNER_ID, usageClass: 'BASE' },
    })

    await expect(
      accountUsage.finalizeChatTurn(await claimedTurnInput(messageId))
    ).rejects.toThrow('Chat account usage is not configured')

    await expect(
      prisma.chatMessage.findUniqueOrThrow({ where: { id: messageId } })
    ).resolves.toMatchObject({ lifecycleStatus: 'IN_PROGRESS' })
    expect(
      await prisma.chatAccountUsage.count({
        where: { ownerId: OWNER_ID, usageClass: 'BASE' },
      })
    ).toBe(0)
  })

  test('returns the same conflict boundary for a foreign message collision', async () => {
    const messageId = randomUUID()
    await accountUsage.finalizeChatTurn(await claimedTurnInput(messageId))

    await expect(
      accountUsage.claimChatTurn({
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        threadId: THREAD_TWO_ID,
        assistantMessageId: messageId,
        parentId: null,
      })
    ).rejects.toBeInstanceOf(accountUsage.ChatTurnConflictError)

    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('0.25')
  })

  test('atomically sums concurrent distinct turn charges', async () => {
    await resetToPreviousUsage(4, 10)

    const results = await Promise.all(
      Array.from({ length: 8 }, async () =>
        accountUsage.finalizeChatTurn(
          await claimedTurnInput(randomUUID(), { rawCreditsUsed: 0.125 })
        )
      )
    )

    expect(
      results.every(
        (result: FinalizeChatTurnResult) => result.outcome === 'completed'
      )
    ).toBe(true)
    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.budgetCredits.toString()).toBe('10')
    expect(usage.usedCredits.toString()).toBe('1')
    expect(
      await prisma.chatAccountUsage.count({
        where: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      })
    ).toBe(1)
  })

  test('accepts one bounded overrun and denies the next precheck', async () => {
    await resetUsage(0.9, 1)
    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(true)

    await accountUsage.finalizeChatTurn(
      await claimedTurnInput(randomUUID(), { rawCreditsUsed: 0.2 })
    )

    expect(
      await accountUsage.isChatAccountUsageAvailable({
        ownerId: OWNER_ID,
        usageClass: 'BASE',
        now: NOW,
      })
    ).toBe(false)
    const usage = await prisma.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: OWNER_ID,
          usageClass: 'BASE',
          monthStart: MONTH_START,
        },
      },
    })
    expect(usage.usedCredits.toString()).toBe('1.1')
  })

  describe('exam conversation (assessment mode)', () => {
    const BOUND_MS = 90_000

    async function examThread() {
      const { thread } = await threadService.ThreadService.createThread(
        EXAM_PARTICIPANT_ID,
        CHATBOT_ID
      )
      return thread.id
    }

    function examClaim(
      threadId: string,
      userId: string,
      assistantId: string,
      now?: Date
    ) {
      return accountUsage.claimChatTurn({
        ownerId: OWNER_ID,
        chatbotId: CHATBOT_ID,
        threadId,
        assistantMessageId: assistantId,
        // A client-chosen parent the server must ignore.
        parentId: randomUUID(),
        assessmentTurn: {
          userMessage: {
            id: userId,
            content: `Question ${userId.slice(0, 4)}`,
            chatMode: 'tutor',
            modelId: null,
          },
          inProgressBoundMs: BOUND_MS,
          ...(now ? { now } : {}),
        },
      })
    }

    async function answer(
      threadId: string,
      userId: string,
      assistantId: string,
      lifecycleAttemptId: string | null
    ) {
      await accountUsage.finalizeChatTurn({
        ...turnInput(assistantId, { threadId, parentId: userId }),
        participantId: EXAM_PARTICIPANT_ID,
        lifecycleAttemptId,
      })
    }

    // Every stored message has at most one child, and following the chain from
    // the root reaches every message.
    async function expectLinear(threadId: string, expectedIds: string[]) {
      const rows = await prisma.chatMessage.findMany({ where: { threadId } })
      const children = new Map<string | null, string[]>()
      for (const row of rows) {
        children.set(row.parentId, [
          ...(children.get(row.parentId) ?? []),
          row.id,
        ])
      }
      for (const siblings of children.values()) {
        expect(siblings).toHaveLength(1)
      }
      const chain: string[] = []
      for (
        let next = children.get(null)?.[0];
        next;
        next = children.get(next)?.[0]
      ) {
        chain.push(next)
      }
      expect(chain).toEqual(expectedIds)
    }

    beforeEach(async () => {
      process.env.CHAT_ASSESSMENT_MODE = 'true'
      await prisma.chatThread.deleteMany({
        where: { participantId: EXAM_PARTICIPANT_ID },
      })
    })

    test('two concurrent creates agree on one thread', async () => {
      const results = await Promise.all([
        threadService.ThreadService.createThread(
          EXAM_PARTICIPANT_ID,
          CHATBOT_ID
        ),
        threadService.ThreadService.createThread(
          EXAM_PARTICIPANT_ID,
          CHATBOT_ID
        ),
      ])

      expect(results[0].thread.id).toBe(results[1].thread.id)
      expect(results.filter((result) => result.created)).toHaveLength(1)
      expect(
        await prisma.chatThread.count({
          where: { participantId: EXAM_PARTICIPANT_ID, chatbotId: CHATBOT_ID },
        })
      ).toBe(1)
    })

    test.each([
      ['on', 'true'],
      ['off', 'false'],
    ])('keeps one chain through a failed answer with lifecycle writes %s', async (_name, lifecycle) => {
      process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = lifecycle
      const threadId = await examThread()
      const [u1, a1, u2, a2, u3, a3] = Array.from({ length: 6 }, randomUUID)

      const first = await examClaim(threadId, u1, a1)
      expect(first).toMatchObject({ outcome: 'claimed' })
      await answer(threadId, u1, a1, first.lifecycleAttemptId)

      const second = await examClaim(threadId, u2, a2)
      expect(second).toMatchObject({
        outcome: 'claimed',
        history: [
          { id: u1, role: 'user' },
          { id: a1, role: 'assistant' },
          { id: u2, role: 'user' },
        ],
      })
      await accountUsage.failChatTurn({
        assistantMessageId: a2,
        threadId,
        lifecycleAttemptId: second.lifecycleAttemptId,
        keepFailedMarker: true,
      })
      const failed = await prisma.chatMessage.findUniqueOrThrow({
        where: { id: a2 },
      })
      expect(failed.lifecycleStatus).toBe('FAILED')

      const third = await examClaim(threadId, u3, a3)
      expect(third).toMatchObject({
        outcome: 'claimed',
        history: [
          { id: u1, role: 'user' },
          { id: a1, role: 'assistant' },
          { id: u2, role: 'user' },
          { id: u3, role: 'user' },
        ],
      })
      await answer(threadId, u3, a3, third.lifecycleAttemptId)

      await expectLinear(threadId, [u1, a1, u2, a2, u3, a3])
    })

    test('an empty answer without lifecycle writes stays as a failed marker', async () => {
      process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED = 'false'
      const threadId = await examThread()
      const [u1, a1] = [randomUUID(), randomUUID()]
      await examClaim(threadId, u1, a1)

      await accountUsage.finalizeChatTurn({
        ...turnInput(a1, { threadId, parentId: u1, content: [] }),
        participantId: EXAM_PARTICIPANT_ID,
        lifecycleAttemptId: null,
        keepFailedMarker: true,
      })

      const row = await prisma.chatMessage.findUniqueOrThrow({
        where: { id: a1 },
      })
      expect(row.lifecycleStatus).toBe('FAILED')
    })

    test('a second tab cannot fork or run in parallel with a turn in progress', async () => {
      const threadId = await examThread()
      const [u1, a1, u2, a2] = Array.from({ length: 4 }, randomUUID)
      await examClaim(threadId, u1, a1)

      const parallel = await examClaim(threadId, u2, a2)

      expect(parallel.outcome).toBe('in_progress')
      expect(
        await prisma.chatMessage.count({ where: { id: { in: [u2, a2] } } })
      ).toBe(0)
    })

    test('two simultaneous turns claim exactly once', async () => {
      const threadId = await examThread()
      const claims = await Promise.all([
        examClaim(threadId, randomUUID(), randomUUID()),
        examClaim(threadId, randomUUID(), randomUUID()),
      ])

      expect(claims.map((claim) => claim.outcome).sort()).toEqual([
        'claimed',
        'in_progress',
      ])
    })

    test('an abandoned in-progress answer stops blocking and is marked failed', async () => {
      const threadId = await examThread()
      const [u1, a1, u2, a2] = Array.from({ length: 4 }, randomUUID)
      await examClaim(threadId, u1, a1)

      const later = await examClaim(
        threadId,
        u2,
        a2,
        new Date(Date.now() + BOUND_MS + 1000)
      )

      expect(later.outcome).toBe('claimed')
      const abandoned = await prisma.chatMessage.findUniqueOrThrow({
        where: { id: a1 },
      })
      expect(abandoned.lifecycleStatus).toBe('FAILED')
      await expectLinear(threadId, [u1, a1, u2, a2])
    })

    test('refuses a reused question id', async () => {
      const threadId = await examThread()
      const [u1, a1] = [randomUUID(), randomUUID()]
      const first = await examClaim(threadId, u1, a1)
      await answer(threadId, u1, a1, first.lifecycleAttemptId)

      await expect(
        examClaim(threadId, u1, randomUUID())
      ).rejects.toBeInstanceOf(accountUsage.ChatTurnConflictError)
    })
  })
})
