import { allowCoursePurgeInTransaction, prisma } from '@klicker-uzh/prisma'
import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  ElementData,
  ElementInstanceResults,
  ElementOptionsNumerical,
} from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { expect } from 'vitest'
import {
  Course,
  courseArchivedOne,
  courseArchivedTwo,
  courseFive,
  courseFour,
  courseOne,
  courseThree,
  courseTwo,
  User,
  userOne,
  userTwo,
} from './userData.js'

// #region

export async function createElements(
  prisma: PrismaClient,
  n: number,
  user: User
) {
  const elements = []

  for (let i = 1; i <= n; i++) {
    // create the element in the database
    const element = await prisma.element.create({
      data: {
        type: ElementType.NUMERICAL,
        name: `Element ${i}`,
        content: '',
        explanation: undefined,
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          restrictions: undefined,
          solutionRanges: undefined,
          exactSolutions: undefined,
        } as ElementOptionsNumerical,
        owner: {
          connect: {
            id: user.id,
          },
        },
      },
    })

    // recompute the derived permissions for the element owner
    await recomputeDerivedPermissions(
      { elementId: element.id, userId: user.id },
      prisma
    )

    elements.push({
      id: element.id,
      type: element.type as ElementType,
    })
  }

  return elements
}

export async function createCourse(
  prisma: PrismaClient,
  course: Course,
  isGamificationEnabled: boolean,
  isArchived: boolean = false
) {
  const defaultStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // one week ago
  const defaultEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // two weeks in future

  // create course in the database
  const dbCourse = await prisma.course.create({
    data: {
      id: course.id,
      name: course.name,
      displayName: course.name,
      description: '',
      pinCode: Math.floor(Math.random() * 9000 + 1000),
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      groupDeadlineDate: defaultEndDate,
      ownerId: course.owner.id,
      isGamificationEnabled,
      isArchived,
    },
  })

  // recompute the derived permissions for the course owner
  await recomputeDerivedPermissions(
    { courseId: dbCourse.id, userId: course.owner.id },
    prisma
  )
}

export async function createLiveQuiz(
  prisma: PrismaClient,
  course: Course,
  i: number,
  elements: { id: number; type: ElementType }[]
) {
  // create a live quiz in the database
  const dbLiveQuiz = await prisma.liveQuiz.create({
    data: {
      name: `Live Quiz ${i} for ${course.name}`,
      displayName: `Live Quiz ${i} for ${course.name}`,
      description: '',
      courseId: course.id,
      ownerId: course.owner.id,
      blocks: {
        create: elements.map((element, index) => ({
          order: index,
          elements: {
            create: [
              {
                order: 0,
                elementId: element.id,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: element.type,
                options: {},
                elementData: {} as ElementData,
                results: {} as ElementInstanceResults,
                anonymousResults: {} as ElementInstanceResults,
                ownerId: course.owner.id,
              },
            ],
          },
        })),
      },
    },
  })

  // recompute the derived permissions for the course owner
  await recomputeDerivedPermissions(
    { liveQuizId: dbLiveQuiz.id, userId: course.owner.id },
    prisma
  )

  return dbLiveQuiz
}

export async function createPracticeQuiz(
  prisma: PrismaClient,
  course: Course,
  ix: number,
  elements: { id: number; type: ElementType }[]
) {
  // create a practice quiz in the database
  const dbPracticeQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `Practice Quiz ${ix} for ${course.name}`,
      displayName: `Practice Quiz ${ix} for ${course.name}`,
      description: '',
      courseId: course.id,
      ownerId: course.owner.id,
      availableFrom:
        ix > 1 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined, // one week in the future
      stacks: {
        create: elements.map((element, index) => ({
          order: index,
          type: ElementStackType.PRACTICE_QUIZ,
          elements: {
            create: [
              {
                order: 0,
                elementId: element.id,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementType: element.type,
                options: {},
                elementData: {} as ElementData,
                results: {} as ElementInstanceResults,
                anonymousResults: {} as ElementInstanceResults,
                ownerId: course.owner.id,
              },
            ],
          },
        })),
      },
    },
  })

  // recompute the derived permissions for the course owner
  await recomputeDerivedPermissions(
    { practiceQuizId: dbPracticeQuiz.id, userId: course.owner.id },
    prisma
  )

  return dbPracticeQuiz
}

export async function createMicroLearning(
  prisma: PrismaClient,
  course: Course,
  ix: number,
  elements: { id: number; type: ElementType }[]
) {
  // create a microlearning in the database
  const dbMicroLearning = await prisma.microLearning.create({
    data: {
      name: `Microlearning ${ix} for ${course.name}`,
      displayName: `Microlearning ${ix} for ${course.name}`,
      description: '',
      courseId: course.id,
      scheduledStartAt: new Date(Date.now() - ix * 7 * 24 * 60 * 60 * 1000), // ix * one week ago
      scheduledEndAt: new Date(Date.now() + ix * 14 * 24 * 60 * 60 * 1000), // ix * two weeks in future
      ownerId: course.owner.id,
      stacks: {
        create: elements.map((element, index) => ({
          order: index,
          type: ElementStackType.MICROLEARNING,
          elements: {
            create: [
              {
                order: 0,
                elementId: element.id,
                type: ElementInstanceType.MICROLEARNING,
                elementType: element.type,
                options: {},
                elementData: {} as ElementData,
                results: {} as ElementInstanceResults,
                anonymousResults: {} as ElementInstanceResults,
                ownerId: course.owner.id,
              },
            ],
          },
        })),
      },
    },
  })

  // recompute the derived permissions for the course owner
  await recomputeDerivedPermissions(
    { microLearningId: dbMicroLearning.id, userId: course.owner.id },
    prisma
  )

  return dbMicroLearning
}

