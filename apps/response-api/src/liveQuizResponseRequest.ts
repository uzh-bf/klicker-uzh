import { randomUUID } from 'node:crypto'
import {
  LiveQuizResponseCollectionMode,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import type { Redis } from 'ioredis'

export function isAllowedCorsOrigin({
  origin,
  allowedOrigins,
}: {
  origin: string | undefined
  allowedOrigins: string[]
}) {
  return (
    origin === undefined ||
    (origin !== 'null' && allowedOrigins.includes(origin))
  )
}

export function hasJsonContentType(contentType: string | undefined) {
  return (
    contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
  )
}

const CORRELATED_INSTANCE_INFO_FIELDS = [
  'type',
  'blockExecution',
  'sessionBlockId',
  'basePoints',
  'blockClosedAt',
  'defaultCorrectPoints',
  'defaultPoints',
  'firstResponseReceivedAt',
  'maxBonusPoints',
  'pointsMultiplier',
  'restrictions',
  'solutions',
  'timeToZeroBonus',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deriveCaseStudyResponseShape(solutions: string | undefined) {
  if (!solutions) return undefined

  try {
    const parsed: unknown = JSON.parse(solutions)
    if (!Array.isArray(parsed)) return undefined

    const cases: string[] = []
    const items = new Set<number>()
    const criteria = new Map<string, { min: number; max: number }>()

    for (const caseEntry of parsed) {
      if (
        !isRecord(caseEntry) ||
        typeof caseEntry.caseId !== 'string' ||
        !Array.isArray(caseEntry.itemSolutions)
      ) {
        return undefined
      }

      cases.push(caseEntry.caseId)
      for (const itemSolution of caseEntry.itemSolutions) {
        if (
          !isRecord(itemSolution) ||
          typeof itemSolution.itemId !== 'number' ||
          !Number.isInteger(itemSolution.itemId) ||
          itemSolution.itemId <= 0 ||
          !Array.isArray(itemSolution.criteriaSolutions)
        ) {
          return undefined
        }

        items.add(itemSolution.itemId)
        for (const criterionSolution of itemSolution.criteriaSolutions) {
          if (
            !isRecord(criterionSolution) ||
            typeof criterionSolution.criterionId !== 'string' ||
            !criterionSolution.criterionId ||
            typeof criterionSolution.min !== 'number' ||
            !Number.isFinite(criterionSolution.min) ||
            typeof criterionSolution.max !== 'number' ||
            !Number.isFinite(criterionSolution.max) ||
            criterionSolution.min > criterionSolution.max
          ) {
            return undefined
          }

          const existingBounds = criteria.get(criterionSolution.criterionId)
          if (
            existingBounds &&
            (existingBounds.min !== criterionSolution.min ||
              existingBounds.max !== criterionSolution.max)
          ) {
            return undefined
          }
          criteria.set(criterionSolution.criterionId, {
            min: criterionSolution.min,
            max: criterionSolution.max,
          })
        }
      }
    }

    return JSON.stringify({
      cases,
      items: [...items],
      criteria: [...criteria].map(([id, bounds]) => ({ id, ...bounds })),
    })
  } catch {
    return undefined
  }
}

export function adaptLiveQuizResponseInstanceInfo(
  operationalInfo: Record<string, string>
) {
  const instanceInfo: Record<string, string> = {}

  for (const field of CORRELATED_INSTANCE_INFO_FIELDS) {
    const value = operationalInfo[field]
    if (typeof value === 'string') {
      instanceInfo[field] = value
    }
  }

  if (
    operationalInfo.type === 'SC' ||
    operationalInfo.type === 'MC' ||
    operationalInfo.type === 'KPRIM'
  ) {
    if (typeof operationalInfo.choiceCount === 'string') {
      instanceInfo.choiceCount = operationalInfo.choiceCount
    }
  } else if (operationalInfo.type === 'SELECTION') {
    if (typeof operationalInfo.numberOfInputs === 'string') {
      instanceInfo.numberOfInputs = operationalInfo.numberOfInputs
    }
    const selectionAnswerIds =
      operationalInfo.selectionAnswerIds ?? operationalInfo.solutions
    if (typeof selectionAnswerIds === 'string') {
      instanceInfo.selectionAnswerIds = selectionAnswerIds
    }
  } else if (operationalInfo.type === 'CASE_STUDY') {
    const responseShape =
      operationalInfo.caseStudyResponseShape ??
      deriveCaseStudyResponseShape(operationalInfo.solutions)
    if (typeof responseShape === 'string') {
      instanceInfo.caseStudyResponseShape = responseShape
    }
  }

  return instanceInfo
}

export async function resolveResponseCollectionMode({
  cachedMode,
  liveQuizId,
  lookupMode,
}: {
  cachedMode: string | undefined
  liveQuizId: string
  lookupMode: (
    liveQuizId: string
  ) => Promise<LiveQuizResponseCollectionMode | string | null>
}) {
  if (
    cachedMode === LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
    cachedMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return cachedMode
  }

  const storedMode = await lookupMode(liveQuizId)
  if (
    storedMode === LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
    storedMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return storedMode
  }

  throw new Error(
    `Response collection mode for live quiz ${liveQuizId} is unavailable`
  )
}

export type LiveQuizResponseRequest = {
  messageId: string
  liveQuizId: string
  instanceId: string
  response: LiveQuizResponseInput
  responseTimestamp: number
  cookieHeader: string | undefined
}

export function parseLiveQuizResponseRequest({
  payload,
  cookieHeader,
  now = Date.now,
}: {
  payload: unknown
  cookieHeader: string | undefined
  now?: () => number
}):
  | { ok: true; request: LiveQuizResponseRequest }
  | { ok: false; message: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Body must be a JSON object' }
  }

  const { response, liveQuizId, instanceId } = payload as Record<
    string,
    unknown
  >
  if (!response || !liveQuizId || typeof instanceId === 'undefined') {
    return {
      ok: false,
      message: 'Missing required fields: response, liveQuizId, instanceId',
    }
  }

  return {
    ok: true,
    request: {
      messageId: randomUUID(),
      liveQuizId: String(liveQuizId),
      instanceId: String(instanceId),
      response: response as LiveQuizResponseInput,
      responseTimestamp: now(),
      cookieHeader,
    },
  }
}

export async function loadLiveQuizResponseInstance({
  database,
  redis,
  request,
}: {
  database: Pick<PrismaClient, 'liveQuiz'>
  redis: Pick<Redis, 'hgetall'>
  request: LiveQuizResponseRequest
}) {
  const operationalInfo = await redis.hgetall(
    `lq:${request.liveQuizId}:i:${request.instanceId}:info`
  )
  const instanceInfo = adaptLiveQuizResponseInstanceInfo(operationalInfo)
  const responseCollectionMode = await resolveResponseCollectionMode({
    cachedMode: operationalInfo.responseCollectionMode,
    liveQuizId: request.liveQuizId,
    lookupMode: async (id) =>
      (
        await database.liveQuiz.findUnique({
          where: { id },
          select: { responseCollectionMode: true },
        })
      )?.responseCollectionMode ?? null,
  })

  return { instanceInfo, responseCollectionMode }
}
