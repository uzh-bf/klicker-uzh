import { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { hatchetClient } from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import {
  type AnswerCollection,
  type CatalogCollection,
  CourseAuthType,
  type Element,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  ObjectAccess,
  PermissionLevel,
  type PrismaClient,
  PublicationStatus,
  ResponseCorrectness,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  DisplayMode,
  type ElementData,
  type ElementInstanceOptions,
  type ElementInstanceResults,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  MISSING_CATALOG_COLLECTION_ID,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import generatePassword from 'generate-password'
import { createPubSub, Repeater } from 'graphql-yoga'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { vi } from 'vitest'
import {
  handleProcessCourseDuplication,
  handleSweepStaleCourseDuplications,
} from '@/services/courseDuplication.js'
import {
  handleEndExpiredGroupActivity,
  handlePublishScheduledGroupActivity,
} from '@/services/groups.js'
import {
  handleAssessmentLiveQuizBlockClosureAggregation,
  handlePublishScheduledLiveQuiz,
  handleStandardLiveQuizBlockClosureAggregation,
} from '@/services/liveQuizzes.js'
import {
  handleEndExpiredMicroLearning,
  handlePublishScheduledMicroLearning,
} from '@/services/microLearning.js'
import { handlePublishScheduledPracticeQuiz } from '@/services/practiceQuizzes.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { createAnswerCollection } from '../src/services/resources.js'
import { createCatalogCollection } from '../src/services/sharing.js'
import {
  answerCollection1,
  answerCollection2,
  catalogCollection1,
  catalogCollection2,
} from './testData.js'
import {
  userFive,
  userFour,
  userOne,
  userSix,
  userThree,
  userTwo,
} from './userData.js'

type TestInitializationResult = {
  userOneCtx: ContextWithUser
  userTwoCtx: ContextWithUser
  userThreeCtx: ContextWithUser
  userFourCtx: ContextWithUser
  userFiveCtx: ContextWithUser
  userSixCtx: ContextWithUser
}

// ! General Test Suite Helpers (general setup, user seeding, database connections, cleanup, etc.)
// #region
export async function testInitialization(
  prisma: PrismaClient,
  hatchet: Hatchet,
  emitter: EventEmitter
): Promise<TestInitializationResult> {
  // upsert all users in the database
  await Promise.all(
    [userOne, userTwo, userThree, userFour, userFive, userSix].map(
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
  expect(dbUsers).toHaveLength(6)
  const actualEmails = dbUsers.map((user) => user.email)
  expect(actualEmails).toEqual(
    expect.arrayContaining([
      userOne.email,
      userTwo.email,
      userThree.email,
      userFour.email,
      userFive.email,
      userSix.email,
    ])
  )
  expect(actualEmails).toHaveLength(6)

  // seed the top-level catalog collection with fixed ID
  await prisma.catalogCollection.upsert({
    where: { id: MISSING_CATALOG_COLLECTION_ID },
    create: {
      id: MISSING_CATALOG_COLLECTION_ID,
      name: '',
      access: ObjectAccess.PUBLIC,
    },
    update: {},
  })

  const pubSub = createPubSub()
  const redisExec = new Redis({ host: '127.0.0.1', port: 6379 })
  const redisAssessmentExec = new Redis({ host: '127.0.0.1', port: 6380 })

  const hatchetCtx = {
    hatchet,
    pubSub,
    emitter,
    redisExec,
    redisAssessmentExec,
    prisma,
    tasks: {} as ContextWithUser['tasks'],
  }

  // initialize tasks to be called
  const tasks = {
    createAuditLogEntry: hatchet.task({
      name: 'create-audit-log-entry',
      fn: async ({
        message,
      }: {
        message: Record<string, string | undefined> & {
          correlationId?: string
          info: string
        }
      }) => {
        console.info('Audit log triggered', message)
        return { success: true }
      },
    }),
    publishScheduledMicroLearning: hatchet.task({
      name: 'publish-scheduled-micro-learning',
      fn: async (
        { microLearningId }: { microLearningId: string },
        executionCtx
      ) => {
        const success = await handlePublishScheduledMicroLearning(
          { microLearningId },
          hatchetCtx,
          executionCtx
        )
        return { success }
      },
    }),
    publishScheduledPracticeQuiz: hatchet.task({
      name: 'publish-scheduled-practice-quiz',
      fn: async (
        { practiceQuizId }: { practiceQuizId: string },
        executionCtx
      ) => {
        const success = await handlePublishScheduledPracticeQuiz(
          { practiceQuizId },
          hatchetCtx,
          executionCtx
        )
        return { success }
      },
    }),
    publishScheduledGroupActivity: hatchet.task({
      name: 'publish-scheduled-group-activity',
      fn: async (
        { groupActivityId }: { groupActivityId: string },
        executionCtx
      ) => {
        const success = await handlePublishScheduledGroupActivity(
          { groupActivityId },
          hatchetCtx,
          executionCtx
        )
        return { success }
      },
    }),
    publishScheduledLiveQuiz: hatchet.task({
      name: 'publish-scheduled-live-quiz',
      fn: async ({ liveQuizId }: { liveQuizId: string }, executionCtx) => {
        const success = await handlePublishScheduledLiveQuiz(
          { liveQuizId },
          hatchetCtx,
          executionCtx
        )
        return { success }
      },
    }),
    endExpiredMicroLearning: hatchet.task({
      name: 'end-expired-micro-learning',
      fn: async (
        { microLearningId }: { microLearningId: string },
        executionCtx
      ) => {
        const success = await handleEndExpiredMicroLearning(
          { microLearningId },
          hatchetCtx,
          executionCtx
        )
        return { success }
      },
    }),
    endExpiredGroupActivity: hatchet.task({
      name: 'end-expired-group-activity',
      fn: async (
        { groupActivityId }: { groupActivityId: string },
        executionCtx
      ) => {
        const success = await handleEndExpiredGroupActivity(
          { groupActivityId },
          hatchetCtx,
          executionCtx
        )
        return { success }
      },
    }),
    aggregateLiveQuizBlockResultsStandard: hatchet.task({
      name: 'aggregate-block-closure-standard',
      retries: 3,
      fn: async (
        {
          liveQuizId,
          blockId,
        }: {
          liveQuizId: string
          blockId: number
        },
        executionContext
      ) => {
        const success = await handleStandardLiveQuizBlockClosureAggregation(
          { liveQuizId, blockId },
          hatchetCtx,
          executionContext
        )
        return { success }
      },
    }),
    aggregateLiveQuizBlockResultsAssessment: hatchet.task({
      name: 'aggregate-block-closure-assessment',
      retries: 3,
      fn: async (
        {
          liveQuizId,
          blockId,
        }: {
          liveQuizId: string
          blockId: number
        },
        executionContext
      ) => {
        const success = await handleAssessmentLiveQuizBlockClosureAggregation(
          { liveQuizId, blockId },
          hatchetCtx,
          executionContext
        )
        return { success }
      },
    }),
    processCourseDuplication: hatchet.task({
      name: 'process-course-duplication',
      fn: vi.fn(async ({ jobId }: { jobId: string }, executionCtx) => {
        const success = await handleProcessCourseDuplication(
          { jobId },
          hatchetCtx,
          executionCtx
        )
        return { success }
      }),
    }),
    sweepStaleCourseDuplications: hatchet.task({
      name: 'sweep-stale-course-duplications',
      fn: vi.fn(async (_input: Record<string, never>, executionCtx) => {
        const success = await handleSweepStaleCourseDuplications(
          {},
          hatchetCtx,
          executionCtx
        )
        return { success }
      }),
    }),
  }
  hatchetCtx.tasks = tasks

  // mock context with user including all required properties
  const userOneCtx: ContextWithUser = {
    user: {
      sub: userOne.sub,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: true,
      catalystIndividual: true,
    },
    prisma,
    hatchet,
    tasks,
    emitter,
    redisExec,
    redisAssessmentExec,
    pubSub: {
      publish: vi.fn(),
      subscribe: vi.fn().mockReturnValue(new Repeater(() => {})),
    } as ContextWithUser['pubSub'],
    req: {} as any,
    res: {} as any,
  }

  // mock remaining contexts
  const userTwoCtx: ContextWithUser = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userTwo.sub },
  }
  const userThreeCtx: ContextWithUser = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userThree.sub },
  }
  const userFourCtx: ContextWithUser = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userFour.sub },
  }
  const userFiveCtx: ContextWithUser = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userFive.sub },
  }
  const userSixCtx: ContextWithUser = {
    ...userOneCtx,
    user: { ...userOneCtx.user, sub: userSix.sub },
  }

  return {
    userOneCtx,
    userTwoCtx,
    userThreeCtx,
    userFourCtx,
    userFiveCtx,
    userSixCtx,
  }
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
  process.env.DATABASE_URL =
    'postgresql://klicker-prod:klicker@localhost:5432/klicker-prod'
}

