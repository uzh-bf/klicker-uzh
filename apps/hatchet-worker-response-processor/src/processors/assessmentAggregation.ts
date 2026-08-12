import { createHash } from 'node:crypto'
import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import { ElementType, UserRole } from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import { getAssessmentRedis } from '../redis.js'
import { getLeaderboardUpdates } from './helpers.js'

type AggregationRedis = {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>
}

type AggregationDependencies = {
  redis: AggregationRedis
}

type HashOperation = {
  command: 'HINCRBY' | 'HSET'
  key: string
  field: string
  value: string
}

const APPLY_AGGREGATION_ONCE_SCRIPT = `
local marker = redis.call('HGET', KEYS[1], ARGV[1])
if marker == 'aggregated' then
  return 0
end

if ((#ARGV - 1) % 4) ~= 0 then
  return redis.error_reply('INVALID_AGGREGATION_ARGUMENTS')
end

for index = 2, #ARGV, 4 do
  local command = ARGV[index]
  local key = ARGV[index + 1]
  local value = ARGV[index + 3]
  if command ~= 'HINCRBY' and command ~= 'HSET' then
    return redis.error_reply('INVALID_AGGREGATION_COMMAND')
  end
  if command == 'HINCRBY' and tonumber(value) == nil then
    return redis.error_reply('INVALID_AGGREGATION_INCREMENT')
  end
  local keyType = redis.call('TYPE', key)
  if type(keyType) == 'table' then
    keyType = keyType.ok
  end
  if keyType ~= 'none' and keyType ~= 'hash' then
    return redis.error_reply('INVALID_AGGREGATION_KEY_TYPE')
  end
end

for index = 2, #ARGV, 4 do
  redis.call(
    ARGV[index],
    ARGV[index + 1],
    ARGV[index + 2],
    ARGV[index + 3]
  )
end

redis.call('HSET', KEYS[1], ARGV[1], 'aggregated')
return 1
`

function defaultDependencies(): AggregationDependencies {
  return { redis: getAssessmentRedis() }
}

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
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>,
  dependencies: AggregationDependencies = defaultDependencies()
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
  const liveQuizKey = `lq:${liveQuizId}`
  const instanceKey = `${liveQuizKey}:i:${instanceId}`
  const operations: HashOperation[] = []
  const increment = (key: string, field: string, value: number) => {
    operations.push({
      command: 'HINCRBY',
      key,
      field,
      value: String(value),
    })
  }
  const set = (key: string, field: string, value: string) => {
    operations.push({ command: 'HSET', key, field, value })
  }

  if (isGamificationEnabled && elementType !== ElementType.CONTENT) {
    for (const update of getLeaderboardUpdates({
      participantId,
      participantRole: UserRole.PARTICIPANT,
      liveQuizKey,
      sessionBlockId: blockId,
      pointsAwarded,
      xpAwarded,
    })) {
      increment(update.key, update.field, update.increment)
    }
  }

  switch (elementType) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      response.choices
        ?.filter((choice) => choice.selected)
        .forEach((choice) => {
          increment(`${instanceKey}:results`, String(choice.ix), 1)
        })
      increment(`${instanceKey}:results`, 'participants', 1)
      break
    case ElementType.NUMERICAL: {
      const responseHash = createHash('md5')
        .update(response.value ?? '')
        .digest('hex')
      increment(`${instanceKey}:results`, responseHash, 1)
      set(`${instanceKey}:responseHashes`, responseHash, response.value ?? '')
      increment(`${instanceKey}:results`, 'participants', 1)
      break
    }
    case ElementType.FREE_TEXT: {
      const cleanResponseValue = response.value?.trim() ?? ''
      const responseHash = createHash('md5')
        .update(cleanResponseValue)
        .digest('hex')
      increment(`${instanceKey}:results`, responseHash, 1)
      set(`${instanceKey}:responseHashes`, responseHash, cleanResponseValue)
      increment(`${instanceKey}:results`, 'participants', 1)
      break
    }
    case ElementType.SELECTION:
      response.selection?.forEach((answerId) => {
        if (answerId !== -1 && answerId != null) {
          increment(`${instanceKey}:results`, String(answerId), 1)
        }
      })
      increment(`${instanceKey}:results`, 'participants', 1)
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
                increment(`${instanceKey}:results`, combinedHash, 1)
                set(
                  `${instanceKey}:responseHashes`,
                  combinedHash,
                  String(criterionResponse)
                )
              }
            )
          })
        }
      )
      increment(`${instanceKey}:results`, 'participants', 1)
      break
    case ElementType.CONTENT:
      increment(`${instanceKey}:results`, 'participants', 1)
      break
  }

  try {
    const applied = await dependencies.redis.eval(
      APPLY_AGGREGATION_ONCE_SCRIPT,
      1,
      `${instanceKey}:votes`,
      message.correlationId,
      ...operations.flatMap((operation) => [
        operation.command,
        operation.key,
        operation.field,
        operation.value,
      ])
    )
    ctx.logger.info('Assessment response aggregation completed', {
      extra: {
        correlationId: message.correlationId,
        liveQuizId: message.liveQuizId,
        instanceId: message.instanceId,
        applied: applied === 1,
      },
    })
    return { status: applied === 1 ? 200 : 208 }
  } catch {
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
