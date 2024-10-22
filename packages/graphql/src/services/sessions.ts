import {
  AccessMode,
  ConfusionTimestep,
  Element,
  ElementType,
  QuestionInstance,
  QuestionInstanceType,
  SessionBlockStatus,
  SessionStatus,
} from '@klicker-uzh/prisma'
import { processQuestionData } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { max, mean, median, min, quantileSeq, std } from 'mathjs'
import schedule from 'node-schedule'
import { createHmac } from 'node:crypto'
import { mapValues, omitBy, pick, prop, sortBy } from 'remeda'
import { ISession } from 'src/schema/session.js'
import { Context, ContextWithUser } from '../lib/context.js'
import { prepareInitialInstanceResults } from '../lib/questions.js'
import { sendTeamsNotifications } from '../lib/util.js'
import {
  AllQuestionInstanceTypeData,
  QuestionResultsChoices,
} from '../types/app.js'

// TODO: rework scheduling for serverless
const scheduledJobs: Record<string, any> = {}

// FIXME: move to config file or environment variable?
const FIRST_ACHIEVEMENT_ID = 5
const SECOND_ACHIEVEMENT_ID = 6
const THIRD_ACHIEVEMENT_ID = 7

async function getQuestionMap(
  blocks: BlockArgs[],
  ctx: ContextWithUser
): Promise<Record<number, Element>> {
  const allQuestionsIds = new Set(
    blocks.reduce<number[]>((acc, block) => [...acc, ...block.questionIds], [])
  )

  const questions = await ctx.prisma.element.findMany({
    where: {
      id: { in: Array.from(allQuestionsIds) },
      ownerId: ctx.user.sub,
    },
  })

  if (questions.length !== allQuestionsIds.size) {
    throw new GraphQLError('Not all questions could be found')
  }

  return questions.reduce<Record<number, Element>>(
    (acc, question) => ({ ...acc, [question.id]: question }),
    {}
  )
}

interface BlockArgs {
  questionIds: number[]
  randomSelection?: number | null
  timeLimit?: number | null
}

interface CreateSessionArgs {
  name: string
  displayName: string
  description?: string | null
  blocks: BlockArgs[]
  courseId?: string | null
  multiplier: number
  maxBonusPoints: number
  timeToZeroBonus: number
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
}