export async function initializePrisma() {
  // configure database
  getDatabaseUrl()

  try {
    // create EventEmitter for test context
    const emitter = new EventEmitter()

    return { prisma, hatchet: hatchetClient, emitter }
  } catch (error) {
    console.error('Failed to initialize test environment:', error)
    throw new Error(`Database connection failed: ${error}`)
  }
}
// #endregion

// ! Content helpers (object creation for testing)
// #region
/**
 * Seeds two answer collections with different access levels (public and restricted).
 *
 * @param userContext - The user context for the current operation
 * @returns {Promise<AnswerCollection[]>}
 */
export async function seedAnswerCollections(
  userContext
): Promise<{ AC1: AnswerCollection; AC2: AnswerCollection }> {
  const collections = await Promise.all(
    [answerCollection1, answerCollection2].map((collection) =>
      createAnswerCollection(
        {
          name: collection.name,
          description: collection.description,
          answers: collection.entries,
        },
        userContext
      )
    )
  )

  if (
    !collections ||
    collections.some((collection) => !collection) ||
    collections.length !== 2 ||
    !collections[0] ||
    !collections[1]
  ) {
    throw new Error('Failed to create answer collections')
  }

  return { AC1: collections[0], AC2: collections[1] }
}

/**
 * Seeds the database with different types of elements for testing
 *
 * @param userContext - The user context containing the Prisma client and user information
 * @param answerCollectionId - The ID of the answer collection to associate with certain elements
 * @returns An object containing all created elements (SC, MC, KP, NR, FT, SE, CS, FC, CT)
 */
