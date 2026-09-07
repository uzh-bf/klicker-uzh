import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { prisma } from '@klicker-uzh/prisma'
import type { Prisma } from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { Redis } from 'ioredis'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  activateLiveQuizBlock,
  handleAssessmentLiveQuizBlockClosureAggregation,
  handleStandardLiveQuizBlockClosureAggregation,
} from '../src/services/liveQuizzes.js'
import type { ContextWithUser } from '../src/lib/context.js'

type Handler = HatchetHandlers['handleStandardLiveQuizBlockClosureAggregation']

describe('Closed live quiz aggregation ownership', () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
  })
  const globalCtx = {
    prisma,
    redisExec: redis,
    redisAssessmentExec: redis,
    emitter: new EventEmitter(),
  } as Parameters<Handler>[1]
  const executionCtx = {
    logger: { info: vi.fn() },
  } as unknown as Parameters<Handler>[2]
  let ownerId: string
  let quizId: string
  let blockId: number
  let instanceId: number
  let newerBlockId: number
  const startedAt = new Date('2026-01-01T10:00:00Z')
  const closedAt = new Date('2026-01-01T10:01:00Z')
  const input = () => ({
    liveQuizId: quizId,
    blockId,
    blockExecution: 2,
    blockStartedAt: startedAt.toISOString(),
  })
  const infoKey = () => `lq:${quizId}:i:${instanceId}:info`
  const resultsKey = () => `lq:${quizId}:i:${instanceId}:results`

  it('clears the previous closure marker when reactivating a block', async () => {
    const publish = vi.fn()
    const ctx = {
      ...globalCtx,
      pubSub: { publish },
    } as unknown as ContextWithUser
    await activateLiveQuizBlock({ quizId, blockId }, ctx)
    expect(await redis.hget(infoKey(), 'blockClosedAt')).toBeNull()
    expect(publish).toHaveBeenCalledOnce()
    const block = await prisma.elementBlock.findUniqueOrThrow({
      where: { id: blockId },
    })
    expect(block.execution).toBe(2)
    expect(block.status).toBe('ACTIVE')
    expect(await redis.hget(infoKey(), 'blockStartedAt')).toBe(
      String(block.startedAt!.getTime())
    )
  })

  beforeEach(async () => {
    ownerId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        shortname: ownerId,
        email: `${ownerId}@aggregation.example.invalid`,
      },
    })
    const element = await prisma.element.create({
      data: {
        type: 'SC',
        status: 'READY',
        name: 'Synthetic aggregation question',
        content: 'Select an option',
        ownerId,
        options: {
          choices: [{ ix: 0, value: 'A', correct: true }],
          displayMode: 'LIST',
          hasSampleSolution: true,
        },
      },
    })
    const elementData = processElementData(element)
    const quiz = await prisma.liveQuiz.create({
      data: {
        name: 'Synthetic aggregation quiz',
        displayName: 'Aggregation',
        status: 'PUBLISHED',
        ownerId,
        isGamificationEnabled: false,
        blocks: {
          create: [
            {
              order: 0,
              status: 'EXECUTED',
              execution: 2,
              startedAt,
              closedAt,
              elements: {
                create: [
                  {
                    type: 'LIVE_QUIZ',
                    elementId: element.id,
                    elementType: 'SC',
                    order: 0,
                    options: {},
                    elementData,
                    ownerId,
                    results: getInitialInstanceResults(elementData),
                    anonymousResults: getInitialInstanceResults(elementData),
                  },
                ],
              },
            },
            { order: 1, status: 'ACTIVE', execution: 0, startedAt: closedAt },
          ],
        },
      },
      include: {
        blocks: { include: { elements: true }, orderBy: { order: 'asc' } },
      },
    })
    quizId = quiz.id
    blockId = quiz.blocks[0]!.id
    instanceId = quiz.blocks[0]!.elements[0]!.id
    newerBlockId = quiz.blocks[1]!.id
    await prisma.liveQuiz.update({
      where: { id: quizId },
      data: { activeBlockId: newerBlockId },
    })
    await redis.hset(infoKey(), {
      blockExecution: 2,
      blockStartedAt: startedAt.getTime(),
      blockClosedAt: closedAt.getTime(),
    })
    await redis.hset(resultsKey(), { participants: 3, '0': 3 })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    const keys = await redis.keys(`lq:${quizId}:*`)
    if (keys.length) await redis.del(...keys)
    await prisma.user.deleteMany({ where: { id: ownerId } })
  })

  afterAll(async () => {
    await redis.quit()
    await prisma.$disconnect()
  })

  it('persists late cached responses without closing the newer active block', async () => {
    await handleStandardLiveQuizBlockClosureAggregation(
      input(),
      globalCtx,
      executionCtx
    )
    const quiz = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: quizId },
    })
    const block = await prisma.elementBlock.findUniqueOrThrow({
      where: { id: blockId },
    })
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: instanceId },
    })
    expect(quiz.activeBlockId).toBe(newerBlockId)
    expect(block.closedAt).toEqual(closedAt)
    expect(instance.anonymousResults).toMatchObject({
      total: 3,
      choices: { '0': 3 },
    })
    expect(await redis.ttl(resultsKey())).toBeGreaterThan(86390)
  })

  it.each([
    'execution',
    'activation',
    'abort',
  ] as const)('leaves results and retention unchanged after a newer %s', async (change) => {
    if (change === 'abort') {
      await prisma.liveQuiz.update({
        where: { id: quizId },
        data: { status: 'DRAFT' },
      })
    } else {
      await prisma.elementBlock.update({
        where: { id: blockId },
        data:
          change === 'execution' ? { execution: 3 } : { startedAt: closedAt },
      })
    }
    await handleStandardLiveQuizBlockClosureAggregation(
      input(),
      globalCtx,
      executionCtx
    )
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: instanceId },
    })
    expect(instance.anonymousResults.total).toBe(0)
    expect(await redis.ttl(resultsKey())).toBe(-1)
  })

  it('rejects partially initialized cache without persisting or expiring it', async () => {
    await redis.hdel(infoKey(), 'blockStartedAt')
    await expect(
      handleStandardLiveQuizBlockClosureAggregation(
        input(),
        globalCtx,
        executionCtx
      )
    ).rejects.toThrow()
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: instanceId },
    })
    expect(instance.anonymousResults.total).toBe(0)
    expect(await redis.ttl(resultsKey())).toBe(-1)
  })

  it('does not expire cache when persistence fails', async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(new Error('synthetic persistence failure'))
    const failingCtx = {
      ...globalCtx,
      prisma: { $transaction: transaction } as unknown as typeof prisma,
    }
    await expect(
      handleStandardLiveQuizBlockClosureAggregation(
        input(),
        failingCtx,
        executionCtx
      )
    ).rejects.toThrow()
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(await redis.ttl(resultsKey())).toBe(-1)
  })

  it('persists zero matching assessment responses before setting retention', async () => {
    await prisma.liveQuiz.update({
      where: { id: quizId },
      data: { isAssessmentEnabled: true, pinCode: '123456' },
    })
    await prisma.elementInstance.update({
      where: { id: instanceId },
      data: { results: { total: 9, choices: { '0': 9 } } },
    })
    await handleAssessmentLiveQuizBlockClosureAggregation(
      input(),
      globalCtx,
      executionCtx
    )
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: instanceId },
    })
    expect(instance.results).toMatchObject({ total: 0, choices: { '0': 0 } })
    expect(await redis.ttl(resultsKey())).toBeGreaterThan(86390)
  })

  it('rejects legacy jobs without execution identity', async () => {
    const legacy = { liveQuizId: quizId, blockId } as Parameters<Handler>[0]
    await expect(
      handleStandardLiveQuizBlockClosureAggregation(
        legacy,
        globalCtx,
        executionCtx
      )
    ).rejects.toThrow()
    expect(await redis.ttl(resultsKey())).toBe(-1)
  })

  it('retains cumulative assessment responses only from the matching execution', async () => {
    await prisma.liveQuiz.update({
      where: { id: quizId },
      data: { isAssessmentEnabled: true, pinCode: '123456' },
    })
    const participant = await prisma.participant.create({
      data: { username: randomUUID(), password: 'synthetic-unused-password' },
    })
    try {
      for (const execution of [1, 2]) {
        await prisma.liveQuizResponse.create({
          data: {
            instanceId,
            elementBlockExecution: execution,
            participantId: participant.id,
            submittedAt: new Date(startedAt.getTime() - 1000),
            timeSpent: 1,
            correctness: 'CORRECT',
            basePoints: 0,
            correctnessPoints: 0,
            bonusPoints: 0,
            response: { choices: [{ ix: 0, selected: true }] },
          },
        })
      }
      await handleAssessmentLiveQuizBlockClosureAggregation(
        input(),
        globalCtx,
        executionCtx
      )
      const instance = await prisma.elementInstance.findUniqueOrThrow({
        where: { id: instanceId },
      })
      expect(instance.results).toMatchObject({ total: 1, choices: { '0': 1 } })
    } finally {
      await prisma.participant.delete({ where: { id: participant.id } })
    }
  })

  it('leaves retention unchanged when cache ownership changes immediately before expiry', async () => {
    const evaluate = redis.eval.bind(redis)
    vi.spyOn(redis, 'eval').mockImplementationOnce(async (...args) => {
      await redis.hset(infoKey(), 'blockStartedAt', closedAt.getTime())
      return evaluate(...args)
    })
    await expect(
      handleStandardLiveQuizBlockClosureAggregation(
        input(),
        globalCtx,
        executionCtx
      )
    ).rejects.toThrow()
    expect(await redis.ttl(resultsKey())).toBe(-1)
  })

  it.each([
    'abort',
    'activation',
  ] as const)('rechecks ownership after persistence and before expiry for %s', async (change) => {
    let commits = 0
    const transaction = async (
      work: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options: { timeout: number }
    ) => {
      const result = await prisma.$transaction(work, options)
      if (++commits === 1) {
        if (change === 'abort') {
          await prisma.liveQuiz.update({
            where: { id: quizId },
            data: { status: 'DRAFT' },
          })
        } else {
          await prisma.elementBlock.update({
            where: { id: blockId },
            data: { startedAt: closedAt },
          })
        }
      }
      return result
    }
    const ctx = {
      ...globalCtx,
      prisma: { $transaction: transaction } as unknown as typeof prisma,
    }
    await handleStandardLiveQuizBlockClosureAggregation(
      input(),
      ctx,
      executionCtx
    )
    expect(commits).toBe(2)
    expect(await redis.ttl(resultsKey())).toBe(-1)
  })

  it('validates all block cache identities before last-block quiz-wide expiry', async () => {
    await prisma.liveQuiz.update({
      where: { id: quizId },
      data: { activeBlockId: null },
    })
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: instanceId },
    })
    const last = await prisma.elementBlock.update({
      where: { id: newerBlockId },
      data: {
        status: 'EXECUTED',
        closedAt,
        elements: {
          create: [
            {
              type: 'LIVE_QUIZ',
              elementId: instance.elementId,
              elementType: 'SC',
              ownerId,
              order: 0,
              options: {},
              elementData: instance.elementData,
              results: instance.results,
              anonymousResults: instance.anonymousResults,
            },
          ],
        },
      },
      include: { elements: true },
    })
    const lastInfo = `lq:${quizId}:i:${last.elements[0]!.id}:info`
    const lastResults = `lq:${quizId}:i:${last.elements[0]!.id}:results`
    await redis.hset(lastInfo, {
      blockExecution: 0,
      blockStartedAt: closedAt.getTime(),
    })
    await redis.hset(lastResults, { participants: 1, '0': 1 })
    const lastInput = {
      ...input(),
      blockId: newerBlockId,
      blockExecution: 0,
      blockStartedAt: closedAt.toISOString(),
    }
    await redis.hset(infoKey(), 'blockExecution', 3)
    await expect(
      handleStandardLiveQuizBlockClosureAggregation(
        lastInput,
        globalCtx,
        executionCtx
      )
    ).rejects.toThrow()
    expect(await redis.ttl(lastResults)).toBe(-1)
    await redis.hset(infoKey(), 'blockExecution', 2)
    await handleStandardLiveQuizBlockClosureAggregation(
      lastInput,
      globalCtx,
      executionCtx
    )
    expect(await redis.ttl(lastResults)).toBeGreaterThan(86390)
    expect(await redis.ttl(resultsKey())).toBeGreaterThan(86390)
  })
})
