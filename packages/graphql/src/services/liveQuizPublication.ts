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
              },
            })
          : liveQuiz

      return {
        quiz: publishedQuiz,
        didStart: false,
        scheduledPublicationTaskId: publishedQuiz.scheduledPublicationTaskId,
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
      },
    })

    return {
      quiz: publishedQuiz,
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
  clearScheduledPublicationTask = false,
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  clearScheduledPublicationTask?: boolean
}) {
  await prisma.liveQuiz.update({
    where: { id: liveQuizId },
    data: {
      publicationMetadataMaterializedAt: new Date(),
      ...(clearScheduledPublicationTask
        ? { scheduledPublicationTaskId: null }
        : {}),
    },
  })
}

export async function clearLiveQuizScheduledPublicationTask({
  prisma,
  liveQuizId,
  scheduledPublicationTaskId,
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
  scheduledPublicationTaskId: string
}) {
  await prisma.liveQuiz.updateMany({
    where: {
      id: liveQuizId,
      scheduledPublicationTaskId,
    },
    data: { scheduledPublicationTaskId: null },
  })
}

export async function deleteLiveQuizScheduledPublicationTask({
  prisma,
  liveQuizId,
  scheduledPublicationTaskId,
  deleteScheduledTask,
}: {
  prisma: DB.PrismaClient
  liveQuizId: string
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
    scheduledPublicationTaskId,
  })
}

export async function reconcileLiveQuizPublications({
  prisma,
  redisExec,
  redisAssessmentExec,
  deleteScheduledTask,
  batchSize = 50,
}: {
  prisma: DB.PrismaClient
  redisExec: PublicationRedis
  redisAssessmentExec: PublicationRedis
  deleteScheduledTask: (taskId: string) => Promise<void>
  batchSize?: number
}) {
  const pendingQuizzes = await prisma.liveQuiz.findMany({
    where: {
      status: DB.PublicationStatus.PUBLISHED,
      OR: [
        { publicationMetadataMaterializedAt: null },
        { scheduledPublicationTaskId: { not: null } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: batchSize,
  })
  const failures: unknown[] = []

  for (const pendingQuiz of pendingQuizzes) {
    try {
      const publication = await transitionLiveQuizToPublished({
        prisma,
        liveQuizId: pendingQuiz.id,
        source: 'reconcile',
      })
      if (!publication) continue

      if (publication.quiz.publicationMetadataMaterializedAt === null) {
        await materializeLiveQuizPublication({
          quiz: publication.quiz,
          redisExec,
          redisAssessmentExec,
        })
        await markLiveQuizPublicationMaterialized({
          prisma,
          liveQuizId: publication.quiz.id,
        })
      }

      if (publication.scheduledPublicationTaskId) {
        await deleteLiveQuizScheduledPublicationTask({
          prisma,
          liveQuizId: publication.quiz.id,
          scheduledPublicationTaskId: publication.scheduledPublicationTaskId,
          deleteScheduledTask,
        })
      }
    } catch (error) {
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
