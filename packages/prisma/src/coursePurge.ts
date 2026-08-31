import type { Prisma } from './client.js'

export function getCourseDeletionAdvisoryLockKey(courseId: string) {
  return `course-deletion:${courseId}`
}

/** Acquire the exclusive transaction fence used by course deletion/mutation. */
export async function tryAcquireCourseDeletionAdvisoryLock(
  prisma: Prisma.TransactionClient,
  courseId: string
) {
  const advisoryLockKey = getCourseDeletionAdvisoryLockKey(courseId)
  const [lock] = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_xact_lock(hashtextextended(${advisoryLockKey}, 0)) AS "acquired"
  `
  return lock?.acquired === true
}

/**
 * Acquire a shared transaction fence for an accepted live-quiz response.
 *
 * Multiple responses may be admitted concurrently, while the exclusive course
 * deletion fence must wait until every admission transaction has committed.
 */
export async function tryAcquireCourseResponseAdmissionAdvisoryLock(
  prisma: Prisma.TransactionClient,
  courseId: string
) {
  const advisoryLockKey = getCourseDeletionAdvisoryLockKey(courseId)
  const [lock] = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_xact_lock_shared(hashtextextended(${advisoryLockKey}, 0)) AS "acquired"
  `
  return lock?.acquired === true
}

/**
 * Permit physical Course deletion for the current database transaction.
 *
 * Production course deletion is soft-only. This escape hatch exists for
 * repository-owned fixture cleanup and explicit future retention jobs, and is
 * deliberately transaction-local so stale application pods cannot inherit it.
 */
export async function allowCoursePurgeInTransaction(
  prisma: Prisma.TransactionClient
) {
  await allowCourseDeletionMutationInTransaction(prisma)
  await prisma.$executeRaw`
    SELECT set_config('klicker.allow_course_purge', 'on', true)
  `
}

/** Allow the background deletion workflow to finalize or restore its marker. */
export async function allowCourseDeletionMutationInTransaction(
  prisma: Prisma.TransactionClient
) {
  await prisma.$executeRaw`
    SELECT set_config('klicker.allow_course_deletion_mutation', 'on', true)
  `
}
