import * as DB from '@klicker-uzh/prisma/client'

type PublicationSource = 'manual' | 'scheduled' | 'reconcile'
type PublicationRedis = {
  hset(
    key: string,
    values: Record<string, string | number | boolean>
  ): Promise<unknown>
}

export async function transitionLiveQuizToPublished({
  prisma,
  liveQuizId,
  source,
  now = new Date(),
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  source: PublicationSource
  now?: Date
}) {
  return prisma.$transaction(async (transaction) => {
    const [lockedQuiz] = await transaction.$queryRaw<Pick<DB.LiveQuiz, 'id'>[]>`
      SELECT "id"
      FROM "public"."LiveQuiz"
      WHERE "id" = ${liveQuizId}::uuid AND "isDeleted" = false
      FOR UPDATE
    `
    if (!lockedQuiz) return null

    const liveQuiz = await transaction.liveQuiz.findUnique({
      where: { id: lockedQuiz.id },
    })
    if (!liveQuiz) return null

    if (liveQuiz.status === DB.PublicationStatus.PUBLISHED) {
      const publishedQuiz =
        liveQuiz.startedAt === null
          ? await transaction.liveQuiz.update({
              where: { id: liveQuiz.id },
              data: {
                startedAt: now,
                publicationMetadataMaterializedAt: null,
                publicationMetadataRetryAt: null,
              },
            })
          : liveQuiz
      const publishedQuizWithStart = requirePublishedStart(publishedQuiz)

      return {
        quiz: publishedQuizWithStart,
        didStart: false,
        scheduledPublicationTaskId:
          publishedQuizWithStart.scheduledPublicationTaskId,
      }
    }

    const canPublish =
      source === 'scheduled'
        ? liveQuiz.status === DB.PublicationStatus.SCHEDULED &&
          liveQuiz.availableFrom !== null &&
          liveQuiz.availableFrom <= now
        : source === 'manual' &&
          (liveQuiz.status === DB.PublicationStatus.DRAFT ||
            liveQuiz.status === DB.PublicationStatus.SCHEDULED)
    if (!canPublish) return null

    const publishedQuiz = await transaction.liveQuiz.update({
      where: { id: liveQuizId },
      data: {
        status: DB.PublicationStatus.PUBLISHED,
        startedAt: now,
        publicationMetadataMaterializedAt: null,
        publicationMetadataRetryAt: null,
      },
    })
    const publishedQuizWithStart = requirePublishedStart(publishedQuiz)

    return {
      quiz: publishedQuizWithStart,
      didStart: true,
      scheduledPublicationTaskId: liveQuiz.scheduledPublicationTaskId,
    }
  })
}

export async function materializeLiveQuizPublication({
  quiz,
  redisExec,
  redisAssessmentExec,
}: {
  quiz: Pick<
    DB.LiveQuiz,
    | 'id'
    | 'namespace'
    | 'startedAt'
    | 'isGamificationEnabled'
    | 'isAssessmentEnabled'
  >
  redisExec: PublicationRedis
  redisAssessmentExec: PublicationRedis
}) {
  const redis = quiz.isAssessmentEnabled ? redisAssessmentExec : redisExec
  if (quiz.startedAt === null) {
    throw new Error(
      `Published live quiz ${quiz.id} has no persisted start timestamp`
    )
  }

  await redis.hset(`lq:${quiz.id}:meta`, {
    namespace: quiz.namespace,
    startedAt: Number(quiz.startedAt),
    isGamificationEnabled: quiz.isGamificationEnabled,
    isAssessmentEnabled: quiz.isAssessmentEnabled,
  })
}

export async function markLiveQuizPublicationMaterialized({
  prisma,
  liveQuizId,
  startedAt,
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  startedAt: Date
}) {
  const result = await prisma.liveQuiz.updateMany({
    where: {
      id: liveQuizId,
      status: DB.PublicationStatus.PUBLISHED,
      startedAt,
    },
    data: {
      publicationMetadataMaterializedAt: new Date(),
      publicationMetadataRetryAt: null,
    },
  })
  if (result.count !== 1) {
    throw new Error(
      `Live quiz ${liveQuizId} changed during publication materialization`
    )
  }
}

