import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { EventEmitter } from 'node:events'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  abandonAdaptivePracticeQuizAttempt,
  getAdaptivePracticeQuizCohortResults,
  getAdaptivePracticeQuizResult,
  getAdaptivePracticeQuizState,
  restartAdaptivePracticeQuizAttempt,
  resumeAdaptivePracticeQuizAttempt,
  startAdaptivePracticeQuizAttempt,
  submitAdaptivePracticeQuizResponse,
  withSerializableRetry,
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

describe('adaptive practice quiz service', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "Participant" RESTART IDENTITY CASCADE'
    )
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('starts and resumes one attempt for an enrolled participant regardless of isActive', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )

    const starts = await Promise.all(
      Array.from({ length: 6 }, () =>
        startAdaptivePracticeQuizAttempt(
          { practiceQuizId: fixture.quizId },
          participantCtx
        )
      )
    )
    const first = starts[0]!
    const resumed = await resumeAdaptivePracticeQuizAttempt(
      { attemptId: first.attemptId },
      participantCtx
    )
    const queried = await getAdaptivePracticeQuizState(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    expect(first).toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
      answeredQuestions: 0,
      questionNumber: 1,
      maximumQuestions: 8,
      elapsedSeconds: null,
      showTimer: true,
      canStartNewAttempt: false,
    })
    expect(first.servedItem).not.toBeNull()
    expect(new Set(starts.map(({ attemptId }) => attemptId))).toEqual(
      new Set([first.attemptId])
    )
    expect(resumed.attemptId).toBe(first.attemptId)
    expect(queried?.attemptId).toBe(first.attemptId)
    expect(
      await prisma.adaptivePracticeQuizAttempt.count({
        where: { participantId: fixture.participantId },
      })
    ).toBe(1)
  })

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

  it('preserves missing response timing and rejects implausible durations', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )

    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
          elapsedSeconds: 86_401,
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ELAPSED_SECONDS_INVALID' },
    })

    const afterMissingTiming = await submitAdaptivePracticeQuizResponse(
      {
        attemptId: state.attemptId,
        servedItemId: state.servedItem!.poolItemId,
        response: { choiceIndices: [0] },
        elapsedSeconds: null,
      },
      participantCtx
    )
    expect(afterMissingTiming.status).toBe(
      DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
    )
    expect(afterMissingTiming.elapsedSeconds).toBeNull()
    await expect(
      getAdaptivePracticeQuizState(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
    ).resolves.toMatchObject({ elapsedSeconds: null })
    await submitAdaptivePracticeQuizResponse(
      {
        attemptId: state.attemptId,
        servedItemId: afterMissingTiming.servedItem!.poolItemId,
        response: { choiceIndices: [0] },
        elapsedSeconds: 3,
      },
      participantCtx
    )

    const stored = await prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
      where: { id: state.attemptId },
      include: { responses: { orderBy: { order: 'asc' } } },
    })
    expect(stored.elapsedSeconds).toBeNull()
    expect(
      stored.responses.map(({ elapsedSeconds }) => elapsedSeconds)
    ).toEqual([null, 3])
  })

  it('atomically restarts active attempts but blocks retakes under first-completed policy', async () => {
    const fixture = await createRuntimeFixture({
      attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
    })
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const first = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    let replacement = await restartAdaptivePracticeQuizAttempt(
      { attemptId: first.attemptId },
      participantCtx
    )
    expect(replacement.attemptId).not.toBe(first.attemptId)
    await expect(
      prisma.adaptivePracticeQuizAttempt.findUniqueOrThrow({
        where: { id: first.attemptId },
      })
    ).resolves.toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
      stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
    })

    while (
      replacement.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS
    ) {
      replacement = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: replacement.attemptId,
          servedItemId: replacement.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    }

    await expect(
      getAdaptivePracticeQuizState(
        { practiceQuizId: fixture.quizId },
        participantCtx
      )
    ).resolves.toMatchObject({
      attemptId: replacement.attemptId,
      status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      canStartNewAttempt: false,
      servedItem: null,
    })

    const retakes = await Promise.allSettled([
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      ),
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        participantCtx
      ),
    ])
    expect(retakes).toHaveLength(2)
    expect(
      retakes.every(
        (retake) =>
          retake.status === 'rejected' &&
          retake.reason?.extensions?.code === 'ADAPTIVE_RETAKE_FORBIDDEN'
      )
    ).toBe(true)
  })

  it('rejects foreign attempts, arbitrary pool items, and replayed responses', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const otherCtx = contextFor(
      fixture.otherParticipantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    const servedItemId = state.servedItem!.poolItemId
    const arbitraryItemId = fixture.poolItemIds.find(
      (poolItemId) => poolItemId !== servedItemId
    )!

    await expect(
      startAdaptivePracticeQuizAttempt(
        { practiceQuizId: fixture.quizId },
        otherCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_PARTICIPATION_REQUIRED' },
    })
    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: state.attemptId },
        otherCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_NOT_FOUND' },
    })
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: arbitraryItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ITEM_NOT_SERVED' },
    })
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        otherCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_NOT_FOUND' },
    })

    const concurrent = await Promise.allSettled([
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      ),
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      ),
    ])
    expect(
      concurrent.filter(({ status }) => status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      concurrent.filter(({ status }) => status === 'rejected')
    ).toHaveLength(1)
    expect(
      (
        concurrent.find(
          ({ status }) => status === 'rejected'
        ) as PromiseRejectedResult
      ).reason
    ).toMatchObject({
      extensions: { code: 'ADAPTIVE_RESPONSE_ALREADY_SUBMITTED' },
    })
    expect(
      await prisma.adaptivePracticeQuizResponse.count({
        where: { attemptId: state.attemptId },
      })
    ).toBe(1)
    await expect(
      submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId,
          response: { choiceIndices: [0] },
        },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_RESPONSE_ALREADY_SUBMITTED' },
    })
  })

  it('grades and snapshots the immutable published pool after source edits', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    const poolItem =
      await prisma.practiceQuizAdaptivePoolItem.findUniqueOrThrow({
        where: { id: state.servedItem!.poolItemId },
      })
    await prisma.element.update({
      where: { id: poolItem.elementId },
      data: {
        isDeleted: true,
        version: { increment: 1 },
        content: 'Changed after publication',
        options: choiceOptions(1),
      },
    })

    await submitAdaptivePracticeQuizResponse(
      {
        attemptId: state.attemptId,
        servedItemId: poolItem.id,
        response: { choiceIndices: [0] },
      },
      participantCtx
    )
    const response = await prisma.adaptivePracticeQuizResponse.findFirstOrThrow(
      { where: { attemptId: state.attemptId } }
    )
    const snapshot = response.elementSnapshot as ElementData

    expect(response).toMatchObject({ score: 1, correct: true })
    expect(snapshot.content).toBe(`Adaptive item ${poolItem.id}`)
    expect(
      (snapshot.options as { choices: Array<{ correct?: boolean }> }).choices[0]
        ?.correct
    ).toBe(true)
  })

  it('completes with hierarchical estimates and participant-safe level-band results', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const participantBefore = await prisma.participant.findUniqueOrThrow({
      where: { id: fixture.participantId },
    })
    let state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    while (state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      state = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
          elapsedSeconds: 3,
        },
        participantCtx
      )
    }

    const result = await getAdaptivePracticeQuizResult(
      { attemptId: state.attemptId },
      participantCtx
    )
    const estimates = await prisma.adaptivePracticeQuizEstimate.findMany({
      where: { attemptId: state.attemptId },
    })
    const participantAfter = await prisma.participant.findUniqueOrThrow({
      where: { id: fixture.participantId },
    })

    expect(state).toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
      answeredQuestions: 8,
      canStartNewAttempt: true,
      servedItem: null,
      elapsedSeconds: 24,
    })
    expect(result.levelLabel).not.toBeNull()
    expect(result.levelInterpretation).toBe(DB.AdaptiveLevelMappingRule.NEAREST)
    expect(result.confidence).not.toBe('INSUFFICIENT_DATA')
    expect(result.levelBands).toHaveLength(3)
    expect(result.competenceProfile).toHaveLength(2)
    expect(
      result.competenceProfile.every((node) => node.children.length === 1)
    ).toBe(true)
    expect(result.trajectory.length).toBeGreaterThan(0)
    expect(result.trajectory[0]?.levelLabel).toBeNull()
    expect(result.trajectory.at(-1)?.levelLabel).not.toBeNull()
    expect(result.trajectory.at(-1)?.levelLabel).toBe(result.levelLabel)
    expect(result.trajectory.at(-1)?.position).toBe(result.position)
    expect(result.trajectory.at(-1)?.lowerPosition).toBe(result.lowerPosition)
    expect(result.trajectory.at(-1)?.upperPosition).toBe(result.upperPosition)
    expect(estimates).toHaveLength(5)
    expect(estimates.every((estimate) => estimate.responseCount > 0)).toBe(true)
    expect(
      estimates
        .filter(
          (estimate) =>
            estimate.nodeKind === DB.AdaptiveEstimateNodeKind.COMPETENCE
        )
        .every(
          (estimate) =>
            estimate.stopReason === DB.AdaptivePracticeQuizStopReason.CLASSIFIED
        )
    ).toBe(true)

    expect(participantAfter.xp).toBe(participantBefore.xp)
    expect(await prisma.questionResponse.count()).toBe(0)
    expect(await prisma.questionResponseDetail.count()).toBe(0)
    expect(await prisma.leaderboardEntry.count()).toBe(0)
    expect(await prisma.timelineEntry.count()).toBe(0)
    expect(await prisma.adaptivePracticeQuizCohortSnapshot.count()).toBe(0)

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('standardError')
    expect(serialized).not.toContain('theta')
    expect(serialized).not.toContain('solutions')

    await prisma.adaptivePracticeQuizEstimate.updateMany({
      where: {
        attemptId: state.attemptId,
        nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
      },
      data: { responseCount: result.answeredQuestions - 1 },
    })
    await expect(
      getAdaptivePracticeQuizResult(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_DATA_INVALID' },
    })

    const retake = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    expect(retake.attemptId).not.toBe(state.attemptId)
    expect(retake.canStartNewAttempt).toBe(false)
  })

  it('exposes mastery interpretation for placement results', async () => {
    const fixture = await createRuntimeFixture({
      attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
    })
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    let state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    while (state.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS) {
      state = await submitAdaptivePracticeQuizResponse(
        {
          attemptId: state.attemptId,
          servedItemId: state.servedItem!.poolItemId,
          response: { choiceIndices: [0] },
          elapsedSeconds: 1,
        },
        participantCtx
      )
    }

    await expect(
      getAdaptivePracticeQuizResult(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).resolves.toMatchObject({
      levelInterpretation: DB.AdaptiveLevelMappingRule.MASTERY,
    })
  })

  it('abandons attempts and suppresses small cohort distributions', async () => {
    const fixture = await createRuntimeFixture()
    const participantCtx = contextFor(
      fixture.participantId,
      DB.UserRole.PARTICIPANT
    )
    const state = await startAdaptivePracticeQuizAttempt(
      { practiceQuizId: fixture.quizId },
      participantCtx
    )
    const abandoned = await abandonAdaptivePracticeQuizAttempt(
      { attemptId: state.attemptId },
      participantCtx
    )
    expect(abandoned).toMatchObject({
      status: DB.AdaptivePracticeQuizAttemptStatus.ABANDONED,
      stopReason: DB.AdaptivePracticeQuizStopReason.ABANDONED,
      servedItem: null,
    })
    await expect(
      resumeAdaptivePracticeQuizAttempt(
        { attemptId: state.attemptId },
        participantCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_NOT_IN_PROGRESS' },
    })

    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    expect(cohort).toMatchObject({
      cohortSize: null,
      suppressed: true,
      attemptSummary: {
        suppressed: true,
        classified: null,
        capped: null,
        poolExhausted: null,
        stoppedInsufficientData: null,
        insufficientData: null,
        nearBoundary: null,
      },
    })
    expect(cohort.distributions.every(({ suppressed }) => suppressed)).toBe(
      true
    )
    expect(
      cohort.distributions.every(({ buckets }) => buckets.length === 0)
    ).toBe(true)
    expect(cohort.distributions).toContainEqual(
      expect.objectContaining({
        nodeKind: DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
        parentNodeId: expect.any(Number),
        depth: 1,
        order: 0,
      })
    )
  })

  it('suppresses a small insufficient-data cohort bucket', async () => {
    const fixture = await createRuntimeFixture()

    for (let index = 0; index < 10; index++) {
      const participant = await prisma.participant.create({
        data: {
          username: `adaptive-cohort-participant-${index}`,
          password: 'test',
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId: fixture.courseId,
          participantId: participant.id,
        },
      })
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
          completedAt: new Date('2026-07-10T12:00:00.000Z'),
        },
      })
      const levelId =
        index < 5
          ? fixture.levelIds[0]!
          : index < 9
            ? fixture.levelIds[1]!
            : null
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: levelId === null ? null : index < 5 ? -1 : 1,
          standardError: levelId === null ? null : 0.5,
          responseCount: levelId === null ? 0 : 4,
          levelId,
          stopReason:
            levelId === null
              ? DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA
              : DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
        },
      })
    }

    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    const overall = cohort.distributions.find(
      ({ nodeKind }) => nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL
    )

    expect(cohort.cohortSize).toBe(10)
    expect(overall).toMatchObject({
      suppressed: true,
      insufficientDataCount: null,
      buckets: [],
    })
    expect(cohort.attemptSummary).toMatchObject({
      suppressed: true,
      capped: 10,
      insufficientData: null,
    })
    expect(cohort.attemptSummary.suppressions).toContainEqual({
      field: 'INSUFFICIENT_DATA',
      reason: 'SMALL_CELL_OR_COMPLEMENT',
    })
  })

  it('publishes cohort results only at fixed five-participant boundaries', async () => {
    const fixture = await createRuntimeFixture()
    const lecturerCtx = contextFor(fixture.ownerId, DB.UserRole.USER)

    async function addCompletedAttempt(
      index: number,
      existing?: { participantId: string; participationId: number }
    ) {
      const participant = existing
        ? { id: existing.participantId }
        : await prisma.participant.create({
            data: {
              username: `adaptive-release-participant-${index}`,
              password: 'test',
            },
          })
      const participation = existing
        ? { id: existing.participationId }
        : await prisma.participation.create({
            data: {
              courseId: fixture.courseId,
              participantId: participant.id,
            },
          })
      const stopReason = DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason,
          completedAt: new Date(
            new Date('2026-07-10T13:00:00.000Z').getTime() + index * 1000
          ),
        },
      })
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: 0,
          standardError: 0.5,
          responseCount: 4,
          levelId: fixture.levelIds[1]!,
          stopReason,
        },
      })

      return {
        participantId: participant.id,
        participationId: participation.id,
      }
    }

    const releasedParticipants: {
      participantId: string
      participationId: number
    }[] = []
    for (let index = 0; index < 5; index++) {
      releasedParticipants.push(await addCompletedAttempt(index))
    }
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => {})
    const concurrentFirstReads = await Promise.all(
      Array.from({ length: 6 }, () =>
        getAdaptivePracticeQuizCohortResults(
          { practiceQuizId: fixture.quizId },
          lecturerCtx
        )
      )
    )
    expect(errorOutput.mock.calls.flat().join('\n')).not.toContain(
      '"event":"adaptive_cohort_snapshot","outcome":"FAILED"'
    )
    errorOutput.mockRestore()
    const firstRelease = concurrentFirstReads[0]!
    expect(concurrentFirstReads).toEqual(
      Array.from({ length: 6 }, () => firstRelease)
    )
    expect(firstRelease.cohortSize).toBe(5)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.findMany({
        where: { configId: fixture.configId },
        select: { releaseSize: true, invalidatedAt: true },
      })
    ).toEqual([{ releaseSize: 5, invalidatedAt: null }])

    await addCompletedAttempt(5, releasedParticipants[0])
    const afterRetake = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterRetake).toEqual(firstRelease)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.count({
        where: { configId: fixture.configId },
      })
    ).toBe(1)

    releasedParticipants.push(await addCompletedAttempt(6))
    const afterSixthParticipant = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterSixthParticipant).toEqual(firstRelease)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.count({
        where: { configId: fixture.configId },
      })
    ).toBe(1)

    for (let index = 7; index <= 10; index++) {
      releasedParticipants.push(await addCompletedAttempt(index))
    }
    const secondRelease = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(secondRelease.cohortSize).toBe(10)
    const snapshots = await prisma.adaptivePracticeQuizCohortSnapshot.findMany({
      where: { configId: fixture.configId },
      orderBy: { releaseSize: 'asc' },
    })
    expect(snapshots.map(({ releaseSize }) => releaseSize)).toEqual([5, 10])
    const serializedSnapshots = JSON.stringify(snapshots)
    expect(serializedSnapshots).not.toContain('participantId')
    expect(serializedSnapshots).not.toContain('attemptId')
    expect(serializedSnapshots).not.toContain('adaptive-release-participant')
    expect(serializedSnapshots).not.toContain('normalizedResponse')

    await prisma.participant.delete({
      where: { id: releasedParticipants.at(-1)!.participantId },
    })
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.count({
        where: {
          configId: fixture.configId,
          invalidatedAt: { not: null },
        },
      })
    ).toBe(2)
    const afterDeletion = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    const afterRepeatedPolling = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      lecturerCtx
    )
    expect(afterDeletion).toEqual(firstRelease)
    expect(afterRepeatedPolling).toEqual(afterDeletion)
    expect(
      await prisma.adaptivePracticeQuizCohortSnapshot.findMany({
        where: { configId: fixture.configId },
        orderBy: { releaseSize: 'asc' },
        select: { releaseSize: true, invalidatedAt: true },
      })
    ).toEqual([
      { releaseSize: 5, invalidatedAt: null },
      { releaseSize: 10, invalidatedAt: expect.any(Date) },
    ])
  })

  it('summarizes selected outcomes and computes near-boundary counts', async () => {
    const fixture = await createRuntimeFixture()

    for (let index = 0; index < 20; index++) {
      const participant = await prisma.participant.create({
        data: {
          username: `adaptive-summary-participant-${index}`,
          password: 'test',
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId: fixture.courseId,
          participantId: participant.id,
        },
      })
      const stopReason =
        index < 5
          ? DB.AdaptivePracticeQuizStopReason.CLASSIFIED
          : index < 10
            ? DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP
            : index < 15
              ? DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED
              : DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason,
          completedAt: new Date(
            new Date('2026-07-10T12:00:00.000Z').getTime() + index * 1000
          ),
        },
      })
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: index < 5 ? -1.5 : 0,
          standardError: 0.1,
          responseCount: 4,
          levelId: fixture.levelIds[1]!,
          stopReason,
        },
      })
    }

    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    expect(cohort.attemptSummary).toEqual({
      suppressed: false,
      suppressions: [],
      classified: 5,
      capped: 5,
      poolExhausted: 5,
      stoppedInsufficientData: 5,
      insufficientData: 0,
      nearBoundary: 5,
    })
  })

  it('computes privacy-safe pilot metrics from canonical responses', async () => {
    const fixture = await createRuntimeFixture()
    const poolItems = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: { id: { in: fixture.poolItemIds.slice(0, 5) } },
      orderBy: { id: 'asc' },
    })
    expect(poolItems).toHaveLength(5)

    for (let index = 0; index < 43; index++) {
      const participant = await prisma.participant.create({
        data: {
          username: `adaptive-pilot-participant-${index}`,
          password: 'test',
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId: fixture.courseId,
          participantId: participant.id,
        },
      })
      const poolItem =
        index < 30
          ? poolItems[0]!
          : index < 35
            ? poolItems[1]!
            : index < 39
              ? poolItems[2]!
              : poolItems[3]!
      const correct = index < 21 || (index >= 30 && index < 35)
      const startedAt = new Date(
        new Date('2026-07-10T12:00:00.000Z').getTime() + index * 60_000
      )
      const elapsedSeconds = 60 + index
      const reportedElapsedSeconds = index === 0 ? null : elapsedSeconds
      const attempt = await prisma.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          practiceQuizId: fixture.quizId,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
          startedAt,
          completedAt: new Date(startedAt.getTime() + elapsedSeconds * 1000),
          elapsedSeconds: reportedElapsedSeconds,
        },
      })
      await prisma.adaptivePracticeQuizResponse.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          assignmentId: poolItem.sourceAssignmentId,
          poolItemId: poolItem.id,
          elementId: poolItem.elementId,
          elementSnapshot: poolItem.elementData,
          order: 1,
          response: { choiceIndices: [correct ? 0 : 1] },
          normalizedResponse: { choiceIndices: [correct ? 0 : 1] },
          score: correct ? 1 : 0,
          correct,
          overallThetaBefore: 0,
          overallThetaAfter: correct ? 0.2 : -0.2,
          overallStandardErrorAfter: 0.9,
          elapsedSeconds: reportedElapsedSeconds,
        },
      })
      await prisma.adaptivePracticeQuizEstimate.create({
        data: {
          attemptId: attempt.id,
          configId: fixture.configId,
          competenceTreeId: fixture.treeId,
          nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: correct ? 0.2 : -0.2,
          standardError: 0.9,
          responseCount: index === 1 ? 2 : 1,
          levelId: fixture.levelIds[1]!,
          stopReason: DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
        },
      })
    }

    const telemetry = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cohort = await getAdaptivePracticeQuizCohortResults(
      { practiceQuizId: fixture.quizId },
      contextFor(fixture.ownerId, DB.UserRole.USER)
    )
    expect(telemetry).toHaveBeenCalledWith(
      `event=adaptive_cohort_integrity_anomaly type=response_count_mismatch practiceQuizId=${fixture.quizId}`
    )
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain(
      'adaptive-pilot-participant'
    )
    telemetry.mockRestore()
    expect(cohort.cohortSize).toBe(40)
    expect(cohort.pilotMetrics).toMatchObject({
      suppressed: true,
      medianQuestionCount: 1,
      p95QuestionCount: 1,
      medianElapsedSeconds: null,
      p95ElapsedSeconds: null,
      responseCountMismatchDetected: null,
      durationMissingDetected: null,
    })
    expect(cohort.pilotMetrics.suppressions).toEqual(
      expect.arrayContaining([
        {
          field: 'DURATION_PERCENTILES',
          reason: 'SMALL_KNOWN_OR_MISSING_PARTITION',
        },
        {
          field: 'RESPONSE_COUNT_MISMATCH',
          reason: 'SMALL_CELL_OR_COMPLEMENT',
        },
        {
          field: 'DURATION_MISSING',
          reason: 'SMALL_KNOWN_OR_MISSING_PARTITION',
        },
      ])
    )

    const diagnostic = cohort.itemDiagnostics.find(
      ({ poolItemId }) => poolItemId === poolItems[0]!.id
    )
    expect(diagnostic).toMatchObject({
      suppressed: false,
      suppressions: [],
      responseCount: 30,
      exposureRate: 30 / 40,
      observedCorrectRate: 0.7,
      highExposure: true,
      misfitFlag: true,
    })
    expect(diagnostic?.expectedCorrectRate).toBeGreaterThan(0.9)
    expect(diagnostic?.residual).toBeLessThan(-0.2)

    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[1]!.id
      )
    ).toMatchObject({
      suppressed: false,
      responseCount: 5,
      residual: null,
    })
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[1]!.id
      )?.suppressions
    ).toContainEqual({
      field: 'ITEM_RESIDUAL',
      reason: 'MINIMUM_RESPONSES',
    })
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[2]!.id
      )
    ).toMatchObject({
      suppressed: true,
      responseCount: null,
      exposureRate: null,
      observedCorrectRate: null,
      expectedCorrectRate: null,
      residual: null,
    })
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[2]!.id
      )?.suppressions
    ).toEqual(
      expect.arrayContaining([
        {
          field: 'ITEM_EXPOSURE',
          reason: 'SMALL_CELL_OR_COMPLEMENT',
        },
        {
          field: 'ITEM_ACCURACY',
          reason: 'SMALL_CELL_OR_COMPLEMENT',
        },
      ])
    )
    expect(
      cohort.itemDiagnostics.find(
        ({ poolItemId }) => poolItemId === poolItems[4]!.id
      )
    ).toMatchObject({
      suppressed: false,
      responseCount: 0,
      exposureRate: 0,
      observedCorrectRate: null,
      expectedCorrectRate: null,
      residual: null,
    })
  })

  it('enforces lecturer permissions on the cohort GraphQL field', async () => {
    const fixture = await createRuntimeFixture()
    const outsider = await prisma.user.create({
      data: {
        email: 'adaptive-runtime-outsider@example.com',
        shortname: 'adaptive-runtime-outsider',
      },
    })
    const reader = await prisma.user.create({
      data: {
        email: 'adaptive-runtime-reader@example.com',
        shortname: 'adaptive-runtime-reader',
      },
    })
    const manager = await prisma.user.create({
      data: {
        email: 'adaptive-runtime-manager@example.com',
        shortname: 'adaptive-runtime-manager',
      },
    })
    await prisma.derivedPermission.createMany({
      data: [
        {
          practiceQuizId: fixture.quizId,
          userId: reader.id,
          permissionLevel: DB.PermissionLevel.READ,
        },
        {
          practiceQuizId: fixture.quizId,
          userId: manager.id,
          permissionLevel: DB.PermissionLevel.ADMIN,
        },
      ],
    })
    const resolver = schema.getQueryType()!.getFields()
      .adaptivePracticeQuizCohortResults!.resolve!
    const info = {
      fieldName: 'adaptivePracticeQuizCohortResults',
    } as never

    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(fixture.participantId, DB.UserRole.PARTICIPANT),
        info
      )
    ).rejects.toMatchObject({ message: 'Unauthorized' })
    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(outsider.id, DB.UserRole.USER),
        info
      )
    ).resolves.toBeNull()
    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(manager.id, DB.UserRole.USER),
        info
      )
    ).resolves.toMatchObject({ practiceQuizId: fixture.quizId })
    await expect(
      resolver(
        {},
        { practiceQuizId: fixture.quizId },
        contextFor(reader.id, DB.UserRole.USER),
        info
      )
    ).resolves.toBeNull()
  })

  it.each([
    Object.assign(new Error('Prisma transaction conflict'), { code: 'P2034' }),
    Object.assign(new Error('PostgreSQL serialization conflict'), {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: {
            kind: 'TransactionWriteConflict',
            originalCode: '40001',
          },
        },
      },
    }),
    Object.assign(new Error('PostgreSQL deadlock'), {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: {
            kind: 'TransactionWriteConflict',
            originalCode: '40P01',
          },
        },
      },
    }),
  ])('returns a stable API error after retry exhaustion', async (error) => {
    const transaction = vi.fn().mockRejectedValue(error)
    const ctx = {
      prisma: { $transaction: transaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(ctx, async () => undefined)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ATTEMPT_CONFLICT' },
    })
    expect(transaction).toHaveBeenCalledTimes(3)
  })

  it('recovers from a transient transaction conflict', async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Prisma transaction conflict'), {
          code: 'P2034',
        })
      )
      .mockResolvedValueOnce('updated')
    const ctx = {
      prisma: { $transaction: transaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(ctx, async () => 'ignored')
    ).resolves.toBe('updated')
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it('retries start-only uniqueness conflicts but passes them through otherwise', async () => {
    const uniqueConflict = Object.assign(new Error('Unique conflict'), {
      code: 'P2002',
    })
    const retryingTransaction = vi
      .fn()
      .mockRejectedValueOnce(uniqueConflict)
      .mockResolvedValueOnce('existing-attempt')
    const retryingCtx = {
      prisma: { $transaction: retryingTransaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(retryingCtx, async () => 'ignored', {
        retryOnUniqueConstraint: true,
      })
    ).resolves.toBe('existing-attempt')
    expect(retryingTransaction).toHaveBeenCalledTimes(2)

    const nonRetryingTransaction = vi.fn().mockRejectedValue(uniqueConflict)
    const nonRetryingCtx = {
      prisma: { $transaction: nonRetryingTransaction },
    } as unknown as ContextWithUser
    await expect(
      withSerializableRetry(nonRetryingCtx, async () => 'ignored')
    ).rejects.toBe(uniqueConflict)
    expect(nonRetryingTransaction).toHaveBeenCalledTimes(1)
  })

  it('passes non-transaction failures through without retrying', async () => {
    const failure = Object.assign(new Error('Validation failed'), {
      code: 'P2003',
    })
    const transaction = vi.fn().mockRejectedValue(failure)
    const ctx = {
      prisma: { $transaction: transaction },
    } as unknown as ContextWithUser

    await expect(
      withSerializableRetry(ctx, async () => 'ignored')
    ).rejects.toBe(failure)
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})

async function createRuntimeFixture({
  attemptSelectionPolicy = DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
}: {
  attemptSelectionPolicy?: DB.AdaptiveAttemptSelectionPolicy
} = {}) {
  const owner = await prisma.user.create({
    data: {
      id: '20000000-0000-4000-8000-000000000001',
      email: 'adaptive-runtime-owner@example.com',
      shortname: 'adaptive-runtime-owner',
    },
  })
  const course = await prisma.course.create({
    data: {
      name: 'adaptive-runtime-course',
      displayName: 'Adaptive runtime course',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
      groupDeadlineDate: new Date('2026-12-01T00:00:00.000Z'),
      pinCode: 4242,
      ownerId: owner.id,
      isAdaptiveLearningEnabled: true,
    },
  })
  const tree = await prisma.competenceTree.create({
    data: {
      name: 'adaptive-runtime-tree',
      displayName: 'Adaptive runtime tree',
      ownerId: owner.id,
      thetaMin: -3,
      thetaMax: 3,
      levelMappingRule: DB.AdaptiveLevelMappingRule.NEAREST,
    },
  })
  await prisma.competenceTreeCourse.create({
    data: { treeId: tree.id, courseId: course.id, linkedById: owner.id },
  })
  const levels = await Promise.all(
    ['Basic', 'Independent', 'Advanced'].map((label, order) =>
      prisma.competenceTreeLevel.create({
        data: { treeId: tree.id, label, order },
      })
    )
  )
  const firstRoot = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.COMPETENCE,
      name: 'Reading',
      order: 0,
      depth: 0,
      weight: 0.6,
    },
  })
  const firstLeaf = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
      name: 'Scanning',
      order: 0,
      depth: 1,
      parentId: firstRoot.id,
    },
  })
  const secondRoot = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.COMPETENCE,
      name: 'Grammar',
      order: 1,
      depth: 0,
      weight: 0.4,
    },
  })
  const secondLeaf = await prisma.competenceTreeNode.create({
    data: {
      treeId: tree.id,
      kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
      name: 'Agreement',
      order: 0,
      depth: 1,
      parentId: secondRoot.id,
    },
  })
  for (const leafNodeId of [firstLeaf.id, secondLeaf.id]) {
    for (const level of levels) {
      await prisma.competenceTreeLeafLevelCoverage.create({
        data: {
          treeId: tree.id,
          leafNodeId,
          levelId: level.id,
          targetItemCount: 2,
        },
      })
    }
  }

  const quiz = await prisma.practiceQuiz.create({
    data: {
      name: 'adaptive-runtime-quiz',
      displayName: 'Adaptive runtime quiz',
      ownerId: owner.id,
      courseId: course.id,
      mode: DB.PracticeQuizMode.ADAPTIVE,
      status: DB.PublicationStatus.PUBLISHED,
      pointsMultiplier: 0,
      isGamificationEnabled: false,
      isAssessmentEnabled: false,
    },
  })
  await prisma.derivedPermission.create({
    data: {
      practiceQuizId: quiz.id,
      userId: owner.id,
      permissionLevel: DB.PermissionLevel.OWNER,
    },
  })
  const config = await prisma.practiceQuizAdaptiveConfig.create({
    data: {
      practiceQuizId: quiz.id,
      competenceTreeId: tree.id,
      preset:
        attemptSelectionPolicy ===
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
          ? DB.AdaptivePracticeQuizPreset.PLACEMENT
          : DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
      attemptSelectionPolicy,
      levelMappingRule:
        attemptSelectionPolicy ===
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
          ? DB.AdaptiveLevelMappingRule.MASTERY
          : DB.AdaptiveLevelMappingRule.NEAREST,
      totalQuestionCap: 8,
      perLeafQuestionCap: 4,
      minQuestionsPerLeaf: 1,
      classificationZ: 0.2,
      poolPublishedAt: new Date(),
    },
  })
  await prisma.practiceQuizAdaptiveNodeOverride.createMany({
    data: [
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: firstRoot.id,
        enabled: true,
        weight: 0.6,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: firstLeaf.id,
        enabled: true,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: secondRoot.id,
        enabled: true,
        weight: 0.4,
      },
      {
        configId: config.id,
        competenceTreeId: tree.id,
        nodeId: secondLeaf.id,
        enabled: true,
      },
    ],
  })

  const poolItemIds: number[] = []
  const difficulties = [-2, -0.5, 0.5, 2]
  for (const [root, leaf] of [
    [firstRoot, firstLeaf],
    [secondRoot, secondLeaf],
  ] as const) {
    for (let index = 0; index < difficulties.length; index++) {
      const level = levels[Math.min(index, levels.length - 1)]!
      const element = await prisma.element.create({
        data: {
          type: DB.ElementType.SC,
          name: `Adaptive item ${root.id}-${index}`,
          content: `Adaptive item pending`,
          options: choiceOptions(0),
          ownerId: owner.id,
        },
      })
      const assignment = await prisma.competenceTreeElementAssignment.create({
        data: {
          treeId: tree.id,
          elementId: element.id,
          leafNodeId: leaf.id,
          levelId: level.id,
        },
      })
      const itemData = elementData(element, `Adaptive item pending`)
      const poolItem = await prisma.practiceQuizAdaptivePoolItem.create({
        data: {
          configId: config.id,
          competenceTreeId: tree.id,
          sourceAssignmentId: assignment.id,
          elementId: element.id,
          elementVersion: element.version,
          elementType: element.type,
          elementName: element.name,
          elementData: itemData,
          leafNodeId: leaf.id,
          nodePath: [root.id, leaf.id],
          nodeNamePath: [root.name, leaf.name],
          levelId: level.id,
          levelLabel: level.label,
          levelOrder: level.order,
          discrimination: 1.2,
          difficulty: difficulties[index]!,
          guessing: 0.5,
        },
      })
      await prisma.element.update({
        where: { id: element.id },
        data: { content: `Adaptive item ${poolItem.id}` },
      })
      await prisma.practiceQuizAdaptivePoolItem.update({
        where: { id: poolItem.id },
        data: {
          elementData: elementData(
            { ...element, content: `Adaptive item ${poolItem.id}` },
            `Adaptive item ${poolItem.id}`
          ),
        },
      })
      poolItemIds.push(poolItem.id)
    }
  }

  const participant = await prisma.participant.create({
    data: { username: 'adaptive-runtime-participant', password: 'test' },
  })
  const otherParticipant = await prisma.participant.create({
    data: { username: 'adaptive-runtime-other', password: 'test' },
  })
  await prisma.participation.createMany({
    data: [
      { courseId: course.id, participantId: participant.id, isActive: false },
    ],
  })

  return {
    ownerId: owner.id,
    courseId: course.id,
    treeId: tree.id,
    configId: config.id,
    quizId: quiz.id,
    levelIds: levels.map(({ id }) => id),
    participantId: participant.id,
    otherParticipantId: otherParticipant.id,
    poolItemIds,
  }
}

