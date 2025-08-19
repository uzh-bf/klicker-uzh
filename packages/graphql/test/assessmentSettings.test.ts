import { ElementOrderType, PrismaClient } from '@klicker-uzh/prisma'
import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'
import type { ContextWithUser } from '../src/lib/context.js'
import { manipulateGroupActivity } from '../src/services/groups.js'
import { manipulateLiveQuiz } from '../src/services/liveQuizzes.js'
import { manipulateMicroLearning } from '../src/services/microLearning.js'
import { manipulatePracticeQuiz } from '../src/services/practiceQuizzes.js'
import {
  initializePrisma,
  seedCourse,
  seedGroupActivity,
  seedLiveQuiz,
  seedMicroLearning,
  seedPracticeQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Unit tests for assessment configuration functionalities', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser

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
    const { userOneCtx: ctx1 } = await testInitialization(prisma, emitter)
    userOneCtx = ctx1
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  describe('Unit tests for assessment settings on courses and activities', () => {
    // set default booleans for irrelevant interaction settings
    const isConfusionFeedbackEnabled = false
    const isLiveQAEnabled = false
    const isModerationEnabled = false

    // helper function to seed courses with different gamification and assessment settings
    async function seedCourses() {
      const nonGamified = await seedCourse(
        { isGamificationEnabled: false, isAssessmentEnabled: false },
        userOneCtx
      )
      const gamified = await seedCourse(
        { isGamificationEnabled: true, isAssessmentEnabled: false },
        userOneCtx
      )
      const assessment = await seedCourse(
        { isAssessmentEnabled: true, isGamificationEnabled: false },
        userOneCtx
      )
      const gamifiedAssessment = await seedCourse(
        { isGamificationEnabled: true, isAssessmentEnabled: true },
        userOneCtx
      )

      return { nonGamified, gamified, assessment, gamifiedAssessment }
    }

    it('Verify that booleans on live quizzes are set correctly when assigning it to courses', async () => {
      // seed courses
      const { nonGamified, gamified, assessment, gamifiedAssessment } =
        await seedCourses()

      // Case 1: Manipulate a live quiz without course assignment and gamification enabled (create and edit)
      const liveQuiz1 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: true,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: null,
        },
        userOneCtx
      )
      expect(liveQuiz1.id).not.toBeNull()
      expect(liveQuiz1.isGamificationEnabled).toBe(true)
      expect(liveQuiz1.isAssessmentEnabled).toBe(false)

      const liveQuiz2 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz2Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz2.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: true,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: null,
        },
        userOneCtx
      )
      expect(liveQuiz2Edited.isGamificationEnabled).toBe(true)
      expect(liveQuiz2Edited.isAssessmentEnabled).toBe(false)

      // Case 2: Manipulate a live quiz without course assignment and gamification disabled (create and edit)
      const liveQuiz3 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: null,
        },
        userOneCtx
      )
      expect(liveQuiz3.id).not.toBeNull()
      expect(liveQuiz3.isGamificationEnabled).toBe(false)
      expect(liveQuiz3.isAssessmentEnabled).toBe(false)

      const liveQuiz4 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz4Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz4.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: null,
        },
        userOneCtx
      )
      expect(liveQuiz4Edited.isGamificationEnabled).toBe(false)
      expect(liveQuiz4Edited.isAssessmentEnabled).toBe(false)

      // Case 3: Manipulate a live quiz with gamified course assignment and check that gamification setting is ignored (create and edit)
      const liveQuiz5 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(liveQuiz5.isGamificationEnabled).toBe(true)
      expect(liveQuiz5.isAssessmentEnabled).toBe(false)

      const liveQuiz6 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz6Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz6.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(liveQuiz6Edited.isGamificationEnabled).toBe(true)
      expect(liveQuiz6Edited.isAssessmentEnabled).toBe(false)

      // Case 4: Manipulate a live quiz with non-gamified course assignment and check that gamification setting is set (create and edit)
      const liveQuiz7 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: true,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(liveQuiz7.isGamificationEnabled).toBe(true)
      expect(liveQuiz7.isAssessmentEnabled).toBe(false)

      const liveQuiz8 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz8Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz8.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: true,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(liveQuiz8Edited.isGamificationEnabled).toBe(true)
      expect(liveQuiz8Edited.isAssessmentEnabled).toBe(false)

      // Case 5: Manipulate a live quiz with assessment enabled course assignment (create and edit)
      const liveQuiz9 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(liveQuiz9.isGamificationEnabled).toBe(false)
      expect(liveQuiz9.isAssessmentEnabled).toBe(true)

      const liveQuiz10 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz10Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz10.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(liveQuiz10Edited.isGamificationEnabled).toBe(false)
      expect(liveQuiz10Edited.isAssessmentEnabled).toBe(true)

      // Case 6: Manipulate a live quiz with assessment disabled course assignment (create and edit)
      const liveQuiz11 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(liveQuiz11.isGamificationEnabled).toBe(false)
      expect(liveQuiz11.isAssessmentEnabled).toBe(false)

      const liveQuiz12 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz12Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz12.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(liveQuiz12Edited.isGamificationEnabled).toBe(false)
      expect(liveQuiz12Edited.isAssessmentEnabled).toBe(false)

      // Case 7: Manipulate a live quiz assigned to courses with different gamification and assessment setting combinations
      const liveQuiz13 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: true,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(liveQuiz13.isGamificationEnabled).toBe(true)
      expect(liveQuiz13.isAssessmentEnabled).toBe(true)

      const liveQuiz14 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz14Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz14.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: false, // will be overridden by course setting
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(liveQuiz14Edited.isGamificationEnabled).toBe(true)
      expect(liveQuiz14Edited.isAssessmentEnabled).toBe(true)

      // Case 8: Manipulate a live quiz without course assignment and gamification enabled (create and edit)
      const liveQuiz15 = await manipulateLiveQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: true,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: null,
        },
        userOneCtx
      )
      expect(liveQuiz15.id).not.toBeNull()
      expect(liveQuiz15.isGamificationEnabled).toBe(true)
      expect(liveQuiz15.isAssessmentEnabled).toBe(false)

      const liveQuiz16 = await seedLiveQuiz({ elements: [] }, userOneCtx)
      const liveQuiz16Edited = await manipulateLiveQuiz(
        {
          id: liveQuiz16.id,
          name: uuid(),
          displayName: uuid(),
          blocks: [],
          multiplier: 1,
          isGamificationEnabled: true,
          isConfusionFeedbackEnabled,
          isLiveQAEnabled,
          isModerationEnabled,
          courseId: null,
        },
        userOneCtx
      )
      expect(liveQuiz16Edited.isGamificationEnabled).toBe(true)
      expect(liveQuiz16Edited.isAssessmentEnabled).toBe(false)
    })

    it('Verify that booleans on practice quizzes are set correctly when assigning it to courses', async () => {
      // seed courses
      const { nonGamified, gamified, assessment, gamifiedAssessment } =
        await seedCourses()

      // Case 1: Manipulate a practice quiz with gamified course assignment (create and edit)
      const practiceQuiz1 = await manipulatePracticeQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(practiceQuiz1.isGamificationEnabled).toBe(true)
      expect(practiceQuiz1.isAssessmentEnabled).toBe(false)

      const practiceQuiz2 = await seedPracticeQuiz(
        { elements: [], courseId: nonGamified.id },
        userOneCtx
      )
      const practiceQuiz2Edited = await manipulatePracticeQuiz(
        {
          id: practiceQuiz2.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(practiceQuiz2Edited.isGamificationEnabled).toBe(true)
      expect(practiceQuiz2Edited.isAssessmentEnabled).toBe(false)

      // Case 2: Manipulate a practice quiz with non-gamified course assignment (create and edit)
      const practiceQuiz3 = await manipulatePracticeQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(practiceQuiz3.isGamificationEnabled).toBe(false)
      expect(practiceQuiz3.isAssessmentEnabled).toBe(false)

      const practiceQuiz4 = await seedPracticeQuiz(
        { elements: [], courseId: gamified.id },
        userOneCtx
      )
      const practiceQuiz4Edited = await manipulatePracticeQuiz(
        {
          id: practiceQuiz4.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(practiceQuiz4Edited.isGamificationEnabled).toBe(false)
      expect(practiceQuiz4Edited.isAssessmentEnabled).toBe(false)

      // Case 3: Manipulate a practice quiz with assessment enabled course assignment (create and edit)
      const practiceQuiz5 = await manipulatePracticeQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(practiceQuiz5.isGamificationEnabled).toBe(false)
      expect(practiceQuiz5.isAssessmentEnabled).toBe(true)

      const practiceQuiz6 = await seedPracticeQuiz(
        { elements: [], courseId: gamified.id },
        userOneCtx
      )
      const practiceQuiz6Edited = await manipulatePracticeQuiz(
        {
          id: practiceQuiz6.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(practiceQuiz6Edited.isGamificationEnabled).toBe(false)
      expect(practiceQuiz6Edited.isAssessmentEnabled).toBe(true)

      // Case 4: Manipulate a practice quiz assigned to courses with different gamification and assessment setting combinations
      const practiceQuiz7 = await manipulatePracticeQuiz(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(practiceQuiz7.isGamificationEnabled).toBe(true)
      expect(practiceQuiz7.isAssessmentEnabled).toBe(true)

      const practiceQuiz8 = await seedPracticeQuiz(
        { elements: [], courseId: nonGamified.id },
        userOneCtx
      )
      const practiceQuiz8Edited = await manipulatePracticeQuiz(
        {
          id: practiceQuiz8.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(practiceQuiz8Edited.isGamificationEnabled).toBe(true)
      expect(practiceQuiz8Edited.isAssessmentEnabled).toBe(true)
    })

    it('Verify that booleans on microlearning are set correctly when assigning it to courses', async () => {
      // seed courses
      const { nonGamified, gamified, assessment, gamifiedAssessment } =
        await seedCourses()

      // Case 1: Manipulate a microlearning with gamified course assignment (create and edit)
      const microlearning1 = await manipulateMicroLearning(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(microlearning1.isGamificationEnabled).toBe(true)
      expect(microlearning1.isAssessmentEnabled).toBe(false)

      const microlearning2 = await seedMicroLearning(
        { elements: [], courseId: nonGamified.id },
        userOneCtx
      )
      const microlearning2Edited = await manipulateMicroLearning(
        {
          id: microlearning2.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(microlearning2Edited.isGamificationEnabled).toBe(true)
      expect(microlearning2Edited.isAssessmentEnabled).toBe(false)

      // Case 2: Manipulate a microlearning with non-gamified course assignment (create and edit)
      const microlearning3 = await manipulateMicroLearning(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(microlearning3.isGamificationEnabled).toBe(false)
      expect(microlearning3.isAssessmentEnabled).toBe(false)

      const microlearning4 = await seedMicroLearning(
        { elements: [], courseId: gamified.id },
        userOneCtx
      )
      const microlearning4Edited = await manipulateMicroLearning(
        {
          id: microlearning4.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(microlearning4Edited.isGamificationEnabled).toBe(false)
      expect(microlearning4Edited.isAssessmentEnabled).toBe(false)

      // Case 3: Manipulate a microlearning with assessment enabled course assignment (create and edit)
      const microlearning5 = await manipulateMicroLearning(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(microlearning5.isGamificationEnabled).toBe(false)
      expect(microlearning5.isAssessmentEnabled).toBe(true)

      const microlearning6 = await seedMicroLearning(
        { elements: [], courseId: gamified.id },
        userOneCtx
      )
      const microlearning6Edited = await manipulateMicroLearning(
        {
          id: microlearning6.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(microlearning6Edited.isGamificationEnabled).toBe(false)
      expect(microlearning6Edited.isAssessmentEnabled).toBe(true)

      // Case 4: Manipulate a microlearning assigned to courses with different gamification and assessment setting combinations
      const microlearning7 = await manipulateMicroLearning(
        {
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(microlearning7.isGamificationEnabled).toBe(true)
      expect(microlearning7.isAssessmentEnabled).toBe(true)

      const microlearning8 = await seedMicroLearning(
        { elements: [], courseId: nonGamified.id },
        userOneCtx
      )
      const microlearning8Edited = await manipulateMicroLearning(
        {
          id: microlearning8.id,
          name: uuid(),
          displayName: uuid(),
          stacks: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(microlearning8Edited.isGamificationEnabled).toBe(true)
      expect(microlearning8Edited.isAssessmentEnabled).toBe(true)
    })

    it('Verify that booleans on group activities are set correctly when assigning it to courses', async () => {
      // seed courses
      const { nonGamified, gamified, assessment, gamifiedAssessment } =
        await seedCourses()

      // Case 1: Manipulate a group with gamified course assignment (create and edit)
      const groupActivity1 = await manipulateGroupActivity(
        {
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(groupActivity1.isGamificationEnabled).toBe(true)
      expect(groupActivity1.isAssessmentEnabled).toBe(false)

      const groupActivity2 = await seedGroupActivity(
        { elements: [], courseId: nonGamified.id },
        userOneCtx
      )
      const groupActivity2Edited = await manipulateGroupActivity(
        {
          id: groupActivity2.id,
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamified.id,
        },
        userOneCtx
      )
      expect(groupActivity2Edited.isGamificationEnabled).toBe(true)
      expect(groupActivity2Edited.isAssessmentEnabled).toBe(false)

      // Case 2: Manipulate a group with non-gamified course assignment (create and edit)
      const groupActivity3 = await manipulateGroupActivity(
        {
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(groupActivity3.isGamificationEnabled).toBe(false)
      expect(groupActivity3.isAssessmentEnabled).toBe(false)

      const groupActivity4 = await seedGroupActivity(
        { elements: [], courseId: gamified.id },
        userOneCtx
      )
      const groupActivity4Edited = await manipulateGroupActivity(
        {
          id: groupActivity4.id,
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: nonGamified.id,
        },
        userOneCtx
      )
      expect(groupActivity4Edited.isGamificationEnabled).toBe(false)
      expect(groupActivity4Edited.isAssessmentEnabled).toBe(false)

      // Case 3: Manipulate a group with assessment enabled course assignment (create and edit)
      const groupActivity5 = await manipulateGroupActivity(
        {
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(groupActivity5.isGamificationEnabled).toBe(false)
      expect(groupActivity5.isAssessmentEnabled).toBe(true)

      const groupActivity6 = await seedGroupActivity(
        { elements: [], courseId: gamified.id },
        userOneCtx
      )
      const groupActivity6Edited = await manipulateGroupActivity(
        {
          id: groupActivity6.id,
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: assessment.id,
        },
        userOneCtx
      )
      expect(groupActivity6Edited.isGamificationEnabled).toBe(false)
      expect(groupActivity6Edited.isAssessmentEnabled).toBe(true)

      // Case 4: Manipulate a group assigned to courses with different gamification and assessment setting combinations
      const groupActivity7 = await manipulateGroupActivity(
        {
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(groupActivity7.isGamificationEnabled).toBe(true)
      expect(groupActivity7.isAssessmentEnabled).toBe(true)

      const groupActivity8 = await seedGroupActivity(
        { elements: [], courseId: nonGamified.id },
        userOneCtx
      )
      const groupActivity8Edited = await manipulateGroupActivity(
        {
          id: groupActivity8.id,
          name: uuid(),
          displayName: uuid(),
          description: 'Task',
          stack: { order: 0, elements: [] },
          clues: [],
          multiplier: 1,
          startDate: new Date(),
          endDate: new Date(),
          courseId: gamifiedAssessment.id,
        },
        userOneCtx
      )
      expect(groupActivity8Edited.isGamificationEnabled).toBe(true)
      expect(groupActivity8Edited.isAssessmentEnabled).toBe(true)
    })
  })
})