export async function seedElements(
  userContext,
  answerCollectionId: number
): Promise<{
  SC: Element
  MC: Element
  KP: Element
  NR: Element
  FT: Element
  SE: Element
  CS: Element
  FC: Element
  CT: Element
}> {
  const AC = await userContext.prisma.answerCollection.findUnique({
    where: { id: answerCollectionId },
    include: {
      entries: true,
    },
  })

  const SC = await userContext.prisma.element.create({
    data: {
      type: ElementType.SC,
      name: 'SC Element',
      content: 'SC Content',
      explanation: 'SC Explanation',
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'Choice 1', correct: true, feedback: 'Feedback 1' },
          { ix: 1, value: 'Choice 2', correct: false, feedback: 'Feedback 2' },
          { ix: 2, value: 'Choice 3', correct: false, feedback: 'Feedback 3' },
          { ix: 3, value: 'Choice 4', correct: false, feedback: 'Feedback 4' },
        ],
      },
      ownerId: userContext.user.sub,
    },
  })

  const MC = await userContext.prisma.element.create({
    data: {
      type: ElementType.MC,
      name: 'MC Element',
      content: 'MC Content',
      options: {},
      ownerId: userContext.user.sub,
    },
  })

  const KP = await userContext.prisma.element.create({
    data: {
      type: ElementType.KPRIM,
      name: 'KP Element',
      content: 'KP Content',
      options: {},
      ownerId: userContext.user.sub,
    },
  })

  const NR = await userContext.prisma.element.create({
    data: {
      type: ElementType.NUMERICAL,
      name: 'NR Element',
      content: 'NR Content',
      options: {},
      ownerId: userContext.user.sub,
    },
  })

  const FT = await userContext.prisma.element.create({
    data: {
      type: ElementType.FREE_TEXT,
      name: 'FT Element',
      content: 'FT Content',
      options: {},
      ownerId: userContext.user.sub,
    },
  })

  const SE = await userContext.prisma.element.create({
    data: {
      type: ElementType.SELECTION,
      name: 'SE Element',
      content: 'SE Content',
      options: {},
      ownerId: userContext.user.sub,
      answerCollectionId: AC.id,
    },
  })

  const CS = await userContext.prisma.element.create({
    data: {
      type: ElementType.CASE_STUDY,
      name: 'CS Element',
      content: 'CS Content',
      options: {},
      ownerId: userContext.user.sub,
      answerCollectionId: AC.id,
      answerCollectionItems: {
        connect: [{ id: AC.entries[1]!.id }, { id: AC.entries[2]!.id }],
      },
    },
  })

  const FC = await userContext.prisma.element.create({
    data: {
      type: ElementType.FLASHCARD,
      name: 'FC Element',
      content: 'FC Content',
      options: {},
      ownerId: userContext.user.sub,
    },
  })

  const CT = await userContext.prisma.element.create({
    data: {
      type: ElementType.CONTENT,
      name: 'CT Element',
      content: 'CT Content',
      options: {},
      ownerId: userContext.user.sub,
    },
  })

  return { SC, MC, KP, NR, FT, SE, CS, FC, CT }
}