export async function testInitialization(prisma: PrismaClient) {
  // upsert all users in the database
  await Promise.all(
    [userOne, userTwo].map(
      async (user) =>
        await prisma.user.upsert({
          where: { id: user.id },
          update: {},
          create: {
            id: user.id,
            email: user.email,
            shortname: user.shortname,
          },
        })
    )
  )

  // verify that users have been created correctly in the database
  const dbUsers = await prisma.user.findMany()
  expect(dbUsers).toHaveLength(2)
  const actualEmails = dbUsers.map((user) => user.email)
  expect(actualEmails).toEqual(
    expect.arrayContaining([userOne.email, userTwo.email])
  )
  expect(actualEmails).toHaveLength(2)

  await Promise.all(
    [userOne, userTwo].map(async (user) => {
      let userPrisma = await prisma.user.findUnique({
        where: { id: user.id },
      })
      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: user.provider,
            providerAccountId: user.providerAccountId,
          },
        },
        create: {
          user: { connect: { id: userPrisma?.id } },
          type: 'oauth',
          provider: user.provider,
          providerAccountId: user.providerAccountId,
        },
        update: {},
      })
    })
  )

  /**
   * userOne:
   *  - courseOne:
   *     - liveQuizOne
   *     - liveQuizTwo
   *     - liveQuizThree
   *     - practiceQuizOne
   *     - practiceQuizTwo
   *     - microLearningOne
   *   - courseTwo:
   *     - practiceQuizThree
   *     - microlearningTwo
   *     - microlearningThree
   *
   * userTwo:
   *  - courseThree:
   *     - liveQuizFour
   *     - liveQuizFive
   *     - practiceQuizFour
   *     - microLearningFour
   *  - courseFour:
   *  - courseFive:
   *     - liveQuizSeven
   */
  const e1 = await createElements(prisma, 2, userOne)
  const e2 = await createElements(prisma, 3, userTwo)

  await createCourse(prisma, courseOne, true)
  await createCourse(prisma, courseTwo, false)
  await createCourse(prisma, courseThree, true)
  await createCourse(prisma, courseFour, true)
  await createCourse(prisma, courseFive, false)
  await createCourse(prisma, courseArchivedOne, true, true)
  await createCourse(prisma, courseArchivedTwo, true, true)

  await createLiveQuiz(prisma, courseOne, 1, e1)
  await createLiveQuiz(prisma, courseOne, 2, e1)
  await createLiveQuiz(prisma, courseOne, 3, e1)
  await createPracticeQuiz(prisma, courseOne, 1, e1)
  await createPracticeQuiz(prisma, courseOne, 2, e1)
  await createMicroLearning(prisma, courseOne, 1, e1)

  await createPracticeQuiz(prisma, courseTwo, 1, e1)
  await createMicroLearning(prisma, courseTwo, 1, e1)
  await createMicroLearning(prisma, courseTwo, 2, e1)

  await createLiveQuiz(prisma, courseThree, 1, e2)
  await createLiveQuiz(prisma, courseThree, 2, e2)
  await createPracticeQuiz(prisma, courseThree, 1, e2)
  await createMicroLearning(prisma, courseThree, 1, e2)

  await createLiveQuiz(prisma, courseFive, 1, e2)
}

// function to be run at the end of a test suite / test case to ensure complete deletion of all test data
export async function testCleanup(prisma: PrismaClient) {
  // delete all catalog collections (including top-level) and other objects from the database
  await prisma.catalogCollection.deleteMany()
  await prisma.answerCollection.deleteMany()
  await prisma.element.deleteMany()
  await prisma.liveQuiz.deleteMany()
  await prisma.practiceQuiz.deleteMany()
  await prisma.microLearning.deleteMany()
  await prisma.groupActivity.deleteMany()
  await prisma.$transaction(async (tx) => {
    await tx.course.updateMany({ data: { isDeleted: true } })
    await allowCoursePurgeInTransaction(tx)
    await tx.course.deleteMany({ where: { isDeleted: true } })
  })

  // verify that no permission or derived permission entries are left in the database (deleted through cascading)
  const dbPermissions = await prisma.permission.count()
  const dbPermissionsDerived = await prisma.derivedPermission.count()
  if (dbPermissions > 0 || dbPermissionsDerived > 0) {
    throw new Error(
      `Permissions or derived permissions still exist in the database: ${dbPermissions} permissions, ${dbPermissionsDerived} derived permissions`
    )
  }

  // delete all users, participants and user groups / participant groups that have been added for the test run
  await prisma.user.deleteMany()
  await prisma.participant.deleteMany()
  await prisma.userGroup.deleteMany()
  await prisma.participantGroup.deleteMany()
}

// setup test database configuration
// use the DATABASE_URL environment variable if available (for CI or local dev)
export function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // as a fallback, use default PostgreSQL connection
  process.env.DATABASE_URL =
    'postgresql://klicker-prod:klicker@localhost:5432/klicker-prod'
}

export async function initializePrisma() {
  // configure database
  getDatabaseUrl()

  try {
    // test database connection
    await prisma.$connect()

    return prisma
  } catch (error) {
    console.error('Failed to initialize test environment:', error)
    throw new Error(`Database connection failed: ${error}`)
  }
}