export async function createSession(
  {
    name,
    displayName,
    description,
    blocks,
    courseId,
    multiplier,
    maxBonusPoints,
    timeToZeroBonus,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
  }: CreateSessionArgs,
  ctx: ContextWithUser
) {
  const questionMap = await getQuestionMap(blocks, ctx)

  const session = await ctx.prisma.liveSession.create({
    data: {
      name: name.trim(),
      displayName: displayName.trim(),
      description,
      pointsMultiplier: multiplier,
      maxBonusPoints: maxBonusPoints,
      timeToZeroBonus: timeToZeroBonus,
      isGamificationEnabled,
      isConfusionFeedbackEnabled,
      isLiveQAEnabled,
      isModerationEnabled,
      blocks: {
        create: blocks.map(
          ({ questionIds, randomSelection, timeLimit }, blockIx) => {
            const newInstances = questionIds.map((questionId, ix) => {
              const question = questionMap[questionId]!
              const processedQuestionData = processQuestionData(question)

              return {
                order: ix,
                type: QuestionInstanceType.SESSION,
                pointsMultiplier: multiplier * question.pointsMultiplier,
                maxBonusPoints: maxBonusPoints,
                timeToZeroBonus: timeToZeroBonus,
                questionData: processedQuestionData,
                results: prepareInitialInstanceResults(processedQuestionData),
                question: {
                  connect: { id: questionId },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
              }
            })

            return {
              order: blockIx,
              randomSelection,
              timeLimit,
              instances: {
                create: newInstances,
              },
            }
          }
        ),
      },
      owner: {
        connect: { id: ctx.user.sub },
      },
      course: courseId
        ? {
            connect: { id: courseId },
          }
        : undefined,
    },
    include: {
      blocks: true,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'Session', id: session.id })

  return session
}

interface EditSessionArgs {
  id: string
  name: string
  displayName: string
  description?: string | null
  blocks: BlockArgs[]
  courseId?: string | null
  multiplier: number
  maxBonusPoints: number
  timeToZeroBonus: number
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
}

export async function editSession(
  {
    id,
    name,
    displayName,
    description,
    blocks,
    courseId,
    multiplier,
    maxBonusPoints,
    timeToZeroBonus,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
  }: EditSessionArgs,
  ctx: ContextWithUser
) {
  // find all instances belonging to the old session and delete them as the content of the questions might have changed
  const oldSession = await ctx.prisma.liveSession.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      blocks: {
        include: {
          instances: true,
        },
      },
    },
  })

  if (!oldSession) {
    throw new GraphQLError('Session not found')
  }
  if (
    oldSession.status === SessionStatus.RUNNING ||
    oldSession.status === SessionStatus.COMPLETED
  ) {
    throw new GraphQLError('Cannot edit a running or completed session')
  }

  const oldQuestionInstances = oldSession.blocks.reduce<QuestionInstance[]>(
    (acc, block) => [...acc, ...block.instances],
    []
  )

  await ctx.prisma.questionInstance.deleteMany({
    where: {
      id: { in: oldQuestionInstances.map(({ id }) => id) },
    },
  })
  await ctx.prisma.liveSession.update({
    where: { id },
    data: {
      blocks: {
        deleteMany: {},
      },
      course: {
        disconnect: true,
      },
    },
  })

  const questionMap = await getQuestionMap(blocks, ctx)

  const session = await ctx.prisma.liveSession.update({
    where: { id },
    data: {
      name: name.trim(),
      displayName: displayName.trim(),
      description,
      pointsMultiplier: multiplier,
      maxBonusPoints: maxBonusPoints,
      timeToZeroBonus: timeToZeroBonus,
      isGamificationEnabled: isGamificationEnabled,
      isConfusionFeedbackEnabled,
      isLiveQAEnabled,
      isModerationEnabled,
      blocks: {
        create: blocks.map(
          ({ questionIds, randomSelection, timeLimit }, blockIx) => {
            const newInstances = questionIds.map((questionId, ix) => {
              const question = questionMap[questionId]!
              const processedQuestionData = processQuestionData(question)

              return {
                order: ix,
                type: QuestionInstanceType.SESSION,
                pointsMultiplier: multiplier * question.pointsMultiplier,
                maxBonusPoints: maxBonusPoints,
                timeToZeroBonus: timeToZeroBonus,
                questionData: processedQuestionData,
                results: prepareInitialInstanceResults(processedQuestionData),
                question: {
                  connect: { id: questionId },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
              }
            })

            return {
              order: blockIx,
              randomSelection,
              timeLimit,
              instances: {
                create: newInstances,
              },
            }
          }
        ),
      },
      owner: {
        connect: { id: ctx.user.sub },
      },
      course: courseId
        ? {
            connect: { id: courseId },
          }
        : undefined,
    },
    include: {
      blocks: true,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'Session', id: session.id })

  return session
}

interface GetLiveSessionDataArgs {
  id: string
}

export async function getLiveSessionData(
  { id }: GetLiveSessionDataArgs,
  ctx: ContextWithUser
) {
  if (!id) {
    return null
  }

  // TODO: only return data that is required for the live quiz update
  const session = await ctx.prisma.liveSession.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      blocks: {
        include: {
          instances: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      course: true,
    },
  })

  return session
}

interface StartSessionArgs {
  id: string
}

