import { prisma } from '@klicker-uzh/prisma'
import { registerAdaptivePracticeQuizAttemptFlowTests } from './adaptivePracticeQuizAttemptFlowSuite.js'
import { registerAdaptivePracticeQuizOutcomeTests } from './adaptivePracticeQuizOutcomesSuite.js'
import { registerAdaptivePracticeQuizRetentionTests } from './adaptivePracticeQuizRetentionSuite.js'
import { registerAdaptivePracticeQuizRetryTests } from './adaptivePracticeQuizRetrySuite.js'
import { registerAdaptivePracticeQuizRuntimeLifecycleTests } from './adaptivePracticeQuizRuntimeLifecycleSuite.js'

describe('adaptive practice quiz service', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "Participant" RESTART IDENTITY CASCADE'
    )
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  registerAdaptivePracticeQuizRuntimeLifecycleTests()
  registerAdaptivePracticeQuizRetentionTests()
  registerAdaptivePracticeQuizAttemptFlowTests()
  registerAdaptivePracticeQuizOutcomeTests()
  registerAdaptivePracticeQuizRetryTests()
})
