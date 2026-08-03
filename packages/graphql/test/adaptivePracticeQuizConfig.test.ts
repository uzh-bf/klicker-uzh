import { prisma } from '@klicker-uzh/prisma'
import { registerAdaptivePracticeQuizConfigAuthoringTests } from './adaptivePracticeQuizConfigAuthoringSuite.js'
import { registerAdaptivePracticeQuizConfigAuthorizationTests } from './adaptivePracticeQuizConfigAuthorizationSuite.js'
import { registerAdaptivePracticeQuizConfigContractTests } from './adaptivePracticeQuizConfigContractSuite.js'
import { registerAdaptivePracticeQuizConfigPublicationTests } from './adaptivePracticeQuizConfigPublicationSuite.js'
import { registerAdaptivePracticeQuizConfigReadinessTests } from './adaptivePracticeQuizConfigReadinessSuite.js'
import { cleanup } from './adaptivePracticeQuizConfigTestSupport.js'

describe('adaptive practice quiz configuration and publication', () => {
  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  registerAdaptivePracticeQuizConfigContractTests()
  registerAdaptivePracticeQuizConfigAuthoringTests()
  registerAdaptivePracticeQuizConfigReadinessTests()
  registerAdaptivePracticeQuizConfigPublicationTests()
  registerAdaptivePracticeQuizConfigAuthorizationTests()
})
