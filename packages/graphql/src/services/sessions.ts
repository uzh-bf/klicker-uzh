import {
  Attachment,
  ConfusionTimestep,
  Question,
  QuestionInstance,
  QuestionType,
  SessionBlockStatus,
  SessionStatus,
} from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import * as R from 'ramda'
import { ascend, dissoc, mapObjIndexed, pick, prop, sortWith } from 'ramda'
import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'
// TODO: rework scheduling for serverless
import { GraphQLError } from 'graphql'
import { max, mean, median, min, quantileSeq, std } from 'mathjs'
import schedule from 'node-schedule'

const scheduledJobs: Record<string, any> = {}

function processQuestionData(question: Question): AllQuestionTypeData {
  switch (question.type) {
    case QuestionType.SC:
    case QuestionType.MC:
    case QuestionType.KPRIM: {
      return {
        ...question,
        attachments: null,
        options: question.options!.valueOf(),
      } as unknown as ChoicesQuestionData
    }

    case QuestionType.NUMERICAL: {
      return {
        ...question,
        attachments: null,
      } as NumericalQuestionData
    }

    case QuestionType.FREE_TEXT: {
      return {
        ...question,
        attachments: null,
      } as FreeTextQuestionData
    }
  }
}

function prepareInitialInstanceResults(questionData: AllQuestionTypeData) {
  switch (questionData.type) {
    case QuestionType.SC:
    case QuestionType.MC:
    case QuestionType.KPRIM: {
      const choices = questionData.options.choices.reduce(
        (acc, _, ix) => ({ ...acc, [ix]: 0 }),
        {}
      )
      return { choices } as ChoicesQuestionResults
    }

    case QuestionType.NUMERICAL: {
      return {} as NumericalQuestionResults
    }

    case QuestionType.FREE_TEXT: {
      return {} as FreeTextQuestionResults
    }
  }
}

interface BlockArgs {
  questionIds: number[]
  randomSelection?: number
  timeLimit?: number
}

interface CreateSessionArgs {
  name: string
  displayName?: string | null
  blocks: BlockArgs[]
  courseId?: string
  isGamificationEnabled?: boolean
}