function choiceOptions(correctIndex: number) {
  return {
    displayMode: 'LIST',
    choices: [
      { ix: 0, value: 'A', correct: correctIndex === 0 },
      { ix: 1, value: 'B', correct: correctIndex === 1 },
    ],
  }
}

function elementData(
  element: Pick<
    DB.Element,
    'id' | 'version' | 'name' | 'type' | 'pointsMultiplier'
  > & { content: string },
  content: string
): ElementData {
  return {
    id: `${element.id}-v${element.version}`,
    elementId: element.id,
    type: element.type,
    name: element.name,
    content,
    pointsMultiplier: element.pointsMultiplier,
    options: choiceOptions(0),
  } as ElementData
}

function holdConfigLock(configId: string, mode: 'SHARE' | 'UPDATE') {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      if (mode === 'SHARE') {
        await tx.$queryRaw`
          SELECT "id"
          FROM "PracticeQuizAdaptiveConfig"
          WHERE "id" = ${configId}::uuid
          FOR SHARE
        `
      } else {
        await tx.$queryRaw`
          SELECT "id"
          FROM "PracticeQuizAdaptiveConfig"
          WHERE "id" = ${configId}::uuid
          FOR UPDATE
        `
      }
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

function holdAttemptLock(attemptId: string) {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "AdaptivePracticeQuizAttempt"
        WHERE "id" = ${attemptId}::uuid
        FOR UPDATE
      `
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

function holdPermissionRemoval(permissionId: number) {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Permission"
        WHERE "id" = ${permissionId}
        FOR UPDATE
      `
      ready.resolve()
      await release.promise
      await tx.permission.delete({ where: { id: permissionId } })
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

function holdActivityLogTableLock() {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        'LOCK TABLE "ActivityLogEntry" IN ACCESS EXCLUSIVE MODE'
      )
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

function holdAdaptiveAttemptTableLock() {
  const ready = createDeferred()
  const release = createDeferred()
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        'LOCK TABLE "AdaptivePracticeQuizAttempt" IN ACCESS EXCLUSIVE MODE'
      )
      ready.resolve()
      await release.promise
    },
    { timeout: 15_000 }
  )
  return {
    ready: ready.promise,
    done,
    release: release.resolve,
  }
}