export async function startSession(
  { id }: StartSessionArgs,
  ctx: ContextWithUser
) {
  try {
    const session = await ctx.prisma.liveSession.findFirst({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      include: {
        blocks: {
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

    switch (session.status) {
      case SessionStatus.COMPLETED:
        return null

      case SessionStatus.RUNNING:
        return session

      case SessionStatus.PREPARED:
      case SessionStatus.SCHEDULED: {
        try {
          await ctx.redisExec
            .pipeline()
            .hmset(`s:${session.id}:meta`, {
              // TODO: remove the namespace entirely, as the session id is also a uuid
              namespace: session.namespace,
              // execution: session.execution,
              startedAt: Number(new Date()),
            })
            .exec()
        } catch (e) {
          console.error(e)
        }

        // generate a random pin code
        const pinCode = 100000 + Math.floor(Math.random() * 900000)

        const startedSession = await ctx.prisma.liveSession.update({
          where: {
            id,
          },
          data: {
            status: SessionStatus.RUNNING,
            startedAt: new Date(),
            pinCode:
              session.accessMode === AccessMode.RESTRICTED ? pinCode : null,
          },
        })

        await sendTeamsNotifications(
          'graphql/startSession',
          `START Session ${session.name} with id ${session.id}.`
        )

        return startedSession
      }
    }
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/startSession',
      `ERROR - failed to start session: ${error}`
    )
    throw error
  }
}

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
            if (
              instance.questionData.type === ElementType.CONTENT ||
              instance.questionData.type === ElementType.FLASHCARD
            ) {
              return false
            }

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

interface ActivateSessionBlockArgs {
  sessionId: string
  sessionBlockId: number
}

export async function activateSessionBlock(
  { sessionId, sessionBlockId }: ActivateSessionBlockArgs,
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: {
      id: sessionId,
      ownerId: ctx.user.sub,
    },
    include: {
      blocks: {
        orderBy: {
          id: 'asc',
        },
      },
    },
  })

  if (!session || session.ownerId !== ctx.user.sub) return null

  const newBlock = session.blocks.find((block) => block.id === sessionBlockId)

  // if the block is not from the current session, return early
  if (!newBlock) return session

  // if the block is already active, return early
  if (session.activeBlockId === sessionBlockId) return session

  // set the new block to active
  const updatedSession = await ctx.prisma.liveSession.update({
    where: { id: sessionId },
    data: {
      activeBlock: {
        connect: { id: sessionBlockId },
      },
      blocks: {
        update: {
          where: { id: sessionBlockId },
          data: {
            status: SessionBlockStatus.ACTIVE,
            expiresAt: newBlock.timeLimit
              ? dayjs().add(newBlock.timeLimit, 'seconds').toDate()
              : undefined,
          },
        },
      },
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
      },
    },
  })

  if (updatedSession.activeBlock?.expiresAt) {
    scheduledJobs[sessionBlockId] = schedule.scheduleJob(
      dayjs(updatedSession.activeBlock.expiresAt).add(20, 'second').toDate(),
      async () => {
        await deactivateSessionBlock(
          {
            sessionId,
            sessionBlockId,
          },
          ctx,
          true
        )
        ctx.emitter.emit('invalidate', {
          typename: 'Session',
          id: session.id,
        })
      }
    )
  }

  ctx.pubSub.publish('runningSessionUpdated', {
    sessionId,
    block: updatedSession.activeBlock,
  })

  // initialize the cache for the new active block
  const redisMulti = ctx.redisExec.pipeline()

  updatedSession.activeBlock!.instances.forEach((instance) => {
    const questionData = instance.questionData

    const commonInfo = {
      namespace: session.namespace,
      startedAt: Number(new Date()),
      sessionBlockId,
      type: questionData.type,
      pointsMultiplier: instance.pointsMultiplier,
      maxBonusPoints: instance.maxBonusPoints,
      timeToZeroBonus: instance.timeToZeroBonus,
    }

    switch (questionData.type) {
      case ElementType.SC:
      case ElementType.MC:
      case ElementType.KPRIM: {
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:info`, {
          ...commonInfo,
          choiceCount: questionData.options.choices.length,
          solutions: JSON.stringify(
            questionData.options.choices
              .map((choice, ix) => ({ ix, correct: choice.correct }))
              .filter((choice) => choice.correct)
              .map((choice) => choice.ix)
          ),
        })
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:results`, {
          participants: 0,
          ...(instance.results as QuestionResultsChoices).choices,
        })
        break
      }

      case ElementType.NUMERICAL: {
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: JSON.stringify(questionData.options.solutionRanges),
        })
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:results`, {
          participants: 0,
        })
        break
      }

      case ElementType.FREE_TEXT: {
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: JSON.stringify(questionData.options.solutions),
        })
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:results`, {
          participants: 0,
        })
        break
      }
    }
  })

  redisMulti.exec()

  // TODO: if it has been executed already, rehydrate the cache

  return updatedSession
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

