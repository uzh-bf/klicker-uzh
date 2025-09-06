import {
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { deleteLiveQuiz } from 'src/services/liveQuizzes.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  initializePrisma,
  seedCourse,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userFive, userFour, userThree, userTwo } from './userData.js'

describe('Integration tests for assessment configuration functionalities', () => {
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

  describe('Integration tests for restrictions that need to be enforced for assessment activities', () => {
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

    it('Verify that assessment live quizzes can only be deleted in draft state and only by course admins / owners', async () => {
      // seed courses
      const { assessment } = await seedCourses()

      // share the assessment course directly with user two (admin permissions)
      await prisma.permission.create({
        data: {
          userId: userTwo.id,
          courseId: assessment.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      })
      await recomputeDerivedPermissions({ courseId: assessment.id }, prisma)

      // share the assessment course directly with users three, four, and five (editor, execution, and viewer permissions)
      await prisma.permission.createMany({
        data: [
          {
            userId: userThree.id,
            courseId: assessment.id,
            permissionLevel: PermissionLevel.WRITE,
          },
          {
            userId: userFour.id,
            courseId: assessment.id,
            permissionLevel: PermissionLevel.EXECUTE,
          },
          {
            userId: userFive.id,
            courseId: assessment.id,
            permissionLevel: PermissionLevel.READ,
          },
        ],
      })
      await recomputeDerivedPermissions({ courseId: assessment.id }, prisma)

      // seed multiple live quizzes in different states
      const draftQuiz1 = await seedLiveQuiz(
        {
          elements: [],
          status: PublicationStatus.DRAFT,
          courseId: assessment.id,
        },
        userOneCtx
      )
      const draftQuiz2 = await seedLiveQuiz(
        {
          elements: [],
          status: PublicationStatus.DRAFT,
          courseId: assessment.id,
        },
        userOneCtx
      )
      const scheduledQuiz1 = await seedLiveQuiz(
        {
          elements: [],
          status: PublicationStatus.SCHEDULED,
          courseId: assessment.id,
        },
        userOneCtx
      )
      const scheduledQuiz2 = await seedLiveQuiz(
        {
          elements: [],
          status: PublicationStatus.SCHEDULED,
          courseId: assessment.id,
        },
        userOneCtx
      )
      const runningQuiz = await seedLiveQuiz(
        {
          elements: [],
          status: PublicationStatus.PUBLISHED,
          courseId: assessment.id,
        },
        userOneCtx
      )
      const endedQuiz = await seedLiveQuiz(
        {
          elements: [],
          status: PublicationStatus.ENDED,
          courseId: assessment.id,
        },
        userOneCtx
      )
      await recomputeDerivedPermissions({ courseId: assessment.id }, prisma)

      // draft assessment live quizzes can only be deleted by a course admin or owner
      const res1 = await deleteLiveQuiz({ id: draftQuiz1.id }, userThreeCtx)
      expect(res1).toBeNull()
      const res2 = await deleteLiveQuiz({ id: draftQuiz1.id }, userFourCtx)
      expect(res2).toBeNull()
      const res3 = await deleteLiveQuiz({ id: draftQuiz1.id }, userFiveCtx)
      expect(res3).toBeNull()

      const res4 = await deleteLiveQuiz({ id: draftQuiz1.id }, userTwoCtx)
      expect(res4).not.toBeNull()
      expect(res4?.id).toEqual(draftQuiz1.id)

      const res5 = await deleteLiveQuiz({ id: draftQuiz2.id }, userOneCtx)
      expect(res5).not.toBeNull()
      expect(res5?.id).toEqual(draftQuiz2.id)

      // scheduled assessment live quizzes can only be deleted by a course admin or owner
      const res6 = await deleteLiveQuiz({ id: scheduledQuiz1.id }, userThreeCtx)
      expect(res6).toBeNull()
      const res7 = await deleteLiveQuiz({ id: scheduledQuiz1.id }, userFourCtx)
      expect(res7).toBeNull()
      const res8 = await deleteLiveQuiz({ id: scheduledQuiz1.id }, userFiveCtx)
      expect(res8).toBeNull()

      const res9 = await deleteLiveQuiz({ id: scheduledQuiz1.id }, userTwoCtx)
      expect(res9).not.toBeNull()
      expect(res9?.id).toEqual(scheduledQuiz1.id)

      const res10 = await deleteLiveQuiz({ id: scheduledQuiz2.id }, userOneCtx)
      expect(res10).not.toBeNull()
      expect(res10?.id).toEqual(scheduledQuiz2.id)

      // running assessment live quizzes cannot be deleted
      const res11 = await deleteLiveQuiz({ id: runningQuiz.id }, userOneCtx)
      expect(res11).toBeNull()
      const res12 = await deleteLiveQuiz({ id: runningQuiz.id }, userTwoCtx)
      expect(res12).toBeNull()
      const res13 = await deleteLiveQuiz({ id: runningQuiz.id }, userThreeCtx)
      expect(res13).toBeNull()
      const res14 = await deleteLiveQuiz({ id: runningQuiz.id }, userFourCtx)
      expect(res14).toBeNull()
      const res15 = await deleteLiveQuiz({ id: runningQuiz.id }, userFiveCtx)
      expect(res15).toBeNull()

      // ended assessment live quizzes cannot be deleted
      const res16 = await deleteLiveQuiz({ id: endedQuiz.id }, userOneCtx)
      expect(res16).toBeNull()
      const res17 = await deleteLiveQuiz({ id: endedQuiz.id }, userTwoCtx)
      expect(res17).toBeNull()
      const res18 = await deleteLiveQuiz({ id: endedQuiz.id }, userThreeCtx)
      expect(res18).toBeNull()
      const res19 = await deleteLiveQuiz({ id: endedQuiz.id }, userFourCtx)
      expect(res19).toBeNull()
      const res20 = await deleteLiveQuiz({ id: endedQuiz.id }, userFiveCtx)
      expect(res20).toBeNull()
    })
  })
})
