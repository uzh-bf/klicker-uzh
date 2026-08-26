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
const THREAD_ONE_ID = randomUUID()
const THREAD_TWO_ID = randomUUID()
const TEST_KEY = `u2-account-${OWNER_ID.slice(0, 8)}`

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
  await prisma.user.update({
    where: { id: OWNER_ID },
    data: { aiChatbotPublishingEnabled: true },
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
  await prisma.participant.deleteMany({ where: { id: PARTICIPANT_ID } })
  await prisma.user.deleteMany({ where: { id: OWNER_ID } })
}

describePostgres('account usage PostgreSQL integration', () => {
  beforeAll(async () => {
    ;({ prisma } = await import('@klicker-uzh/prisma'))
    accountUsage = await import('../src/services/accountUsage')
    threadService = await import('../src/services/threads')
    await prisma.$connect()
    await cleanup()

    await prisma.user.create({
      data: {
        id: OWNER_ID,
        email: `${TEST_KEY}@example.invalid`,
        shortname: TEST_KEY,
        aiChatbotPublishingEnabled: true,
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
    await resetUsage()
  })

  afterAll(async () => {
    if (!prisma) return
    await cleanup()
    await prisma.$disconnect()
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
      data: { aiChatbotPublishingEnabled: false },
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
      data: { aiChatbotPublishingEnabled: true },
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
    if (!winner || winner.outcome !== 'claimed') {
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
})
