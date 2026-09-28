import { testCleanup } from '@klicker-uzh/adaptive-test-host/helpers'
import { prisma } from '@klicker-uzh/prisma'
import { registerAdaptivePracticeQuizAttemptFlowTests } from './adaptivePracticeQuizAttemptFlowSuite.js'
import { registerAdaptivePracticeQuizOutcomeTests } from './adaptivePracticeQuizOutcomesSuite.js'
import { registerAdaptivePracticeQuizRetentionTests } from './adaptivePracticeQuizRetentionSuite.js'
import { registerAdaptivePracticeQuizRetryTests } from './adaptivePracticeQuizRetrySuite.js'
import { registerAdaptivePracticeQuizRuntimeLifecycleTests } from './adaptivePracticeQuizRuntimeLifecycleSuite.js'

describe('adaptive practice quiz service', () => {
  beforeEach(async () => {
    await testCleanup(prisma)
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  registerAdaptivePracticeQuizRuntimeLifecycleTests()
  registerAdaptivePracticeQuizRetentionTests()
  registerAdaptivePracticeQuizAttemptFlowTests()
  registerAdaptivePracticeQuizOutcomeTests()
  registerAdaptivePracticeQuizRetryTests()
})
