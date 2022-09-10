import {
  Question,
  QuestionInstance,
  QuestionType,
  SessionBlockStatus,
  SessionStatus,
} from '@klicker-uzh/prisma'
import { dissoc, mapObjIndexed } from 'ramda'
import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'

function processQuestionData(question: Question): AllQuestionTypeData {
  switch (question.type) {
    case QuestionType.SC:
    case QuestionType.MC: {
      return {
        ...question,
        options: question.options!.valueOf(),
      } as ChoicesQuestionData
    }

    case QuestionType.NUMERICAL: {
      return {
        ...question,
      } as NumericalQuestionData
    }

    case QuestionType.FREE_TEXT: {
      return {
        ...question,
      } as FreeTextQuestionData
    }
  }
}

function prepareInitialInstanceResults(questionData: AllQuestionTypeData) {
  switch (questionData.type) {
    case QuestionType.SC:
    case QuestionType.MC: {
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

interface CreateCourseArgs {
  name: string
  displayName?: string
  color?: string
}

export async function createCourse(
  { name, displayName, color }: CreateCourseArgs,
  ctx: ContextWithUser
) {
  return ctx.prisma.course.create({
    data: {
      name,
      displayName: displayName ?? name,
      color,
      owner: {
        connect: { id: ctx.user.sub },
      },
    },
  })
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
}

export async function createSession(
  { name, displayName, blocks, courseId }: CreateSessionArgs,
  ctx: ContextWithUser
) {
  const allQuestionsIds = blocks.reduce<number[]>(
    (acc, block) => [...acc, ...block.questionIds],
    []
  )

  const questions = await ctx.prisma.question.findMany({
    where: {
      id: {
        in: allQuestionsIds,
      },
    },
    include: {
      attachments: true,
    },
  })

  return ctx.prisma.session.create({
    data: {
      name,
      displayName: displayName ?? name,
      blocks: {
        create: blocks.map(({ questionIds, randomSelection, timeLimit }) => {
          const newInstances = questionIds.map((questionId) => {
            const questionData = questions.find(
              (q) => q.id === questionId
            ) as Question
            const processedQuestionData = processQuestionData(questionData)
            return {
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
            randomSelection,
            timeLimit,
            instances: {
              create: newInstances,
            },
          }
        }),
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
      blocks: true,
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
    include: { blocks: true },
  })

  if (!session || session.ownerId !== ctx.user.sub) return null

  const newBlockIndex = session.blocks.findIndex(
    (block) => block.id === sessionBlockId
  )

  // if the block is not from the current session, return early
  if (newBlockIndex === -1) return session

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
          },
        },
      },
    },
    include: {
      activeBlock: {
        include: { instances: true },
      },
      blocks: true,
    },
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
      case QuestionType.MC: {
        redisMulti.hmset(`s:${session.id}:i:${instance.id}:info`, {
          ...commonInfo,
          type: questionData.type,
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

export async function deactivateSessionBlock(
  { sessionId, sessionBlockId }: ActivateSessionBlockArgs,
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      blocks: true,
      activeBlock: {
        include: { instances: true },
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

  const redisMulti = ctx.redisExec.multi()
  redisMulti.hgetall(`s:${sessionId}:lb`)
  redisMulti.hgetall(`s:${sessionId}:b:${sessionBlockId}:lb`)
  activeInstanceIds.forEach((instanceId) => {
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:responseHashes`)
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:responses`)
    redisMulti.hgetall(`s:${sessionId}:i:${instanceId}:results`)
  })
  const cachedResults = await redisMulti.exec()

  if (!cachedResults) return session

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
      session.activeBlock!.instances[Math.floor((ix - ixMod) / 3)]
    switch (ixMod) {
      // results
      case 2: {
        const results = mapObjIndexed((count, responseHash) => {
          return {
            count,
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
                  responses: {
                    create: Object.entries(results.responses).map(
                      ([participantId, response]) => ({
                        response,
                        participant: {
                          connect: { id: participantId },
                        },
                        participation: {
                          connect: {
                            courseId_participantId: {
                              // TODO: this is not set if the session is not in a course (i.e., not gamified)
                              courseId: session.courseId as string,
                              participantId,
                            },
                          },
                        },
                      })
                    ),
                  },
                },
              })),
            },
            leaderboard: {
              create: Object.entries(blockLeaderboard).map(([id, score]) => ({
                score: Number(score),
                participant: {
                  connect: { id },
                },
                type: 'SESSION_BLOCK',
                // TODO: use the real username here, or remove it
                username: id,
              })),
            },
          },
        },
      },
      leaderboard: {
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
            // TODO: use the real username here, or remove it
            username: id,
          },
          update: {
            score: Number(score),
          },
        })),
      },
    },
    include: {
      blocks: true,
    },
  })

  // unlink everything regarding the block in redis
  const unlinkMulti = ctx.redisExec.pipeline()
  unlinkMulti.unlink(`s:${sessionId}:b:${sessionBlockId}:lb`)
  activeInstanceIds.forEach((instanceId) => {
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:info`)
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:responseHashes`)
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:responses`)
    unlinkMulti.unlink(`s:${sessionId}:i:${instanceId}:results`)
  })
  unlinkMulti.exec()

  return updatedSession
}

export async function getSession({ id }: { id: string }, ctx: ContextWithUser) {
  const session = await ctx.prisma.session.findUnique({
    where: { id },
    include: {
      activeBlock: {
        include: {
          instances: true,
        },
      },
    },
  })

  return session
}

interface GetLeaderboardArgs {
  sessionId: string
}

export async function getLeaderboard(
  { sessionId }: GetLeaderboardArgs,
  ctx: ContextWithUser
) {
  const top5 = await ctx.prisma.session
    .findUnique({
      where: {
        id: sessionId,
      },
    })
    .leaderboard({
      orderBy: {
        score: 'desc',
      },
      take: 5,
    })

  // TODO: extract self into separate query to allow for improved caching?
  // const self = await ctx.prisma.leaderboardEntry.findUnique({
  //   where: {
  //     type_participantId_sessionId: {
  //       type: 'SESSION',
  //       participantId: ctx.user.sub,
  //       sessionId,
  //     },
  //   },
  // })

  // if (!top5 || !self) return null
  if (!top5) return null

  // return [...top5, self]
  return top5
}

export async function getFeedbacks(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const feedbacks = await ctx.prisma.session
    .findUnique({
      where: { id },
    })
    .feedbacks({
      where: { isPublished: true },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })

  return feedbacks
}

export async function upvoteFeedback(
  { feedbackId, increment }: { feedbackId: number; increment: number },
  ctx: ContextWithOptionalUser
) {
  return ctx.prisma.feedback.update({
    where: {
      id: feedbackId,
    },
    data: {
      votes: { increment: increment },
    },
  })
}

export async function voteFeedbackResponse(
  {
    id,
    incrementUpvote,
    incrementDownvote,
  }: { id: number; incrementUpvote: number; incrementDownvote: number },
  ctx: ContextWithOptionalUser
) {
  return ctx.prisma.feedbackResponse.update({
    where: {
      id: id,
    },
    data: {
      positiveReactions: { increment: incrementUpvote },
      negativeReactions: { increment: incrementDownvote },
    },
  })
}

export async function createFeedback(
  {
    sessionId,
    content,
    isPublished,
  }: { sessionId: string; content: string; isPublished: boolean },
  ctx: ContextWithOptionalUser
) {
  if (ctx.user?.sub) {
    return ctx.prisma.feedback.create({
      data: {
        content,
        isPublished: isPublished,
        session: {
          connect: { id: sessionId },
        },
        participant: {
          connect: { id: ctx.user.sub },
        },
      },
    })
  } else {
    return ctx.prisma.feedback.create({
      data: {
        content,
        isPublished: isPublished,
        session: {
          connect: { id: sessionId },
        },
      },
    })
  }
}
