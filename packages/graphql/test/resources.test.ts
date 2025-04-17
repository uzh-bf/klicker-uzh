import { PrismaClient } from '@klicker-uzh/prisma'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('Unit tests for resource management (e.g. answer collections)', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser
  let userFiveCtx: ContextWithUser

  beforeAll(async () => {
    const { prisma: newPrisma, emitter: newEmitter } = await initializePrisma()
    prisma = newPrisma
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const {
      userOneCtx: ctx1,
      userTwoCtx: ctx2,
      userThreeCtx: ctx3,
      userFourCtx: ctx4,
      userFiveCtx: ctx5,
    } = await testInitialization(prisma, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
    userFiveCtx = ctx5
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  // ! Answer Collection Management
  // #region
  // TODO: IMPLEMENT / RE-USE FROM SHARING TEST SUITE
  it('SIMPLE TEST', async () => {
    expect(true).toBe(true)
  })
  // #endregion
})
