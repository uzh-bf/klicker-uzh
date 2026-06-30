import {
  PublicationStatus,
  type ConfusionTimestep,
  type ElementBlock,
  type ElementInstance,
  type LiveQuiz,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { Redis } from 'ioredis'
import { aggregateFeedbacks, toFeedback } from './manageLiveQuizLecturerView.js'

type RedisLike = Pick<Redis, 'pipeline'>

type CockpitBlockSource = Pick<
  ElementBlock,
  | 'execution'
  | 'expiresAt'
  | 'id'
  | 'order'
  | 'randomSelection'
  | 'status'
  | 'timeLimit'
> & {
  elements: Pick<
    ElementInstance,
    | 'anonymousResults'
    | 'elementData'
    | 'elementType'
    | 'id'
    | 'results'
    | 'type'
  >[]
}

type CockpitLiveQuizSource = Pick<
  LiveQuiz,
  | 'displayName'
  | 'id'
  | 'isAssessmentEnabled'
  | 'isConfusionFeedbackEnabled'
  | 'isGamificationEnabled'
  | 'isLiveQAEnabled'
  | 'isModerationEnabled'
  | 'name'
  | 'namespace'
  | 'pinCode'
  | 'startedAt'
  | 'status'
> & {
  activeBlock:
    | (Pick<ElementBlock, 'id'> & {
        elements: Pick<ElementInstance, 'id'>[]
      })
    | null
  blocks: CockpitBlockSource[]
  course: {
    id: string
    displayName: string
    language: string
  } | null
  confusionFeedbacks: Pick<
    ConfusionTimestep,
    'createdAt' | 'difficulty' | 'speed'
  >[]
  feedbacks: Parameters<typeof toFeedback>[0][]
}

function isRedisLike(redis: unknown): redis is RedisLike {
  return (
    Boolean(redis) &&
    typeof (redis as { pipeline?: unknown }).pipeline === 'function'
  )
}

function getResultTotal(results: unknown) {
  if (!results || typeof results !== 'object') return 0
  if (!('total' in results)) return 0

  const total = (results as { total?: unknown }).total
  return typeof total === 'number' ? total : 0
}

function getElementDataName(elementData: unknown) {
  if (!elementData || typeof elementData !== 'object') return null
  if (!('name' in elementData)) return null

  const name = (elementData as { name?: unknown }).name
  return typeof name === 'string' ? name : null
}

function getElementDataElementId(elementData: unknown) {
  if (!elementData || typeof elementData !== 'object') return null
  if (!('elementId' in elementData)) return null

  const elementId = (elementData as { elementId?: unknown }).elementId
  return typeof elementId === 'number' ? elementId : null
}

async function getCachedActiveBlockParticipants({
  id,
  liveQuiz,
  redis,
}: {
  id: string
  liveQuiz: CockpitLiveQuizSource
  redis: unknown
}) {
  if (!liveQuiz.activeBlock?.id || !isRedisLike(redis)) return null

  const redisMulti = redis.pipeline()
  liveQuiz.activeBlock.elements.forEach((instance) => {
    redisMulti.hgetall(`lq:${id}:i:${instance.id}:results`)
  })

  const cacheContent = (await redisMulti.exec()) as
    | [Error | null, { participants: string }][]
    | null

  return (
    cacheContent
      ?.map(([_, result]) => Number.parseInt(result?.participants, 10))
      .reduce((acc, value) => Math.min(acc, value), 100000) ?? null
  )
}

function toCockpitBlock(block: CockpitBlockSource, numOfParticipants: number) {
  return {
    id: block.id,
    numOfParticipants,
    order: block.order,
    status: block.status,
    expiresAt: block.expiresAt,
    timeLimit: block.timeLimit,
    randomSelection: block.randomSelection,
    execution: block.execution,
    elements: block.elements.map((instance) => ({
      id: instance.id,
      type: instance.type,
      elementType: instance.elementType,
      elementData: {
        elementId: getElementDataElementId(instance.elementData),
        name: getElementDataName(instance.elementData),
      },
    })),
  }
}

export async function getCockpitLiveQuiz({
  id,
  prisma,
  redisExec,
  redisAssessmentExec,
}: {
  id: string
  prisma: PrismaClient
  redisExec?: unknown
  redisAssessmentExec?: unknown
}) {
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: { id, status: PublicationStatus.PUBLISHED },
    select: {
      id: true,
      isLiveQAEnabled: true,
      isConfusionFeedbackEnabled: true,
      isModerationEnabled: true,
      isGamificationEnabled: true,
      isAssessmentEnabled: true,
      namespace: true,
      name: true,
      displayName: true,
      pinCode: true,
      status: true,
      startedAt: true,
      activeBlock: {
        select: {
          id: true,
          elements: {
            select: { id: true },
            orderBy: { order: 'asc' },
          },
        },
      },
      course: {
        select: {
          id: true,
          displayName: true,
          language: true,
        },
      },
      blocks: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          status: true,
          expiresAt: true,
          timeLimit: true,
          randomSelection: true,
          execution: true,
          elements: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              type: true,
              elementType: true,
              elementData: true,
              results: true,
              anonymousResults: true,
            },
          },
        },
      },
      confusionFeedbacks: {
        select: {
          speed: true,
          difficulty: true,
          createdAt: true,
        },
      },
      feedbacks: {
        select: {
          id: true,
          isPublished: true,
          isPinned: true,
          isResolved: true,
          content: true,
          votes: true,
          resolvedAt: true,
          createdAt: true,
          responses: {
            select: {
              id: true,
              content: true,
              positiveReactions: true,
              negativeReactions: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })

  if (!liveQuiz) {
    return null
  }

  const blockParticipants = liveQuiz.blocks.reduce<Record<number, number>>(
    (acc, block) => {
      acc[block.id] = block.elements.reduce(
        (instanceAcc, instance) =>
          Math.min(
            instanceAcc,
            getResultTotal(instance.results) +
              getResultTotal(instance.anonymousResults)
          ),
        100000
      )
      return acc
    },
    {}
  )

  const redis = liveQuiz.isAssessmentEnabled ? redisAssessmentExec : redisExec
  const activeBlockParticipants = await getCachedActiveBlockParticipants({
    id,
    liveQuiz,
    redis,
  })

  if (liveQuiz.activeBlock?.id) {
    blockParticipants[liveQuiz.activeBlock.id] =
      activeBlockParticipants ?? blockParticipants[liveQuiz.activeBlock.id] ?? 0
  }

  return {
    id: liveQuiz.id,
    isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
    isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
    isModerationEnabled: liveQuiz.isModerationEnabled,
    isGamificationEnabled: liveQuiz.isGamificationEnabled,
    isAssessmentEnabled: liveQuiz.isAssessmentEnabled,
    namespace: liveQuiz.namespace,
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    pinCode: liveQuiz.pinCode,
    status: liveQuiz.status,
    startedAt: liveQuiz.startedAt,
    course: liveQuiz.course,
    activeBlock: liveQuiz.activeBlock
      ? {
          id: liveQuiz.activeBlock.id,
        }
      : null,
    blocks: liveQuiz.blocks.map((block) =>
      toCockpitBlock(block, blockParticipants[block.id] ?? 0)
    ),
    confusionSummary: aggregateFeedbacks(liveQuiz.confusionFeedbacks),
    feedbacks: liveQuiz.feedbacks.map(toFeedback),
  }
}