async function waitForQuizLockConflict(
  practiceQuizId: string,
  probe: 'SHARE' | 'UPDATE'
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        if (probe === 'SHARE') {
          await tx.$queryRaw`
            SELECT "id"
            FROM "PracticeQuiz"
            WHERE "id" = ${practiceQuizId}::uuid
            FOR SHARE NOWAIT
          `
        } else {
          await tx.$queryRaw`
            SELECT "id"
            FROM "PracticeQuiz"
            WHERE "id" = ${practiceQuizId}::uuid
            FOR UPDATE NOWAIT
          `
        }
      })
    } catch (error) {
      if (postgresErrorCode(error) === '55P03') return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for the practice-quiz lifecycle lock.')
}

async function waitForCourseLockConflict(
  courseId: string,
  probe: 'SHARE' | 'UPDATE'
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        if (probe === 'SHARE') {
          await tx.$queryRaw`
            SELECT "id"
            FROM "Course"
            WHERE "id" = ${courseId}::uuid
            FOR SHARE NOWAIT
          `
        } else {
          await tx.$queryRaw`
            SELECT "id"
            FROM "Course"
            WHERE "id" = ${courseId}::uuid
            FOR UPDATE NOWAIT
          `
        }
      })
    } catch (error) {
      if (postgresErrorCode(error) === '55P03') return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for the course lifecycle lock.')
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

function postgresErrorCode(error: unknown): string | undefined {
  const prismaError = error as {
    code?: string
    meta?: {
      code?: string
      driverAdapterError?: {
        cause?: { code?: string; originalCode?: string }
      }
    }
  }
  return (
    prismaError.meta?.code ??
    prismaError.meta?.driverAdapterError?.cause?.originalCode ??
    prismaError.meta?.driverAdapterError?.cause?.code ??
    prismaError.code
  )
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
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
    redisExec: {} as ContextWithUser['redisExec'],
    redisAssessmentExec: {} as ContextWithUser['redisAssessmentExec'],
    pubSub: {} as ContextWithUser['pubSub'],
    hatchet: {} as ContextWithUser['hatchet'],
    tasks: {} as ContextWithUser['tasks'],
    req: {} as ContextWithUser['req'],
    res: {} as ContextWithUser['res'],
  }
}