export async function createSession(
  {
    name,
    displayName,
    blocks,
    courseId,
    isGamificationEnabled,
  }: CreateSessionArgs,
  ctx: ContextWithUser
) {
  const allQuestionsIds = new Set(
    blocks.reduce<number[]>((acc, block) => [...acc, ...block.questionIds], [])
  )

  const questions = await ctx.prisma.question.findMany({
    where: {
      id: { in: Array.from(allQuestionsIds) },
      ownerId: ctx.user.sub,
    },
    include: {
      attachments: true,
    },
  })

  if (questions.length !== allQuestionsIds.size) {
    throw new GraphQLError('Not all questions could be found')
  }

  const questionMap = questions.reduce<
    Record<number, Question & { attachments: Attachment[] }>
  >((acc, question) => ({ ...acc, [question.id]: question }), {})

  const session = await ctx.prisma.session.create({
    data: {
      name,
      displayName: displayName ?? name,
      isGamificationEnabled: isGamificationEnabled ?? false,
      blocks: {
        create: blocks.map(
          ({ questionIds, randomSelection, timeLimit }, blockIx) => {
            const newInstances = questionIds.map((questionId, ix) => {
              const question = questionMap[questionId]
              const processedQuestionData = processQuestionData(question)
              const questionAttachmentInstances = question.attachments.map(
                pick(['type', 'href', 'name', 'description', 'originalName'])
              )
              return {
                order: ix,
                questionData: processedQuestionData,
                results: prepareInitialInstanceResults(processedQuestionData),
                question: {
                  connect: { id: questionId },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
                attachments: {
                  create: questionAttachmentInstances,
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

interface StartSessionArgs {
  id: string
}

export async function startSession(
  { id }: StartSessionArgs,
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.findFirst({
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
        const results = await ctx.redisExec
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

      // generate a unique pin code
      const pinCode = 100000 + Math.floor(Math.random() * 900000)

      // TODO: if the session is paused, reinitialize and restart

      return ctx.prisma.session.update({
        where: {
          id,
        },
        data: {
          status: SessionStatus.RUNNING,
          startedAt: new Date(),
          pinCode,
        },
      })
    }
  }
}

interface EndSessionArgs {
  id: string
}

export async function endSession({ id }: EndSessionArgs, ctx: ContextWithUser) {
  const session = await ctx.prisma.session.findFirst({
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

  if (session.status === SessionStatus.COMPLETED) {
    return session
  }
  if (
    session.status === SessionStatus.PREPARED ||
    session.status === SessionStatus.SCHEDULED
  ) {
    return null
  }

  // if the session is part of a course, update the course leaderboard with the accumulated points
  if (session.courseId) {
    const sessionLB = await ctx.redisExec.hgetall(`s:${id}:lb`)

    if (sessionLB) {
      const result = await ctx.prisma.$transaction(
        Object.entries(sessionLB).map(([participantId, score]) =>
          ctx.prisma.leaderboardEntry.upsert({
            where: {
              type_participantId_courseId: {
                type: 'COURSE',
                courseId: session.courseId!,
                participantId,
              },
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
                  id: participantId,
                },
              },
              participation: {
                connect: {
                  courseId_participantId: {
                    courseId: session.courseId!,
                    participantId,
                  },
                },
              },
              score: Number(score),
            },
            update: {
              score: {
                increment: Number(score),
              },
            },
          })
        )
      )
    }
  }

  ctx.redisExec.unlink(`s:${id}:meta`)
  ctx.redisExec.unlink(`s:${id}:lb`)

  return ctx.prisma.session.update({
    where: {
      id,
    },
    data: {
      status: SessionStatus.COMPLETED,
      finishedAt: new Date(),
    },
  })
}

interface ActivateSessionBlockArgs {
  sessionId: string
  sessionBlockId: number
}

export async function activateSessionBlock(
  { sessionId, sessionBlockId }: ActivateSessionBlockArgs,
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.findUnique({
    where: { id: sessionId },
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
  const updatedSession = await ctx.prisma.session.update({
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
        include: { instances: true },
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
      updatedSession.activeBlock.expiresAt,
      async () => {
        await deactivateSessionBlock(
          {
            sessionId,
            sessionBlockId,
          },
          ctx,
          true
        )
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
    const questionData = instance.questionData!.valueOf() as AllQuestionTypeData

    const commonInfo = {
      namespace: session.namespace,
      startedAt: Number(new Date()),
      sessionBlockId,
    }

    switch (questionData.type) {
      case QuestionType.SC:
      case QuestionType.MC:
      case QuestionType.KPRIM: {
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:info`, {
          ...commonInfo,
          type: questionData.type,
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
          ...(instance.results!.valueOf() as ChoicesQuestionResults).choices,
        })
        break
      }

      case QuestionType.NUMERICAL: {
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:info`, {
          ...commonInfo,
          type: questionData.type,
          solutions: JSON.stringify(questionData.options.solutionRanges),
        })
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:results`, {
          participants: 0,
        })
        break
      }

      case QuestionType.FREE_TEXT: {
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:info`, {
          ...commonInfo,
          type: questionData.type,
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

async function getCachedBlockResults({
  ctx,
  sessionId,
  sessionBlockId,
  activeInstanceIds,
}) {
  const redisMulti = ctx.redisExec.multi()
  redisMulti.hgetall(`s:${sessionId}:lb`)
  redisMulti.hgetall(`s:${sessionId}:b:${sessionBlockId}:lb`)
  activeInstanceIds.forEach((instanceId) => {
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:responseHashes`)
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:responses`)
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:results`)
  })
  return await redisMulti.exec()
}

async function unlinkCachedBlockResults({
  ctx,
  sessionId,
  sessionBlockId,
  activeInstanceIds,
}) {
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

async function processCachedData({ cachedResults, activeBlock }) {
  const mappedResults: any[] = cachedResults.map(([_, result]) => result)

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
  > = mappedResults.slice(2).reduce((acc: any, cacheObj: any, ix) => {
    const ixMod = ix % 3
    const instance: QuestionInstance =
      activeBlock!.instances[Math.floor((ix - ixMod) / 3)]
    switch (ixMod) {
      // results
      case 2: {
        const results = mapObjIndexed((count, responseHash) => {
          return {
            count: +count,
            value:
              acc[instance.id]['responseHashes'][responseHash] ?? responseHash,
          }
        }, dissoc('participants', cacheObj))

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
  const session = await ctx.prisma.session.findUnique({
    where: {
      id: sessionId,
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

  const { instanceResults, sessionLeaderboard, blockLeaderboard } =
    await processCachedData({
      cachedResults,
      activeBlock: session.activeBlock,
    })

  // TODO: what if session gamified and results are reset? are points taken away?
  const updatedSession = await ctx.prisma.session.update({
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
              update: Object.entries(instanceResults).map(([id, results]) => ({
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
              })),
            },
            // leaderboard: {
            //   create: Object.entries(blockLeaderboard).map(([id, score]) => ({
            //     score: Number(score),
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
            upsert: Object.entries(sessionLeaderboard).map(([id, score]) => ({
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
                score: Number(score),
                sessionParticipation: {
                  connect: {
                    courseId_participantId: {
                      courseId: session.courseId as string,
                      participantId: id,
                    },
                  },
                },
              },
              update: {
                score: Number(score),
              },
            })),
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

  // const leaderboardUpdates = Object.entries(sessionLeaderboard).map(
  //   ([id, score]) => {
  //     out
  //   }
  // )

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
}

export async function getRunningSession(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.findUnique({
    where: { id },
    include: {
      activeBlock: {
        include: {
          instances: {
            orderBy: {
              order: 'asc',
            },
            include: {
              attachments: true,
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
          const questionData =
            instance.questionData?.valueOf() as AllQuestionTypeData
          if (
            !questionData ||
            typeof questionData !== 'object' ||
            Array.isArray(questionData)
          )
            return instance

          switch (questionData.type) {
            case QuestionType.SC:
            case QuestionType.MC:
              return {
                ...instance,
                questionData: {
                  ...questionData,
                  options: {
                    ...questionData.options,
                    choices: questionData.options.choices.map(
                      pick(['ix', 'value'])
                    ),
                  },
                },
              }

            case QuestionType.NUMERICAL:
            case QuestionType.FREE_TEXT:
              return {
                ...instance,
                questionData: {
                  ...questionData,
                  options: {
                    restrictions: questionData.options.restrictions,
                  },
                },
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

interface GetLeaderboardArgs {
  sessionId: string
}

export async function getLeaderboard(
  { sessionId }: GetLeaderboardArgs,
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.findUnique({
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
      username: entry.participant.username,
      avatar: entry.participant.avatar,
      score: entry.score,
      // isSelf: entry.participantId === ctx.user.sub,
      lastBlockOrder,
    }
  })

  const sortByScoreAndUsername = R.curry(R.sortWith)([
    R.descend(R.prop('score')),
    R.ascend(R.prop('username')),
  ])

  const sortedEntries = sortByScoreAndUsername(preparedEntries)

  const filteredEntries = sortedEntries.flatMap((entry, ix) => {
    return { ...entry, rank: ix + 1 }
  })

  return filteredEntries
}

// modify session parameters isAudienceInteractionEnabled, isModerationEnabled, isGamificationEnabled
interface SessionSettingArgs {
  id: string
  isAudienceInteractionActive?: boolean | null
  isModerationEnabled?: boolean | null
  isGamificationEnabled?: boolean | null
}

export async function changeSessionSettings(
  {
    id,
    isAudienceInteractionActive,
    isModerationEnabled,
    isGamificationEnabled,
  }: SessionSettingArgs,
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.update({
    where: { id },
    data: {
      isAudienceInteractionActive: isAudienceInteractionActive ?? undefined,
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
  ctx: ContextWithOptionalUser
) {
  const userWithSessions = await ctx.prisma.user.findUnique({
    where: {
      shortname,
    },
    include: {
      sessions: {
        where: {
          accessMode: 'PUBLIC',
          status: 'RUNNING',
        },
      },
    },
  })

  if (!userWithSessions?.sessions) return []

  return userWithSessions.sessions
}

export async function getUserSessions(
  { userId }: { userId: string },
  ctx: ContextWithOptionalUser
) {
  console.log('starting getUserSession')
  const userSessions = await ctx.prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      sessions: {
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
                select: {
                  id: true,
                  questionData: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return userSessions?.sessions.map((session) => {
    return {
      ...pick(
        ['id', 'name', 'displayName', 'accessMode', 'status', 'createdAt'],
        session
      ),
      blocks: session.blocks.map(pick(['id', 'instances'])),
      course: session.course
        ? pick(['id', 'name', 'displayName'], session.course)
        : undefined,
    }
  })
}

// compute the average of all feedbacks that were given within the last 10 minutes
const aggregateFeedbacks = (feedbacks: ConfusionTimestep[]) => {
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
  const session = await ctx.prisma.session.findUnique({
    where: { id },
    include: {
      activeBlock: true,
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

  // recude session to only contain what is required for the lecturer cockpit
  const reducedSession = {
    ...session,
    activeBlock: session.activeBlock
      ? {
          id: session.activeBlock.id,
        }
      : null,
    blocks: session.blocks.map((block) => {
      return {
        ...block,
        instances: block.instances.map((instance) => {
          const questionData =
            instance.questionData?.valueOf() as AllQuestionTypeData
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
    confusionFeedbacks: [aggregateFeedbacks(session.confusionFeedbacks)],
  }

  return reducedSession
}

export async function getPinnedFeedbacks(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.findUnique({
    where: { id },
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
    confusionFeedbacks: [aggregateFeedbacks(session.confusionFeedbacks)],
  }

  return reducedSession
}

function checkCorrectnessFreeText(instance) {
  // Adds "correct" attribute (true/false) to results in FREE_TEXT questions if they match any given solution )(exact match)
  if (instance.questionData.type === 'FREE_TEXT') {
    for (const id in instance.results) {
      if (
        instance.questionData.options.solutions &&
        instance.questionData.options.solutions.includes(
          instance.results[id].value
        )
      ) {
        instance.results[id].correct = true
      } else {
        instance.results[id].correct = false
      }
    }
  }
  return instance
}

function computeStatistics(instance) {
  // Compute the statistics for numerical questions
  if (instance.questionData.type === 'NUMERICAL' && !instance.statistics) {
    const results = []
    for (const key in instance.results) {
      results.push(instance.results[key])
    }
    const valueArray = results.reduce((acc, { count, value }) => {
      const elements = Array(count).fill(parseFloat(value))
      return acc.concat(elements)
    }, [])
    const hasResults = valueArray.length > 0

    instance.statistics = {
      max: hasResults && max(valueArray),
      mean: hasResults && mean(valueArray),
      median: hasResults && median(valueArray),
      min: hasResults && min(valueArray),
      q1: hasResults && quantileSeq(valueArray, 0.25),
      q3: hasResults && quantileSeq(valueArray, 0.75),
      sd: hasResults && std(valueArray),
    }
  }
  return instance
}

function completeQuestionData(instances) {
  return instances.map((instance) =>
    computeStatistics(checkCorrectnessFreeText(instance))
  )
}

export async function getSessionEvaluation(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.findUnique({
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
      confusionFeedbacks: true,
    },
  })

  if (!session) return null

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

    const { instanceResults } = await processCachedData({
      cachedResults,
      activeBlock: session.activeBlock,
    })

    activeInstanceResults = Object.entries(instanceResults).map(
      ([id, results]) => {
        const instance = session.activeBlock!.instances.find(
          (instance) => instance.id === Number(id)
        )

        return {
          id: `${instance?.id}-eval`,
          blockIx: session.activeBlock?.order,
          instanceIx: instance?.order,
          status: session.activeBlock!.status,
          questionData: instance?.questionData,
          participants: results.participants,
          results: results.results,
        }
      }
    )

    activeInstanceResults = sortWith(
      [ascend(prop('blockIx')), ascend(prop('instanceIx'))],
      activeInstanceResults
    )
  }

  let executedInstanceResults = session.blocks.flatMap((block) =>
    block.instances.map((instance) => ({
      id: `${instance.id}-eval`,
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
        status: session.activeBlock?.status,
      })),
    }
  }

  const temp = {
    id: `${id}-eval`,
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

  return {
    id: `${id}-eval`,
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
