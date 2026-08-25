import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
  ReviewStatus,
} from '@klicker-uzh/prisma/client'
import {
  ElementData,
  ElementInstanceResults,
  ElementOptions,
} from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { vi } from 'vitest'
import { v4 as uuid } from 'uuid'
import type { ContextWithUser } from '../src/lib/context.js'
import { applyActivityBatchOperations } from '../src/services/activities.js'
import { deleteGroupActivity } from '../src/services/groups.js'
import { deleteMicroLearning } from '../src/services/microLearning.js'
import { deletePracticeQuiz } from '../src/services/practiceQuizzes.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

describe('Integration tests for batch operations on activities', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser
  let userFourCtx: ContextWithUser
  let userFiveCtx: ContextWithUser

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
    const {
      userOneCtx: ctx1,
      userTwoCtx: ctx2,
      userThreeCtx: ctx3,
      userFourCtx: ctx4,
      userFiveCtx: ctx5,
    } = await testInitialization(prisma, hatchet, emitter)

    userOneCtx = ctx1
    userTwoCtx = ctx2
    userThreeCtx = ctx3
    userFourCtx = ctx4
    userFiveCtx = ctx5
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await testCleanup(prisma)
  })

  async function seedElement(
    args: { [x: string]: any },
    prisma: PrismaClient,
    seed: number = 0
  ) {
    // randomly choose one of the values of ElementType
    const elementTypes = Object.values(ElementType)
    const randomType = elementTypes[seed % elementTypes.length]!

    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: randomType,
        options: {} as ElementOptions,
        ownerId: userOneCtx.user.sub,
        ...args,
      },
    })

    await recomputeDerivedPermissions(
      { elementId: element.id, userId: userOneCtx.user.sub },
      prisma
    )

    return element.id
  }

  async function seedCourse(
    args: { [x: string]: any } = {},
    prisma: PrismaClient
  ) {
    const course = await prisma.course.create({
      data: {
        name: uuid(),
        displayName: uuid(),
        pinCode: !args.isAssessmentEnabled
          ? Math.floor(100000 + Math.random() * 900000)
          : null,
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // two weeks ago
        endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // three weeks in the future
        isGroupCreationEnabled: true,
        groupDeadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // one week in the future
        ownerId: userOneCtx.user.sub,
        authType: !!args.isAssessmentEnabled
          ? CourseAuthType.SSO
          : CourseAuthType.PIN,
        ...args,
      },
    })

    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    return course
  }

  async function seedLiveQuiz(
    args: { [x: string]: any } = {},
    prisma: PrismaClient
  ) {
    const elementId = await seedElement(
      args.ownerId ? { ownerId: args.ownerId } : {},
      prisma,
      0
    )

    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name: uuid(),
        displayName: uuid(),
        pointsMultiplier: 1,
        courseId: args.courseId,
        ownerId: userOneCtx.user.sub,
        pinCode:
          args?.isAssessmentEnabled === true
            ? (args.pinCode ?? 'AB12CD') // valid 6-char uppercase alphanumeric
            : null,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: [
                  {
                    order: 0,
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementType: ElementType.SC,
                    options: { pointsMultiplier: 1 },
                    elementData: { pointsMultiplier: 1 } as ElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    elementId: elementId,
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
        ...args,
      },
    })

    await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, prisma)
    return liveQuiz
  }

  async function seedPracticeQuiz(
    args: { courseId: string; [x: string]: any },
    prisma: PrismaClient
  ) {
    const elementId = await seedElement(
      args.ownerId ? { ownerId: args.ownerId } : {},
      prisma,
      1
    )
    const practiceQuiz = await prisma.practiceQuiz.create({
      data: {
        name: uuid(),
        displayName: uuid(),
        ownerId: userOneCtx.user.sub,
        stacks: {
          create: [
            {
              order: 0,
              type: ElementStackType.PRACTICE_QUIZ,
              elements: {
                create: [
                  {
                    order: 0,
                    type: ElementInstanceType.PRACTICE_QUIZ,
                    elementType: ElementType.SC,
                    options: { pointsMultiplier: 2 },
                    elementData: { pointsMultiplier: 2 } as ElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    elementId: elementId,
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
        ...args,
      },
    })

    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id },
      prisma
    )
    return practiceQuiz
  }

  async function seedMicroLearning(
    args: { courseId: string; [x: string]: any },
    prisma: PrismaClient
  ) {
    const elementId = await seedElement(
      args.ownerId ? { ownerId: args.ownerId } : {},
      prisma,
      2
    )
    const microLearning = await prisma.microLearning.create({
      data: {
        name: uuid(),
        displayName: uuid(),
        ownerId: userOneCtx.user.sub,
        scheduledStartAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // one week + 1 day in the future
        scheduledEndAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // two weeks + 1 day in the future
        stacks: {
          create: [
            {
              order: 0,
              type: ElementStackType.MICROLEARNING,
              elements: {
                create: [
                  {
                    order: 0,
                    type: ElementInstanceType.MICROLEARNING,
                    elementType: ElementType.SC,
                    options: { pointsMultiplier: 3 },
                    elementData: { pointsMultiplier: 3 } as ElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    elementId: elementId,
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
        ...args,
      },
    })

    await recomputeDerivedPermissions(
      { microLearningId: microLearning.id },
      prisma
    )
    return microLearning
  }

  async function seedGroupActivity(
    args: { courseId: string; [key: string]: any },
    prisma: PrismaClient
  ) {
    const elementId = await seedElement(
      args.ownerId ? { ownerId: args.ownerId } : {},
      prisma,
      3
    )
    const groupActivity = await prisma.groupActivity.create({
      data: {
        name: uuid(),
        displayName: uuid(),
        scheduledStartAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // one week + 1 day in the future
        scheduledEndAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // two weeks + 1 day in the future
        ownerId: userOneCtx.user.sub,
        stacks: {
          create: [
            {
              order: 0,
              type: ElementStackType.GROUP_ACTIVITY,
              elements: {
                create: [
                  {
                    order: 0,
                    type: ElementInstanceType.GROUP_ACTIVITY,
                    elementType: ElementType.SC,
                    options: { pointsMultiplier: 4 },
                    elementData: { pointsMultiplier: 4 } as ElementData,
                    results: {} as ElementInstanceResults,
                    anonymousResults: {} as ElementInstanceResults,
                    elementId: elementId,
                    ownerId: userOneCtx.user.sub,
                  },
                ],
              },
            },
          ],
        },
        ...args,
      },
    })

    await recomputeDerivedPermissions(
      { groupActivityId: groupActivity.id },
      prisma
    )
    return groupActivity
  }

  it('does not hard-delete published activities through batch deletion', async () => {
    const course = await seedCourse({}, prisma)
    const practiceQuiz = await seedPracticeQuiz(
      { courseId: course.id, status: PublicationStatus.PUBLISHED },
      prisma
    )
    const microLearning = await seedMicroLearning(
      { courseId: course.id, status: PublicationStatus.PUBLISHED },
      prisma
    )
    const groupActivity = await seedGroupActivity(
      { courseId: course.id, status: PublicationStatus.PUBLISHED },
      prisma
    )

    expect(
      await deletePracticeQuiz(
        { id: practiceQuiz.id, onlyIfUnpublished: true },
        userOneCtx
      )
    ).toBeNull()
    expect(
      await deleteMicroLearning(
        { id: microLearning.id, onlyIfUnpublished: true },
        userOneCtx
      )
    ).toBeNull()
    expect(
      await deleteGroupActivity(
        { id: groupActivity.id, onlyIfUnpublished: true },
        userOneCtx
      )
    ).toBeNull()

    await expect(
      prisma.practiceQuiz.findUnique({ where: { id: practiceQuiz.id } })
    ).resolves.toMatchObject({
      id: practiceQuiz.id,
      status: PublicationStatus.PUBLISHED,
    })
    await expect(
      prisma.microLearning.findUnique({ where: { id: microLearning.id } })
    ).resolves.toMatchObject({
      id: microLearning.id,
      status: PublicationStatus.PUBLISHED,
    })
    await expect(
      prisma.groupActivity.findUnique({ where: { id: groupActivity.id } })
    ).resolves.toMatchObject({
      id: groupActivity.id,
      status: PublicationStatus.PUBLISHED,
    })

    await expect(
      deletePracticeQuiz({ id: practiceQuiz.id }, userOneCtx)
    ).resolves.toMatchObject({ id: practiceQuiz.id })
    await expect(
      prisma.practiceQuiz.findUnique({ where: { id: practiceQuiz.id } })
    ).resolves.toBeNull()
  })

  it('uses the publication status as an atomic batch-deletion predicate', async () => {
    const practiceQuizDelete = vi.fn().mockRejectedValue({ code: 'P2025' })
    const practiceQuizCtx = {
      prisma: {
        practiceQuiz: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'practice-quiz-id',
            status: PublicationStatus.SCHEDULED,
            responses: [],
            stacks: [],
          }),
          delete: practiceQuizDelete,
        },
      },
    } as unknown as ContextWithUser

    const microLearningDelete = vi.fn().mockRejectedValue({ code: 'P2025' })
    const microLearningCtx = {
      prisma: {
        microLearning: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'micro-learning-id',
            status: PublicationStatus.SCHEDULED,
            responses: [],
            stacks: [],
          }),
          delete: microLearningDelete,
        },
      },
    } as unknown as ContextWithUser

    const groupActivityDelete = vi.fn().mockRejectedValue({ code: 'P2025' })
    const groupActivityCtx = {
      prisma: {
        groupActivity: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'group-activity-id',
            status: PublicationStatus.SCHEDULED,
            activityInstances: [],
            stacks: [],
          }),
          delete: groupActivityDelete,
        },
      },
    } as unknown as ContextWithUser

    await expect(
      deletePracticeQuiz(
        { id: 'practice-quiz-id', onlyIfUnpublished: true },
        practiceQuizCtx
      )
    ).resolves.toBeNull()
    await expect(
      deleteMicroLearning(
        { id: 'micro-learning-id', onlyIfUnpublished: true },
        microLearningCtx
      )
    ).resolves.toBeNull()
    await expect(
      deleteGroupActivity(
        { id: 'group-activity-id', onlyIfUnpublished: true },
        groupActivityCtx
      )
    ).resolves.toBeNull()

    const unpublishedStatuses = {
      in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
    }
    expect(practiceQuizDelete).toHaveBeenCalledWith({
      where: { id: 'practice-quiz-id', status: unpublishedStatuses },
    })
    expect(microLearningDelete).toHaveBeenCalledWith({
      where: { id: 'micro-learning-id', status: unpublishedStatuses },
    })
    expect(groupActivityDelete).toHaveBeenCalledWith({
      where: { id: 'group-activity-id', status: unpublishedStatuses },
    })
  })

  it('guards group activity hard deletion with an instance predicate', async () => {
    const groupActivityDelete = vi.fn().mockResolvedValue({
      id: 'group-activity-id',
      status: PublicationStatus.PUBLISHED,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
    })
    const groupActivityCtx = {
      prisma: {
        groupActivity: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'group-activity-id',
            status: PublicationStatus.PUBLISHED,
            scheduledPublicationTaskId: null,
            scheduledCompletionTaskId: null,
            activityInstances: [],
            stacks: [],
          }),
          delete: groupActivityDelete,
        },
      },
      emitter: new EventEmitter(),
    } as unknown as ContextWithUser

    await expect(
      deleteGroupActivity({ id: 'group-activity-id' }, groupActivityCtx)
    ).resolves.toMatchObject({ id: 'group-activity-id' })

    expect(groupActivityDelete).toHaveBeenCalledWith({
      where: {
        id: 'group-activity-id',
        OR: [
          {
            status: {
              in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
            },
          },
          { activityInstances: { none: {} } },
        ],
      },
    })
  })

  it('hard-deletes an unpublished group activity with instances', async () => {
    const groupActivityDelete = vi.fn().mockResolvedValue({
      id: 'group-activity-id',
      status: PublicationStatus.SCHEDULED,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
    })
    const groupActivityCtx = {
      prisma: {
        groupActivity: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'group-activity-id',
            status: PublicationStatus.SCHEDULED,
            scheduledPublicationTaskId: null,
            scheduledCompletionTaskId: null,
            activityInstances: [{ id: 'instance-id' }],
            stacks: [],
          }),
          delete: groupActivityDelete,
        },
      },
      emitter: new EventEmitter(),
    } as unknown as ContextWithUser

    await expect(
      deleteGroupActivity({ id: 'group-activity-id' }, groupActivityCtx)
    ).resolves.toMatchObject({ id: 'group-activity-id' })

    expect(groupActivityDelete).toHaveBeenCalledWith({
      where: {
        id: 'group-activity-id',
        OR: [
          {
            status: {
              in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
            },
          },
          { activityInstances: { none: {} } },
        ],
      },
    })
  })

  it('returns null when a group activity disappears before soft deletion', async () => {
    const groupActivityUpdate = vi.fn().mockRejectedValue({ code: 'P2025' })
    const groupActivityCtx = {
      prisma: {
        groupActivity: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'group-activity-id',
            status: PublicationStatus.PUBLISHED,
            scheduledCompletionTaskId: null,
            activityInstances: [{ id: 'instance-id' }],
            stacks: [],
          }),
        },
        $transaction: vi.fn(async (callback) =>
          callback({ groupActivity: { update: groupActivityUpdate } })
        ),
      },
      emitter: new EventEmitter(),
    } as unknown as ContextWithUser

    await expect(
      deleteGroupActivity({ id: 'group-activity-id' }, groupActivityCtx)
    ).resolves.toBeNull()

    expect(groupActivityUpdate).toHaveBeenCalledWith({
      where: { id: 'group-activity-id' },
      data: {
        isDeleted: true,
        directPermissions: { deleteMany: {} },
        scheduledCompletionTaskId: null,
      },
    })
  })

  it('Verify that the case of missing activity ids and a wrong courseId are handled correctly', async () => {
    // seed a course
    const course = await seedCourse({ ownerId: userTwoCtx.user.sub }, prisma)

    // seed a live quiz assigned to the course
    const liveQuiz = await seedLiveQuiz({ courseId: course.id }, prisma)

    // call the batch operation with no activity ids
    const updates = await applyActivityBatchOperations(
      { activityIds: [] },
      userOneCtx
    )
    expect(updates).toEqual(0)

    // call the batch operation with an invalid course id
    const updatesInvalidCourse = await applyActivityBatchOperations(
      { activityIds: [liveQuiz.id], courseId: uuid() },
      userOneCtx
    )
    expect(updatesInvalidCourse).toEqual(0)

    // call the batch operation with a course id where the user does not have access
    const updatesNoAccess = await applyActivityBatchOperations(
      { activityIds: [liveQuiz.id], courseId: course.id },
      userOneCtx
    )
    expect(updatesNoAccess).toEqual(0)

    // call the batch operation with a valid course but no valid access to the activity
    const updatesNoActivityAccess = await applyActivityBatchOperations(
      { activityIds: [liveQuiz.id], courseId: course.id },
      userThreeCtx
    )
    expect(updatesNoActivityAccess).toEqual(0)

    // call the batch operation with a valid course and derived permission, but no direct access
    const updatesDerivedActivityAccess = await applyActivityBatchOperations(
      { activityIds: [liveQuiz.id], courseId: course.id },
      userTwoCtx
    )
    expect(updatesDerivedActivityAccess).toEqual(1)
  })

  it('Verify that the case of setting multipliers for a non-gamified non-assessment course is handled correctly', async () => {
    // seed course without gamification or assessment flags
    const course = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: false },
      prisma
    )

    // seed live quiz without course
    const liveQuiz = await seedLiveQuiz({}, prisma)

    // call batch operation on live quiz and course assignment & multiplier -> should fail due to course flags
    const updates = await applyActivityBatchOperations(
      { activityIds: [liveQuiz.id], courseId: course.id, multiplier: 2 },
      userOneCtx
    )
    expect(updates).toEqual(0)
  })

  it('Verify that all activity types are correctly handled for new course assignment', async () => {
    // seed courses with differnet gamification and assessment settings
    const defaultCourse = await seedCourse({}, prisma)
    const gamifiedCourse = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: false },
      prisma
    )
    const assessmentCourse = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: true },
      prisma
    )
    const standardCourse = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: false },
      prisma
    )

    // seed live quiz, practice quiz, microlearning, and group activity assigned to default course
    const liveQuiz = await seedLiveQuiz({ courseId: defaultCourse.id }, prisma)
    const practiceQuiz = await seedPracticeQuiz(
      { courseId: defaultCourse.id },
      prisma
    )
    const microlearning = await seedMicroLearning(
      { courseId: defaultCourse.id },
      prisma
    )
    const groupActivity = await seedGroupActivity(
      { courseId: defaultCourse.id },
      prisma
    )

    // use batch operation to re-assign to gamified course
    const updates = await applyActivityBatchOperations(
      {
        activityIds: [
          liveQuiz.id,
          practiceQuiz.id,
          microlearning.id,
          groupActivity.id,
        ],
        courseId: gamifiedCourse.id,
      },
      userOneCtx
    )
    expect(updates).toEqual(4)

    // verify that the booleans on the activity are set correctly
    const updatedLiveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
    })
    const updatedPracticeQuiz = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuiz.id },
    })
    const updatedMicrolearning = await prisma.microLearning.findUnique({
      where: { id: microlearning.id },
    })
    const updatedGroupActivity = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })

    expect(updatedLiveQuiz?.isGamificationEnabled).toBe(true)
    expect(updatedLiveQuiz?.isAssessmentEnabled).toBe(false)
    expect(updatedLiveQuiz?.pinCode).toBeNull()

    expect(updatedPracticeQuiz?.isGamificationEnabled).toBe(true)
    expect(updatedPracticeQuiz?.isAssessmentEnabled).toBe(false)

    expect(updatedMicrolearning?.isGamificationEnabled).toBe(true)
    expect(updatedMicrolearning?.isAssessmentEnabled).toBe(false)

    expect(updatedGroupActivity?.isGamificationEnabled).toBe(true)
    expect(updatedGroupActivity?.isAssessmentEnabled).toBe(false)

    // use batch operation to re-assign to assessment course
    const updates2 = await applyActivityBatchOperations(
      {
        activityIds: [
          liveQuiz.id,
          practiceQuiz.id,
          microlearning.id,
          groupActivity.id,
        ],
        courseId: assessmentCourse.id,
      },
      userOneCtx
    )
    expect(updates2).toEqual(4)

    // verify that the booleans on the activity are set correctly
    const updatedLiveQuiz2 = await prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
    })
    const updatedPracticeQuiz2 = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuiz.id },
    })
    const updatedMicrolearning2 = await prisma.microLearning.findUnique({
      where: { id: microlearning.id },
    })
    const updatedGroupActivity2 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })

    expect(updatedLiveQuiz2?.isGamificationEnabled).toBe(false)
    expect(updatedLiveQuiz2?.isAssessmentEnabled).toBe(true)
    expect(updatedLiveQuiz2?.pinCode).not.toBeNull()
    expect(updatedLiveQuiz2?.pinCode).toMatch(/^[A-Z0-9]{6}$/) // pin should be set automatically for assessment live quizzes

    expect(updatedPracticeQuiz2?.isGamificationEnabled).toBe(false)
    expect(updatedPracticeQuiz2?.isAssessmentEnabled).toBe(true)

    expect(updatedMicrolearning2?.isGamificationEnabled).toBe(false)
    expect(updatedMicrolearning2?.isAssessmentEnabled).toBe(true)

    expect(updatedGroupActivity2?.isGamificationEnabled).toBe(false)
    expect(updatedGroupActivity2?.isAssessmentEnabled).toBe(true)

    // use batch operation to re-assign to non-gamified non-assessment course
    const updates3 = await applyActivityBatchOperations(
      {
        activityIds: [
          liveQuiz.id,
          practiceQuiz.id,
          microlearning.id,
          groupActivity.id,
        ],
        courseId: standardCourse.id,
      },
      userOneCtx
    )
    expect(updates3).toEqual(4)

    // verify that the booleans on the activity are set correctly
    const updatedLiveQuiz3 = await prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
    })
    const updatedPracticeQuiz3 = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuiz.id },
    })
    const updatedMicrolearning3 = await prisma.microLearning.findUnique({
      where: { id: microlearning.id },
    })
    const updatedGroupActivity3 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })

    expect(updatedLiveQuiz3?.isGamificationEnabled).toBe(false)
    expect(updatedLiveQuiz3?.isAssessmentEnabled).toBe(false)
    expect(updatedLiveQuiz3?.pinCode).toBeNull()

    expect(updatedPracticeQuiz3?.isGamificationEnabled).toBe(false)
    expect(updatedPracticeQuiz3?.isAssessmentEnabled).toBe(false)

    expect(updatedMicrolearning3?.isGamificationEnabled).toBe(false)
    expect(updatedMicrolearning3?.isAssessmentEnabled).toBe(false)

    expect(updatedGroupActivity3?.isGamificationEnabled).toBe(false)
    expect(updatedGroupActivity3?.isAssessmentEnabled).toBe(false)
  })

  it('Verify that all activity types are correctly handled for multiplier updates', async () => {
    // seed a default course to assign the asynchronous activities to
    const course = await seedCourse({}, prisma)

    // seed gamified activities
    const liveQuizGamified = await seedLiveQuiz(
      {
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
      },
      prisma
    )
    const practiceQuizGamified = await seedPracticeQuiz(
      {
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )
    const microlearningGamified = await seedMicroLearning(
      {
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )
    const groupActivityGamified = await seedGroupActivity(
      {
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )

    // seed assessment activities
    const liveQuizAssessment = await seedLiveQuiz(
      {
        isAssessmentEnabled: true,
        isGamificationEnabled: false,
        pointsMultiplier: 1,
      },
      prisma
    )
    const practiceQuizAssessment = await seedPracticeQuiz(
      {
        isAssessmentEnabled: true,
        isGamificationEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )
    const microlearningAssessment = await seedMicroLearning(
      {
        isAssessmentEnabled: true,
        isGamificationEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )
    const groupActivityAssessment = await seedGroupActivity(
      {
        isAssessmentEnabled: true,
        isGamificationEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )

    // seed non-gamified non-assessment activities
    const liveQuizNonGamified = await seedLiveQuiz(
      {
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
      },
      prisma
    )
    const practiceQuizNonGamified = await seedPracticeQuiz(
      {
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )
    const microlearningNonGamified = await seedMicroLearning(
      {
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )
    const groupActivityNonGamified = await seedGroupActivity(
      {
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
        courseId: course.id,
      },
      prisma
    )

    // trigger a batch operation to update the multipliers of all activities
    const result = await applyActivityBatchOperations(
      {
        activityIds: [
          liveQuizGamified.id,
          practiceQuizGamified.id,
          microlearningGamified.id,
          groupActivityGamified.id,
          liveQuizAssessment.id,
          practiceQuizAssessment.id,
          microlearningAssessment.id,
          groupActivityAssessment.id,
          liveQuizNonGamified.id,
          practiceQuizNonGamified.id,
          microlearningNonGamified.id,
          groupActivityNonGamified.id,
        ],
        multiplier: 2,
      },
      userOneCtx
    )
    expect(result).toBe(8) // successful updates for all activities with gamification or assessment enabled

    // verify that the multiplier updates on the corresponding activities have gone into effect
    const updatedLiveQuizGamified = await prisma.liveQuiz.findUnique({
      where: { id: liveQuizGamified.id },
      include: { blocks: { include: { elements: true } } },
    })
    expect(updatedLiveQuizGamified?.pointsMultiplier).toEqual(2)

    const updatedPracticeQuizGamified = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuizGamified.id },
      include: { stacks: { include: { elements: true } } },
    })
    expect(updatedPracticeQuizGamified?.pointsMultiplier).toEqual(2)

    const updatedMicrolearningGamified = await prisma.microLearning.findUnique({
      where: { id: microlearningGamified.id },
      include: { stacks: { include: { elements: true } } },
    })
    expect(updatedMicrolearningGamified?.pointsMultiplier).toEqual(2)

    const updatedGroupActivityGamified = await prisma.groupActivity.findUnique({
      where: { id: groupActivityGamified.id },
      include: { stacks: { include: { elements: true } } },
    })
    expect(updatedGroupActivityGamified?.pointsMultiplier).toEqual(2)

    const updatedLiveQuizAssessment = await prisma.liveQuiz.findUnique({
      where: { id: liveQuizAssessment.id },
      include: { blocks: { include: { elements: true } } },
    })
    expect(updatedLiveQuizAssessment?.pointsMultiplier).toEqual(2)

    const updatedPracticeQuizAssessment = await prisma.practiceQuiz.findUnique({
      where: { id: practiceQuizAssessment.id },
      include: { stacks: { include: { elements: true } } },
    })
    expect(updatedPracticeQuizAssessment?.pointsMultiplier).toEqual(2)

    const updatedMicrolearningAssessment =
      await prisma.microLearning.findUnique({
        where: { id: microlearningAssessment.id },
        include: { stacks: { include: { elements: true } } },
      })
    expect(updatedMicrolearningAssessment?.pointsMultiplier).toEqual(2)

    const updatedGroupActivityAssessment =
      await prisma.groupActivity.findUnique({
        where: { id: groupActivityAssessment.id },
        include: { stacks: { include: { elements: true } } },
      })
    expect(updatedGroupActivityAssessment?.pointsMultiplier).toEqual(2)

    const unchangedLiveQuizNonGamified = await prisma.liveQuiz.findUnique({
      where: { id: liveQuizNonGamified.id },
      include: { blocks: { include: { elements: true } } },
    })
    expect(unchangedLiveQuizNonGamified?.pointsMultiplier).toEqual(1)

    const unchangedPracticeQuizNonGamified =
      await prisma.practiceQuiz.findUnique({
        where: { id: practiceQuizNonGamified.id },
        include: { stacks: { include: { elements: true } } },
      })
    expect(unchangedPracticeQuizNonGamified?.pointsMultiplier).toEqual(1)

    const unchangedMicrolearningNonGamified =
      await prisma.microLearning.findUnique({
        where: { id: microlearningNonGamified.id },
        include: { stacks: { include: { elements: true } } },
      })
    expect(unchangedMicrolearningNonGamified?.pointsMultiplier).toEqual(1)

    const unchangedGroupActivityNonGamified =
      await prisma.groupActivity.findUnique({
        where: { id: groupActivityNonGamified.id },
        include: { stacks: { include: { elements: true } } },
      })
    expect(unchangedGroupActivityNonGamified?.pointsMultiplier).toEqual(1)

    // verify that the multiplier updates on the instance have been applied (first add instance to all activities)
    const lqGamifiedInstance = updatedLiveQuizGamified?.blocks[0]?.elements[0]
    expect(lqGamifiedInstance?.options.pointsMultiplier).toEqual(2)

    const lqAssessmentInstance =
      updatedLiveQuizAssessment?.blocks[0]?.elements[0]
    expect(lqAssessmentInstance?.options.pointsMultiplier).toEqual(2)

    const lqNonGamifiedInstance =
      unchangedLiveQuizNonGamified?.blocks[0]?.elements[0]
    expect(lqNonGamifiedInstance?.options.pointsMultiplier).toEqual(1)

    const pqGamifiedInstance =
      updatedPracticeQuizGamified?.stacks[0]?.elements[0]
    expect(pqGamifiedInstance?.options.pointsMultiplier).toEqual(4)

    const pqAssessmentInstance =
      updatedPracticeQuizAssessment?.stacks[0]?.elements[0]
    expect(pqAssessmentInstance?.options.pointsMultiplier).toEqual(4)

    const pqNonGamifiedInstance =
      unchangedPracticeQuizNonGamified?.stacks[0]?.elements[0]
    expect(pqNonGamifiedInstance?.options.pointsMultiplier).toEqual(2)

    const mlGamifiedInstance =
      updatedMicrolearningGamified?.stacks[0]?.elements[0]
    expect(mlGamifiedInstance?.options.pointsMultiplier).toEqual(6)

    const mlAssessmentInstance =
      updatedMicrolearningAssessment?.stacks[0]?.elements[0]
    expect(mlAssessmentInstance?.options.pointsMultiplier).toEqual(6)

    const mlNonGamifiedInstance =
      unchangedMicrolearningNonGamified?.stacks[0]?.elements[0]
    expect(mlNonGamifiedInstance?.options.pointsMultiplier).toEqual(3)

    const gaGamifiedInstance =
      updatedGroupActivityGamified?.stacks[0]?.elements[0]
    expect(gaGamifiedInstance?.options.pointsMultiplier).toEqual(8)

    const gaAssessmentInstance =
      updatedGroupActivityAssessment?.stacks[0]?.elements[0]
    expect(gaAssessmentInstance?.options.pointsMultiplier).toEqual(8)

    const gaNonGamifiedInstance =
      unchangedGroupActivityNonGamified?.stacks[0]?.elements[0]
    expect(gaNonGamifiedInstance?.options.pointsMultiplier).toEqual(4)
  })

  it('Verify that with live quiz grading components set, the quizzes are updated accordingly (and other activities are skipped', async () => {
    // seed three live quizzes with different gamification and assessment settings
    const gamifiedLiveQuiz = await seedLiveQuiz(
      {
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        defaultPoints: 10,
        defaultCorrectPoints: 20,
        maxBonusPoints: 30,
        timeToZeroBonus: 10,
      },
      prisma
    )
    const assessmentLiveQuiz = await seedLiveQuiz(
      {
        isGamificationEnabled: false,
        isAssessmentEnabled: true,
        defaultPoints: 10,
        defaultCorrectPoints: 20,
        maxBonusPoints: 30,
        timeToZeroBonus: 10,
      },
      prisma
    )
    const standardLiveQuiz = await seedLiveQuiz(
      {
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        defaultPoints: 10,
        defaultCorrectPoints: 20,
        maxBonusPoints: 30,
        timeToZeroBonus: 10,
      },
      prisma
    )

    // update the custom grading logic of the live quiz through batch updates
    const res = await applyActivityBatchOperations(
      {
        activityIds: [
          gamifiedLiveQuiz.id,
          assessmentLiveQuiz.id,
          standardLiveQuiz.id,
        ],
        basePoints: 100,
        correctnessPoints: 200,
        bonusPoints: 300,
        timeToZeroBonus: 60,
      },
      userOneCtx
    )
    expect(res).toBe(2) // gamified and assessment quizzes should be updated

    // verify that the points of the gamified and assessment live quiz have been updated, while the others remain unchanged
    const updatedGamifiedLiveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: gamifiedLiveQuiz.id },
    })
    expect(updatedGamifiedLiveQuiz?.defaultPoints).toBe(100)
    expect(updatedGamifiedLiveQuiz?.defaultCorrectPoints).toBe(200)
    expect(updatedGamifiedLiveQuiz?.maxBonusPoints).toBe(300)
    expect(updatedGamifiedLiveQuiz?.timeToZeroBonus).toBe(60)

    const updatedAssessmentLiveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: assessmentLiveQuiz.id },
    })
    expect(updatedAssessmentLiveQuiz?.defaultPoints).toBe(100)
    expect(updatedAssessmentLiveQuiz?.defaultCorrectPoints).toBe(200)
    expect(updatedAssessmentLiveQuiz?.maxBonusPoints).toBe(300)
    expect(updatedAssessmentLiveQuiz?.timeToZeroBonus).toBe(60)

    const unchangedStandardLiveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: standardLiveQuiz.id },
    })
    expect(unchangedStandardLiveQuiz?.defaultPoints).toBe(10)
    expect(unchangedStandardLiveQuiz?.defaultCorrectPoints).toBe(20)
    expect(unchangedStandardLiveQuiz?.maxBonusPoints).toBe(30)
    expect(unchangedStandardLiveQuiz?.timeToZeroBonus).toBe(10)
  })

  it('Verify that only draft and scheduled activities are updated', async () => {
    const course = await seedCourse({}, prisma)
    const courseNew = await seedCourse({}, prisma)

    const lq1 = await seedLiveQuiz({ status: PublicationStatus.DRAFT }, prisma)
    const lq2 = await seedLiveQuiz(
      { status: PublicationStatus.SCHEDULED },
      prisma
    )
    const lq3 = await seedLiveQuiz(
      { status: PublicationStatus.PUBLISHED },
      prisma
    )
    const lq4 = await seedLiveQuiz(
      { courseId: course.id, status: PublicationStatus.ENDED },
      prisma
    )

    const pq1 = await seedPracticeQuiz(
      { courseId: course.id, status: PublicationStatus.DRAFT },
      prisma
    )
    const pq2 = await seedPracticeQuiz(
      { courseId: course.id, status: PublicationStatus.SCHEDULED },
      prisma
    )
    const pq3 = await seedPracticeQuiz(
      { courseId: course.id, status: PublicationStatus.PUBLISHED },
      prisma
    )

    const ml1 = await seedMicroLearning(
      { courseId: course.id, status: PublicationStatus.DRAFT },
      prisma
    )
    const ml2 = await seedMicroLearning(
      { courseId: course.id, status: PublicationStatus.SCHEDULED },
      prisma
    )
    const ml3 = await seedMicroLearning(
      { courseId: course.id, status: PublicationStatus.PUBLISHED },
      prisma
    )
    const ml4 = await seedMicroLearning(
      { courseId: course.id, status: PublicationStatus.ENDED },
      prisma
    )

    const ga1 = await seedGroupActivity(
      { courseId: course.id, status: PublicationStatus.DRAFT },
      prisma
    )
    const ga2 = await seedGroupActivity(
      { courseId: course.id, status: PublicationStatus.SCHEDULED },
      prisma
    )
    const ga3 = await seedGroupActivity(
      { courseId: course.id, status: PublicationStatus.PUBLISHED },
      prisma
    )
    const ga4 = await seedGroupActivity(
      { courseId: course.id, status: PublicationStatus.ENDED },
      prisma
    )
    const ga5 = await seedGroupActivity(
      { courseId: course.id, status: PublicationStatus.GRADED },
      prisma
    )

    const updated = await applyActivityBatchOperations(
      {
        activityIds: [
          lq1.id,
          lq2.id,
          lq3.id,
          lq4.id,
          pq1.id,
          pq2.id,
          pq3.id,
          ml1.id,
          ml2.id,
          ml3.id,
          ml4.id,
          ga1.id,
          ga2.id,
          ga3.id,
          ga4.id,
          ga5.id,
        ],
        courseId: courseNew.id,
      },
      userOneCtx
    )
    expect(updated).toEqual(8) // only draft and scheduled activities should be updated

    // verify that the changes were only applied to the activities in draft and scheduled state
    const lq1Updated = await prisma.liveQuiz.findUnique({
      where: { id: lq1.id },
    })
    expect(lq1Updated?.courseId).toEqual(courseNew.id)
    const lq2Updated = await prisma.liveQuiz.findUnique({
      where: { id: lq2.id },
    })
    expect(lq2Updated?.courseId).toEqual(courseNew.id)
    const lq3Unchanged = await prisma.liveQuiz.findUnique({
      where: { id: lq3.id },
    })
    expect(lq3Unchanged?.courseId).toBeNull()
    const lq4Unchanged = await prisma.liveQuiz.findUnique({
      where: { id: lq4.id },
    })
    expect(lq4Unchanged?.courseId).toEqual(course.id)

    const pq1Updated = await prisma.practiceQuiz.findUnique({
      where: { id: pq1.id },
    })
    expect(pq1Updated?.courseId).toEqual(courseNew.id)
    const pq2Updated = await prisma.practiceQuiz.findUnique({
      where: { id: pq2.id },
    })
    expect(pq2Updated?.courseId).toEqual(courseNew.id)
    const pq3Unchanged = await prisma.practiceQuiz.findUnique({
      where: { id: pq3.id },
    })
    expect(pq3Unchanged?.courseId).toEqual(course.id)

    const ml1Updated = await prisma.microLearning.findUnique({
      where: { id: ml1.id },
    })
    expect(ml1Updated?.courseId).toEqual(courseNew.id)
    const ml2Updated = await prisma.microLearning.findUnique({
      where: { id: ml2.id },
    })
    expect(ml2Updated?.courseId).toEqual(courseNew.id)
    const ml3Unchanged = await prisma.microLearning.findUnique({
      where: { id: ml3.id },
    })
    expect(ml3Unchanged?.courseId).toEqual(course.id)
    const ml4Unchanged = await prisma.microLearning.findUnique({
      where: { id: ml4.id },
    })
    expect(ml4Unchanged?.courseId).toEqual(course.id)

    const ga1Updated = await prisma.groupActivity.findUnique({
      where: { id: ga1.id },
    })
    expect(ga1Updated?.courseId).toEqual(courseNew.id)
    const ga2Updated = await prisma.groupActivity.findUnique({
      where: { id: ga2.id },
    })
    expect(ga2Updated?.courseId).toEqual(courseNew.id)
    const ga3Unchanged = await prisma.groupActivity.findUnique({
      where: { id: ga3.id },
    })
    expect(ga3Unchanged?.courseId).toEqual(course.id)
    const ga4Unchanged = await prisma.groupActivity.findUnique({
      where: { id: ga4.id },
    })
    expect(ga4Unchanged?.courseId).toEqual(course.id)
    const ga5Unchanged = await prisma.groupActivity.findUnique({
      where: { id: ga5.id },
    })
    expect(ga5Unchanged?.courseId).toEqual(course.id)
  })

  it('Verify that group activities can only be assigned to courses with group formation enabled and the deadline set correspondingly', async () => {
    const course = await seedCourse({}, prisma)
    const newCourse = await seedCourse({ isGroupCreationEnabled: true }, prisma)
    const newCourseNoGroups = await seedCourse(
      { isGroupCreationEnabled: false },
      prisma
    )
    const newCourseLateGroupDeadline = await seedCourse(
      {
        isGroupCreationEnabled: true,
        groupDeadlineDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      },
      prisma
    )
    const groupActivity = await seedGroupActivity(
      { courseId: course.id },
      prisma
    )

    // try to assign the group activity to a course with group formation disabled
    const res1 = await applyActivityBatchOperations(
      { activityIds: [groupActivity.id], courseId: newCourseNoGroups.id },
      userOneCtx
    )
    expect(res1).toBe(0)

    // verify that the group activity has not been re-assigned
    const groupActivityUnchanged = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })
    expect(groupActivityUnchanged?.courseId).toEqual(course.id)

    // try to assign the group activity to a course with group formation enabled
    const res2 = await applyActivityBatchOperations(
      { activityIds: [groupActivity.id], courseId: newCourse.id },
      userOneCtx
    )
    expect(res2).toBe(1)

    // verify that the group activity has been re-assigned
    const groupActivityUpdated = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })
    expect(groupActivityUpdated?.courseId).toEqual(newCourse.id)

    // try to assign the group activity to a course with the group formation deadline after the group activity's start date
    const res3 = await applyActivityBatchOperations(
      {
        activityIds: [groupActivity.id],
        courseId: newCourseLateGroupDeadline.id,
      },
      userOneCtx
    )
    expect(res3).toBe(0)

    // verify that the group activity has not been re-assigned
    const groupActivityUpdated2 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })
    expect(groupActivityUpdated2?.courseId).toEqual(newCourse.id)
  })

  it('Verify that microlearnings and group activities can only be assigned to courses with corresponding availability', async () => {
    // seed course, group activity and microlearning
    const course = await seedCourse({}, prisma)
    const groupActivity = await seedGroupActivity(
      { courseId: course.id },
      prisma
    )
    const microlearning = await seedMicroLearning(
      { courseId: course.id },
      prisma
    )

    // create different valid and invalid courses
    const invalid1 = await seedCourse(
      { endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
      prisma
    ) // course ends before activity
    const invalid2 = await seedCourse(
      {
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
      },
      prisma
    ) // course starts after activity and ends before activity
    const invalid3 = await seedCourse(
      {
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        groupDeadlineDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
      prisma
    ) // course starts after activity

    const valid = await seedCourse(
      {
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      },
      prisma
    )

    // try to assign the group activity to the first invalid course and validate that no assignment is made
    const res1 = await applyActivityBatchOperations(
      {
        activityIds: [groupActivity.id, microlearning.id],
        courseId: invalid1.id,
      },
      userOneCtx
    )
    expect(res1).toBe(0)

    const groupActivityUpdated1 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })
    expect(groupActivityUpdated1?.courseId).toEqual(course.id)
    const microlearningUpdated1 = await prisma.microLearning.findUnique({
      where: { id: microlearning.id },
    })
    expect(microlearningUpdated1?.courseId).toEqual(course.id)

    // try to assign the group activity to the second invalid course and validate that no assignment is made
    const res2 = await applyActivityBatchOperations(
      {
        activityIds: [groupActivity.id, microlearning.id],
        courseId: invalid2.id,
      },
      userOneCtx
    )
    expect(res2).toBe(0)

    const groupActivityUpdated2 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })
    expect(groupActivityUpdated2?.courseId).toEqual(course.id)
    const microlearningUpdated2 = await prisma.microLearning.findUnique({
      where: { id: microlearning.id },
    })
    expect(microlearningUpdated2?.courseId).toEqual(course.id)

    // try to assign the group activity to the third invalid course and validate that no assignment is made
    const res3 = await applyActivityBatchOperations(
      {
        activityIds: [groupActivity.id, microlearning.id],
        courseId: invalid3.id,
      },
      userOneCtx
    )
    expect(res3).toBe(0)

    const groupActivityUpdated3 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })
    expect(groupActivityUpdated3?.courseId).toEqual(course.id)
    const microlearningUpdated3 = await prisma.microLearning.findUnique({
      where: { id: microlearning.id },
    })
    expect(microlearningUpdated3?.courseId).toEqual(course.id)

    // try to assign the group activity to the valid course and validate that the assignment is made
    const res4 = await applyActivityBatchOperations(
      { activityIds: [groupActivity.id, microlearning.id], courseId: valid.id },
      userOneCtx
    )
    expect(res4).toBe(2)

    const groupActivityUpdated4 = await prisma.groupActivity.findUnique({
      where: { id: groupActivity.id },
    })
    expect(groupActivityUpdated4?.courseId).toEqual(valid.id)
    const microlearningUpdated4 = await prisma.microLearning.findUnique({
      where: { id: microlearning.id },
    })
    expect(microlearningUpdated4?.courseId).toEqual(valid.id)
  })

  it('Verify that the derived access to an activity through a course is updated correctly when re-assigning it', async () => {
    const course1 = await seedCourse(
      {
        directPermissions: {
          create: {
            userId: userTwoCtx.user.sub,
            permissionLevel: PermissionLevel.WRITE,
          },
        },
      },
      prisma
    )
    const course2 = await seedCourse(
      {
        directPermissions: {
          create: {
            userId: userThreeCtx.user.sub,
            permissionLevel: PermissionLevel.ADMIN,
          },
        },
      },
      prisma
    )

    // assign an activity of each type to the first course
    const liveQuiz = await seedLiveQuiz({ courseId: course1.id }, prisma)
    const practiceQuiz = await seedPracticeQuiz(
      { courseId: course1.id },
      prisma
    )
    const microLearning = await seedMicroLearning(
      { courseId: course1.id },
      prisma
    )
    const groupActivity = await seedGroupActivity(
      { courseId: course1.id },
      prisma
    )

    // verify that user two has derived access to all activities
    const permission1 = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission1).not.toBeNull()
    expect(permission1!.permissionLevel).toEqual(PermissionLevel.EXECUTE)

    const permission2 = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission2).not.toBeNull()
    expect(permission2!.permissionLevel).toEqual(PermissionLevel.EXECUTE)

    const permission3 = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission3).not.toBeNull()
    expect(permission3!.permissionLevel).toEqual(PermissionLevel.EXECUTE)

    const permission4 = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission4).not.toBeNull()
    expect(permission4!.permissionLevel).toEqual(PermissionLevel.EXECUTE)

    // verify that user three has no access to any activity
    const permission5 = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission5).toBeNull()

    const permission6 = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission6).toBeNull()

    const permission7 = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission7).toBeNull()

    const permission8 = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission8).toBeNull()

    // re-assign the activities to course2 using the batch operation
    const res = await applyActivityBatchOperations(
      {
        activityIds: [
          liveQuiz.id,
          practiceQuiz.id,
          microLearning.id,
          groupActivity.id,
        ],
        courseId: course2.id,
      },
      userOneCtx
    )
    expect(res).toBe(4)

    // verify that user two has no access to any activity
    const permission9 = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission9).toBeNull()

    const permission10 = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission10).toBeNull()

    const permission11 = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission11).toBeNull()

    const permission12 = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userTwoCtx.user.sub,
        },
      },
    })
    expect(permission12).toBeNull()

    // verify that user three has access to all activities
    const permission13 = await prisma.derivedPermission.findUnique({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuiz.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission13).not.toBeNull()
    expect(permission13!.permissionLevel).toEqual(PermissionLevel.ADMIN)

    const permission14 = await prisma.derivedPermission.findUnique({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuiz.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission14).not.toBeNull()
    expect(permission14!.permissionLevel).toEqual(PermissionLevel.ADMIN)

    const permission15 = await prisma.derivedPermission.findUnique({
      where: {
        microLearningId_userId: {
          microLearningId: microLearning.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission15).not.toBeNull()
    expect(permission15!.permissionLevel).toEqual(PermissionLevel.ADMIN)

    const permission16 = await prisma.derivedPermission.findUnique({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivity.id,
          userId: userThreeCtx.user.sub,
        },
      },
    })
    expect(permission16).not.toBeNull()
    expect(permission16!.permissionLevel).toEqual(PermissionLevel.ADMIN)
  })

  it('Verify that course re-assignments for activities in an assessment course are only accepted from assessment course admins / owner', async () => {
    // seed an assessment course and a normal gamified course
    const assessment = await seedCourse({ isAssessmentEnabled: true }, prisma)
    const gamified = await seedCourse({ isGamificationEnabled: true }, prisma)

    // seed activities that are assigned to the assessment course
    const lq = await seedLiveQuiz(
      {
        courseId: assessment.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
        isAssessmentEnabled: true,
      },
      prisma
    )
    const pq = await seedPracticeQuiz(
      {
        courseId: assessment.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
        isAssessmentEnabled: true,
      },
      prisma
    )
    const ml = await seedMicroLearning(
      {
        courseId: assessment.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
        isAssessmentEnabled: true,
      },
      prisma
    )
    const ga = await seedGroupActivity(
      {
        courseId: assessment.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
        isAssessmentEnabled: true,
      },
      prisma
    )

    // verify that all activities have assessment enabled and are assigned to the assessment course
    const verification1 = await prisma.liveQuiz.findUnique({
      where: { id: lq.id },
    })
    expect(verification1).not.toBeNull()
    expect(verification1!.isAssessmentEnabled).toBe(true)
    expect(verification1!.courseId).toBe(assessment.id)

    const verification2 = await prisma.practiceQuiz.findUnique({
      where: { id: pq.id },
    })
    expect(verification2).not.toBeNull()
    expect(verification2!.isAssessmentEnabled).toBe(true)
    expect(verification2!.courseId).toBe(assessment.id)

    const verification3 = await prisma.microLearning.findUnique({
      where: { id: ml.id },
    })
    expect(verification3).not.toBeNull()
    expect(verification3!.isAssessmentEnabled).toBe(true)
    expect(verification3!.courseId).toBe(assessment.id)

    const verification4 = await prisma.groupActivity.findUnique({
      where: { id: ga.id },
    })
    expect(verification4).not.toBeNull()
    expect(verification4!.isAssessmentEnabled).toBe(true)
    expect(verification4!.courseId).toBe(assessment.id)

    // share both courses with read, write and admin permissions with users two, three and four
    await prisma.permission.createMany({
      data: [
        {
          courseId: assessment.id,
          userId: userTwoCtx.user.sub,
          permissionLevel: PermissionLevel.READ,
        },
        {
          courseId: assessment.id,
          userId: userThreeCtx.user.sub,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          courseId: assessment.id,
          userId: userFourCtx.user.sub,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          courseId: gamified.id,
          userId: userTwoCtx.user.sub,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          courseId: gamified.id,
          userId: userThreeCtx.user.sub,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          courseId: gamified.id,
          userId: userFourCtx.user.sub,
          permissionLevel: PermissionLevel.READ,
        },
        {
          courseId: gamified.id,
          userId: userFiveCtx.user.sub,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ courseId: assessment.id }, prisma)
    await recomputeDerivedPermissions({ courseId: gamified.id }, prisma)

    // share the activities directly with user five
    await prisma.permission.createMany({
      data: [
        {
          liveQuizId: lq.id,
          userId: userFiveCtx.user.sub,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          practiceQuizId: pq.id,
          userId: userFiveCtx.user.sub,
          permissionLevel: PermissionLevel.WRITE,
        },
        {
          microLearningId: ml.id,
          userId: userFiveCtx.user.sub,
          permissionLevel: PermissionLevel.EXECUTE,
        },
        {
          groupActivityId: ga.id,
          userId: userFiveCtx.user.sub,
          permissionLevel: PermissionLevel.READ,
        },
      ],
    })
    await recomputeDerivedPermissions({ liveQuizId: lq.id }, prisma)
    await recomputeDerivedPermissions({ practiceQuizId: pq.id }, prisma)
    await recomputeDerivedPermissions({ microLearningId: ml.id }, prisma)
    await recomputeDerivedPermissions({ groupActivityId: ga.id }, prisma)

    // verify that triggering a course re-assignment is only successful for users one and four
    for (const userCtx of [userTwoCtx, userThreeCtx, userFiveCtx]) {
      const res = await applyActivityBatchOperations(
        {
          activityIds: [lq.id, pq.id, ml.id, ga.id],
          courseId: gamified.id,
        },
        userCtx
      )
      expect(res).toBe(0)

      const verification1 = await prisma.liveQuiz.findUnique({
        where: { id: lq.id },
      })
      expect(verification1).not.toBeNull()
      expect(verification1!.isAssessmentEnabled).toBe(true)
      expect(verification1!.courseId).toBe(assessment.id)

      const verification2 = await prisma.practiceQuiz.findUnique({
        where: { id: pq.id },
      })
      expect(verification2).not.toBeNull()
      expect(verification2!.isAssessmentEnabled).toBe(true)
      expect(verification2!.courseId).toBe(assessment.id)

      const verification3 = await prisma.microLearning.findUnique({
        where: { id: ml.id },
      })
      expect(verification3).not.toBeNull()
      expect(verification3!.isAssessmentEnabled).toBe(true)
      expect(verification3!.courseId).toBe(assessment.id)

      const verification4 = await prisma.groupActivity.findUnique({
        where: { id: ga.id },
      })
      expect(verification4).not.toBeNull()
      expect(verification4!.isAssessmentEnabled).toBe(true)
      expect(verification4!.courseId).toBe(assessment.id)
    }

    for (const userCtx of [userOneCtx, userFourCtx]) {
      const res = await applyActivityBatchOperations(
        {
          activityIds: [lq.id, pq.id, ml.id, ga.id],
          courseId: gamified.id,
        },
        userCtx
      )
      expect(res).toBe(4)

      const verification1 = await prisma.liveQuiz.findUnique({
        where: { id: lq.id },
      })
      expect(verification1).not.toBeNull()
      expect(verification1!.isAssessmentEnabled).toBe(false)
      expect(verification1!.courseId).toBe(gamified.id)

      const verification2 = await prisma.practiceQuiz.findUnique({
        where: { id: pq.id },
      })
      expect(verification2).not.toBeNull()
      expect(verification2!.isAssessmentEnabled).toBe(false)
      expect(verification2!.courseId).toBe(gamified.id)

      const verification3 = await prisma.microLearning.findUnique({
        where: { id: ml.id },
      })
      expect(verification3).not.toBeNull()
      expect(verification3!.isAssessmentEnabled).toBe(false)
      expect(verification3!.courseId).toBe(gamified.id)

      const verification4 = await prisma.groupActivity.findUnique({
        where: { id: ga.id },
      })
      expect(verification4).not.toBeNull()
      expect(verification4!.isAssessmentEnabled).toBe(false)
      expect(verification4!.courseId).toBe(gamified.id)

      // assign the activities back to the assessment course to be ready for another transfer
      if (userCtx.user.sub === userOneCtx.user.sub) {
        // backwards assignment only works for user one (user four has not sufficient permissions, on purpose)
        const res2 = await applyActivityBatchOperations(
          {
            activityIds: [lq.id, pq.id, ml.id, ga.id],
            courseId: assessment.id,
          },
          userCtx
        )
        expect(res2).toBe(4)

        const verification5 = await prisma.liveQuiz.findUnique({
          where: { id: lq.id },
        })
        expect(verification5).not.toBeNull()
        expect(verification5!.isAssessmentEnabled).toBe(true)
        expect(verification5!.courseId).toBe(assessment.id)

        const verification6 = await prisma.practiceQuiz.findUnique({
          where: { id: pq.id },
        })
        expect(verification6).not.toBeNull()
        expect(verification6!.isAssessmentEnabled).toBe(true)
        expect(verification6!.courseId).toBe(assessment.id)

        const verification7 = await prisma.microLearning.findUnique({
          where: { id: ml.id },
        })
        expect(verification7).not.toBeNull()
        expect(verification7!.isAssessmentEnabled).toBe(true)
        expect(verification7!.courseId).toBe(assessment.id)

        const verification8 = await prisma.groupActivity.findUnique({
          where: { id: ga.id },
        })
        expect(verification8).not.toBeNull()
        expect(verification8!.isAssessmentEnabled).toBe(true)
        expect(verification8!.courseId).toBe(assessment.id)
      }
    }
  })

  it('Verify that the course assignment, multiplier and points can be updated simultaneously and that the review status is updated correctly', async () => {
    // seed courses
    const course = await seedCourse({ isGamificationEnabled: true }, prisma)
    const newCourse = await seedCourse({ isGamificationEnabled: true }, prisma)

    // seed activites
    const lq = await seedLiveQuiz(
      {
        courseId: course.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
      },
      prisma
    )
    const pq = await seedPracticeQuiz(
      {
        courseId: course.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
      },
      prisma
    )
    const ml = await seedMicroLearning(
      {
        courseId: course.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
      },
      prisma
    )
    const ga = await seedGroupActivity(
      {
        courseId: course.id,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
      },
      prisma
    )

    // apply a batch operation where all options are passed -> only live quiz should be updated
    const res = await applyActivityBatchOperations(
      {
        activityIds: [lq.id, pq.id, ml.id, ga.id],
        courseId: newCourse.id,
        multiplier: 2,
        basePoints: 100,
        correctnessPoints: 200,
        bonusPoints: 0,
        timeToZeroBonus: 60,
      },
      userOneCtx
    )
    expect(res).toBe(1) // only live quiz should be updated

    // verify that only live quiz has been updated
    const updatedLiveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: lq.id },
    })
    expect(updatedLiveQuiz).not.toBeNull()
    expect(updatedLiveQuiz!.courseId).toEqual(newCourse.id)
    expect(updatedLiveQuiz!.pointsMultiplier).toEqual(2)
    expect(updatedLiveQuiz!.defaultPoints).toEqual(100)
    expect(updatedLiveQuiz!.defaultCorrectPoints).toEqual(200)
    expect(updatedLiveQuiz!.maxBonusPoints).toEqual(0)
    expect(updatedLiveQuiz!.timeToZeroBonus).toEqual(60)
    expect(updatedLiveQuiz!.reviewStatus).toEqual(ReviewStatus.INCOMPLETE)

    const unchangedPracticeQuiz = await prisma.practiceQuiz.findUnique({
      where: { id: pq.id },
    })
    expect(unchangedPracticeQuiz).not.toBeNull()
    expect(unchangedPracticeQuiz!.courseId).toEqual(course.id)
    expect(unchangedPracticeQuiz!.pointsMultiplier).toEqual(1)
    expect(unchangedPracticeQuiz!.reviewStatus).toEqual(ReviewStatus.REVIEWED)

    const unchangedMicroLearning = await prisma.microLearning.findUnique({
      where: { id: ml.id },
    })
    expect(unchangedMicroLearning).not.toBeNull()
    expect(unchangedMicroLearning!.courseId).toEqual(course.id)
    expect(unchangedMicroLearning!.pointsMultiplier).toEqual(1)
    expect(unchangedMicroLearning!.reviewStatus).toEqual(ReviewStatus.REVIEWED)

    const unchangedGroupActivity = await prisma.groupActivity.findUnique({
      where: { id: ga.id },
    })
    expect(unchangedGroupActivity).not.toBeNull()
    expect(unchangedGroupActivity!.courseId).toEqual(course.id)
    expect(unchangedGroupActivity!.pointsMultiplier).toEqual(1)
    expect(unchangedGroupActivity!.reviewStatus).toEqual(ReviewStatus.REVIEWED)

    // trigger another update only using course re-assignment and multiplier updates
    const res2 = await applyActivityBatchOperations(
      {
        activityIds: [lq.id, pq.id, ml.id, ga.id],
        courseId: newCourse.id,
        multiplier: 3,
      },
      userOneCtx
    )
    expect(res2).toBe(4)

    // verify that all activities have been updated and that the review status has been unset (course re-assignment)
    const updatedLiveQuiz2 = await prisma.liveQuiz.findUnique({
      where: { id: lq.id },
    })
    expect(updatedLiveQuiz2).not.toBeNull()
    expect(updatedLiveQuiz2!.courseId).toEqual(newCourse.id)
    expect(updatedLiveQuiz2!.pointsMultiplier).toEqual(3)
    expect(updatedLiveQuiz2!.reviewStatus).toEqual(ReviewStatus.INCOMPLETE)

    const updatedPracticeQuiz = await prisma.practiceQuiz.findUnique({
      where: { id: pq.id },
    })
    expect(updatedPracticeQuiz).not.toBeNull()
    expect(updatedPracticeQuiz!.courseId).toEqual(newCourse.id)
    expect(updatedPracticeQuiz!.pointsMultiplier).toEqual(3)
    expect(updatedPracticeQuiz!.reviewStatus).toEqual(ReviewStatus.INCOMPLETE)

    const updatedMicroLearning = await prisma.microLearning.findUnique({
      where: { id: ml.id },
    })
    expect(updatedMicroLearning).not.toBeNull()
    expect(updatedMicroLearning!.courseId).toEqual(newCourse.id)
    expect(updatedMicroLearning!.pointsMultiplier).toEqual(3)
    expect(updatedMicroLearning!.reviewStatus).toEqual(ReviewStatus.INCOMPLETE)

    const updatedGroupActivity = await prisma.groupActivity.findUnique({
      where: { id: ga.id },
    })
    expect(updatedGroupActivity).not.toBeNull()
    expect(updatedGroupActivity!.courseId).toEqual(newCourse.id)
    expect(updatedGroupActivity!.pointsMultiplier).toEqual(3)
    expect(updatedGroupActivity!.reviewStatus).toEqual(ReviewStatus.INCOMPLETE)

    // set the status to reviewed again for all activities
    await prisma.liveQuiz.update({
      where: { id: lq.id },
      data: { reviewStatus: ReviewStatus.REVIEWED },
    })
    await prisma.practiceQuiz.update({
      where: { id: pq.id },
      data: { reviewStatus: ReviewStatus.REVIEWED },
    })
    await prisma.microLearning.update({
      where: { id: ml.id },
      data: { reviewStatus: ReviewStatus.REVIEWED },
    })
    await prisma.groupActivity.update({
      where: { id: ga.id },
      data: { reviewStatus: ReviewStatus.REVIEWED },
    })

    // trigger another batch operation only modifying the multiplier
    const res3 = await applyActivityBatchOperations(
      {
        activityIds: [lq.id, pq.id, ml.id, ga.id],
        courseId: newCourse.id, // re-assignment to the same course should not result in modifications
        multiplier: 4,
      },
      userOneCtx
    )
    expect(res3).toBe(4)

    // verify that all activities have been updated and the status has been set to changed after review
    const updatedLiveQuiz3 = await prisma.liveQuiz.findUnique({
      where: { id: lq.id },
    })
    expect(updatedLiveQuiz3).not.toBeNull()
    expect(updatedLiveQuiz3!.courseId).toEqual(newCourse.id)
    expect(updatedLiveQuiz3!.pointsMultiplier).toEqual(4)
    expect(updatedLiveQuiz3!.reviewStatus).toEqual(
      ReviewStatus.MODIFIED_AFTER_REVIEW
    )

    const updatedPracticeQuiz2 = await prisma.practiceQuiz.findUnique({
      where: { id: pq.id },
    })
    expect(updatedPracticeQuiz2).not.toBeNull()
    expect(updatedPracticeQuiz2!.courseId).toEqual(newCourse.id)
    expect(updatedPracticeQuiz2!.pointsMultiplier).toEqual(4)
    expect(updatedPracticeQuiz2!.reviewStatus).toEqual(
      ReviewStatus.MODIFIED_AFTER_REVIEW
    )

    const updatedMicroLearning2 = await prisma.microLearning.findUnique({
      where: { id: ml.id },
    })
    expect(updatedMicroLearning2).not.toBeNull()
    expect(updatedMicroLearning2!.courseId).toEqual(newCourse.id)
    expect(updatedMicroLearning2!.pointsMultiplier).toEqual(4)
    expect(updatedMicroLearning2!.reviewStatus).toEqual(
      ReviewStatus.MODIFIED_AFTER_REVIEW
    )

    const updatedGroupActivity2 = await prisma.groupActivity.findUnique({
      where: { id: ga.id },
    })
    expect(updatedGroupActivity2).not.toBeNull()
    expect(updatedGroupActivity2!.courseId).toEqual(newCourse.id)
    expect(updatedGroupActivity2!.pointsMultiplier).toEqual(4)
    expect(updatedGroupActivity2!.reviewStatus).toEqual(
      ReviewStatus.MODIFIED_AFTER_REVIEW
    )
  })
})
