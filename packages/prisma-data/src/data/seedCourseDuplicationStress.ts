import { prisma } from '@klicker-uzh/prisma'
import * as Prisma from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { v5 as uuidv5 } from 'uuid'
import { COURSE_ID_DUPLICATION_STRESS, USER_ID_TEST } from './constants.js'
import { prepareCourse } from './helpers.js'

const STRESS_ACTIVITY_COUNT = 200
const STRESS_PIN_CODE_START = 987650000

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

  for (const [index, id] of expectedActivityIds.entries()) {
    const name = `Duplication stress activity ${index + 1}`
    await prisma.liveQuiz.upsert({
      where: { id },
      create: {
        id,
        name,
        displayName: name,
        description: 'Empty development stress-test activity.',
        ownerId: USER_ID_TEST,
        courseId: COURSE_ID_DUPLICATION_STRESS,
        status: Prisma.PublicationStatus.DRAFT,
        isDeleted: false,
      },
      update: {
        name,
        displayName: name,
        description: 'Empty development stress-test activity.',
        ownerId: USER_ID_TEST,
        courseId: COURSE_ID_DUPLICATION_STRESS,
        status: Prisma.PublicationStatus.DRAFT,
        isDeleted: false,
      },
    })
  }

  await recomputeDerivedPermissions(
    { courseId: COURSE_ID_DUPLICATION_STRESS, userId: USER_ID_TEST },
    prisma
  )

  const [course, activities, permission] = await Promise.all([
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
  ])

  const expectedIds = new Set(expectedActivityIds)
  const invalidActivity = activities.find(
    (activity) =>
      !expectedIds.has(activity.id) ||
      activity.ownerId !== USER_ID_TEST ||
      activity.status !== Prisma.PublicationStatus.DRAFT ||
      activity.isDeleted ||
      activity.blocks.length > 0
  )

  if (
    !course ||
    course.ownerId !== USER_ID_TEST ||
    course._count.liveQuizzes !== STRESS_ACTIVITY_COUNT ||
    activities.length !== STRESS_ACTIVITY_COUNT ||
    invalidActivity ||
    !permission
  ) {
    throw new Error(
      'The course duplication stress fixture failed verification.'
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