/**
 * Seeds two catalog collections with different access levels (public and restricted).
 *
 * @param userContext - The user context for the current operation
 * @returns {Promise<{ publicCatalog: CatalogCollection, restrictedCatalog: CatalogCollection }>}
 */
export async function seedCatalogCollections(userContext): Promise<{
  publicCatalog: CatalogCollection
  restrictedCatalog: CatalogCollection
}> {
  const [publicCatalog, restrictedCatalog] = await Promise.all([
    createCatalogCollection(
      {
        name: catalogCollection1.name,
        access: catalogCollection1.access,
      },
      userContext
    ),
    createCatalogCollection(
      {
        name: catalogCollection2.name,
        access: catalogCollection2.access,
      },
      userContext
    ),
  ])

  return { publicCatalog, restrictedCatalog }
}

/**
 * Seeds permission records for two answer collections, setting up a hierarchical access structure
 * with different permission levels (ADMIN, WRITE, READ) for users 2, 3, and 4.
 *
 * @param prisma - The Prisma client instance for database operations
 * @param AC1Id - The ID of the first answer collection to create permissions for
 * @param AC2Id - The ID of the second answer collection to create permissions for
 * @returns {Promise<void>}
 *
 */
export async function seedAnswerCollectionPermissions(
  prisma: PrismaClient,
  AC1Id: number,
  AC2Id: number
) {
  // create permissions for users 2, 3, and 4 (ADMIN, WRITE, READ in descending order)
  await prisma.permission.createMany({
    data: [
      {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: AC1Id,
      },
      {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        answerCollectionId: AC1Id,
      },
      {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        answerCollectionId: AC1Id,
      },
      {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userTwo.id,
        answerCollectionId: AC2Id,
      },
      {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        answerCollectionId: AC2Id,
      },
      {
        permissionLevel: PermissionLevel.READ,
        userId: userFour.id,
        answerCollectionId: AC2Id,
      },
    ],
  })

  // recompute derived permissions that are checked in backend service functions
  await recomputeDerivedPermissions({ answerCollectionId: AC1Id }, prisma)
  await recomputeDerivedPermissions({ answerCollectionId: AC2Id }, prisma)
}

/**
 * Seeds catalog collection permissions for testing
 *
 * Creates user permissions (READ, WRITE, ADMIN) for users 2, 3, and 4 on specified
 * public and restricted catalog collections.
 *
 * @param prisma - Prisma client instance
 * @param publicId - ID of the public catalog collection
 * @param restrictedId - ID of the restricted catalog collection
 */
export async function seedCatalogCollectionPermissions(
  prisma: PrismaClient,
  publicId: string,
  restrictedId: string
) {
  // create permissions for users 2, 3, and 4 (READ, WRITE, ADMIN in ascending order)
  await prisma.permission.createMany({
    data: [
      {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        catalogCollectionId: publicId,
      },
      {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        catalogCollectionId: publicId,
      },
      {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        catalogCollectionId: publicId,
      },
      {
        permissionLevel: PermissionLevel.READ,
        userId: userTwo.id,
        catalogCollectionId: restrictedId,
      },
      {
        permissionLevel: PermissionLevel.WRITE,
        userId: userThree.id,
        catalogCollectionId: restrictedId,
      },
      {
        permissionLevel: PermissionLevel.ADMIN,
        userId: userFour.id,
        catalogCollectionId: restrictedId,
      },
    ],
  })

  // recompute derived permissions that are checked in backend service functions
  await recomputeDerivedPermissions({ catalogCollectionId: publicId }, prisma)
  await recomputeDerivedPermissions(
    { catalogCollectionId: restrictedId },
    prisma
  )
}

