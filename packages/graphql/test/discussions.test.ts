import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { registerAnonymousRateLimitsSuite } from './discussions/anonymous-rate-limits.suite.js'
import { registerContentAndConcurrencySuite } from './discussions/content-and-concurrency.suite.js'
import { registerDeletionPolicySuite } from './discussions/deletion-policy.suite.js'
import { registerGatesAndEmbedAccessSuite } from './discussions/gates-and-embed-access.suite.js'
import { registerScopesSuite } from './discussions/scopes.suite.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('Integration tests for the course discussion platform', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser

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
    const { userOneCtx: ctx1 } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )
    userOneCtx = ctx1
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  const getContext = () => ({ prisma, userOneCtx })

  registerContentAndConcurrencySuite(getContext)
  registerAnonymousRateLimitsSuite(getContext)
  registerGatesAndEmbedAccessSuite(getContext)
  registerDeletionPolicySuite(getContext)
  registerScopesSuite(getContext)
})