export async function clearLiveQuizScheduledPublicationTask({
  prisma,
  liveQuizId,
  startedAt,
  scheduledPublicationTaskId,
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  startedAt: Date
  scheduledPublicationTaskId: string
}) {
  const result = await prisma.liveQuiz.updateMany({
    where: {
      id: liveQuizId,
      status: DB.PublicationStatus.PUBLISHED,
      startedAt,
      scheduledPublicationTaskId,
    },
    data: { scheduledPublicationTaskId: null },
  })
  if (result.count !== 1) {
    const liveQuiz = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuizId },
      select: {
        status: true,
        startedAt: true,
        scheduledPublicationTaskId: true,
      },
    })
    const alreadyCleaned =
      liveQuiz.status === DB.PublicationStatus.PUBLISHED &&
      liveQuiz.startedAt?.getTime() === startedAt.getTime() &&
      liveQuiz.scheduledPublicationTaskId === null
    if (!alreadyCleaned) {
      throw new Error(
        `Live quiz ${liveQuizId} changed during scheduled publication cleanup`
      )
    }
  }
}

export async function deleteLiveQuizScheduledPublicationTask({
  prisma,
  liveQuizId,
  startedAt,
  scheduledPublicationTaskId,
  deleteScheduledTask,
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  startedAt: Date
  scheduledPublicationTaskId: string
  deleteScheduledTask: (taskId: string) => Promise<void>
}) {
  try {
    await deleteScheduledTask(scheduledPublicationTaskId)
  } catch (error) {
    if (!isScheduledTaskNotFound(error)) throw error
  }

  await clearLiveQuizScheduledPublicationTask({
    prisma,
    liveQuizId,
    startedAt,
    scheduledPublicationTaskId,
  })
}

export async function reconcileLiveQuizPublications({
  prisma,
  redisExec,
  redisAssessmentExec,
  deleteScheduledTask,
  batchSize = 50,
  now = new Date(),
  retryDelayMs = 5 * 60_000,
}: {
  prisma: DB.PrismaClient
  redisExec: PublicationRedis
  redisAssessmentExec: PublicationRedis
  deleteScheduledTask: (taskId: string) => Promise<void>
  batchSize?: number
  now?: Date
  retryDelayMs?: number
}) {
  const pendingQuizzes = await prisma.liveQuiz.findMany({
    where: {
      status: DB.PublicationStatus.PUBLISHED,
      AND: [
        {
          OR: [
            { publicationMetadataMaterializedAt: null },
            { scheduledPublicationTaskId: { not: null } },
          ],
        },
        {
          OR: [
            { publicationMetadataRetryAt: null },
            { publicationMetadataRetryAt: { lte: now } },
          ],
        },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: batchSize,
  })
  const failures: unknown[] = []

  for (const pendingQuiz of pendingQuizzes) {
    let expectedStartedAt = pendingQuiz.startedAt
    try {
      const publication = await transitionLiveQuizToPublished({
        prisma,
        liveQuizId: pendingQuiz.id,
        source: 'reconcile',
        now,
      })
      if (!publication) continue
      expectedStartedAt = publication.quiz.startedAt

      if (publication.quiz.publicationMetadataMaterializedAt === null) {
        await materializeLiveQuizPublication({
          quiz: publication.quiz,
          redisExec,
          redisAssessmentExec,
        })
        await markLiveQuizPublicationMaterialized({
          prisma,
          liveQuizId: publication.quiz.id,
          startedAt: expectedStartedAt,
        })
      }

      if (publication.scheduledPublicationTaskId) {
        await deleteLiveQuizScheduledPublicationTask({
          prisma,
          liveQuizId: publication.quiz.id,
          startedAt: expectedStartedAt,
          scheduledPublicationTaskId: publication.scheduledPublicationTaskId,
          deleteScheduledTask,
        })
      }
    } catch (error) {
      if (expectedStartedAt) {
        await prisma.liveQuiz.updateMany({
          where: {
            id: pendingQuiz.id,
            status: DB.PublicationStatus.PUBLISHED,
            startedAt: expectedStartedAt,
          },
          data: {
            publicationMetadataRetryAt: new Date(now.getTime() + retryDelayMs),
          },
        })
      }
      failures.push(error)
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to reconcile ${failures.length} live quiz publication(s)`
    )
  }

  return pendingQuizzes.length
}

function isScheduledTaskNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    error.response.status === 404
  )
}

function requirePublishedStart<T extends Pick<DB.LiveQuiz, 'id' | 'startedAt'>>(
  liveQuiz: T
): T & { startedAt: Date } {
  if (!liveQuiz.startedAt) {
    throw new Error(`Published live quiz ${liveQuiz.id} has no start timestamp`)
  }
  return liveQuiz as T & { startedAt: Date }
}