/**
 * Creates live quiz template activities directly in the database.
 *
 * @param prisma - The Prisma client instance for database operations
 * @returns Object containing the IDs of the created activities and templates
 *   - activityId1: ID of the first live quiz activity
 *   - activityId2: ID of the second live quiz activity
 *   - activityId3: ID of the third live quiz activity
 *   - templateId1: ID of the first activity template
 *   - templateId2: ID of the second activity template
 *   - templateId3: ID of the third activity template
 */
export async function seedLiveQuizTemplates(prisma: PrismaClient) {
  // create activity templates (without content, simply for access validation)
  const activityId1 = 'ca9f1fc4-0daf-4cdb-92b3-e55557b24831'
  const activityId2 = '86ff081d-07cd-4bea-91b7-fc633ed7a092'
  const activityId3 = '3be3228c-4a64-4a84-8743-46c4ba0ed333'
  const templateData = [
    { id: activityId1, name: 'LQ1' },
    { id: activityId2, name: 'LQ2' },
    { id: activityId3, name: 'LQ3' },
  ]
  const templates = await Promise.all(
    templateData.map(async ({ id, name }) => {
      const newTemplate = await prisma.activityTemplate.create({
        data: {
          description: `${name} Description`,
          instructions: `${name} Instructions`,
          liveQuiz: {
            create: {
              id, // activity id is relevant (connected to assignments, etc. - templateId mainly for routing)
              name,
              displayName: name,
              status: PublicationStatus.TEMPLATE,
              owner: {
                connect: {
                  id: userOne.id,
                },
              },
            },
          },
        },
      })

      await recomputeDerivedPermissions(
        { liveQuizId: id, userId: userOne.id },
        prisma
      )

      return newTemplate
    })
  )
  const templateId1 = templates.find((AT) => AT.liveQuizId === activityId1)!.id
  const templateId2 = templates.find((AT) => AT.liveQuizId === activityId2)!.id
  const templateId3 = templates.find((AT) => AT.liveQuizId === activityId3)!.id

  return {
    activityId1,
    activityId2,
    activityId3,
    templateId1,
    templateId2,
    templateId3,
  }
}

/**
 * Creates and seeds a new course in the database.
 *
 * @param startDate - The start date of the course (defaults to one week ago)
 * @param endDate - The end date of the course (defaults to two weeks in the future)
 * @param ctx - Context with authenticated user information
 * @returns The newly created course object
 */
export async function seedCourse(
  {
    startDate,
    endDate,
    isGamificationEnabled,
    isAssessmentEnabled,
  }: {
    startDate?: Date
    endDate?: Date
    isGamificationEnabled?: boolean
    isAssessmentEnabled?: boolean
  },
  ctx: ContextWithUser
) {
  const defaultStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // one week ago
  const defaultEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // two weeks in future
  const course = await ctx.prisma.course.create({
    data: {
      name: uuidv4(),
      displayName: uuidv4(),
      description: uuidv4(),
      pinCode: !isAssessmentEnabled
        ? Math.floor(Math.random() * 9000 + 1000)
        : null,
      startDate: startDate ?? defaultStartDate,
      endDate: endDate ?? defaultEndDate,
      groupDeadlineDate: endDate ?? defaultEndDate,
      isGamificationEnabled,
      isAssessmentEnabled,
      ownerId: ctx.user.sub,
      authType: isAssessmentEnabled ? CourseAuthType.SSO : CourseAuthType.PIN,
    },
  })

  return course
}

/**
 * Seeds a LiveQuiz in the database for testing purposes.
 *
 * @param elements - Array of elements to include in the live quiz, each with an id and type.
 * @param status - Optional publication status for the live quiz.
 * @param courseId - Optional course ID to associate with the live quiz.
 * @param ctx - Context object containing user information and Prisma client.
 * @returns Promise resolving to the created LiveQuiz object.
 */
