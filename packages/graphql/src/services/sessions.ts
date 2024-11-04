import { SessionStatus } from '@klicker-uzh/prisma'
import type {
  AllQuestionInstanceTypeData,
  QuestionResultsOpen,
} from '@klicker-uzh/types'
import { max, mean, median, min, quantileSeq, std } from 'mathjs'
import { createHmac } from 'node:crypto'
import { mapValues, omitBy, prop, sortBy } from 'remeda'
import type { Context, ContextWithUser } from '../lib/context.js'

// FIXME: move to config file or environment variable?
const FIRST_ACHIEVEMENT_ID = 5
const SECOND_ACHIEVEMENT_ID = 6
const THIRD_ACHIEVEMENT_ID = 7

interface GetCachedBlockResultsArgs {
  ctx: Context
  sessionId: string
  sessionBlockId: number
  activeInstanceIds: number[]
}

async function getCachedBlockResults({
  ctx,
  sessionId,
  sessionBlockId,
  activeInstanceIds,
}: GetCachedBlockResultsArgs) {
  const redisMulti = ctx.redisExec.multi()
  redisMulti.hgetall(`s:${sessionId}:lb`)
  redisMulti.hgetall(`s:${sessionId}:b:${sessionBlockId}:lb`)
  activeInstanceIds.forEach((instanceId) => {
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:responseHashes`)
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:responses`)
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:results`)
  })
  return redisMulti.exec()
}

interface ProcessCachedDataArgs {
  cachedResults: any[]
  activeBlock: any
}

async function processCachedData({
  cachedResults,
  activeBlock,
}: ProcessCachedDataArgs) {
  const mappedResults = cachedResults.map(([_, result]) => result)

  const sessionLeaderboard: Record<string, string> = mappedResults[0]
  const blockLeaderboard: Record<string, string> = mappedResults[1]

  const instanceResults: Record<
    string,
    {
      responseHashes: Record<string, string>
      responses: Record<string, string>
      results: Record<string, any>
      participants: number
    }
  > = mappedResults.slice(2).reduce((acc, cacheObj, ix) => {
    const ixMod = ix % 3
    const instance = activeBlock.instances[Math.floor((ix - ixMod) / 3)]
    switch (ixMod) {
      // results
      case 2: {
        const results = mapValues(
          omitBy(cacheObj, (_, key) => key === 'participants'),
          (count: number, responseHash: string) => {
            return {
              count: +count,
              value:
                acc[instance.id]['responseHashes'][responseHash] ??
                responseHash,
            }
          }
        )

        return {
          ...acc,
          [instance.id]: {
            ...acc[instance.id],
            participants: cacheObj.participants,
            results,
          },
        }
      }

      // responses
      case 1:
        return {
          ...acc,
          [instance.id]: {
            ...acc[instance.id],
            responses: cacheObj,
          },
        }

      // response hashes
      case 0:
        return {
          ...acc,
          [instance.id]: {
            responseHashes: cacheObj,
          },
        }

      default:
        return acc
    }
  }, {})

  return {
    sessionLeaderboard,
    blockLeaderboard,
    cachedResults,
    instanceResults,
  }
}

interface GetRunningSessionsArgs {
  shortname: string
}

export async function getRunningSessions(
  { shortname }: GetRunningSessionsArgs,
  ctx: Context
) {
  const userWithSessions = await ctx.prisma.user.findUnique({
    where: {
      shortname: shortname.trim(),
    },
    include: {
      sessions: {
        where: {
          accessMode: 'PUBLIC',
          status: 'RUNNING',
        },
        include: {
          course: true,
        },
      },
    },
  })

  if (!userWithSessions?.sessions) return []

  return userWithSessions.sessions
}

export async function getUnassignedSessions(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      sessions: {
        where: {
          courseId: null,
          status: {
            in: [
              SessionStatus.RUNNING,
              SessionStatus.SCHEDULED,
              SessionStatus.PREPARED,
            ],
          },
        },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      },
    },
  })

  return user?.sessions
}

type PickedInstanceType = Pick<
  AllQuestionInstanceTypeData,
  'questionData' | 'elementType' | 'results' | 'statistics'
>

function checkCorrectnessFreeText(instance: PickedInstanceType) {
  // Adds "correct" attribute (true/false) to results in FREE_TEXT questions if they match any given solution)(exact match, case insensitive)
  instance.elementType = instance.questionData.type
  if (
    instance.elementType === 'FREE_TEXT' &&
    instance.questionData.type === 'FREE_TEXT'
  ) {
    for (const id in instance.results) {
      if (instance.questionData.options.solutions) {
        const solutions = instance.questionData.options.solutions.map(
          (solution: string) => solution.toLowerCase()
        )
        if (solutions.includes(instance.results[id].value.toLowerCase())) {
          instance.results[id].correct = true
        } else {
          instance.results[id].correct = false
        }
      } else {
        instance.results[id].correct = undefined
      }
    }
  }
  return instance
}

function computeStatistics(instance: PickedInstanceType) {
  // Compute the statistics for numerical questions
  instance.elementType = instance.questionData.type
  if (
    instance.elementType === 'NUMERICAL' &&
    instance.questionData.type === 'NUMERICAL'
  ) {
    const results: QuestionResultsOpen['responses'][0][] = []
    for (const key in instance.results) {
      results.push(instance.results[key])
    }
    const valueArray = results.reduce<number[]>((acc, { count, value }) => {
      const elements = Array(count).fill(parseFloat(value))
      return acc.concat(elements)
    }, [])

    // set correct attribute to each of the instance.results elements depending on solutionRanges
    for (const id in instance.results) {
      const value = parseFloat(instance.results[id].value)
      let correct: boolean | undefined = undefined

      if (
        instance.questionData.options.solutionRanges &&
        instance.questionData.options.solutionRanges[0] &&
        Object.keys(instance.questionData.options.solutionRanges[0]).length !==
          0
      ) {
        correct = false
        const solutionRanges = instance.questionData.options.solutionRanges
        for (const range of solutionRanges) {
          if (
            (typeof range.min === 'undefined' ||
              range.min === null ||
              value >= range.min) &&
            (typeof range.max === 'undefined' ||
              range.max === null ||
              value <= range.max)
          ) {
            correct = true
            break
          }
        }
      } else if (
        instance.questionData.options.solutionRanges &&
        instance.questionData.options.solutionRanges[0] &&
        Object.keys(instance.questionData.options.solutionRanges[0]).length ===
          0
      ) {
        instance.results[id].correct = true
      }
      instance.results[id].correct = correct
    }

    const hasResults = valueArray.length > 0

    instance.statistics = hasResults
      ? {
          max: max(valueArray),
          mean: mean(valueArray),
          median: median(valueArray),
          min: min(valueArray),
          q1: quantileSeq(valueArray, 0.25) as number,
          q3: quantileSeq(valueArray, 0.75) as number,
          sd: std(valueArray) as number[],
        }
      : undefined
  }
  return instance
}

function completeQuestionData(instances: PickedInstanceType[]) {
  return instances.map((instance) =>
    computeStatistics(checkCorrectnessFreeText(instance))
  )
}

export async function getSessionEvaluation(
  { id, hmac }: { id: string; hmac?: string | null },
  ctx: Context
) {
  if ((!ctx.user?.sub && typeof hmac !== 'string') || hmac == '') {
    return null
  }

  let session = await ctx.prisma.liveSession.findUnique({
    where: {
      id,
      ownerId: ctx.user?.sub || undefined,
    },
    include: {
      activeBlock: {
        include: {
          instances: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      blocks: {
        orderBy: {
          order: 'asc',
        },
        where: {
          status: {
            equals: 'EXECUTED',
          },
        },
        include: {
          instances: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      feedbacks: {
        include: {
          responses: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
      confusionFeedbacks: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  if (!session) return null

  if (typeof hmac === 'string') {
    const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
    hmacEncoder.update(session.namespace + session.id)
    const sessionHmac = hmacEncoder.digest('hex')

    // evaluate whether the hashed session.namespace and session.id equals the hmac
    if (sessionHmac !== hmac) {
      return null
    }
  }

  // if the session is running and a block is active
  // fetch the current results from the execution cache
  let activeInstanceResults: any[] = []
  if (session.status === SessionStatus.RUNNING && session.activeBlock) {
    const activeInstanceIds = session.activeBlock.instances.map(
      (instance) => instance.id
    )

    const cachedResults = await getCachedBlockResults({
      ctx,
      sessionId: session.id,
      sessionBlockId: session.activeBlock.id,
      activeInstanceIds,
    })

    // FIXME: rework processCachedData with a clean return type
    const { instanceResults } = await processCachedData({
      cachedResults: cachedResults as any[],
      activeBlock: session.activeBlock,
    })

    activeInstanceResults = Object.entries(instanceResults).map(
      ([id, results]) => {
        const instance = session!.activeBlock!.instances.find(
          (instance) => instance.id === Number(id)
        )

        return {
          id: `${instance?.id}-eval`,
          displayName: session!.displayName,
          blockIx: session!.activeBlock!.order,
          instanceIx: instance?.order,
          status: session!.activeBlock!.status,
          questionData: instance?.questionData,
          participants: results.participants,
          results: results.results,
        }
      }
    )

    activeInstanceResults = sortBy(
      activeInstanceResults,
      [prop('blockIx'), 'asc'],
      [prop('instanceIx'), 'asc']
    )
  }

  let executedInstanceResults = session.blocks.flatMap((block) =>
    block.instances.map((instance) => ({
      id: `${instance.id}-eval`,
      displayName: session!.displayName,
      blockIx: block.order,
      instanceIx: instance.order,
      status: block.status,
      questionData: instance.questionData,
      participants: instance.participants,
      results: instance.results,
    }))
  )

  const executedBlocks = session.blocks.map((block) => ({
    blockIx: block.order,
    blockStatus: block.status,
    tabData: block.instances.map((instance) => ({
      id: `${instance.id}-eval`,
      questionIx: instance.order,
      name: instance.questionData?.name,
      status: block.status,
    })),
  }))

  let activeBlock
  if (session.status === SessionStatus.RUNNING && session.activeBlock) {
    activeBlock = {
      blockIx: session.activeBlock.order,
      blockStatus: session.activeBlock.status,
      tabData: session.activeBlock.instances.map((instance) => ({
        id: `${instance.id}-eval`,
        questionIx: instance.order,
        name: instance.questionData?.name,
        status: session!.activeBlock?.status,
      })),
    }
  }

  return {
    id: `${id}-eval`,
    displayName: session.displayName,
    status: session.status,
    isGamificationEnabled: session.isGamificationEnabled,
    blocks: activeBlock ? [...executedBlocks, activeBlock] : executedBlocks,
    instanceResults: [
      ...completeQuestionData(executedInstanceResults),
      ...completeQuestionData(activeInstanceResults),
    ],
    feedbacks: session.feedbacks,
    confusionFeedbacks: session.confusionFeedbacks,
  }
}