interface UnlinkCachedBlockResultsArgs {
  ctx: Context
  sessionId: string
  sessionBlockId: number
  activeInstanceIds: number[]
}

async function unlinkCachedBlockResults({
  ctx,
  sessionId,
  sessionBlockId,
  activeInstanceIds,
}: UnlinkCachedBlockResultsArgs) {
  // unlink everything regarding the block in redis
  const unlinkMulti = ctx.redisExec.pipeline()
  unlinkMulti.unlink(`s:${sessionId}:b:${sessionBlockId}:lb`)
  activeInstanceIds.forEach((instanceId) => {
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:info`)
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:responseHashes`)
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:responses`)
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:results`)
  })
  return unlinkMulti.exec()
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

export async function deactivateSessionBlock(
  { sessionId, sessionBlockId }: ActivateSessionBlockArgs,
  ctx: ContextWithUser,
  isScheduled?: boolean
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: {
      id: sessionId,
      ownerId: ctx.user.sub,
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
          id: 'asc',
        },
      },
    },
  })

  if (!session || session.ownerId !== ctx.user.sub || !session.activeBlock)
    return null

  // if the block is not the active one, return early
  if (session.activeBlockId !== sessionBlockId) return session

  const activeInstanceIds = session.activeBlock.instances.map(
    (instance) => instance.id
  )

  const cachedResults = await getCachedBlockResults({
    ctx,
    sessionId,
    sessionBlockId,
    activeInstanceIds,
  })

  if (!cachedResults) return null

  try {
    const { instanceResults, sessionLeaderboard, blockLeaderboard } =
      await processCachedData({
        cachedResults,
        activeBlock: session.activeBlock,
      })

    const existingParticipantsLB = (
      await Promise.allSettled(
        Object.entries(sessionLeaderboard).map(async ([id, score]) => {
          const participant = await ctx.prisma.participant.findUnique({
            where: { id },
          })

          if (!participant) return null

          return [id, score] as [string, string]
        })
      )
    ).flatMap((result) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      return [result.value]
    })

    // TODO: what if session gamified and results are reset? are points taken away?
    const updatedSession = await ctx.prisma.liveSession.update({
      where: {
        id: sessionId,
      },
      data: {
        activeBlock: {
          disconnect: true,
        },
        blocks: {
          update: {
            where: {
              id: Number(sessionBlockId),
            },
            data: {
              status: SessionBlockStatus.EXECUTED,
              instances: {
                update: Object.entries(instanceResults).map(
                  ([id, results]) => ({
                    where: { id: Number(id) },
                    data: {
                      results: results.results,
                      participants: Number(results.participants),
                      // TODO: persist responses or "too much information"? delete when session is completed? what about anonymous users?
                      // responses: {
                      //   create: Object.entries(results.responses).map(
                      //     ([participantId, response]) => ({
                      //       response,
                      //       participant: {
                      //         connect: { id: participantId },
                      //       },
                      //       participation: {
                      //         connect: {
                      //           courseId_participantId: {
                      //             // TODO: this is not set if the session is not in a course (i.e., not gamified)
                      //             courseId: session.courseId as string,
                      //             participantId,
                      //           },
                      //         },
                      //       },
                      //     })
                      //   ),
                      // },
                    },
                  })
                ),
              },
              // leaderboard: {
              //   create: Object.entries(blockLeaderboard).map(([id, score]) => ({
              //     score: parseInt(score),
              //     participant: {
              //       connect: { id },
              //     },
              //     type: 'SESSION_BLOCK',
              //     username: id,
              //   })),
              // },
            },
          },
        },
        leaderboard: session.isGamificationEnabled
          ? {
              upsert: existingParticipantsLB.map(
                ([id, score]: [string, string]) => ({
                  where: {
                    type_participantId_sessionId: {
                      type: 'SESSION',
                      participantId: id,
                      sessionId,
                    },
                  },
                  create: {
                    type: 'SESSION',
                    participant: {
                      connect: { id },
                    },
                    score: parseInt(score),
                    sessionParticipation: {
                      connectOrCreate: {
                        where: {
                          courseId_participantId: {
                            courseId: session.courseId as string,
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
                  },
                  update: {
                    score: parseInt(score),
                  },
                })
              ),
            }
          : undefined,
      },
      include: {
        blocks: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    ctx.pubSub.publish('runningSessionUpdated', {
      sessionId,
      block: null,
    })

    ctx.emitter.emit('invalidate', {
      typename: 'Session',
      id: session.id,
    })

    if (!isScheduled && scheduledJobs[sessionBlockId]) {
      await scheduledJobs[sessionBlockId].cancel()
      delete scheduledJobs[sessionBlockId]
    }

    unlinkCachedBlockResults({
      ctx,
      sessionId,
      sessionBlockId,
      activeInstanceIds,
    })

    return updatedSession
  } catch (error: any) {
    await sendTeamsNotifications(
      'graphql/deactivateSessionBlock',
      `ERROR - failed to deactivate session block ${sessionBlockId} in session ${
        session.id
      } with active block ${session.activeBlockId}: ${error?.message || error}`
    )

    throw error
  }
}

export async function getRunningSession({ id }: { id: string }, ctx: Context) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: { id },
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
      course: true,
    },
  })

  // extract solution from instances in active block
  let sessionWithoutSolutions: any

  if (session && session.activeBlock) {
    sessionWithoutSolutions = {
      ...session,
      activeBlock: {
        ...session.activeBlock,
        instances: session.activeBlock.instances.map((instance) => {
          const questionData = instance.questionData
          if (
            !questionData ||
            typeof questionData !== 'object' ||
            Array.isArray(questionData)
          )
            return instance

          switch (questionData.type) {
            case ElementType.SC:
            case ElementType.MC:
              return {
                ...instance,
                questionData: {
                  ...questionData,
                  options: {
                    ...questionData.options,
                    choices: questionData.options.choices.map((choice) => ({
                      ...pick(choice, ['ix', 'value']),
                    })),
                  },
                },
              }

            case ElementType.NUMERICAL:
            case ElementType.FREE_TEXT:
              return {
                ...instance,
                questionData,
              }

            default:
              return instance
          }
        }),
      },
    }
  }

  if (session?.status === SessionStatus.RUNNING) {
    return sessionWithoutSolutions || session
  }

  return null
}

export async function getLeaderboard(
  { sessionId }: { sessionId: string },
  ctx: Context
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      leaderboard: {
        orderBy: {
          score: 'desc',
        },
        include: {
          participant: true,
          sessionParticipation: true,
        },
      },
      blocks: true,
    },
  })

  if (!session) return null

  const participant = ctx.user?.sub
    ? await ctx.prisma.participant.findUnique({
        where: {
          id: ctx.user.sub,
        },
      })
    : null

  const participantProfilePublic =
    (participant?.isProfilePublic ?? false) ||
    ctx.user?.role === 'USER' ||
    ctx.user?.role === 'ADMIN'

  // find the order attribute of the last exectued block
  const executedBlockOrders = session?.blocks
    .filter(
      (sessionBlock) => sessionBlock.status === SessionBlockStatus.EXECUTED
    )
    .map((sessionBlock) => Number(sessionBlock.order))

  const lastBlockOrder = executedBlockOrders
    ? Math.max(...executedBlockOrders)
    : 0

  const preparedEntries = session?.leaderboard?.flatMap((entry) => {
    if (!entry.sessionParticipation?.isActive) return []

    // TODO: remove the lastBlockOrder attribute from the nexus type LeaderboardEntry once the leaderboard comparison is moved to the server
    return {
      id: entry.id,
      participantId: entry.participant.id,
      username:
        entry.participant.isProfilePublic && participantProfilePublic
          ? entry.participant.username
          : 'Anonymous',
      avatar:
        entry.participant.isProfilePublic && participantProfilePublic
          ? entry.participant.avatar
          : null,
      score: entry.score,
      // isSelf: entry.participantId === ctx.user.sub,
      lastBlockOrder,
    }
  })

  const sortedEntries = sortBy(
    preparedEntries,
    [prop('score'), 'desc'],
    [prop('username'), 'asc']
  )

  const filteredEntries = sortedEntries.flatMap((entry, ix) => {
    return { ...entry, rank: ix + 1 }
  })

  return filteredEntries
}

