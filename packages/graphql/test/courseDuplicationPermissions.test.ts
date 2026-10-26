import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementInstanceType,
  ElementStackType,
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

type DuplicationSelection = {
  duplicateLiveQuizzes?: boolean
  duplicatePracticeQuizzes?: boolean
  duplicateMicrolearnings?: boolean
  duplicateGroupActivities?: boolean
  isGroupCreationEnabled?: boolean
}

type DuplicatedActivity = {
  id: string
  ownerId: string
  directPermissions: {
    id: number
    userId: string | null
    permissionLevel: PermissionLevel
  }[]
  derivedPermissions: {
    userId: string
    permissionLevel: PermissionLevel
    directPermissionId: number | null
  }[]
}

type SeedActivityArgs = {
  courseId: string
  elementId: number
  ownerId: string
}

type ActivityTypeCase = {
  label: string
  selection: DuplicationSelection
  seed: (args: SeedActivityArgs) => Promise<unknown>
  copiedActivities: (courseId: string) => Promise<DuplicatedActivity[]>
  copiedIdForElement: (courseId: string, elementId: number) => Promise<string>
}

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

  const duplicationArgs = (
    sourceCourseId: string,
    selection: DuplicationSelection = { duplicateLiveQuizzes: true }
  ) => ({
    name: 'Duplicated Course',
    displayName: 'Duplicated Course',
    description: 'Duplicated course',
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    language: 'en' as const,
    isGamificationEnabled: true,
    sourceCourseId,
    ...selection,
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

  // instance payload for the activity seeds below; the element data is taken
  // from the element so that duplication can duplicate the instance
  async function elementInstanceData({
    elementId,
    ownerId,
    type,
  }: {
    elementId: number
    ownerId: string
    type: ElementInstanceType
  }) {
    const element = await prisma.element.findUniqueOrThrow({
      where: { id: elementId },
    })
    const elementData = processElementData(element)

    return {
      order: 0,
      type,
      elementType: element.type,
      elementId,
      options: { pointsMultiplier: 1, basePoints: false },
      elementData,
      results: getInitialInstanceResults(elementData),
      anonymousResults: getInitialInstanceResults(elementData),
      ownerId,
    }
  }

  async function seedPracticeQuizWithElement({
    courseId,
    elementId,
    ownerId,
  }: SeedActivityArgs) {
    return await prisma.practiceQuiz.create({
      data: {
        name: 'Practice Quiz',
        displayName: 'Practice Quiz',
        status: PublicationStatus.DRAFT,
        courseId,
        ownerId,
        stacks: {
          create: [
            {
              order: 0,
              type: ElementStackType.PRACTICE_QUIZ,
              elements: {
                create: [
                  await elementInstanceData({
                    elementId,
                    ownerId,
                    type: ElementInstanceType.PRACTICE_QUIZ,
                  }),
                ],
              },
            },
          ],
        },
      },
    })
  }

  async function seedMicroLearningWithElement({
    courseId,
    elementId,
    ownerId,
  }: SeedActivityArgs) {
    return await prisma.microLearning.create({
      data: {
        name: 'Microlearning',
        displayName: 'Microlearning',
        status: PublicationStatus.DRAFT,
        courseId,
        ownerId,
        scheduledStartAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        scheduledEndAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        stacks: {
          create: [
            {
              order: 0,
              type: ElementStackType.MICROLEARNING,
              elements: {
                create: [
                  await elementInstanceData({
                    elementId,
                    ownerId,
                    type: ElementInstanceType.MICROLEARNING,
                  }),
                ],
              },
            },
          ],
        },
      },
    })
  }

  async function seedGroupActivityWithElement({
    courseId,
    elementId,
    ownerId,
  }: SeedActivityArgs) {
    return await prisma.groupActivity.create({
      data: {
        name: 'Group Activity',
        displayName: 'Group Activity',
        status: PublicationStatus.DRAFT,
        courseId,
        ownerId,
        scheduledStartAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        scheduledEndAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        stacks: {
          create: [
            {
              order: 0,
              type: ElementStackType.GROUP_ACTIVITY,
              elements: {
                create: [
                  await elementInstanceData({
                    elementId,
                    ownerId,
                    type: ElementInstanceType.GROUP_ACTIVITY,
                  }),
                ],
              },
            },
          ],
        },
      },
    })
  }

  function normalizeActivity(activity: {
    id: string
    ownerId: string
    directPermissions: DuplicatedActivity['directPermissions']
    permissions: DuplicatedActivity['derivedPermissions']
  }): DuplicatedActivity {
    return {
      id: activity.id,
      ownerId: activity.ownerId,
      directPermissions: activity.directPermissions,
      derivedPermissions: activity.permissions,
    }
  }

  const activityTypeCases: ActivityTypeCase[] = [
    {
      label: 'live quiz',
      selection: { duplicateLiveQuizzes: true },
      seed: seedLiveQuizWithElement,
      copiedActivities: async (courseId) =>
        (
          await prisma.liveQuiz.findMany({
            where: { courseId },
            include: { directPermissions: true, permissions: true },
          })
        ).map(normalizeActivity),
      copiedIdForElement: async (courseId, elementId) =>
        (await getCopiedLiveQuizForElement(courseId, elementId)).id,
    },
    {
      label: 'practice quiz',
      selection: { duplicatePracticeQuizzes: true },
      seed: seedPracticeQuizWithElement,
      copiedActivities: async (courseId) =>
        (
          await prisma.practiceQuiz.findMany({
            where: { courseId },
            include: { directPermissions: true, permissions: true },
          })
        ).map(normalizeActivity),
      copiedIdForElement: async (courseId, elementId) => {
        const instance = await prisma.elementInstance.findFirstOrThrow({
          where: { elementId, elementStack: { practiceQuiz: { courseId } } },
          include: {
            elementStack: {
              select: { practiceQuiz: { select: { id: true } } },
            },
          },
        })
        return instance.elementStack!.practiceQuiz!.id
      },
    },
    {
      label: 'microlearning',
      selection: { duplicateMicrolearnings: true },
      seed: seedMicroLearningWithElement,
      copiedActivities: async (courseId) =>
        (
          await prisma.microLearning.findMany({
            where: { courseId },
            include: { directPermissions: true, permissions: true },
          })
        ).map(normalizeActivity),
      copiedIdForElement: async (courseId, elementId) => {
        const instance = await prisma.elementInstance.findFirstOrThrow({
          where: { elementId, elementStack: { microLearning: { courseId } } },
          include: {
            elementStack: {
              select: { microLearning: { select: { id: true } } },
            },
          },
        })
        return instance.elementStack!.microLearning!.id
      },
    },
    {
      label: 'group activity',
      selection: {
        duplicateGroupActivities: true,
        isGroupCreationEnabled: true,
      },
      seed: seedGroupActivityWithElement,
      copiedActivities: async (courseId) =>
        (
          await prisma.groupActivity.findMany({
            where: { courseId },
            include: { directPermissions: true, permissions: true },
          })
        ).map(normalizeActivity),
      copiedIdForElement: async (courseId, elementId) => {
        const instance = await prisma.elementInstance.findFirstOrThrow({
          where: { elementId, elementStack: { groupActivity: { courseId } } },
          include: {
            elementStack: {
              select: { groupActivity: { select: { id: true } } },
            },
          },
        })
        return instance.elementStack!.groupActivity!.id
      },
    },
  ]

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

    // the third-party owner can actually use their copy: the effective
    // permission is backed by the grant on the copied activity, not by any
    // access to the copied course
    const derivedAdminThree = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: copiedLiveQuizThree.id,
          userId: userThree.sub,
        },
      },
    })
    expect(derivedAdminThree).toBeTruthy()
    expect(derivedAdminThree!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedAdminThree!.directPermissionId).toBe(directAdminThree!.id)

    expect(
      await prisma.permission.findUnique({
        where: {
          courseId_userId: {
            courseId: duplicatedCourse!.id,
            userId: userThree.sub,
          },
        },
      })
    ).toBeNull()
    expect(
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: duplicatedCourse!.id,
            userId: userThree.sub,
          },
        },
      })
    ).toBeNull()

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
      await prisma.derivedPermission.findUnique({
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

  it.each(
    activityTypeCases
  )('keeps the original $label owner as ADMIN on the copied $label', async ({
    selection,
    seed,
    copiedActivities,
    copiedIdForElement,
  }) => {
    const course = await seedCourse({}, userOneCtx)
    const elementOne = await seedSingleChoiceElement(userOne.sub)
    const elementThree = await seedSingleChoiceElement(userThree.sub)

    await seed({
      courseId: course.id,
      elementId: elementOne.id,
      ownerId: userOne.sub,
    })
    await seed({
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
      duplicationArgs(course.id, selection),
      userTwoCtx
    )
    expect(duplicatedCourse).toBeTruthy()

    const copied = await copiedActivities(duplicatedCourse!.id)
    expect(copied).toHaveLength(2)
    expect(copied.every((activity) => activity.ownerId === userTwo.sub)).toBe(
      true
    )

    const copiedOneId = await copiedIdForElement(
      duplicatedCourse!.id,
      elementOne.id
    )
    const copiedThreeId = await copiedIdForElement(
      duplicatedCourse!.id,
      elementThree.id
    )
    const copiedOne = copied.find((activity) => activity.id === copiedOneId)!
    const copiedThree = copied.find(
      (activity) => activity.id === copiedThreeId
    )!

    // both source owners keep direct and derived ADMIN access on their copy,
    // with the effective permission of the third-party owner backed by that
    // direct grant
    const directOne = copiedOne.directPermissions.find(
      (permission) => permission.userId === userOne.sub
    )
    const derivedOne = copiedOne.derivedPermissions.find(
      (permission) => permission.userId === userOne.sub
    )
    expect(directOne?.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedOne?.permissionLevel).toBe(PermissionLevel.ADMIN)

    const directThree = copiedThree.directPermissions.find(
      (permission) => permission.userId === userThree.sub
    )
    const derivedThree = copiedThree.derivedPermissions.find(
      (permission) => permission.userId === userThree.sub
    )
    expect(directThree?.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedThree?.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedThree?.directPermissionId).toBe(directThree?.id)

    // the grant is scoped to the copied activity the source owner actually
    // owned: the source course owner holds no direct permission on the
    // activity owned by the third party, and the third party holds no
    // permission of any kind on the activity owned by the course owner
    expect(
      copiedThree.directPermissions.some(
        (permission) => permission.userId === userOne.sub
      )
    ).toBe(false)
    expect(
      copiedOne.directPermissions.some(
        (permission) => permission.userId === userThree.sub
      )
    ).toBe(false)
    expect(
      copiedOne.derivedPermissions.some(
        (permission) => permission.userId === userThree.sub
      )
    ).toBe(false)

    // the source course owner keeps course-derived access to all copied
    // activities, since the copy is collaborative rather than isolated
    expect(
      copiedThree.derivedPermissions.find(
        (permission) => permission.userId === userOne.sub
      )?.permissionLevel
    ).toBe(PermissionLevel.ADMIN)
  })

  it('normalizes a redundant direct permission of the source owner to ADMIN', async () => {
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
    // the source owner additionally holds a lower direct permission on their
    // own activity, which is copied before the owner grant is applied
    await prisma.permission.create({
      data: {
        userId: userOne.sub,
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

    const ownerPermissions = await prisma.permission.findMany({
      where: { liveQuizId: copiedLiveQuiz.id, userId: userOne.sub },
    })
    expect(ownerPermissions).toHaveLength(1)
    expect(ownerPermissions[0]!.permissionLevel).toBe(PermissionLevel.ADMIN)

    const derivedAdmin = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: copiedLiveQuiz.id,
          userId: userOne.sub,
        },
      },
    })
    expect(derivedAdmin).toBeTruthy()
    expect(derivedAdmin!.permissionLevel).toBe(PermissionLevel.ADMIN)
    expect(derivedAdmin!.directPermissionId).toBe(ownerPermissions[0]!.id)
  })
})
