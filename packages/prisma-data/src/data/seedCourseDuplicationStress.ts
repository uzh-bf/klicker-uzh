import { prisma } from '@klicker-uzh/prisma'
import * as Prisma from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { v5 as uuidv5 } from 'uuid'
import { COURSE_ID_DUPLICATION_STRESS, USER_ID_TEST } from './constants.js'
import { prepareCourse } from './helpers.js'

const STRESS_ACTIVITY_COUNT = 200
const STRESS_ACTIVITY_CONCURRENCY = 20
const STRESS_PIN_CODE_START = 987650000

function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required to seed the course duplication stress fixture.'
    )
  }

  let hostname: string
  try {
    hostname = new URL(databaseUrl).hostname
  } catch {
    throw new Error('DATABASE_URL is not a valid development database URL.')
  }

  const isLocalHost =
    hostname === 'postgres' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')

  if (!isLocalHost) {
    throw new Error(
      'The course duplication stress fixture refuses non-local database hosts.'
    )
  }
}

function activityId(index: number) {
  return uuidv5(
    `course-duplication-stress-live-quiz-${index}`,
    COURSE_ID_DUPLICATION_STRESS
  )
}

async function seedCourseDuplicationStress() {
  if (process.env.ENV !== 'development') {
    throw new Error(
      'The course duplication stress fixture is available only in development.'
    )
  }

  assertLocalDatabase()

  if (process.env.COURSE_DUPLICATION_STRESS_WRITE !== 'true') {
    console.log(
      'Dry run only. Set COURSE_DUPLICATION_STRESS_WRITE=true to write the stress fixture.'
    )
    return
  }

  const owner = await prisma.user.findUnique({
    where: { id: USER_ID_TEST },
    select: { id: true },
  })
  if (!owner) {
    throw new Error(
      `The development lecturer ${USER_ID_TEST} must exist before seeding the stress fixture.`
    )
  }

  let pinCode = STRESS_PIN_CODE_START
  while (
    await prisma.course.findFirst({
      where: {
        pinCode,
        NOT: { id: COURSE_ID_DUPLICATION_STRESS },
      },
      select: { id: true },
    })
  ) {
    pinCode += 1
  }

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_DUPLICATION_STRESS,
      name: 'Course duplication stress fixture',
      displayName: 'Course duplication stress fixture',
      description:
        'Development-only course with many empty activities for duplication stress testing.',
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
      isGroupCreationEnabled: false,
      ownerId: USER_ID_TEST,
      color: '#016272',
      pinCode,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2030-01-01T00:00:00.000Z'),
      groupDeadlineDate: new Date('2029-12-01T00:00:00.000Z'),
      maxGroupSize: 5,
      preferredGroupSize: 3,
    })
  )

  const expectedActivityIds = Array.from(
    { length: STRESS_ACTIVITY_COUNT },
    (_, index) => activityId(index)
  )

  const existingActivities = await prisma.liveQuiz.findMany({
    where: { id: { in: expectedActivityIds } },
    select: { id: true, courseId: true, ownerId: true },
  })
  const collidingActivity = existingActivities.find(
    (activity) =>
      activity.courseId !== COURSE_ID_DUPLICATION_STRESS ||
      activity.ownerId !== USER_ID_TEST
  )
  if (collidingActivity) {
    throw new Error(
      `The stress fixture activity ${collidingActivity.id} already belongs to course ${collidingActivity.courseId} and owner ${collidingActivity.ownerId}.`
    )
  }

  for (
    let batchStart = 0;
    batchStart < expectedActivityIds.length;
    batchStart += STRESS_ACTIVITY_CONCURRENCY
  ) {
    await Promise.all(
      expectedActivityIds
        .slice(batchStart, batchStart + STRESS_ACTIVITY_CONCURRENCY)
        .map(async (id, batchIndex) => {
          const index = batchStart + batchIndex
          const name = `Duplication stress activity ${index + 1}`
          const data = {
            name,
            displayName: name,
            description: 'Empty development stress-test activity.',
            ownerId: USER_ID_TEST,
            courseId: COURSE_ID_DUPLICATION_STRESS,
            status: Prisma.PublicationStatus.DRAFT,
            isDeleted: false,
          }
          await prisma.liveQuiz.upsert({
            where: { id },
            create: { id, ...data },
            update: data,
          })
        })
    )
  }

  await recomputeDerivedPermissions(
    { courseId: COURSE_ID_DUPLICATION_STRESS, userId: USER_ID_TEST },
    prisma
  )

  const [course, activities, coursePermission, activityPermissions] =
    await Promise.all([
      prisma.course.findUnique({
        where: { id: COURSE_ID_DUPLICATION_STRESS },
        select: {
          ownerId: true,
          _count: { select: { liveQuizzes: true } },
        },
      }),
      prisma.liveQuiz.findMany({
        where: { courseId: COURSE_ID_DUPLICATION_STRESS },
        select: {
          id: true,
          ownerId: true,
          status: true,
          isDeleted: true,
          blocks: { select: { id: true } },
        },
      }),
      prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: COURSE_ID_DUPLICATION_STRESS,
            userId: USER_ID_TEST,
          },
        },
        select: { permissionLevel: true },
      }),
      prisma.derivedPermission.findMany({
        where: {
          liveQuizId: { in: expectedActivityIds },
          userId: USER_ID_TEST,
        },
        select: { liveQuizId: true, permissionLevel: true },
      }),
    ])

  const expectedIds = new Set(expectedActivityIds)
  const verificationErrors: string[] = []

  if (!course) {
    verificationErrors.push(`course ${COURSE_ID_DUPLICATION_STRESS} is missing`)
  } else {
    if (course.ownerId !== USER_ID_TEST) {
      verificationErrors.push(
        `course owner is ${course.ownerId}, expected ${USER_ID_TEST}`
      )
    }
    if (course._count.liveQuizzes !== STRESS_ACTIVITY_COUNT) {
      verificationErrors.push(
        `course live-quiz count is ${course._count.liveQuizzes}, expected ${STRESS_ACTIVITY_COUNT}`
      )
    }
  }

  if (activities.length !== STRESS_ACTIVITY_COUNT) {
    verificationErrors.push(
      `activity count is ${activities.length}, expected ${STRESS_ACTIVITY_COUNT}`
    )
  }

  const missingActivityIds = expectedActivityIds.filter(
    (id) => !activities.some((activity) => activity.id === id)
  )
  const unexpectedActivityIds = activities
    .filter((activity) => !expectedIds.has(activity.id))
    .map((activity) => activity.id)
  if (missingActivityIds.length > 0) {
    verificationErrors.push(
      `missing expected activity ids: ${missingActivityIds.slice(0, 5).join(', ')}`
    )
  }
  if (unexpectedActivityIds.length > 0) {
    verificationErrors.push(
      `unexpected activity ids: ${unexpectedActivityIds.slice(0, 5).join(', ')}`
    )
  }

  const invalidActivity = activities.find((activity) => {
    return (
      !expectedIds.has(activity.id) ||
      activity.ownerId !== USER_ID_TEST ||
      activity.status !== Prisma.PublicationStatus.DRAFT ||
      activity.isDeleted ||
      activity.blocks.length > 0
    )
  })
  if (invalidActivity) {
    const reasons = [
      !expectedIds.has(invalidActivity.id) ? 'unexpected id' : null,
      invalidActivity.ownerId !== USER_ID_TEST
        ? `owner ${invalidActivity.ownerId} (expected ${USER_ID_TEST})`
        : null,
      invalidActivity.status !== Prisma.PublicationStatus.DRAFT
        ? `status ${invalidActivity.status} (expected DRAFT)`
        : null,
      invalidActivity.isDeleted ? 'soft-deleted' : null,
      invalidActivity.blocks.length > 0
        ? `has ${invalidActivity.blocks.length} blocks`
        : null,
    ].filter((reason): reason is string => reason !== null)
    verificationErrors.push(
      `activity ${invalidActivity.id} is invalid: ${reasons.join(', ')}`
    )
  }

  if (!coursePermission) {
    verificationErrors.push('course owner permission is missing')
  } else if (
    coursePermission.permissionLevel !== Prisma.PermissionLevel.OWNER
  ) {
    verificationErrors.push(
      `course owner permission is ${coursePermission.permissionLevel}, expected OWNER`
    )
  }

  if (activityPermissions.length !== STRESS_ACTIVITY_COUNT) {
    verificationErrors.push(
      `activity permission count is ${activityPermissions.length}, expected ${STRESS_ACTIVITY_COUNT}`
    )
  }
  const invalidPermission = activityPermissions.find(
    (permission) => permission.permissionLevel !== Prisma.PermissionLevel.OWNER
  )
  if (invalidPermission) {
    verificationErrors.push(
      `activity ${invalidPermission.liveQuizId} permission is ${invalidPermission.permissionLevel}, expected OWNER`
    )
  }

  if (verificationErrors.length > 0) {
    throw new Error(
      `The course duplication stress fixture failed verification:\n- ${verificationErrors.join('\n- ')}`
    )
  }

  console.log(
    `Seeded ${COURSE_ID_DUPLICATION_STRESS} with ${STRESS_ACTIVITY_COUNT} empty DRAFT live quizzes.`
  )
}

await seedCourseDuplicationStress()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