// modify session parameters isAudienceInteractionEnabled, isModerationEnabled, isGamificationEnabled
interface SessionSettingArgs {
  id: string
  isLiveQAEnabled?: boolean | null
  isConfusionFeedbackEnabled?: boolean | null
  isModerationEnabled?: boolean | null
  isGamificationEnabled?: boolean | null
}

export async function changeSessionSettings(
  {
    id,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    isGamificationEnabled,
  }: SessionSettingArgs,
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveSession.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      isLiveQAEnabled: isLiveQAEnabled ?? undefined,
      isConfusionFeedbackEnabled: isConfusionFeedbackEnabled ?? undefined,
      isModerationEnabled: isModerationEnabled ?? undefined,
      isGamificationEnabled: isGamificationEnabled ?? undefined,
    },
  })
  return session
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

export async function getRunningSessionsCourse(
  {
    courseId,
  }: {
    courseId: string
  },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      sessions: {
        where: {
          status: SessionStatus.RUNNING,
        },
        include: {
          course: true,
        },
      },
    },
  })

  return course?.sessions ?? []
}

export async function getUserRunningSessions(ctx: ContextWithUser) {
  const userWithSessions = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      sessions: {
        where: {
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

export async function getUserSessions(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      sessions: {
        where: {
          isDeleted: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          course: true,
          blocks: {
            orderBy: {
              order: 'asc',
            },
            include: {
              instances: {
                orderBy: {
                  order: 'asc',
                },
              },
              _count: {
                select: { instances: true },
              },
            },
          },
          _count: {
            select: { blocks: true },
          },
        },
      },
    },
  })

  return user?.sessions.map((session) => ({
    ...session,
    blocks: session.blocks.map((block) => ({
      ...block,
      numOfParticipants: block.instances[0]?.participants,
    })),
    course: session.course ? session.course : undefined,
    numOfBlocks: session._count?.blocks,
    numOfQuestions: session.blocks.reduce(
      (acc, block) => acc + block._count?.instances,
      0
    ),
  }))
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

// compute the average of all feedbacks that were given within the last 10 minutes
const aggregateFeedbacks = (feedbacks: ConfusionTimestep[]) => {
  // TODO: for improved efficiency, try to use descending feedback ordering
  // and break early once first is not within the filtering requirements anymore
  const recentFeedbacks = feedbacks.filter(
    (feedback) =>
      dayjs().diff(dayjs(feedback.createdAt)) > 0 &&
      dayjs().diff(dayjs(feedback.createdAt)) < 1000 * 60 * 10
  )

  if (recentFeedbacks.length > 0) {
    const summedFeedbacks = recentFeedbacks.reduce(
      (previousValue, feedback) => {
        return {
          speed: previousValue.speed + feedback.speed,
          difficulty: previousValue.difficulty + feedback.difficulty,
          numberOfParticipants: previousValue.numberOfParticipants + 1,
        }
      },
      { speed: 0, difficulty: 0, numberOfParticipants: 0 }
    )
    return {
      ...summedFeedbacks,
      speed: summedFeedbacks.speed / summedFeedbacks.numberOfParticipants,
      difficulty:
        summedFeedbacks.difficulty / summedFeedbacks.numberOfParticipants,
    }
  }
  return { speed: 0, difficulty: 0, numberOfParticipants: 0 }
}

export async function getCockpitSession(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      activeBlock: {
        include: {
          instances: true,
        },
      },
      blocks: {
        orderBy: {
          order: 'asc',
        },
        include: {
          instances: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      course: true,
      confusionFeedbacks: true,
      feedbacks: {
        include: {
          responses: true,
        },
      },
    },
  })

  if (!session || session?.status !== SessionStatus.RUNNING) {
    return null
  }

  // number of participants per block
  const blockParticipants = session.blocks.reduce<Record<number, number>>(
    (acc, block) => {
      acc[block.id] = block.instances.reduce(
        (instanceAcc, instance) => min(instanceAcc, instance.participants),
        100000
      )
      return acc
    },
    {}
  )

  if (session.activeBlock && session.activeBlock.id) {
    const activeInstanceIds = session.activeBlock?.instances.map(
      (instance) => instance.id
    )
    const redisMulti = ctx.redisExec.pipeline()
    activeInstanceIds?.forEach((instanceId) => {
      redisMulti.hgetall(`s:${id}:i:${instanceId}:results`)
    })
    const cacheContent = (await redisMulti.exec()) as
      | [
          Error | null,
          {
            // TODO: types for the result
          },
        ][]
      | null
    const activeBlockParticipants = cacheContent
      ?.map(([_, result]) => parseInt(result?.participants))
      .reduce((acc, val) => min(acc, val), 100000)
    blockParticipants[session.activeBlock.id] =
      activeBlockParticipants ?? blockParticipants[session.activeBlock.id] ?? 0
  }

  // recude session to only contain what is required for the lecturer cockpit
  const reducedSession = {
    ...session,
    activeBlock: session.activeBlock,
    blocks: session.blocks.map((block) => {
      return {
        ...block,
        numOfParticipants: blockParticipants[block.id],
        instances: block.instances.map((instance) => {
          const questionData = instance.questionData
          if (
            !questionData ||
            typeof questionData !== 'object' ||
            Array.isArray(questionData)
          ) {
            return instance
          } else {
            return {
              ...instance,
              questionData: {
                ...questionData,
                options: null,
              },
            }
          }
        }),
      }
    }),
    confusionSummary: aggregateFeedbacks(session.confusionFeedbacks),
  }

  return reducedSession
}

