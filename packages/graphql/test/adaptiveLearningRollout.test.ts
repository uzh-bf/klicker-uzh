import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'node:events'
import type { ContextWithUser } from '../src/lib/context.js'
import { setCourseAdaptiveLearningEnabled } from '../src/services/courses.js'

describe('adaptive-learning course rollout administration', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "Participant" RESTART IDENTITY CASCADE'
    )
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('is default-off, audited, idempotent, and invalidates course data', async () => {
    const admin = await prisma.user.create({
      data: {
        email: 'adaptive-rollout-admin@example.com',
        shortname: 'adaptive-rollout-admin',
        role: DB.UserRole.ADMIN,
      },
    })
    const course = await createCourse(admin.id)
    const ctx = contextFor(admin.id, DB.UserRole.ADMIN)
    const invalidations: unknown[] = []
    ctx.emitter.on('invalidate', (payload) => invalidations.push(payload))

    expect(course.isAdaptiveLearningEnabled).toBe(false)
    await expect(
      setCourseAdaptiveLearningEnabled(
        { courseId: course.id, enabled: true },
        ctx
      )
    ).resolves.toMatchObject({ isAdaptiveLearningEnabled: true })
    await expect(
      setCourseAdaptiveLearningEnabled(
        { courseId: course.id, enabled: true },
        ctx
      )
    ).resolves.toMatchObject({ isAdaptiveLearningEnabled: true })

    expect(
      await prisma.activityLogEntry.count({
        where: {
          courseId: course.id,
          type: DB.ActivityLogType.MODIFICATION,
          objectType: DB.ObjectType.COURSE,
        },
      })
    ).toBe(1)
    expect(invalidations).toEqual([
      { typename: 'Course', id: course.id },
      { typename: 'Course', id: course.id },
    ])
  })

  it('rechecks the database role and normalizes missing courses', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'adaptive-rollout-user@example.com',
        shortname: 'adaptive-rollout-user',
      },
    })
    const course = await createCourse(user.id)
    const forgedAdminCtx = contextFor(user.id, DB.UserRole.ADMIN)

    await expect(
      setCourseAdaptiveLearningEnabled(
        { courseId: course.id, enabled: true },
        forgedAdminCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ROLLOUT_FORBIDDEN' },
    })
    expect(
      await prisma.course.findUniqueOrThrow({ where: { id: course.id } })
    ).toMatchObject({ isAdaptiveLearningEnabled: false })

    await prisma.user.update({
      where: { id: user.id },
      data: { role: DB.UserRole.ADMIN },
    })
    await expect(
      setCourseAdaptiveLearningEnabled(
        { courseId: crypto.randomUUID(), enabled: true },
        forgedAdminCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })
  })

  it('locks persisted administrator state and waits beyond five seconds for the course', async () => {
    const admin = await prisma.user.create({
      data: {
        email: 'adaptive-rollout-lock-admin@example.com',
        shortname: 'adaptive-rollout-lock-admin',
        role: DB.UserRole.ADMIN,
      },
    })
    const course = await createCourse(admin.id)
    const ctx = contextFor(admin.id, DB.UserRole.ADMIN)
    const courseBlocker = holdCourseShareLock(course.id)
    await courseBlocker.ready

    const enable = setCourseAdaptiveLearningEnabled(
      { courseId: course.id, enabled: true },
      ctx
    )
    let demotion!: Promise<DB.User>
    try {
      await waitForBlockedDatabaseQuery('%FROM "Course"%FOR UPDATE%')
      demotion = (async () =>
        await prisma.user.update({
          where: { id: admin.id },
          data: { role: DB.UserRole.USER },
        }))()
      await waitForBlockedBackendCount(2)
      await new Promise((resolve) => setTimeout(resolve, 5_250))
    } finally {
      courseBlocker.release()
      await courseBlocker.done
    }
    const [enabledCourse, demotedUser] = await Promise.all([enable, demotion])

    expect(enabledCourse.isAdaptiveLearningEnabled).toBe(true)
    expect(demotedUser.role).toBe(DB.UserRole.USER)
    await expect(
      setCourseAdaptiveLearningEnabled(
        { courseId: course.id, enabled: false },
        ctx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ROLLOUT_FORBIDDEN' },
    })
  }, 15_000)
})

function holdCourseShareLock(courseId: string) {
  let release!: () => void
  let ready!: () => void
  const readyPromise = new Promise<void>((resolve) => {
    ready = resolve
  })
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve
  })
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Course"
        WHERE "id" = ${courseId}::uuid
        FOR SHARE
      `
      ready()
      await releasePromise
    },
    { timeout: 12_000 }
  )
  return { ready: readyPromise, release, done }
}

async function waitForBlockedDatabaseQuery(queryPattern: string) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const [state] = await prisma.$queryRaw<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND query LIKE ${queryPattern}
          AND cardinality(pg_blocking_pids(pid)) > 0
      ) AS blocked
    `
    if (state?.blocked) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for blocked query ${queryPattern}.`)
}

async function waitForBlockedBackendCount(expectedCount: number) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const [state] = await prisma.$queryRaw<Array<{ blockedCount: number }>>`
      SELECT COUNT(*)::integer AS "blockedCount"
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND cardinality(pg_blocking_pids(pid)) > 0
    `
    if ((state?.blockedCount ?? 0) >= expectedCount) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(
    `Timed out waiting for ${expectedCount} blocked database backends.`
  )
}

async function createCourse(ownerId: string) {
  const endDate = new Date('2027-07-13T00:00:00.000Z')
  return await prisma.course.create({
    data: {
      name: `adaptive-rollout-course-${crypto.randomUUID()}`,
      displayName: 'Adaptive rollout course',
      ownerId,
      pinCode: 9876,
      startDate: new Date('2026-07-13T00:00:00.000Z'),
      endDate,
      groupDeadlineDate: endDate,
    },
  })
}

function contextFor(subject: string, role: DB.UserRole): ContextWithUser {
  return {
    prisma,
    user: {
      sub: subject,
      role,
      scope: DB.UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    emitter: new EventEmitter(),
  } as unknown as ContextWithUser
}
