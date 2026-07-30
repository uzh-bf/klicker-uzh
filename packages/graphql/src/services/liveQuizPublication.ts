import * as DB from '@klicker-uzh/prisma/client'
import type { Redis } from 'ioredis'

type PublicationSource = 'manual' | 'scheduled'

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
      return {
        quiz: liveQuiz,
        didStart: false,
        scheduledPublicationTaskId: null,
      }
    }

    const canPublish =
      source === 'scheduled'
        ? liveQuiz.status === DB.PublicationStatus.SCHEDULED &&
          liveQuiz.availableFrom !== null &&
          liveQuiz.availableFrom <= now
        : liveQuiz.status === DB.PublicationStatus.DRAFT ||
          liveQuiz.status === DB.PublicationStatus.SCHEDULED
    if (!canPublish) return null

    const publishedQuiz = await transaction.liveQuiz.update({
      where: { id: liveQuizId },
      data: {
        status: DB.PublicationStatus.PUBLISHED,
        startedAt: now,
        scheduledPublicationTaskId: null,
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
  redisExec: Pick<Redis, 'pipeline'>
  redisAssessmentExec: Pick<Redis, 'pipeline'>
}) {
  const redis = quiz.isAssessmentEnabled ? redisAssessmentExec : redisExec
  const pipeline = redis.pipeline()
  pipeline.hmset(`lq:${quiz.id}:meta`, {
    namespace: quiz.namespace,
    startedAt: Number(quiz.startedAt ?? new Date()),
    isGamificationEnabled: quiz.isGamificationEnabled,
    isAssessmentEnabled: quiz.isAssessmentEnabled,
  })

  const results = await pipeline.exec()
  if (results === null) {
    throw new Error('Live quiz publication metadata pipeline was aborted')
  }

  const commandError = results.find(([error]) => error !== null)?.[0]
  if (commandError) throw commandError
}