export async function getControlSession(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      activeBlock: true,
      course: true,
      blocks: {
        include: {
          instances: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!session || session?.status !== SessionStatus.RUNNING) {
    return null
  }

  return session
}

export async function getPinnedFeedbacks(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      confusionFeedbacks: true,
      feedbacks: {
        where: {
          isPinned: true,
        },
      },
    },
  })

  if (session?.status !== SessionStatus.RUNNING || !session) {
    return null
  }

  // recude session to only contain what is required for the lecturer cockpit
  const reducedSession = {
    ...session,
    confusionSummary: aggregateFeedbacks(session.confusionFeedbacks),
  }

  return reducedSession
}

function checkCorrectnessFreeText(instance: AllQuestionInstanceTypeData) {
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

function computeStatistics(instance: AllQuestionInstanceTypeData) {
  // Compute the statistics for numerical questions
  instance.elementType = instance.questionData.type
  if (
    instance.elementType === 'NUMERICAL' &&
    instance.questionData.type === 'NUMERICAL'
  ) {
    const results = []
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
      let correct = undefined

      if (
        instance.questionData.options.solutionRanges &&
        instance.questionData.options.solutionRanges.length > 0 &&
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
        instance.questionData.options.solutionRanges.length > 0 &&
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

function completeQuestionData(instances: AllQuestionInstanceTypeData[]) {
  return instances.map((instance) =>
    computeStatistics(checkCorrectnessFreeText(instance))
  )
}

export async function getSessionHMAC(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: {
      id,
    },
  })

  if (!session) return null

  const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
  hmacEncoder.update(session.namespace + session.id)
  const sessionHmac = hmacEncoder.digest('hex')

  return sessionHmac
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
      cachedResults,
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

export async function cancelSession(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveSession.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      activeBlock: true,
      blocks: {
        include: {
          instances: true,
          activeInSession: true,
        },
      },
      leaderboard: true,
    },
  })

  if (!session) return null

  try {
    if (session.status !== SessionStatus.RUNNING) {
      throw new Error('Session is not running')
    }

    const instances = session.blocks.flatMap((block) => block.instances)

    const [updatedSession] = await ctx.prisma.$transaction([
      ctx.prisma.liveSession.update({
        where: { id },
        data: {
          status: SessionStatus.PREPARED,
          startedAt: null,
          pinCode: null,
          activeBlock: {
            disconnect: true,
          },
          leaderboard: {
            deleteMany: {},
          },
          feedbacks: {
            deleteMany: {},
          },
          confusionFeedbacks: {
            deleteMany: {},
          },
          blocks: {
            updateMany: {
              where: {
                status: {
                  in: [SessionBlockStatus.EXECUTED, SessionBlockStatus.ACTIVE],
                },
              },
              data: {
                status: SessionBlockStatus.SCHEDULED,
                expiresAt: null,
                execution: {
                  increment: 1,
                },
              },
            },
          },
        },
        include: {
          activeBlock: true,
          blocks: {
            include: {
              instances: true,
              activeInSession: true,
            },
          },
        },
      }),

      ...instances.map((instance) =>
        ctx.prisma.questionInstance.update({
          where: {
            id: instance.id,
          },
          data: {
            participants: 0,
            results: prepareInitialInstanceResults(instance.questionData),
          },
        })
      ),
    ])

    const keys = await ctx.redisExec.keys(`s:${id}:*`)
    const pipe = ctx.redisExec.multi()
    for (const key of keys) {
      pipe.unlink(key)
    }
    await pipe.exec()

    await sendTeamsNotifications(
      'graphql/cancelSession',
      `CANCEL Session ${session.name} with id ${session.id}.`
    )

    return updatedSession as ISession
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/cancelSession',
      `ERROR - failed to cancel session ${session.name} with id ${session.id}: ${error}`
    )
    throw error
  }
}

