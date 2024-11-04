import { SessionStatus } from '@klicker-uzh/prisma'
import type {
  AllQuestionInstanceTypeData,
  QuestionResultsOpen,
} from '@klicker-uzh/types'
import { max, mean, median, min, quantileSeq, std } from 'mathjs'
import { createHmac } from 'node:crypto'
import { mapValues, omitBy, prop, sortBy } from 'remeda'
import type { Context, ContextWithUser } from '../lib/context.js'
import { sendTeamsNotifications } from '../lib/util.js'

// TODO: rework scheduling for serverless
const scheduledJobs: Record<string, any> = {}

// FIXME: move to config file or environment variable?
const FIRST_ACHIEVEMENT_ID = 5
const SECOND_ACHIEVEMENT_ID = 6
const THIRD_ACHIEVEMENT_ID = 7

interface EndSessionArgs {
  id: string
}

export async function endSession({ id }: EndSessionArgs, ctx: ContextWithUser) {
  const session = await ctx.prisma.liveSession.findFirst({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      blocks: {
        include: {
          instances: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          id: 'asc',
        },
      },
    },
  })

  // if there is no session matching the current user and session id, exit early
  if (!session) {
    return null
  }

  if (session.status === SessionStatus.COMPLETED) {
    return session
  }
  if (
    session.status === SessionStatus.PREPARED ||
    session.status === SessionStatus.SCHEDULED
  ) {
    return null
  }

  try {
    const sessionLB = await ctx.redisExec.hgetall(`s:${id}:lb`)
    const sessionXP = await ctx.redisExec.hgetall(`s:${id}:xp`)

    let promises: any[] = []

    const participants: Record<string, any> = {}

    Object.entries(sessionXP).forEach(([id, xp]) => {
      participants[id] = {
        xp: parseInt(xp),
      }
    })

    Object.entries(sessionLB).forEach(([id, score]) => {
      participants[id] = {
        ...(participants[id] ?? {}),
        score: parseInt(score),
      }
    })

    // sessionXP should always be around as soon as there are logged-in participants (check first)
    // sessionLB only for sessions that are compatible with points collection (check second)
    if (sessionXP) {
      let existingParticipants = (
        await Promise.allSettled(
          Object.entries(participants).map(async ([id, { score, xp }]) => {
            const participant = await ctx.prisma.participant.findUnique({
              where: { id },
              include: {
                // if the session is part of a course, include the corresponding participations
                // if the participant is not part of the relevant course, the joined array will be empty
                participations: session.courseId
                  ? {
                      where: {
                        courseId: session.courseId,
                      },
                    }
                  : undefined,
              },
            })

            if (!participant) return null

            return {
              id,
              score,
              xp,
              hasParticipation: participant.participations?.[0]?.isActive,
            }
          })
        )
      ).flatMap((result) => {
        if (result.status !== 'fulfilled' || !result.value) return []
        return [result.value]
      })

      // track the achievement ids, which should be awarded to the participants
      let newAchievements: Record<string, number> = {}

      // only award achievements, if the session did contain questions with sample solutions and at least three participants collected points
      const awardAchievements = session.blocks.some(
        (block) =>
          block.instances.some((instance) => {
            return instance.questionData.options.hasSampleSolution ?? false
          }) &&
          existingParticipants.filter(
            ({ score }) => typeof score !== 'undefined'
          ).length >= 3
      )

      // award achievements to the top 3 participants (and all others with equal scores)
      if (awardAchievements) {
        const topScores = existingParticipants
          .filter(({ score }) => typeof score !== 'undefined')
          .sort((a, b) => Number(b.score) - Number(a.score))
          .slice(0, 3)

        const firstRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: FIRST_ACHIEVEMENT_ID },
        })
        const secondRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: SECOND_ACHIEVEMENT_ID },
        })
        const thirdRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: THIRD_ACHIEVEMENT_ID },
        })

        const goldScore = topScores[0]?.score
        const silverScore = topScores[1]?.score
        const bronzeScore = topScores[2]?.score

        // awarding logic (including point and xp updates):
        // award gold to every participant with gold score
        // award silver to every participant with silver score, if silver score != gold score
        // award bronze to every participant with bronze score, if bronze score != silver score
        existingParticipants = existingParticipants.map((participant) => {
          if (
            typeof participant.score === 'undefined' ||
            typeof participant.xp === 'undefined'
          ) {
            return participant
          }

          if (participant.score === goldScore) {
            participant.xp += firstRankAchievement!.rewardedXP ?? 0
            participant.score += firstRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = firstRankAchievement!.id
          }
          if (participant.score === silverScore && silverScore !== goldScore) {
            participant.xp += secondRankAchievement!.rewardedXP ?? 0
            participant.score += secondRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = secondRankAchievement!.id
          }
          if (
            participant.score === bronzeScore &&
            bronzeScore !== silverScore
          ) {
            participant.xp += thirdRankAchievement!.rewardedXP ?? 0
            participant.score += thirdRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = thirdRankAchievement!.id
          }

          return participant
        })
      }

      // update xp of existing participants
      promises = promises.concat(
        existingParticipants
          .filter(({ xp }) => typeof xp !== 'undefined')
          .map(({ id, xp }) =>
            ctx.prisma.participant.update({
              where: { id },
              data: {
                xp: {
                  increment: Number(xp),
                },
              },
            })
          )
      )

      // if the session is part of a course, update the course leaderboard with the accumulated points and award achievements
      if (sessionLB && session.courseId) {
        promises = promises.concat(
          existingParticipants
            .filter(
              ({ score, hasParticipation }) =>
                typeof score !== 'undefined' && hasParticipation
            )
            .map(({ id, score }) =>
              ctx.prisma.leaderboardEntry.upsert({
                where: {
                  type_participantId_courseId: {
                    type: 'COURSE',
                    courseId: session.courseId!,
                    participantId: id,
                  },
                },
                include: {
                  participation: true,
                  participant: true,
                },
                create: {
                  type: 'COURSE',
                  course: {
                    connect: {
                      id: session.courseId!,
                    },
                  },
                  participant: {
                    connect: {
                      id,
                    },
                  },
                  participation: {
                    connectOrCreate: {
                      where: {
                        courseId_participantId: {
                          courseId: session.courseId!,
                          participantId: id,
                        },
                      },
                      create: {
                        course: {
                          connect: {
                            id: session.courseId!,
                          },
                        },
                        participant: {
                          connect: {
                            id,
                          },
                        },
                      },
                    },
                  },
                  score: score,
                },
                update: {
                  score: {
                    increment: score,
                  },
                },
              })
            )
        )

        // award new achievements
        promises = promises.concat(
          existingParticipants
            .filter(({ id }) => typeof newAchievements[id] !== 'undefined')
            .map(({ id }) =>
              ctx.prisma.participant.update({
                where: { id },
                data: {
                  achievements: {
                    upsert: {
                      where: {
                        participantId_achievementId: {
                          participantId: id,
                          achievementId: newAchievements[id]!,
                        },
                      },
                      create: {
                        achievedAt: new Date(),
                        achievedCount: 1,
                        achievement: {
                          connect: {
                            id: newAchievements[id]!,
                          },
                        },
                      },
                      update: {
                        achievedCount: {
                          increment: 1,
                        },
                      },
                    },
                  },
                },
              })
            )
        )
      }
    }

    // execute XP and points in the same transaction to prevent issues when one fails
    // the session update later on should never fail, but we need the return value (keep separate)
    await ctx.prisma.$transaction(promises)

    const keys = await ctx.redisExec.keys(`s:${id}:*`)
    const pipe = ctx.redisExec.multi()
    for (const key of keys) {
      pipe.unlink(key)
    }
    await pipe.exec()

    const stoppedSession = await ctx.prisma.liveSession.update({
      where: {
        id,
      },
      data: {
        status: SessionStatus.COMPLETED,
        finishedAt: new Date(),
        pinCode: null,
      },
    })

    await sendTeamsNotifications(
      'graphql/endSession',
      `END Session ${session.name} with id ${session.id}.`
    )

    return stoppedSession
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/endSession',
      `ERROR - failed to end session ${session.name} with id ${session.id}: ${error}`
    )
    throw error
  }
}

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
