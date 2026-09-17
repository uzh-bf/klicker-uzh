import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementInstanceType,
  ElementType,
  PermissionLevel,
  type PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import type { ContextWithUser } from '../src/lib/context.js'
import { duplicateCourse } from '../src/services/courseDuplication.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'
import { userFour, userOne, userThree, userTwo } from './userData.js'

// Ownership of an activity is carried by its owner column, not by a permission
// row. Duplication always makes the duplicating user the owner of the copy, so
// without an explicit grant the activity's original owner would silently lose
// access to the copied activity.
describe('Integration tests for course duplication permissions', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

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
    const { userOneCtx: ctx1, userTwoCtx: ctx2 } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )

    userOneCtx = ctx1
    userTwoCtx = ctx2
  })

  afterEach(async () => await testCleanup(prisma))

  async function seedSingleChoiceElement(ownerId: string) {
    return await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Single Choice Question',
        content: 'What is the capital of Switzerland?',
        options: {
          choices: [
            { ix: 0, value: 'Zurich', correct: false },
            { ix: 1, value: 'Bern', correct: true },
          ],
          displayMode: 'LIST',
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
        ownerId,
      },
    })
  }

  async function seedLiveQuizWithElement({
    courseId,
    elementId,
    ownerId,
  }: {
    courseId: string
    elementId: number
    ownerId: string
  }) {
    const element = await prisma.element.findUniqueOrThrow({
      where: { id: elementId },
    })
    const elementData = processElementData(element)

    return await prisma.liveQuiz.create({
      data: {
        name: 'Live Quiz',
        displayName: 'Live Quiz',
        status: PublicationStatus.DRAFT,
        courseId,
        ownerId,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementId,
                    elementType: ElementType.SC,
                    options: { pointsMultiplier: 1, basePoints: false },
                    elementData,
                    results: getInitialInstanceResults(elementData),
                    anonymousResults: getInitialInstanceResults(elementData),
                    ownerId,
                  },
                ],
              },
            },
          ],
        },
      },
    })
  }

  const duplicationArgs = (sourceCourseId: string) => ({
    name: 'Duplicated Course',
    displayName: 'Duplicated Course',
    description: 'Duplicated course',
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    language: 'en' as const,
    isGamificationEnabled: true,
    sourceCourseId,
    duplicateLiveQuizzes: true,
  })

  // the copy of an activity is identified by the element it shares with the source
  async function getCopiedLiveQuizForElement(
    targetCourseId: string,
    elementId: number
  ) {
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: {
        elementId,
        elementBlock: { liveQuiz: { courseId: targetCourseId } },
      },
      include: { elementBlock: { include: { liveQuiz: true } } },
    })

    return instance.elementBlock!.liveQuiz
  }

  it('grants the original activity owner ADMIN on their copied activity only', async () => {
    const course = await seedCourse({}, userOneCtx)
    const elementOne = await seedSingleChoiceElement(userOne.sub)
    const elementThree = await seedSingleChoiceElement(userThree.sub)
    await seedLiveQuizWithElement({
      courseId: course.id,
      elementId: elementOne.id,
      ownerId: userOne.sub,
    })
    await seedLiveQuizWithElement({
      courseId: course.id,
      elementId: elementThree.id,
      ownerId: userThree.sub,
    })

    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    await prisma.permission.create({
      data: {
        userId: userTwo.sub,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const duplicatedCourse = await duplicateCourse(
      duplicationArgs(course.id),
      userTwoCtx
    )
    expect(duplicatedCourse).toBeTruthy()

    const copiedLiveQuizzes = await prisma.liveQuiz.findMany({
      where: { courseId: duplicatedCourse!.id },
    })
    expect(copiedLiveQuizzes).toHaveLength(2)
    expect(
      copiedLiveQuizzes.every((liveQuiz) => liveQuiz.ownerId === userTwo.sub)
    ).toBe(true)

    const copiedLiveQuizOne = await getCopiedLiveQuizForElement(
      duplicatedCourse!.id,
      elementOne.id
    )
    const copiedLiveQuizThree = await getCopiedLiveQuizForElement(
      duplicatedCourse!.id,
      elementThree.id
    )

    // the source owner keeps direct and derived ADMIN access on the copy
    const directAdminOne = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: copiedLiveQuizOne.id,
          userId: userOne.sub,
        },
      },
    })
    expect(directAdminOne).toBeTruthy()
    expect(directAdminOne!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedAdminOne = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: copiedLiveQuizOne.id,
          userId: userOne.sub,
        },
      },
    })
    expect(derivedAdminOne).toBeTruthy()
    expect(derivedAdminOne!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const directAdminThree = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: copiedLiveQuizThree.id,
          userId: userThree.sub,
        },
      },
    })
    expect(directAdminThree).toBeTruthy()
    expect(directAdminThree!.permissionLevel).toBe(PermissionLevel.ADMIN)

    // the grant is scoped to the activity the source owner actually owned
    expect(
      await prisma.permission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: copiedLiveQuizOne.id,
            userId: userThree.sub,
          },
        },
      })
    ).toBeNull()
    expect(
      await prisma.permission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: copiedLiveQuizThree.id,
            userId: userOne.sub,
          },
        },
      })
    ).toBeNull()
  })

  it('also copies the direct permissions of the source activity', async () => {
    const course = await seedCourse({}, userOneCtx)
    const elementOne = await seedSingleChoiceElement(userOne.sub)
    const liveQuizOne = await seedLiveQuizWithElement({
      courseId: course.id,
      elementId: elementOne.id,
      ownerId: userOne.sub,
    })

    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    await prisma.permission.create({
      data: {
        userId: userTwo.sub,
        courseId: course.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await prisma.permission.create({
      data: {
        userId: userFour.sub,
        liveQuizId: liveQuizOne.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const duplicatedCourse = await duplicateCourse(
      duplicationArgs(course.id),
      userTwoCtx
    )
    expect(duplicatedCourse).toBeTruthy()

    const copiedLiveQuiz = await getCopiedLiveQuizForElement(
      duplicatedCourse!.id,
      elementOne.id
    )
    expect(copiedLiveQuiz.ownerId).toBe(userTwo.sub)

    const copiedDirectPermission = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: copiedLiveQuiz.id,
          userId: userFour.sub,
        },
      },
    })
    expect(copiedDirectPermission).toBeTruthy()
    expect(copiedDirectPermission!.permissionLevel).toBe(PermissionLevel.READ)

    const ownerGrant = await prisma.permission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: copiedLiveQuiz.id,
          userId: userOne.sub,
        },
      },
    })
    expect(ownerGrant).toBeTruthy()
    expect(ownerGrant!.permissionLevel).toBe(PermissionLevel.ADMIN)
  })
})
