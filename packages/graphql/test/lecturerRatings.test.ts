import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  ElementData,
  ElementInstanceOptions,
  ElementInstanceResults,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { v4 as uuid } from 'uuid'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  lecturerRatingCourses,
  readLecturerRatingCourseIds,
  saveLecturerRating,
  startLecturerRatingSession,
} from '../src/services/lecturerRatings.js'
import { initializePrisma } from './helpers.js'

describe('lecturer ratings', () => {
  let prisma: PrismaClient
  let ownerContext: ContextWithUser
  let managerContext: ContextWithUser
  const userIds: string[] = []

  beforeAll(async () => {
    prisma = (await initializePrisma()).prisma
  })

  afterAll(async () => await prisma.$disconnect())

  beforeEach(async () => {
    const contexts = await Promise.all(
      Array.from({ length: 2 }, async () => {
        const id = uuid()
        const user = await prisma.user.create({
          data: { id, email: id + '@example.invalid', shortname: id },
        })
        userIds.push(user.id)
        return { prisma, user: { sub: user.id } } as ContextWithUser
      })
    )
    ;[ownerContext, managerContext] = contexts as [
      ContextWithUser,
      ContextWithUser,
    ]
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    userIds.length = 0
  })

  async function createCourse(ownerId: string) {
    const suffix = uuid()
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const course = await prisma.course.create({
      data: {
        name: `Synthetic rating course ${suffix}`,
        displayName: `Synthetic rating course ${suffix}`,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate,
        groupDeadlineDate: endDate,
        authType: CourseAuthType.PIN,
        ownerId,
      },
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    return course
  }

  async function createElement({
    type,
    ownerId,
    originalId = null,
    version = 1,
    hasSampleSolution = true,
  }: {
    type: 'SC' | 'KPRIM'
    ownerId: string
    originalId?: string | null
    version?: number
    hasSampleSolution?: boolean
  }) {
    const id = uuid()
    const element = await prisma.element.create({
      data: {
        version,
        originalId,
        name: `Synthetic ${type} ${id}`,
        content: `Synthetic ${type} stem ${id}`,
        type,
        ownerId,
        options: {
          displayMode: 'LIST',
          hasSampleSolution,
          hasAnswerFeedbacks: false,
          choices:
            type === ElementType.SC
              ? [
                  { ix: 0, value: 'Synthetic key', correct: true },
                  { ix: 1, value: 'Synthetic distractor', correct: false },
                ]
              : [
                  { ix: 0, value: 'Synthetic one', correct: true },
                  { ix: 1, value: 'Synthetic two', correct: false },
                  { ix: 2, value: 'Synthetic three', correct: true },
                  { ix: 3, value: 'Synthetic four', correct: false },
                ],
        },
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)
    return element
  }

  function elementDataFor(
    element: Awaited<ReturnType<typeof createElement>>,
    snapshotId = `${element.id}-v${element.version}`
  ): ElementData {
    const data = processElementData(element)
    return { ...data, id: snapshotId } as ElementData
  }

  async function createPracticeInstance({
    courseId,
    element,
    ownerId,
    isDeleted = false,
    snapshotId,
  }: {
    courseId: string
    element: Awaited<ReturnType<typeof createElement>>
    ownerId: string
    isDeleted?: boolean
    snapshotId?: string
  }) {
    const elementData = elementDataFor(element, snapshotId)
    const quiz = await prisma.practiceQuiz.create({
      data: {
        name: `Synthetic rating practice ${uuid()}`,
        displayName: 'Synthetic rating practice',
        courseId,
        isDeleted,
        ownerId,
        stacks: {
          create: {
            order: 0,
            type: ElementStackType.PRACTICE_QUIZ,
            courseId,
            elements: {
              create: {
                order: 0,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementId: element.id,
                elementType: element.type,
                options: {} as ElementInstanceOptions,
                elementData,
                results: getInitialInstanceResults(elementData),
                anonymousResults: getInitialInstanceResults(
                  elementData
                ) as ElementInstanceResults,
                ownerId,
              },
            },
          },
        },
      },
      include: { stacks: { include: { elements: true } } },
    })
    return quiz.stacks[0]!.elements[0]!
  }

  it('atomically starts from current keyed course activity instances', async () => {
    const course = await createCourse(ownerContext.user.sub)
    vi.stubEnv('LECTURER_RATING_COURSE_IDS_JSON', JSON.stringify([course.id]))

    const scV1 = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
      originalId: 'synthetic-family',
      version: 1,
    })
    const scV2 = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
      originalId: 'synthetic-family',
      version: 2,
    })
    const kprim = await createElement({
      type: ElementType.KPRIM,
      ownerId: ownerContext.user.sub,
    })
    const outdated = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
    })
    const deletedActivity = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
    })
    const ungraded = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
      hasSampleSolution: false,
    })

    for (const [element, deleted, snapshotId] of [
      [scV1, false, undefined],
      [scV2, false, undefined],
      [kprim, false, undefined],
      [outdated, false, `${outdated.id}-v0`],
      [deletedActivity, true, undefined],
      [ungraded, false, undefined],
    ] as const) {
      await createPracticeInstance({
        courseId: course.id,
        element,
        ownerId: ownerContext.user.sub,
        isDeleted: deleted,
        snapshotId,
      })
    }

    const [first, concurrent] = await Promise.all([
      startLecturerRatingSession({ courseId: course.id }, ownerContext),
      startLecturerRatingSession({ courseId: course.id }, ownerContext),
    ])
    const resumed = await startLecturerRatingSession(
      { courseId: course.id },
      ownerContext
    )

    expect(first.id).toBe(concurrent.id)
    expect(first.id).toBe(resumed.id)
    expect(first.items.map(({ id }) => id)).toEqual(
      resumed.items.map(({ id }) => id)
    )
    expect(first.items).toHaveLength(2)
    expect(first.items.map(({ format }) => format)).toEqual(['SC', 'KPRIM'])
    expect(first.items[0]).toMatchObject({
      title: scV2.name,
      stem: scV2.content,
      unavailable: false,
    })
    expect(first.items[0]!.title).not.toBe(scV1.name)
    expect(first.items[1]!.choices).toHaveLength(4)
  })

  it('masks revoked item access on resume and rejects the save', async () => {
    const course = await createCourse(ownerContext.user.sub)
    const element = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
    })
    const instance = await createPracticeInstance({
      courseId: course.id,
      element,
      ownerId: ownerContext.user.sub,
    })
    vi.stubEnv('LECTURER_RATING_COURSE_IDS_JSON', JSON.stringify([course.id]))

    await prisma.permission.createMany({
      data: [
        {
          userId: managerContext.user.sub,
          courseId: course.id,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          userId: managerContext.user.sub,
          elementId: element.id,
          permissionLevel: PermissionLevel.READ,
        },
      ],
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    expect(await lecturerRatingCourses(managerContext)).toEqual([
      { id: course.id, name: course.name },
    ])
    const started = await startLecturerRatingSession(
      { courseId: course.id },
      managerContext
    )
    expect(started.items[0]!.unavailable).toBe(false)

    await prisma.permission.deleteMany({
      where: {
        userId: managerContext.user.sub,
        elementId: element.id,
      },
    })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)

    // Course managers retain derived element access while the activity still uses it.
    const inherited = await startLecturerRatingSession(
      { courseId: course.id },
      managerContext
    )
    expect(inherited.items[0]!.unavailable).toBe(false)
    await prisma.elementInstance.delete({ where: { id: instance.id } })
    await recomputeDerivedPermissions({ elementId: element.id }, prisma)
    const resumed = await startLecturerRatingSession(
      { courseId: course.id },
      managerContext
    )
    expect(resumed.items[0]).toMatchObject({
      title: '',
      stem: '',
      choices: [],
      unavailable: true,
    })

    await expect(
      saveLecturerRating(
        {
          courseId: course.id,
          itemId: resumed.items[0]!.id,
          expectedVersion: resumed.items[0]!.ratingVersion,
          difficulty: 3,
          bloom: 'understand',
        },
        managerContext
      )
    ).rejects.toMatchObject({
      extensions: { code: 'LECTURER_RATING_FORBIDDEN' },
    })
  })

  it('reuses saves, records explicit skips, and rejects stale revisions', async () => {
    const course = await createCourse(ownerContext.user.sub)
    const element = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
    })
    await createPracticeInstance({
      courseId: course.id,
      element,
      ownerId: ownerContext.user.sub,
    })
    vi.stubEnv('LECTURER_RATING_COURSE_IDS_JSON', JSON.stringify([course.id]))

    const session = await startLecturerRatingSession(
      { courseId: course.id },
      ownerContext
    )
    const { id: itemId, ratingVersion: expectedVersion } = session.items[0]!
    const rated = await saveLecturerRating(
      {
        courseId: course.id,
        itemId,
        expectedVersion,
        difficulty: 3,
        bloom: 'understand',
      },
      ownerContext
    )
    expect(rated).toMatchObject({
      id: itemId,
      difficulty: 3,
      bloom: 'understand',
      reviewed: true,
      unavailable: false,
    })

    await expect(
      saveLecturerRating(
        { courseId: course.id, itemId, expectedVersion, difficulty: 2 },
        ownerContext
      )
    ).rejects.toMatchObject({
      extensions: { code: 'LECTURER_RATING_CONFLICT' },
    })
    const replay = await saveLecturerRating(
      {
        courseId: course.id,
        itemId,
        expectedVersion,
        difficulty: 3,
        bloom: 'understand',
      },
      ownerContext
    )
    expect(replay.ratingVersion).toBe(rated.ratingVersion)

    const skipped = await saveLecturerRating(
      { courseId: course.id, itemId, expectedVersion: rated.ratingVersion },
      ownerContext
    )
    expect(skipped).toMatchObject({
      id: itemId,
      difficulty: null,
      bloom: null,
      reviewed: true,
    })

    await prisma.element.update({
      where: { id: element.id },
      data: { version: { increment: 1 } },
    })
    await expect(
      saveLecturerRating(
        { courseId: course.id, itemId, expectedVersion, difficulty: 4 },
        ownerContext
      )
    ).rejects.toMatchObject({
      extensions: { code: 'LECTURER_RATING_ITEM_STALE' },
    })
  })

  it('does not include readable elements from another course', async () => {
    const selectedCourse = await createCourse(ownerContext.user.sub)
    const otherCourse = await createCourse(ownerContext.user.sub)
    const otherElement = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
    })
    await createPracticeInstance({
      courseId: otherCourse.id,
      element: otherElement,
      ownerId: ownerContext.user.sub,
    })
    vi.stubEnv(
      'LECTURER_RATING_COURSE_IDS_JSON',
      JSON.stringify([selectedCourse.id])
    )

    const session = await startLecturerRatingSession(
      { courseId: selectedCourse.id },
      ownerContext
    )

    expect(session.items).toEqual([])
  })

  it('returns a sparse session when only one format has an eligible family', async () => {
    const course = await createCourse(ownerContext.user.sub)
    const element = await createElement({
      type: ElementType.SC,
      ownerId: ownerContext.user.sub,
    })
    await createPracticeInstance({
      courseId: course.id,
      element,
      ownerId: ownerContext.user.sub,
    })
    vi.stubEnv('LECTURER_RATING_COURSE_IDS_JSON', JSON.stringify([course.id]))

    const session = await startLecturerRatingSession(
      { courseId: course.id },
      ownerContext
    )

    expect(session.items).toHaveLength(1)
    expect(session.items[0]).toMatchObject({
      format: 'SC',
      position: 1,
      title: element.name,
      unavailable: false,
    })
  })

  it('keeps the rating course allowlist separate and fail-closed', () => {
    expect(
      readLecturerRatingCourseIds({
        LECTURER_RATING_COURSE_IDS_JSON: JSON.stringify([
          'course-one',
          'course-one',
          '',
        ]),
        QUESTION_POOL_LABEL_FINANCE_COURSE_IDS_JSON: JSON.stringify([
          'calibration-course',
        ]),
      })
    ).toEqual(['course-one'])
    expect(
      readLecturerRatingCourseIds({
        LECTURER_RATING_COURSE_IDS_JSON: '{invalid',
      })
    ).toEqual([])
  })
})