export async function deleteLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch live quiz to check its status
  const liveQuiz = await ctx.prisma.liveSession.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    select: {
      status: true,
    },
  })

  if (!liveQuiz) return null

  if (liveQuiz.status === SessionStatus.RUNNING) {
    // running live quizzes cannot be deleted
    return null
  } else if (liveQuiz.status === SessionStatus.COMPLETED) {
    const deletedLiveQuiz = await ctx.prisma.liveSession.update({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: SessionStatus.COMPLETED,
      },
      data: {
        isDeleted: true,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'Session',
      id,
    })

    return deletedLiveQuiz
  } else {
    const deletedLiveQuiz = await ctx.prisma.liveSession.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: {
          in: [SessionStatus.PREPARED, SessionStatus.SCHEDULED],
        },
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'Session',
      id,
    })

    return deletedLiveQuiz
  }
}

export async function getLiveQuizSummary(
  { quizId }: { quizId: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveSession.findUnique({
    where: {
      id: quizId,
      ownerId: ctx.user.sub,
    },
    include: {
      _count: {
        select: {
          feedbacks: true,
          confusionFeedbacks: true,
          leaderboard: true,
        },
      },
      blocks: {
        include: {
          instances: true,
        },
      },
    },
  })

  if (!liveQuiz) return null

  const storedResponses = liveQuiz.blocks.reduce((acc_b, block) => {
    acc_b += block.instances.reduce((acc_i, instance) => {
      acc_i += instance.participants
      return acc_i
    }, 0)
    return acc_b
  }, 0)

  return {
    numOfResponses: storedResponses,
    numOfFeedbacks: liveQuiz._count.feedbacks,
    numOfConfusionFeedbacks: liveQuiz._count.confusionFeedbacks,
    numOfLeaderboardEntries: liveQuiz._count.leaderboard,
  }
}

export async function changeLiveQuizName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  const updatedSession = await ctx.prisma.liveSession.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      name,
      displayName,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id,
  })

  return updatedSession
}