export async function seedLiveQuiz(
  {
    elements,
    status,
    courseId,
  }: {
    elements: { id: number; type: ElementType }[]
    status?: PublicationStatus
    courseId?: string
  },
  ctx: ContextWithUser
) {
  // if a courseId is defined, fetch the corresponding course
  const course = courseId
    ? await ctx.prisma.course.findUnique({
        where: { id: courseId },
      })
    : null

  const liveQuiz = await ctx.prisma.liveQuiz.create({
    data: {
      name: uuidv4(),
      displayName: uuidv4(),
      description: uuidv4(),
      status,
      courseId,
      ownerId: ctx.user.sub,
      isAssessmentEnabled: course?.isAssessmentEnabled ?? false,
      isGamificationEnabled: course?.isGamificationEnabled ?? false,
      pinCode: course?.isAssessmentEnabled
        ? generatePassword.generate({
            length: 6,
            numbers: true,
            uppercase: true,
            lowercase: false,
            symbols: false,
          })
        : null,
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
                ownerId: ctx.user.sub,
              },
            ],
          },
        })),
      },
    },
    include: { blocks: true },
  })

  return liveQuiz
}

/**
 * Seeds a practice quiz in the database with the specified parameters.
 *
 * @param elements - Array of elements to include in the practice quiz, each with an id and type
 * @param courseId - The ID of the course to associate the practice quiz with
 * @param status - Optional publication status for the practice quiz
 * @param ctx - The context object including the authenticated user and Prisma client
 * @returns The created practice quiz object
 */
export async function seedPracticeQuiz(
  {
    elements,
    courseId,
    status,
  }: {
    elements: { id: number; type: ElementType }[]
    courseId: string
    status?: PublicationStatus
  },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.create({
    data: {
      name: uuidv4(),
      displayName: uuidv4(),
      description: uuidv4(),
      courseId,
      status,
      ownerId: ctx.user.sub,
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
                ownerId: ctx.user.sub,
              },
            ],
          },
        })),
      },
    },
  })

  return practiceQuiz
}

/**
 * Seeds a microlearning activity in the database with the specified parameters.
 *
 * @param elements - Array of elements to include in the microlearning activity, each with an id and type
 * @param courseId - The ID of the course to associate the microlearning activity with
 * @param scheduledStartAt - Optional start date for the microlearning activity
 * @param scheduledEndAt - Optional end date for the microlearning activity
 * @param status - Optional publication status for the microlearning activity
 * @param ctx - The context object including the authenticated user and Prisma client
 * @returns The created microlearning activity object
 */
export async function seedMicroLearning(
  {
    elements,
    courseId,
    scheduledStartAt,
    scheduledEndAt,
    status,
  }: {
    elements: { id: number; type: ElementType }[]
    courseId: string
    scheduledStartAt?: Date
    scheduledEndAt?: Date
    status?: PublicationStatus
  },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.create({
    data: {
      name: uuidv4(),
      displayName: uuidv4(),
      description: uuidv4(),
      courseId,
      status,
      scheduledStartAt:
        scheduledStartAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // one week ago
      scheduledEndAt:
        scheduledEndAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // two weeks in future
      ownerId: ctx.user.sub,
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
                ownerId: ctx.user.sub,
              },
            ],
          },
        })),
      },
    },
  })

  return microLearning
}

/**
 * Seeds a group activity in the database with the specified parameters.
 *
 * @param elements - Array of elements to include in the group activity, each with an id and type
 * @param courseId - The ID of the course to associate the group activity with
 * @param scheduledStartAt - Optional start date for the group activity
 * @param scheduledEndAt - Optional end date for the group activity
 * @param status - Optional publication status for the group activity
 * @param ctx - The context object including the authenticated user and Prisma client
 * @returns The created group activity object
 */
export async function seedGroupActivity(
  {
    elements,
    courseId,
    scheduledStartAt,
    scheduledEndAt,
    status,
  }: {
    elements: { id: number; type: ElementType }[]
    courseId: string
    scheduledStartAt?: Date
    scheduledEndAt?: Date
    status?: PublicationStatus
  },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.create({
    data: {
      name: uuidv4(),
      displayName: uuidv4(),
      description: uuidv4(),
      courseId,
      status,
      scheduledStartAt:
        scheduledStartAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // one week ago
      scheduledEndAt:
        scheduledEndAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // two weeks in future
      ownerId: ctx.user.sub,
      stacks: {
        create: {
          order: 0,
          type: ElementStackType.GROUP_ACTIVITY,
          elements: {
            create: elements.map((element, index) => ({
              order: index,
              elementId: element.id,
              type: ElementInstanceType.GROUP_ACTIVITY,
              elementType: element.type,
              options: {},
              elementData: {} as ElementData,
              results: {} as ElementInstanceResults,
              anonymousResults: {} as ElementInstanceResults,
              ownerId: ctx.user.sub,
            })),
          },
        },
      },
    },
  })

  return groupActivity
}
// #endregion

