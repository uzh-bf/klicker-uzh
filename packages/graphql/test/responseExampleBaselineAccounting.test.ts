import { randomUUID } from 'node:crypto'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { getZurichMonthStart } from '@klicker-uzh/util'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  BaselineAccountingError,
  claimBaselineOperation,
  markBaselineOperationDispatched,
  releaseBaselineOperation,
  settleBaselineOperation,
} from '../src/services/responseExampleBaselineAccounting.js'

const NOW = new Date('2026-10-28T10:00:00.000Z')
const DEADLINE = new Date('2026-10-28T12:00:00.000Z')

type Run = {
  chatbotId: string
  setId: string
  reportId: string
  caseId: string
}

describe('response example baseline accounting', () => {
  let db: PrismaClient
  let ownerId: string
  let courseId: string
  let run: Run

  beforeAll(async () => {
    db = prisma
    await requireDisposableDatabase(db)
  })

  beforeEach(async () => {
    ownerId = randomUUID()
    await db.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.invalid`,
        shortname: `baseline-${ownerId}`,
        aiFeaturesEnabled: true,
      },
    })
    const course = await db.course.create({
      data: {
        name: 'Synthetic baseline accounting',
        displayName: 'Synthetic baseline accounting',
        ownerId,
        authType: 'SSO',
        startDate: NOW,
        endDate: DEADLINE,
        groupDeadlineDate: DEADLINE,
      },
    })
    courseId = course.id
    await db.chatAccountUsage.create({
      data: {
        ownerId,
        usageClass: 'BASE',
        monthStart: getZurichMonthStart(NOW),
        budgetCredits: 1,
        usedCredits: 0,
      },
    })
    run = await createRun('first')
  })

  afterEach(async () => {
    if (ownerId) await db.user.deleteMany({ where: { id: ownerId } })
  })

  afterAll(async () => {
    await db.$disconnect()
  })

  async function createRun(label: string): Promise<Run> {
    const chatbot = await db.chatbot.create({
      data: { name: `Synthetic ${label}`, ownerId, courseId },
    })
    const set = await db.responseExampleSet.create({
      data: { chatbotId: chatbot.id },
    })
    const exampleId = randomUUID()
    const report = await db.responseExampleBaselineReport.create({
      data: {
        id: randomUUID(),
        setId: set.id,
        ownerId,
        setDigest: 'synthetic-set-digest',
        configurationDigest: 'synthetic-config-digest',
        deadline: DEADLINE,
        cases: {
          create: {
            id: randomUUID(),
            exampleId,
            ordinal: 0,
            chatMode: 'tutor',
            question: 'Synthetic question',
            idealAnswer: 'Synthetic answer',
            expectedEvidence: [],
          },
        },
      },
      include: { cases: true },
    })
    return {
      chatbotId: chatbot.id,
      setId: set.id,
      reportId: report.id,
      caseId: report.cases[0]!.id,
    }
  }

  async function claim(target = run, stage: 'TARGET' | 'JUDGE' = 'TARGET') {
    return claimBaselineOperation(db, {
      ownerId,
      chatbotId: target.chatbotId,
      runId: target.reportId,
      caseId: target.caseId,
      stage,
      inputRate: 10,
      outputRate: 20,
      now: NOW,
    })
  }

  it('serializes admission across reports and never redispatches an existing identity', async () => {
    const second = await createRun('second')
    const results = await Promise.allSettled([claim(run), claim(second)])
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1)
    const admitted = results.find(
      (
        result
      ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof claim>>> =>
        result.status === 'fulfilled'
    )!.value!
    const target = admitted.runId === run.reportId ? run : second

    expect(await claim(target)).toBeNull()
    expect(await markBaselineOperationDispatched(db, admitted.id, NOW)).toBe(
      true
    )
    expect(await markBaselineOperationDispatched(db, admitted.id, NOW)).toBe(
      false
    )
  })

  it('charges actual usage once and permits an admitted call to overshoot the remaining budget', async () => {
    await db.chatAccountUsage.update({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId,
          usageClass: 'BASE',
          monthStart: getZurichMonthStart(NOW),
        },
      },
      data: { usedCredits: 0.999999 },
    })
    const operation = await claim()
    expect(operation).not.toBeNull()
    expect(await markBaselineOperationDispatched(db, operation!.id, NOW)).toBe(
      true
    )
    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: 200_000,
        outputTokens: 0,
        now: NOW,
      })
    ).toBe('SETTLED')
    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: 200_000,
        outputTokens: 0,
        now: NOW,
      })
    ).toBe('DUPLICATE')

    const usage = await db.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId,
          usageClass: 'BASE',
          monthStart: getZurichMonthStart(NOW),
        },
      },
    })
    expect(usage.usedCredits.toNumber()).toBe(2.999999)
  })

  it('blocks new work on unknown usage, then settles late after report replacement', async () => {
    const operation = await claim()
    expect(operation).not.toBeNull()
    expect(await markBaselineOperationDispatched(db, operation!.id, NOW)).toBe(
      true
    )
    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: null,
        outputTokens: null,
        now: NOW,
      })
    ).toBe('UNCERTAIN')

    await db.responseExampleBaselineReport.delete({
      where: { id: run.reportId },
    })
    const replacement = await db.responseExampleBaselineReport.create({
      data: {
        id: randomUUID(),
        setId: run.setId,
        ownerId,
        setDigest: 'replacement-set-digest',
        configurationDigest: 'replacement-config-digest',
        deadline: DEADLINE,
        cases: {
          create: {
            id: randomUUID(),
            exampleId: randomUUID(),
            ordinal: 0,
            chatMode: 'tutor',
            question: 'Synthetic replacement question',
            idealAnswer: 'Synthetic replacement answer',
            expectedEvidence: [],
          },
        },
      },
      include: { cases: true },
    })
    const replacementRun = {
      ...run,
      reportId: replacement.id,
      caseId: replacement.cases[0]!.id,
    }
    await expect(claim(replacementRun)).rejects.toMatchObject({
      code: 'BASELINE_OPERATION_IN_FLIGHT',
    })

    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: 10_000,
        outputTokens: 5_000,
        now: new Date(NOW.getTime() + 60_000),
      })
    ).toBe('SETTLED')
    expect(await claim(replacementRun)).not.toBeNull()
  })

  it('charges known partial usage once and charges only the late cumulative delta', async () => {
    const operation = await claim()
    expect(operation).not.toBeNull()
    expect(await markBaselineOperationDispatched(db, operation!.id, NOW)).toBe(
      true
    )
    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: 1_000,
        outputTokens: 500,
        usageComplete: false,
        now: NOW,
      })
    ).toBe('UNCERTAIN')
    expect(await claim()).toBeNull()

    await db.responseExampleBaselineReport.delete({
      where: { id: run.reportId },
    })
    const replacement = await db.responseExampleBaselineReport.create({
      data: {
        id: randomUUID(),
        setId: run.setId,
        ownerId,
        setDigest: 'replacement-set-digest',
        configurationDigest: 'replacement-config-digest',
        deadline: DEADLINE,
        cases: {
          create: {
            id: randomUUID(),
            exampleId: randomUUID(),
            ordinal: 0,
            chatMode: 'tutor',
            question: 'Synthetic replacement question',
            idealAnswer: 'Synthetic replacement answer',
            expectedEvidence: [],
          },
        },
      },
      include: { cases: true },
    })
    const replacementRun = {
      ...run,
      reportId: replacement.id,
      caseId: replacement.cases[0]!.id,
    }
    const usageWhere = {
      ownerId_usageClass_monthStart: {
        ownerId,
        usageClass: 'BASE' as const,
        monthStart: getZurichMonthStart(NOW),
      },
    }
    expect(
      (
        await db.chatAccountUsage.findUniqueOrThrow({ where: usageWhere })
      ).usedCredits.toNumber()
    ).toBe(0.02)
    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: 1_000,
        outputTokens: 500,
        usageComplete: false,
        now: NOW,
      })
    ).toBe('UNCERTAIN')
    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: 1_500,
        outputTokens: 1_000,
        now: new Date(NOW.getTime() + 60_000),
      })
    ).toBe('SETTLED')
    expect(
      await settleBaselineOperation(db, {
        operationId: operation!.id,
        inputTokens: 1_500,
        outputTokens: 1_000,
        now: new Date(NOW.getTime() + 120_000),
      })
    ).toBe('DUPLICATE')
    expect(
      (
        await db.chatAccountUsage.findUniqueOrThrow({ where: usageWhere })
      ).usedCredits.toNumber()
    ).toBe(0.035)
    expect(await claim(replacementRun)).not.toBeNull()
  })

  it('rejects exhausted budgets and only releases a proven undispatched claim', async () => {
    await db.chatAccountUsage.update({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId,
          usageClass: 'BASE',
          monthStart: getZurichMonthStart(NOW),
        },
      },
      data: { usedCredits: 1 },
    })
    const exhaustedUsage = await db.chatAccountUsage.findUniqueOrThrow({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId,
          usageClass: 'BASE',
          monthStart: getZurichMonthStart(NOW),
        },
      },
    })
    expect(exhaustedUsage.usedCredits.toNumber()).toBe(1)
    const error = await claim().then(
      () => null,
      (caught) => caught
    )
    if (!(error instanceof BaselineAccountingError)) {
      throw new Error('Expected the configured baseline budget to be exhausted')
    }
    expect(error.code).toBe('BASELINE_BUDGET_EXHAUSTED')

    await db.chatAccountUsage.update({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId,
          usageClass: 'BASE',
          monthStart: getZurichMonthStart(NOW),
        },
      },
      data: { usedCredits: 0 },
    })
    const operation = await claim()
    expect(await releaseBaselineOperation(db, operation!.id)).toBe(true)
    expect(await releaseBaselineOperation(db, operation!.id)).toBe(false)
    expect(await markBaselineOperationDispatched(db, operation!.id, NOW)).toBe(
      false
    )
  })

  it('does not create or modify participant chat records', async () => {
    const [threadsBefore, messagesBefore, creditsBefore] = await Promise.all([
      db.chatThread.count(),
      db.chatMessage.count(),
      db.chatUsageCredits.count(),
    ])
    const operation = await claim()
    await markBaselineOperationDispatched(db, operation!.id, NOW)
    await settleBaselineOperation(db, {
      operationId: operation!.id,
      inputTokens: 1_000,
      outputTokens: 1_000,
      now: NOW,
    })
    const [threadsAfter, messagesAfter, creditsAfter] = await Promise.all([
      db.chatThread.count(),
      db.chatMessage.count(),
      db.chatUsageCredits.count(),
    ])
    expect([threadsAfter, messagesAfter, creditsAfter]).toEqual([
      threadsBefore,
      messagesBefore,
      creditsBefore,
    ])
  })
})
