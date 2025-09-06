import {
  ElementBlockStatus,
  ElementType,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  cancelLiveQuiz,
  deleteLiveQuiz,
  manipulateLiveQuiz,
} from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCourse,
  seedElements,
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

    it('Verify that only assessment course owners and admins can remove activities from the course', async () => {
      // seed courses
      const { assessment, gamifiedAssessment } = await seedCourses()

      // share the assessment course directly with user two (admin permissions)
      await prisma.permission.create({
        data: {
          userId: userTwo.id,
          courseId: assessment.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      })
      await recomputeDerivedPermissions({ courseId: assessment.id }, prisma)

      // share the gamified assessment course directly with user two (admin permissions)
      await prisma.permission.create({
        data: {
          userId: userTwo.id,
          courseId: gamifiedAssessment.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
      })
      await recomputeDerivedPermissions(
        { courseId: gamifiedAssessment.id },
        prisma
      )

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

      // share the gamified assessment course directly with users three, four, and five (editor, execution, and viewer permissions)
      await prisma.permission.createMany({
        data: [
          {
            userId: userThree.id,
            courseId: gamifiedAssessment.id,
            permissionLevel: PermissionLevel.WRITE,
          },
          {
            userId: userFour.id,
            courseId: gamifiedAssessment.id,
            permissionLevel: PermissionLevel.EXECUTE,
          },
          {
            userId: userFive.id,
            courseId: gamifiedAssessment.id,
            permissionLevel: PermissionLevel.READ,
          },
        ],
      })
      await recomputeDerivedPermissions(
        { courseId: gamifiedAssessment.id },
        prisma
      )

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
        userTwoCtx
      )
      const draftQuiz3 = await seedLiveQuiz(
        {
          elements: [],
          status: PublicationStatus.DRAFT,
          courseId: assessment.id,
        },
        userThreeCtx
      )
      await recomputeDerivedPermissions({ courseId: assessment.id }, prisma)

      // general arguments used for manipulation function calls
      const args = {
        name: '',
        displayName: '',
        blocks: [],
        multiplier: 1,
        isGamificationEnabled: true,
        isPinProtected: true,
        isConfusionFeedbackEnabled: true,
        isLiveQAEnabled: true,
        isModerationEnabled: true,
      }

      // verify that only course admins and owners can change the course assignment away from the assessment course
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz1.id, courseId: gamifiedAssessment.id },
          userThreeCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz1.id, courseId: gamifiedAssessment.id },
          userFourCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz1.id, courseId: gamifiedAssessment.id },
          userFiveCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )
      const res4 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz1.id, courseId: gamifiedAssessment.id },
        userTwoCtx
      )
      expect(res4).not.toBeNull()
      expect(res4?.courseId).toEqual(gamifiedAssessment.id)

      const res5 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz1.id, courseId: assessment.id },
        userTwoCtx
      )
      expect(res5).not.toBeNull()
      expect(res5?.courseId).toEqual(assessment.id)

      const res6 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz2.id, courseId: gamifiedAssessment.id },
        userOneCtx
      )
      expect(res6).not.toBeNull()
      expect(res6?.courseId).toEqual(gamifiedAssessment.id)

      // verify the same for the second quiz, owned by the admin user
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz2.id, courseId: assessment.id },
          userThreeCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz2.id, courseId: assessment.id },
          userFourCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz2.id, courseId: assessment.id },
          userFiveCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )

      const res10 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz2.id, courseId: gamifiedAssessment.id },
        userTwoCtx
      )
      expect(res10).not.toBeNull()
      expect(res10?.courseId).toEqual(gamifiedAssessment.id)

      const res11 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz2.id, courseId: assessment.id },
        userTwoCtx
      )
      expect(res11).not.toBeNull()
      expect(res11?.courseId).toEqual(assessment.id)

      const res12 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz3.id, courseId: gamifiedAssessment.id },
        userOneCtx
      )
      expect(res12).not.toBeNull()
      expect(res12?.courseId).toEqual(gamifiedAssessment.id)

      // verify the same for the third course, owned by the editor user
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz3.id, courseId: assessment.id },
          userThreeCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz3.id, courseId: assessment.id },
          userFourCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )
      await expect(
        manipulateLiveQuiz(
          { ...args, id: draftQuiz3.id, courseId: assessment.id },
          userFiveCtx
        )
      ).rejects.toThrow(
        'Assessment live quizzes can only be modified by course admins or owners'
      )

      const res16 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz3.id, courseId: gamifiedAssessment.id },
        userTwoCtx
      )
      expect(res16).not.toBeNull()
      expect(res16?.courseId).toEqual(gamifiedAssessment.id)

      const res17 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz3.id, courseId: assessment.id },
        userTwoCtx
      )
      expect(res17).not.toBeNull()
      expect(res17?.courseId).toEqual(assessment.id)

      const res18 = await manipulateLiveQuiz(
        { ...args, id: draftQuiz3.id, courseId: gamifiedAssessment.id },
        userOneCtx
      )
      expect(res18).not.toBeNull()
      expect(res18?.courseId).toEqual(gamifiedAssessment.id)
    })

    it('Verify that assessment live quizzes cannot be aborted once at least one block has been started', async () => {
      // seed courses
      const { assessment } = await seedCourses()

      // create three different live quizzes in the assessment course
      const { AC1: AC } = await seedAnswerCollections(userOneCtx)
      const { SC, MC } = await seedElements(userOneCtx, AC!.id)
      const quiz1 = await seedLiveQuiz(
        {
          elements: [
            { id: SC.id, type: ElementType.SC },
            { id: MC.id, type: ElementType.MC },
          ],
          status: PublicationStatus.PUBLISHED,
          courseId: assessment.id,
        },
        userOneCtx
      )
      const quiz2 = await seedLiveQuiz(
        {
          elements: [
            { id: SC.id, type: ElementType.SC },
            { id: MC.id, type: ElementType.MC },
          ],
          status: PublicationStatus.PUBLISHED,
          courseId: assessment.id,
        },
        userOneCtx
      )
      const quiz3 = await seedLiveQuiz(
        {
          elements: [
            { id: SC.id, type: ElementType.SC },
            { id: MC.id, type: ElementType.MC },
          ],
          status: PublicationStatus.PUBLISHED,
          courseId: assessment.id,
        },
        userOneCtx
      )
      await recomputeDerivedPermissions({ courseId: assessment.id }, prisma)

      // activate the first block for the second quiz and complete it for the second quiz
      await prisma.elementBlock.update({
        where: { id: quiz2.blocks[0]!.id },
        data: {
          status: ElementBlockStatus.ACTIVE,
          activeInLiveQuiz: { connect: { id: quiz2.id } },
        },
      })

      // activate and close the first block for the third quiz
      await prisma.elementBlock.update({
        where: { id: quiz3.blocks[0]!.id },
        data: { status: ElementBlockStatus.EXECUTED },
      })

      // verify that only the first quiz can be aborted (no quiz active yet)
      const res1 = await cancelLiveQuiz({ id: quiz1.id }, userOneCtx)
      expect(res1).not.toBeNull()
      expect(res1?.status).toEqual(PublicationStatus.DRAFT)

      const res2 = await cancelLiveQuiz({ id: quiz2.id }, userOneCtx)
      expect(res2).toBeNull()

      const res3 = await cancelLiveQuiz({ id: quiz3.id }, userOneCtx)
      expect(res3).toBeNull()
    })
  })
})