// ! Specific test case helpers (e.g. seeding of live quiz including responses to test correction workflows)
// #region
export async function seedLiveQuizWithResponses({
  userOneCtx,
  userTwoCtx,
  userThreeCtx,
  userFourCtx,
}: {
  userOneCtx: ContextWithUser
  userTwoCtx: ContextWithUser
  userThreeCtx: ContextWithUser
  userFourCtx: ContextWithUser
}) {
  const SCQuestion = await prisma.element.create({
    data: {
      status: 'READY',
      type: 'SC',
      name: 'Single Choice Question',
      content: 'What is the capital of Switzerland?',
      explanation: 'The capital of Switzerland is Bern.',
      options: {
        choices: [
          { ix: 0, value: 'Zurich', correct: false },
          { ix: 1, value: 'Bern', correct: true },
          { ix: 2, value: 'Geneva', correct: false },
          { ix: 3, value: 'Lucerne', correct: true },
        ],
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
      },
      basePoints: false,
      pointsMultiplier: 1,
      ownerId: userOneCtx.user.sub,
    },
  })
  await recomputeDerivedPermissions(
    { elementId: SCQuestion.id, userId: userOneCtx.user.sub },
    prisma
  )

  const MCQuestion = await prisma.element.create({
    data: {
      status: 'READY',
      type: 'MC',
      name: 'Multiple Choice Question',
      content: 'What are the capitals of Switzerland?',
      explanation: 'The capital of Switzerland is Bern.',
      options: {
        choices: [
          { ix: 0, value: 'Zurich', correct: false },
          { ix: 1, value: 'Bern', correct: true },
          { ix: 2, value: 'Geneva', correct: false },
          { ix: 3, value: 'Lucerne', correct: true },
        ],
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
      },
      basePoints: true,
      pointsMultiplier: 2,
      ownerId: userOneCtx.user.sub,
    },
  })
  await recomputeDerivedPermissions(
    { elementId: MCQuestion.id, userId: userOneCtx.user.sub },
    prisma
  )

  // create an assessment course
  const assessmentCourse = await prisma.course.create({
    data: {
      name: 'Assessment Course',
      displayName: 'Assessment Course',
      isGamificationEnabled: false,
      isAssessmentEnabled: true,
      authType: 'SSO',
      startDate: new Date(),
      endDate: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 30), // 30 days from now
      groupDeadlineDate: new Date(),
      owner: { connect: { id: userOneCtx.user.sub } },
    },
  })
  await recomputeDerivedPermissions(
    { courseId: assessmentCourse.id, userId: userOneCtx.user.sub },
    prisma
  )

  // create a live quiz with both questions
  const liveQuiz = await prisma.liveQuiz.create({
    data: {
      name: 'Live Quiz',
      displayName: 'Live Quiz',
      ownerId: userOneCtx.user.sub,
      pointsMultiplier: 1,
      isGamificationEnabled: false,
      isAssessmentEnabled: true,
      pinCode: 'D5G4HU',
      courseId: assessmentCourse.id,
      defaultPoints: 20,
      defaultCorrectPoints: 50,
      maxBonusPoints: 30,
      blocks: {
        create: [
          {
            order: 0,
            elements: {
              create: [
                {
                  type: ElementInstanceType.LIVE_QUIZ,
                  elementId: SCQuestion.id,
                  elementType: ElementType.SC,
                  order: 0,
                  options: {
                    pointsMultiplier: 1,
                    basePoints: false,
                  } as ElementInstanceOptions,
                  elementData: processElementData(SCQuestion),
                  results: getInitialInstanceResults(
                    processElementData(SCQuestion)
                  ),
                  anonymousResults: getInitialInstanceResults(
                    processElementData(SCQuestion)
                  ),
                  ownerId: userOneCtx.user.sub,
                },
                {
                  type: ElementInstanceType.LIVE_QUIZ,
                  elementId: MCQuestion.id,
                  elementType: ElementType.MC,
                  order: 1,
                  options: {
                    pointsMultiplier: 2,
                    basePoints: true,
                  } as ElementInstanceOptions,
                  elementData: processElementData(MCQuestion),
                  results: getInitialInstanceResults(
                    processElementData(MCQuestion)
                  ),
                  anonymousResults: getInitialInstanceResults(
                    processElementData(MCQuestion)
                  ),
                  ownerId: userOneCtx.user.sub,
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      blocks: { include: { elements: { orderBy: { order: 'asc' } } } },
    },
  })
  await recomputeDerivedPermissions(
    { liveQuizId: liveQuiz.id, userId: userOneCtx.user.sub },
    prisma
  )
  const instanceId1 = liveQuiz.blocks[0]!.elements[0]!.id
  const instanceId2 = liveQuiz.blocks[0]!.elements[1]!.id

  // share the course with users two, three, and four
  await prisma.permission.createMany({
    data: [
      {
        userId: userTwoCtx.user.sub,
        courseId: assessmentCourse.id,
        permissionLevel: PermissionLevel.READ,
      },
      {
        userId: userThreeCtx.user.sub,
        courseId: assessmentCourse.id,
        permissionLevel: PermissionLevel.WRITE,
      },
      {
        userId: userFourCtx.user.sub,
        courseId: assessmentCourse.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    ],
  })
  await recomputeDerivedPermissions({ courseId: assessmentCourse.id }, prisma)

  // create participant 1 with a correct answer to both questions
  const participant1 = await prisma.participant.create({
    data: {
      id: '36a3b9cf-00eb-46f3-a701-b222b68d0386',
      username: 'participant1',
      password: 'participant1',
      participations: { create: [{ courseId: assessmentCourse.id }] },
    },
  })
  const p1Response1 = await prisma.liveQuizResponse.create({
    data: {
      submittedAt: new Date(),
      response: {
        choices: [
          { ix: 0, selected: false },
          { ix: 1, selected: true },
          { ix: 2, selected: false },
          { ix: 3, selected: false },
        ],
      },
      correctness: ResponseCorrectness.CORRECT,
      basePoints: 0, // no base points for this question
      correctnessPoints: 50,
      bonusPoints: 30,
      timeSpent: -1,
      elementBlockExecution: 0,
      instance: { connect: { id: instanceId1 } },
      participant: { connect: { id: participant1.id } },
    },
  })
  const p1Response2 = await prisma.liveQuizResponse.create({
    data: {
      submittedAt: new Date(),
      response: {
        choices: [
          { ix: 0, selected: false },
          { ix: 1, selected: true },
          { ix: 2, selected: false },
          { ix: 3, selected: false },
        ],
      },
      correctness: ResponseCorrectness.CORRECT,
      basePoints: 20,
      correctnessPoints: 100,
      bonusPoints: 60,
      timeSpent: -1,
      elementBlockExecution: 0,
      instance: { connect: { id: instanceId2 } },
      participant: { connect: { id: participant1.id } },
    },
  })

  // create participant 2 with a partially correct answer to the first question and no answer to the second one
  const participant2 = await prisma.participant.create({
    data: {
      id: 'fbdc8107-0f7e-4b9b-9dc5-9268c99dc784',
      username: 'participant2',
      password: 'participant2',
      participations: { create: [{ courseId: assessmentCourse.id }] },
    },
  })
  const p2Response1 = await prisma.liveQuizResponse.create({
    data: {
      submittedAt: new Date(),
      response: {
        choices: [
          { ix: 0, selected: false },
          { ix: 1, selected: true },
          { ix: 2, selected: true },
          { ix: 3, selected: false },
        ],
      },
      correctness: ResponseCorrectness.PARTIAL, // correctness assumed to be 50%
      basePoints: 0, // no base points for this question
      correctnessPoints: 25,
      bonusPoints: 15,
      timeSpent: -1,
      elementBlockExecution: 0,
      instance: { connect: { id: instanceId1 } },
      participant: { connect: { id: participant2.id } },
    },
  })

  // create participant 3 with a course participation but no answers
  const participant3 = await prisma.participant.create({
    data: {
      id: '56409db9-4bba-425d-81f6-98864ca3daed',
      username: 'participant3',
      password: 'participant3',
      participations: { create: [{ courseId: assessmentCourse.id }] },
    },
  })

  return {
    assessmentCourse,
    liveQuiz,
    instanceId1,
    instanceId2,
    SCQuestion,
    MCQuestion,
    participant1,
    participant2,
    participant3,
    p1Response1,
    p1Response2,
    p2Response1,
  }
}
// #endregion
