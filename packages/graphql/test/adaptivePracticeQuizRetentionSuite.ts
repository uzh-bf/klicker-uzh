import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import {
  abandonAdaptivePracticeQuizAttempt,
  getAdaptivePracticeQuizCohortResults,
  getAdaptivePracticeQuizResult,
  getAdaptivePracticeQuizState,
  restartAdaptivePracticeQuizAttempt,
  resumeAdaptivePracticeQuizAttempt,
  startAdaptivePracticeQuizAttempt,
  submitAdaptivePracticeQuizResponse,
} from '../src/services/adaptivePracticeQuizzes.js'
import {
  deleteCourse,
  setCourseAdaptiveLearningEnabled,
} from '../src/services/courses.js'
import {
  deletePracticeQuiz,
  publishPracticeQuiz,
  unpublishPracticeQuiz,
} from '../src/services/practiceQuizzes.js'

import {
  contextFor,
  createRuntimeFixture,
  holdActivityLogTableLock,
  holdAdaptiveAttemptTableLock,
  holdAttemptLock,
  holdConfigLock,
  holdPermissionRemoval,
  waitForBlockedDatabaseQuery,
  waitForCourseLockConflict,
  waitForQuizLockConflict,
} from './adaptivePracticeQuizRuntimeTestSupport.js'

