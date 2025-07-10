import {
  Element,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  PrismaClient,
} from '@klicker-uzh/prisma'
import {
  ElementData,
  ElementInstanceResults,
  ElementOptionsNumerical,
} from '@klicker-uzh/types'
import { v4 as uuidv4 } from 'uuid'
import { expect } from 'vitest'
import {
  Course,
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
    const element: Element = await prisma.element.create({
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

    // permissions
    await prisma.derivedPermission.upsert({
      where: {
        elementId_userId: {
          elementId: element.id,
          userId: user.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        element: {
          connect: { id: element.id },
        },
        user: {
          connect: { id: user.id },
        },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })
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
  isGamificationEnabled: boolean
) {
  const defaultStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // one week ago
  const defaultEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // two weeks in future

  return await prisma.course.create({
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
      isGamificationEnabled: isGamificationEnabled,
    },
  })
}

export async function createLiveQuiz(
  prisma: PrismaClient,
  course: Course,
  i: number,
  elements: { id: number; type: ElementType }[]
) {
  return await prisma.liveQuiz.create({
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
                migrationId: uuidv4(),
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
}

export async function createPracticeQuiz(
  prisma: PrismaClient,
  course: Course,
  i: number,
  elements: { id: number; type: ElementType }[]
) {
  return await prisma.practiceQuiz.create({
    data: {
      name: `Practice Quiz ${i} for ${course.name}`,
      displayName: `Practice Quiz ${i} for ${course.name}`,
      description: '',
      courseId: course.id,
      ownerId: course.owner.id,
      stacks: {
        create: elements.map((element, index) => ({
          order: index,
          type: ElementStackType.PRACTICE_QUIZ,
          elements: {
            create: [
              {
                order: 0,
                elementId: element.id,
                migrationId: uuidv4(),
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
}

export async function createMicroLearning(
  prisma: PrismaClient,
  course: Course,
  i: number,
  elements: { id: number; type: ElementType }[]
) {
  return await prisma.microLearning.create({
    data: {
      name: `Micro Learning ${i} for ${course.name}`,
      displayName: `Micro Learning ${i} for ${course.name}`,
      description: '',
      courseId: course.id,
      scheduledStartAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // one week ago
      scheduledEndAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // two weeks in future
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
                migrationId: uuidv4(),
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

  const res = await Promise.all(
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

  const c1 = await createCourse(prisma, courseOne, true)
  const c2 = await createCourse(prisma, courseTwo, false)
  const c3 = await createCourse(prisma, courseThree, true)
  const c4 = await createCourse(prisma, courseFour, true)
  const c5 = await createCourse(prisma, courseFive, false)

  const l1 = await createLiveQuiz(prisma, courseOne, 1, e1)
  const l2 = await createLiveQuiz(prisma, courseOne, 2, e1)
  const l3 = await createLiveQuiz(prisma, courseOne, 3, e1)
  const p1 = await createPracticeQuiz(prisma, courseOne, 1, e1)
  const p2 = await createPracticeQuiz(prisma, courseOne, 2, e1)
  const m1 = await createMicroLearning(prisma, courseOne, 1, e1)

  const p3 = await createPracticeQuiz(prisma, courseTwo, 1, e1)
  const m2 = await createMicroLearning(prisma, courseTwo, 1, e1)
  const m3 = await createMicroLearning(prisma, courseTwo, 2, e1)

  const l4 = await createLiveQuiz(prisma, courseThree, 1, e2)
  const l5 = await createLiveQuiz(prisma, courseThree, 2, e2)
  const p4 = await createPracticeQuiz(prisma, courseThree, 1, e2)
  const m4 = await createMicroLearning(prisma, courseThree, 1, e2)

  const l7 = await createLiveQuiz(prisma, courseFive, 1, e2)
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
  await prisma.course.deleteMany()

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
  return 'postgresql://klicker:klicker@localhost:5432/klicker'
}

export async function initializePrisma() {
  // configure database
  const databaseUrl = getDatabaseUrl()

  try {
    // initialize PrismaClient with the database URL
    const prisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
      log: ['error', 'warn'],
    })

    // test database connection
    await prisma.$connect()

    return prisma
  } catch (error) {
    console.error('Failed to initialize test environment:', error)
    throw new Error(`Database connection failed: ${error}`)
  }
}
