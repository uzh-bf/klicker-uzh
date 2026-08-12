import { createHash } from 'node:crypto'
import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import { ElementType, UserRole } from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import { getAssessmentRedis } from '../redis.js'
import { updateLeaderboards } from './helpers.js'

export async function aggregateAssessmentResponses(
  message: {
    correlationId: string
    participantId: string
    liveQuizId: string
    blockId: string
    instanceId: string
    elementType: ElementType
    isGamificationEnabled: boolean
    pointsAwarded: number
    xpAwarded: number
    response: LiveQuizResponseInput
  },
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  const {
    participantId,
    liveQuizId,
    blockId,
    instanceId,
    elementType,
    isGamificationEnabled,
    pointsAwarded,
    xpAwarded,
    response,
  } = message
  const redis = getAssessmentRedis().pipeline()
  const liveQuizKey = `lq:${liveQuizId}`
  const instanceKey = `${liveQuizKey}:i:${instanceId}`

  if (isGamificationEnabled && elementType !== ElementType.CONTENT) {
    updateLeaderboards({
      redisMulti: redis,
      participantId,
      participantRole: UserRole.PARTICIPANT,
      liveQuizKey,
      sessionBlockId: blockId,
      pointsAwarded,
      xpAwarded,
    })
  }

  switch (elementType) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      response.choices
        ?.filter((choice) => choice.selected)
        .forEach((choice) => {
          redis.hincrby(`${instanceKey}:results`, String(choice.ix), 1)
        })
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    case ElementType.NUMERICAL: {
      const responseHash = createHash('md5')
        .update(response.value ?? '')
        .digest('hex')
      redis.hincrby(`${instanceKey}:results`, responseHash, 1)
      redis.hset(
        `${instanceKey}:responseHashes`,
        responseHash,
        response.value ?? ''
      )
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }
    case ElementType.FREE_TEXT: {
      const cleanResponseValue = response.value?.trim() ?? ''
      const responseHash = createHash('md5')
        .update(cleanResponseValue)
        .digest('hex')
      redis.hincrby(`${instanceKey}:results`, responseHash, 1)
      redis.hset(
        `${instanceKey}:responseHashes`,
        responseHash,
        cleanResponseValue
      )
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }
    case ElementType.SELECTION:
      response.selection?.forEach((answerId) => {
        if (answerId !== -1 && answerId != null) {
          redis.hincrby(`${instanceKey}:results`, String(answerId), 1)
        }
      })
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    case ElementType.CASE_STUDY:
      Object.entries(response.assessment ?? {}).forEach(
        ([caseId, caseData]) => {
          Object.entries(caseData).forEach(([itemId, itemData]) => {
            Object.entries(itemData).forEach(
              ([criterionId, criterionResponse]) => {
                if (typeof criterionResponse !== 'number') return
                const responseHash = createHash('md5')
                  .update(String(criterionResponse))
                  .digest('hex')
                const combinedHash = `${caseId}:${itemId}:${criterionId}:${responseHash}`
                redis.hincrby(`${instanceKey}:results`, combinedHash, 1)
                redis.hset(
                  `${instanceKey}:responseHashes`,
                  combinedHash,
                  String(criterionResponse)
                )
              }
            )
          })
        }
      )
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    case ElementType.CONTENT:
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
  }

  try {
    await redis.exec()
    ctx.logger.info('Assessment response aggregation completed', {
      extra: {
        correlationId: message.correlationId,
        liveQuizId: message.liveQuizId,
        instanceId: message.instanceId,
      },
    })
    return { status: 200 }
  } catch {
    redis.discard()
    ctx.logger.error('Assessment response aggregation will retry', {
      extra: {
        correlationId: message.correlationId,
        liveQuizId: message.liveQuizId,
        instanceId: message.instanceId,
      },
    })
    throw new Error('ASSESSMENT_RESPONSE_AGGREGATION_FAILED')
  }
}