export function registerAdaptivePracticeQuizRetentionTests() {
  it('retains attempt history across direct lifecycle deletes while preserving participant erasure', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    for (const deletion of [
      () =>
        prisma.practiceQuizAdaptiveConfig.delete({
          where: { id: fixture.configId },
        }),
      () => prisma.practiceQuiz.delete({ where: { id: fixture.quizId } }),
      () => prisma.course.delete({ where: { id: fixture.courseId } }),
    ]) {
      await expect(deletion()).rejects.toMatchObject({ code: 'P2003' })
    }
    await expect(
      prisma.adaptivePracticeQuizAttempt.findUnique({
        where: { id: state.attemptId },
      })
    ).resolves.not.toBeNull()

    await prisma.participant.delete({
      where: { id: fixture.participantId },
    })

    await expect(
      prisma.adaptivePracticeQuizAttempt.findUnique({
        where: { id: state.attemptId },
      })
    ).resolves.toBeNull()
    await expect(
      prisma.practiceQuiz.findUnique({ where: { id: fixture.quizId } })
    ).resolves.not.toBeNull()
  })

  it('returns a stable retention error when course deletion encounters adaptive history', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    await expect(
      deleteCourse(
        { id: fixture.courseId },
        contextFor(fixture.ownerId, DB.UserRole.USER)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_HISTORY_RETAINED' },
    })
    await expect(
      prisma.course.findUnique({ where: { id: fixture.courseId } })
    ).resolves.not.toBeNull()
    await expect(
      prisma.practiceQuiz.findUnique({ where: { id: fixture.quizId } })
    ).resolves.not.toBeNull()
  })

  it('deletes a course when no adaptive history needs retention', async () => {
    const fixture = await createRuntimeFixture()

    await expect(
      deleteCourse(
        { id: fixture.courseId },
        contextFor(fixture.ownerId, DB.UserRole.USER)
      )
    ).resolves.toMatchObject({ id: fixture.courseId })
    await expect(
      prisma.course.findUnique({ where: { id: fixture.courseId } })
    ).resolves.toBeNull()
  })

  it('lets an in-flight start finish before retention-aware course deletion', async () => {
    const fixture = await createRuntimeFixture()
    const configBlocker = holdConfigLock(fixture.configId, 'UPDATE')
    await configBlocker.ready

    const starting = startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.participantId, DB.UserRole.PARTICIPANT)
    )
    await waitForCourseLockConflict(fixture.courseId, 'UPDATE')
    const deleting = deleteCourse(
      { id: fixture.courseId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    await waitForBlockedDatabaseQuery('%FROM "Course"%FOR UPDATE%')

    configBlocker.release()
    await configBlocker.done
    await expect(starting).resolves.toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
    })
    await expect(deleting).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_HISTORY_RETAINED' },
    })
  })

  it('prevents a new start after retention-aware course deletion has begun', async () => {
    const fixture = await createRuntimeFixture()
    const attemptTableBlocker = holdAdaptiveAttemptTableLock()
    await attemptTableBlocker.ready

    const deleting = deleteCourse(
      { id: fixture.courseId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    await waitForCourseLockConflict(fixture.courseId, 'SHARE')
    const starting = startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.participantId, DB.UserRole.PARTICIPANT)
    )
    await waitForBlockedDatabaseQuery('%FROM "Course"%FOR SHARE%')

    attemptTableBlocker.release()
    await attemptTableBlocker.done
    await expect(deleting).resolves.toMatchObject({ id: fixture.courseId })
    await expect(starting).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_QUIZ_NOT_FOUND' },
    })
  })

  it('keeps persisted cohort snapshots aggregate-only and erasure-aware', async () => {
    const columns = await prisma.$queryRaw<Array<{ columnName: string }>>`
    SELECT column_name::text AS "columnName"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AdaptivePracticeQuizCohortSnapshot'
    ORDER BY ordinal_position
  `
    const columnNames = columns.map(({ columnName }) => columnName)
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'configId',
        'practiceQuizId',
        'releaseSize',
        'releaseWatermark',
        'policyVersion',
        'attemptSelectionPolicy',
        'aggregate',
        'invalidatedAt',
      ])
    )
    expect(columnNames).not.toEqual(
      expect.arrayContaining([
        'participantId',
        'participationId',
        'attemptId',
        'response',
        'elapsedSeconds',
      ])
    )
    const trigger = await prisma.$queryRaw<Array<{ triggerName: string }>>`
    SELECT tgname::text AS "triggerName"
    FROM pg_trigger
    WHERE tgrelid = '"AdaptivePracticeQuizAttempt"'::regclass
      AND NOT tgisinternal
  `
    expect(trigger).toContainEqual({
      triggerName: 'apqa_invalidate_cohort_snapshots_after_delete',
    })
  })

  it('enforces the course rollout gate without deleting attempt history', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const ownerCtx = contextFor(fixture.ownerId, DB.UserRole.USER)
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: false },
    })

    for (const operation of [
      () =>
        getAdaptivePracticeQuizState(
          { practiceQuizId: fixture.quizId },
          participantCtx
        ),
      () =>
        resumeAdaptivePracticeQuizAttempt(
          { attemptId: state.attemptId },
          participantCtx
        ),
      () =>
        restartAdaptivePracticeQuizAttempt(
          { attemptId: state.attemptId },
          participantCtx
        ),
      () =>
        submitAdaptivePracticeQuizResponse(
          {
            attemptId: state.attemptId,
            servedItemId: state.servedItem!.poolItemId,
            response: { choiceIndices: [0] },
          },
          participantCtx
        ),
    ]) {
      await expect(operation()).rejects.toMatchObject({
        extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
      })
    }

    await expect(
      abandonAdaptivePracticeQuizAttempt(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).resolves.toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
      stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
    })
    await expect(
      getAdaptivePracticeQuizCohortResults(
        { practiceQuizId: fixture.quizId },
        ownerCtx
      )
    ).resolves.toMatchObject({ practiceQuizId: fixture.quizId })

    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: true },
    })
    let completed = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    while (
      completed.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
    ) {
      completed = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: completed.attemptId,
          servedItemId: completed.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    }

    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: false },
    })
    await expect(
      getAdaptivePracticeQuizResult(
        { attemptId: completed.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    await expect(
      getAdaptivePracticeQuizCohortResults(
        { practiceQuizId: fixture.quizId },
        ownerCtx
      )
    ).resolves.toMatchObject({ practiceQuizId: fixture.quizId })

    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { practiceQuizId: fixture.quizId },
      })
    ).toBe(2)
  })

  it('does not create an attempt while adaptive learning is disabled', async () => {
    const fixture = await createRuntimeFixture()
    await prisma.course.update({
      where: { id: fixture.courseId },
      data: { isAdaptiveLearningEnabled: false },
    })

    await expect(
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        contextFor(fixture.participantId, DB.UserRole.PARTICIPANT)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { practiceQuizId: fixture.quizId },
      })
    ).toBe(0)
  })

  it('retains an attempt when start reaches the lifecycle lock before deletion', async () => {
    const fixture = await createRuntimeFixture()
    const configBlocker = holdConfigLock(fixture.configId, 'UPDATE')
    await configBlocker.ready

    const started = startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.participantId, DB.UserRole.PARTICIPANT)
    )
    await waitForQuizLockConflict(fixture.quizId, 'UPDATE')
    const deleted = deletePracticeQuiz(
      { id: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    await waitForBlockedDatabaseQuery('%FROM "PracticeQuiz"%FOR UPDATE%')

    configBlocker.release()
    await configBlocker.done
    const [attempt, deletedQuiz] = await Promise.all([started, deleted])

    expect(deletedQuiz).toMatchObject({ id: fixture.quizId, isDeleted: true })
    expect(
      await prisma.adaptivePracticeQuizAttempt.findUnique({
        where: { id: attempt.attemptId },
      })
    ).toMatchObject({ id: attempt.attemptId })
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({
        where: { id: fixture.quizId },
      })
    ).toMatchObject({ isDeleted: true })
  })

  it('fails start cleanly when deletion reaches the lifecycle lock first', async () => {
    const fixture = await createRuntimeFixture()
    const configBlocker = holdConfigLock(fixture.configId, 'SHARE')
    await configBlocker.ready

    const deleted = deletePracticeQuiz(
      { id: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    await waitForQuizLockConflict(fixture.quizId, 'SHARE')
    const started = startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.participantId, DB.UserRole.PARTICIPANT)
    )
    await waitForBlockedDatabaseQuery('%FROM "PracticeQuiz"%FOR SHARE%')

    configBlocker.release()
    await configBlocker.done
    await expect(deleted).resolves.toMatchObject({ id: fixture.quizId })
    await expect(started).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_QUIZ_NOT_FOUND' },
    })
    expect(
      await prisma.practiceQuiz.findUnique({ where: { id: fixture.quizId } })
    ).toBeNull()
    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { practiceQuizId: fixture.quizId },
      })
    ).toBe(0)
  })

  it('fails start without creating an attempt when unpublish locks first', async () => {
    const fixture = await createRuntimeFixture()
    const configBlocker = holdConfigLock(fixture.configId, 'SHARE')
    await configBlocker.ready

    const unpublished = unpublishPracticeQuiz(
      { id: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    await waitForQuizLockConflict(fixture.quizId, 'SHARE')
    const started = startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.participantId, DB.UserRole.PARTICIPANT)
    )
    await waitForBlockedDatabaseQuery('%FROM "PracticeQuiz"%FOR SHARE%')

    configBlocker.release()
    await configBlocker.done
    await expect(unpublished).resolves.toMatchObject({
      status: DB.PublicationStatus.DRAFT,
    })
    await expect(started).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_QUIZ_UNAVAILABLE' },
    })
    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { practiceQuizId: fixture.quizId },
      })
    ).toBe(0)
  })

  it('retains and pauses an attempt when start locks before unpublish', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const ownerCtx = contextFor(fixture.ownerId, DB.UserRole.USER)
    const configBlocker = holdConfigLock(fixture.configId, 'UPDATE')
    await configBlocker.ready

    const started = startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    await waitForQuizLockConflict(fixture.quizId, 'UPDATE')
    const unpublished = unpublishPracticeQuiz({ id: fixture.quizId }, ownerCtx)
    await waitForBlockedDatabaseQuery('%FROM "PracticeQuiz"%FOR UPDATE%')

    configBlocker.release()
    await configBlocker.done
    const [attempt, draftQuiz] = await Promise.all([started, unpublished])

    expect(draftQuiz).toMatchObject({
      id: fixture.quizId,
      status: DB.PublicationStatus.DRAFT,
    })
    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: attempt.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_QUIZ_UNAVAILABLE' },
    })
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: attempt.attemptId,
          servedItemId: attempt.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_QUIZ_UNAVAILABLE' },
    })
    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { id: attempt.attemptId },
      })
    ).toBe(1)
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { configId: fixture.configId },
      })
    ).toBe(fixture.poolItemIds.length)

    await expect(
      publishPracticeQuiz({ id: fixture.quizId }, ownerCtx)
    ).resolves.toMatchObject({
      id: fixture.quizId,
      status: DB.PublicationStatus.PUBLISHED,
    })
    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: attempt.attemptId },
        participantCtx
      )
    ).resolves.toMatchObject({
      attemptId: attempt.attemptId,
      servedItem: { poolItemId: attempt.servedItem!.poolItemId },
      answeredQuestions: 0,
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { configId: fixture.configId },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
    ).toEqual(
      [...fixture.poolItemIds]
        .sort((left, right) => left - right)
        .map((id) => ({ id }))
    )
    expect(
      await prisma.adaptivePracticeQuizResponse.count({
        where: { attemptId: attempt.attemptId },
      })
    ).toBe(0)
  })

  it('does not deadlock quiz deletion behind concurrent permission removal', async () => {
    const fixture = await createRuntimeFixture()
    const manager = await prisma.user.create({
      data: {
        email: 'adaptive-delete-manager@example.com',
        shortname: 'adaptive-delete-manager',
      },
    })
    const permission = await prisma.permission.create({
      data: {
        practiceQuizId: fixture.quizId,
        userId: manager.id,
        permissionLevel: DB.PermissionLevel.ADMIN,
      },
    })
    await prisma.derivedPermission.create({
      data: {
        practiceQuizId: fixture.quizId,
        userId: manager.id,
        permissionLevel: DB.PermissionLevel.ADMIN,
        directPermissionId: permission.id,
      },
    })
    const revocation = holdPermissionRemoval(permission.id)
    await revocation.ready

    const deletion = deletePracticeQuiz(
      { id: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    await waitForBlockedDatabaseQuery('%FROM "Permission"%FOR SHARE%')

    revocation.release()
    await revocation.done
    await expect(deletion).resolves.toMatchObject({ id: fixture.quizId })
    await expect(
      prisma.practiceQuiz.findUnique({ where: { id: fixture.quizId } })
    ).resolves.toBeNull()
  })

  it('serializes restart with disable and resumes the same item after re-enable', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const initial = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    await prisma.user.update({
      where: { id: fixture.ownerId },
      data: { role: DB.UserRole.ADMIN },
    })
    const adminCtx = contextFor(fixture.ownerId, DB.UserRole.ADMIN)
    const attemptBlocker = holdAttemptLock(initial.attemptId)
    await attemptBlocker.ready

    const restarted = restartAdaptivePracticeQuizAttempt(
      { attemptId: initial.attemptId },
      participantCtx
    )
    await waitForQuizLockConflict(fixture.quizId, 'UPDATE')
    const disabled = setCourseAdaptiveLearningEnabled(
      { courseId: fixture.courseId, enabled: false },
      adminCtx
    )
    await waitForBlockedDatabaseQuery('%FROM "Course"%FOR UPDATE%')

    attemptBlocker.release()
    await attemptBlocker.done
    const [replacement] = await Promise.all([restarted, disabled])
    const poolSize = await prisma.practiceQuizAdaptivePoolItem.count({
      where: { configId: fixture.configId },
    })

    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: replacement.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: replacement.attemptId,
          servedItemId: replacement.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })

    await setCourseAdaptiveLearningEnabled(
      { courseId: fixture.courseId, enabled: true },
      adminCtx
    )
    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: replacement.attemptId },
        participantCtx
      )
    ).resolves.toMatchObject({
      attemptId: replacement.attemptId,
      servedItem: { poolItemId: replacement.servedItem!.poolItemId },
      answeredQuestions: 0,
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { configId: fixture.configId },
      })
    ).toBe(poolSize)
    expect(
      await prisma.adaptivePracticeQuizResponse.count({
        where: { attemptId: replacement.attemptId },
      })
    ).toBe(0)
  })

  it('fails restart cleanly when the course disable transaction locks first', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const initial = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    await prisma.user.update({
      where: { id: fixture.ownerId },
      data: { role: DB.UserRole.ADMIN },
    })
    const activityLogBlocker = holdActivityLogTableLock()
    await activityLogBlocker.ready

    const disabled = setCourseAdaptiveLearningEnabled(
      { courseId: fixture.courseId, enabled: false },
      contextFor(fixture.ownerId, DB.UserRole.ADMIN)
    )
    await waitForCourseLockConflict(fixture.courseId, 'SHARE')
    const restarted = restartAdaptivePracticeQuizAttempt(
      { attemptId: initial.attemptId },
      participantCtx
    )
    await waitForBlockedDatabaseQuery('%FROM "Course"%FOR SHARE%')

    activityLogBlocker.release()
    await activityLogBlocker.done
    await expect(disabled).resolves.toMatchObject({
      isAdaptiveLearningEnabled: false,
    })
    await expect(restarted).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COURSE_DISABLED' },
    })
    await expect(
      prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
        where: { id: initial.attemptId },
      })
    ).resolves.toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
      nextPoolItemId: initial.servedItem!.poolItemId,
    })
  })
}
