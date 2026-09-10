import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { CreditResetPeriod, Prisma } from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

const describePostgres =
  process.env.CHAT_CREDITS_INTEGRATION === '1' ? describe : describe.skip

const OWNER_ID = randomUUID()
const COURSE_ID = randomUUID()
const CHATBOT_ID = randomUUID()
const PARTICIPANT_ID = randomUUID()
const TEST_KEY = `synthetic-credit-${OWNER_ID.slice(0, 8)}`
const DAY = 24 * 60 * 60 * 1000

let prisma: PrismaClient
let creditsService: typeof import('../src/services/credits')
let transactions: typeof import('../src/utils/transactions')

function oldPeriodStart() {
  return new Date(Date.now() - 14 * DAY)
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function waitForSignal(
  signal: Promise<void>,
  operation: Promise<unknown>,
  message: string
) {
  await Promise.race([
    signal,
    operation.then(
      () => {
        throw new Error(message)
      },
      (error) => {
        throw error
      }
    ),
  ])
}

async function waitForBlockedChatbotLock(
  mode: 'FOR SHARE' | 'FOR UPDATE',
  operation: Promise<unknown>
) {
  const observation = (async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rows = await prisma.$queryRaw<Array<{ count: number }>>(
        Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM pg_stat_activity
          WHERE "wait_event_type" = 'Lock'
            AND "query" LIKE ${`%${mode}%`}
            AND "query" LIKE '%"public"."Chatbot"%'
        `
      )
      if ((rows[0]?.count ?? 0) > 0) return
      await new Promise<void>((resolve) => setImmediate(resolve))
    }

    throw new Error(`Expected a blocked Chatbot ${mode} writer`)
  })()

  await Promise.race([
    observation,
    operation.then(
      () => {
        throw new Error(`Chatbot ${mode} operation completed before blocking`)
      },
      (error) => {
        throw error
      }
    ),
  ])
}

async function cleanup() {
  const { requireDisposableDatabase } = await import('@klicker-uzh/prisma')
  await requireDisposableDatabase(prisma)
  await prisma.participant.deleteMany({ where: { id: PARTICIPANT_ID } })
  await prisma.chatbot.deleteMany({ where: { id: CHATBOT_ID } })
  await prisma.course.deleteMany({ where: { id: COURSE_ID } })
  await prisma.user.deleteMany({ where: { id: OWNER_ID } })
}

async function createCredits(
  overrides: Partial<{
    current: number
    total: number
    periodStartedAt: Date
    resetCount: number
  }> = {}
) {
  const periodStartedAt = overrides.periodStartedAt ?? oldPeriodStart()
  return prisma.chatUsageCredits.create({
    data: {
      participantId: PARTICIPANT_ID,
      chatbotId: CHATBOT_ID,
      current: overrides.current ?? 2,
      total: overrides.total ?? 3,
      periodStartedAt,
      lastResetAt: periodStartedAt,
      resetCount: overrides.resetCount ?? 4,
      createdAt: periodStartedAt,
    },
  })
}

async function setPolicy(
  overrides: Partial<{
    creditInitialCredits: number
    creditResetPeriod: CreditResetPeriod
    creditResetAmount: number
    creditMaxCredits: number
    creditResetPeriodChangedAt: Date | null
  }> = {}
) {
  await prisma.chatbot.update({
    where: { id: CHATBOT_ID },
    data: {
      creditInitialCredits: overrides.creditInitialCredits ?? 1,
      creditResetPeriod:
        overrides.creditResetPeriod ?? CreditResetPeriod.WEEKLY,
      creditResetAmount: overrides.creditResetAmount ?? 2,
      creditMaxCredits: overrides.creditMaxCredits ?? 5,
      creditResetPeriodChangedAt: overrides.creditResetPeriodChangedAt ?? null,
    },
  })
  await prisma.chatUsageCredits.deleteMany({
    where: { participantId: PARTICIPANT_ID, chatbotId: CHATBOT_ID },
  })
}

describePostgres('chat credit activation PostgreSQL integration', () => {
  beforeAll(async () => {
    ;({ prisma } = await import('@klicker-uzh/prisma'))
    const { requireDisposableDatabase } = await import('@klicker-uzh/prisma')
    await requireDisposableDatabase(prisma)
    creditsService = await import('../src/services/credits')
    transactions = await import('../src/utils/transactions')
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
        displayName: 'Synthetic credit activation course',
        authType: 'SSO',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-01T00:00:00.000Z'),
        groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
        ownerId: OWNER_ID,
      },
    })
    await prisma.chatbot.create({
      data: {
        id: CHATBOT_ID,
        name: 'Synthetic credit activation chatbot',
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
  }, 60_000)

  beforeEach(async () => {
    await setPolicy()
  })

  afterAll(async () => {
    if (!prisma) return
    await cleanup()
    await prisma.$disconnect()
  }, 60_000)

  test('starts a changed schedule at approval and applies its next reset', async () => {
    const changedAt = new Date()
    await setPolicy({
      creditResetPeriod: CreditResetPeriod.DAILY,
      creditResetAmount: 2,
      creditMaxCredits: 5,
      creditResetPeriodChangedAt: changedAt,
    })
    await createCredits()

    const beforeNextPeriod = await creditsService.CreditsService.getUserCredits(
      PARTICIPANT_ID,
      CHATBOT_ID
    )
    expect(beforeNextPeriod).toEqual({ current: 2, total: 3 })

    const preserved = await prisma.chatUsageCredits.findUniqueOrThrow({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    expect(preserved.current.toNumber()).toBe(2)
    expect(preserved.total.toNumber()).toBe(3)
    expect(preserved.resetCount).toBe(4)

    await prisma.chatbot.update({
      where: { id: CHATBOT_ID },
      data: { creditResetPeriodChangedAt: new Date(Date.now() - 2 * DAY) },
    })
    const afterNextPeriod = await creditsService.CreditsService.getUserCredits(
      PARTICIPANT_ID,
      CHATBOT_ID
    )
    expect(afterNextPeriod).toEqual({ current: 4, total: 5 })

    const reset = await prisma.chatUsageCredits.findUniqueOrThrow({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    expect(reset.resetCount).toBe(5)
    expect(reset.current.toNumber()).toBe(4)
    expect(reset.total.toNumber()).toBe(5)
  })

  test('NONE preserves an expired balance and disables reset', async () => {
    await setPolicy({
      creditResetPeriod: CreditResetPeriod.NONE,
      creditResetPeriodChangedAt: new Date(),
    })
    await createCredits()

    await expect(
      creditsService.CreditsService.getUserCredits(PARTICIPANT_ID, CHATBOT_ID)
    ).resolves.toEqual({ current: 2, total: 3 })

    const stored = await prisma.chatUsageCredits.findUniqueOrThrow({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    expect(stored.resetCount).toBe(4)
    expect(stored.current.toNumber()).toBe(2)
    expect(stored.total.toNumber()).toBe(3)
  })

  test('applies an approved lower cap at the next reset', async () => {
    await setPolicy({
      creditResetPeriod: CreditResetPeriod.DAILY,
      creditResetAmount: 3,
      creditMaxCredits: 3,
      creditResetPeriodChangedAt: new Date(),
    })
    await createCredits({
      current: 4,
      total: 9,
      periodStartedAt: oldPeriodStart(),
    })

    await expect(
      creditsService.CreditsService.getUserCredits(PARTICIPANT_ID, CHATBOT_ID)
    ).resolves.toEqual({ current: 4, total: 9 })

    await prisma.chatbot.update({
      where: { id: CHATBOT_ID },
      data: {
        creditResetPeriodChangedAt: new Date(Date.now() - 2 * DAY),
      },
    })
    await expect(
      creditsService.CreditsService.getUserCredits(PARTICIPANT_ID, CHATBOT_ID)
    ).resolves.toEqual({ current: 3, total: 3 })
  })

  test('applies initial-credit changes only to new rows and previews without writing', async () => {
    await setPolicy({
      creditInitialCredits: 4,
      creditMaxCredits: 7,
      creditResetPeriodChangedAt: null,
    })
    await createCredits({ periodStartedAt: new Date() })

    await expect(
      creditsService.CreditsService.getUserCredits(PARTICIPANT_ID, CHATBOT_ID)
    ).resolves.toEqual({ current: 2, total: 3 })

    await expect(
      creditsService.CreditsService.initializeCredits(
        PARTICIPANT_ID,
        CHATBOT_ID
      )
    ).resolves.toEqual({ current: 2, total: 3 })

    await prisma.chatUsageCredits.delete({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    await expect(
      creditsService.CreditsService.previewUserCredits(
        PARTICIPANT_ID,
        CHATBOT_ID
      )
    ).resolves.toEqual({ current: 4, total: 7 })
    await expect(
      prisma.chatUsageCredits.findUnique({
        where: {
          participantId_chatbotId: {
            participantId: PARTICIPANT_ID,
            chatbotId: CHATBOT_ID,
          },
        },
      })
    ).resolves.toBeNull()

    await expect(
      creditsService.CreditsService.initializeCredits(
        PARTICIPANT_ID,
        CHATBOT_ID
      )
    ).resolves.toEqual({ current: 4, total: 7 })
  })

  test('keeps standalone and finalization debits atomic', async () => {
    await createCredits({
      current: 4,
      total: 5,
      periodStartedAt: new Date(),
    })

    await expect(
      creditsService.CreditsService.decrementCredits(
        PARTICIPANT_ID,
        CHATBOT_ID,
        1
      )
    ).resolves.toEqual({ current: 3, total: 5 })

    await expect(
      prisma.$transaction((tx) =>
        creditsService.CreditsService.decrementCreditsInTransaction(
          tx,
          PARTICIPANT_ID,
          CHATBOT_ID,
          1
        )
      )
    ).resolves.toEqual({ current: 2, total: 5 })

    const stored = await prisma.chatUsageCredits.findUniqueOrThrow({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    expect(stored.current.toNumber()).toBe(2)
    expect(stored.total.toNumber()).toBe(5)
  })

  test('initializes policy credits before a disclaimer metadata upsert', async () => {
    await setPolicy({ creditInitialCredits: 4, creditMaxCredits: 7 })
    const { DisclaimersService } = await import('../src/services/disclaimers')

    await DisclaimersService.declineDisclaimer(CHATBOT_ID, PARTICIPANT_ID)

    const stored = await prisma.chatUsageCredits.findUniqueOrThrow({
      where: {
        participantId_chatbotId: {
          participantId: PARTICIPANT_ID,
          chatbotId: CHATBOT_ID,
        },
      },
    })
    expect(stored.current.toNumber()).toBe(4)
    expect(stored.total.toNumber()).toBe(7)
    expect(stored.disclaimerDeclined).toBe(true)
  })

  test('uses the approved policy when approval commits before a writer', async () => {
    await createCredits({ resetCount: 0 })

    const approvalLocked = deferred<void>()
    const releaseApproval = deferred<void>()
    let approval: Promise<Date> | undefined
    let writer: Promise<{ current: number; total: number }> | undefined

    try {
      const approvalTransaction = prisma.$transaction(async (tx) => {
        try {
          await tx.$queryRaw(
            Prisma.sql`
              SELECT 1
              FROM "public"."Chatbot"
              WHERE "id" = CAST(${CHATBOT_ID} AS UUID)
              FOR UPDATE
            `
          )
          approvalLocked.resolve()
          await releaseApproval.promise
          const changedAt = new Date()
          await tx.chatbot.update({
            where: { id: CHATBOT_ID },
            data: {
              creditResetPeriod: CreditResetPeriod.DAILY,
              creditResetAmount: 3,
              creditMaxCredits: 7,
              creditResetPeriodChangedAt: changedAt,
            },
          })
          return changedAt
        } finally {
          approvalLocked.resolve()
        }
      })
      approval = approvalTransaction

      await waitForSignal(
        approvalLocked.promise,
        approvalTransaction,
        'Approval completed before acquiring its Chatbot lock'
      )

      const writerTransaction = creditsService.CreditsService.getUserCredits(
        PARTICIPANT_ID,
        CHATBOT_ID
      )
      writer = writerTransaction
      await waitForBlockedChatbotLock('FOR SHARE', writerTransaction)

      releaseApproval.resolve()
      const [changedAt, writerResult] = await Promise.all([
        approvalTransaction,
        writerTransaction,
      ])
      expect(changedAt).toBeInstanceOf(Date)
      expect(writerResult).toEqual({ current: 2, total: 3 })

      const preserved = await prisma.chatUsageCredits.findUniqueOrThrow({
        where: {
          participantId_chatbotId: {
            participantId: PARTICIPANT_ID,
            chatbotId: CHATBOT_ID,
          },
        },
      })
      expect(preserved.current.toNumber()).toBe(2)
      expect(preserved.total.toNumber()).toBe(3)
      expect(preserved.resetCount).toBe(0)

      await prisma.chatbot.update({
        where: { id: CHATBOT_ID },
        data: { creditResetPeriodChangedAt: new Date(Date.now() - 2 * DAY) },
      })
      await expect(
        creditsService.CreditsService.getUserCredits(PARTICIPANT_ID, CHATBOT_ID)
      ).resolves.toEqual({ current: 5, total: 7 })

      const reset = await prisma.chatUsageCredits.findUniqueOrThrow({
        where: {
          participantId_chatbotId: {
            participantId: PARTICIPANT_ID,
            chatbotId: CHATBOT_ID,
          },
        },
      })
      expect(reset.resetCount).toBe(1)
      expect(reset.current.toNumber()).toBe(5)
      expect(reset.total.toNumber()).toBe(7)
    } finally {
      approvalLocked.resolve()
      releaseApproval.resolve()
      await Promise.allSettled([approval, writer])
    }
  })

  test('keeps an old writer before approval and a new writer after approval ordered', async () => {
    await createCredits({ resetCount: 0 })

    const writerPolicyRead = deferred<void>()
    const releaseWriter = deferred<void>()
    const writerReadyToCommit = deferred<void>()
    const approvalAttempted = deferred<void>()
    const allowWriterCommit = deferred<void>()
    let writer:
      | Promise<{
          current: number
          total: number
          wasReset: boolean
        }>
      | undefined
    let approval: Promise<Date> | undefined

    try {
      const writerTransaction = prisma.$transaction(async (tx) => {
        try {
          const oldPolicy = await transactions.loadChatbotCreditPolicyForWriter(
            tx,
            CHATBOT_ID
          )
          if (!oldPolicy) throw new Error('Synthetic chatbot policy missing')
          expect(oldPolicy.creditResetPeriod).toBe(CreditResetPeriod.WEEKLY)
          writerPolicyRead.resolve()
          await releaseWriter.promise

          const credits = await transactions.findChatUsageCreditsForUpdate(
            tx,
            PARTICIPANT_ID,
            CHATBOT_ID
          )
          if (!credits) throw new Error('Synthetic credits row missing')
          const result = await transactions.resetCreditsIfNeededInTransaction(
            tx,
            PARTICIPANT_ID,
            CHATBOT_ID,
            oldPolicy,
            credits
          )
          writerReadyToCommit.resolve()
          await allowWriterCommit.promise
          return result
        } finally {
          writerPolicyRead.resolve()
          writerReadyToCommit.resolve()
        }
      })
      writer = writerTransaction

      await waitForSignal(
        writerPolicyRead.promise,
        writerTransaction,
        'Old writer completed before reading its policy'
      )

      const approvalTransaction = prisma.$transaction(async (tx) => {
        try {
          await writerReadyToCommit.promise
          approvalAttempted.resolve()
          await tx.$queryRaw(
            Prisma.sql`
              SELECT 1
              FROM "public"."Chatbot"
              WHERE "id" = CAST(${CHATBOT_ID} AS UUID)
              FOR UPDATE
            `
          )
          const changedAt = new Date()
          await tx.chatbot.update({
            where: { id: CHATBOT_ID },
            data: {
              creditResetPeriod: CreditResetPeriod.DAILY,
              creditResetAmount: 3,
              creditMaxCredits: 7,
              creditResetPeriodChangedAt: changedAt,
            },
          })
          return changedAt
        } finally {
          approvalAttempted.resolve()
        }
      })
      approval = approvalTransaction

      releaseWriter.resolve()
      await waitForSignal(
        approvalAttempted.promise,
        approvalTransaction,
        'Approval completed before attempting its Chatbot lock'
      )
      await waitForBlockedChatbotLock('FOR UPDATE', approvalTransaction)
      allowWriterCommit.resolve()

      const [oldWriterResult, changedAt] = await Promise.all([
        writerTransaction,
        approvalTransaction,
      ])
      expect(oldWriterResult).toEqual({
        current: 4,
        total: 5,
        wasReset: true,
      })
      expect(changedAt).toBeInstanceOf(Date)

      await expect(
        creditsService.CreditsService.getUserCredits(PARTICIPANT_ID, CHATBOT_ID)
      ).resolves.toEqual({ current: 4, total: 5 })

      await prisma.chatbot.update({
        where: { id: CHATBOT_ID },
        data: { creditResetPeriodChangedAt: new Date(Date.now() - 2 * DAY) },
      })
      await expect(
        creditsService.CreditsService.getUserCredits(PARTICIPANT_ID, CHATBOT_ID)
      ).resolves.toEqual({ current: 7, total: 7 })

      const stored = await prisma.chatUsageCredits.findUniqueOrThrow({
        where: {
          participantId_chatbotId: {
            participantId: PARTICIPANT_ID,
            chatbotId: CHATBOT_ID,
          },
        },
      })
      expect(stored.resetCount).toBe(2)
      expect(stored.current.toNumber()).toBe(7)
      expect(stored.total.toNumber()).toBe(7)
    } finally {
      writerPolicyRead.resolve()
      releaseWriter.resolve()
      writerReadyToCommit.resolve()
      approvalAttempted.resolve()
      allowWriterCommit.resolve()
      await Promise.allSettled([writer, approval])
    }
  })
})
