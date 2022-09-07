import {
  Question,
  QuestionType,
  SessionBlockStatus,
  SessionStatus,
} from '@klicker-uzh/prisma'
import { ContextWithUser } from '@lib/context'

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

interface BlockArgs {
  questionIds: number[]
  randomSelection?: number
  timeLimit?: number
}

interface CreateSessionArgs {
  name: string
  displayName?: string | null
  blocks: BlockArgs[]
}

export async function createSession(
  { name, displayName, blocks }: CreateSessionArgs,
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
                connect: {
                  id: questionId,
                },
              },
              owner: {
                connect: {
                  id: ctx.user.sub,
                },
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
        connect: {
          id: ctx.user.sub,
        },
      },
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
    where: {
      id: sessionId,
    },
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
    where: {
      id: sessionId,
    },
    data: {
      activeBlock: {
        connect: {
          id: sessionBlockId,
        },
      },
      blocks: {
        update: {
          where: {
            id: sessionBlockId,
          },
          data: {
            status: SessionBlockStatus.ACTIVE,
          },
        },
      },
    },
    include: {
      activeBlock: {
        include: {
          instances: true,
        },
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
    include: { activeBlock: { include: { instances: true } } },
  })

  if (!session || session.ownerId !== ctx.user.sub || !session.activeBlock)
    return null

  // if the block is not the active one, return early
  if (session.activeBlockId !== sessionBlockId) return session

  const activeInstanceIds = session.activeBlock.instances.map(
    (instance) => instance.id
  )

  const redisMulti = ctx.redisExec.multi()
  activeInstanceIds.forEach((instanceId) => {
    redisMulti.hgetall(`s${sessionId}:i:${instanceId}:results`)
  })
  const allInstanceResults = await redisMulti.exec()

  console.warn(allInstanceResults)

  return session

  // TODO: what if session gamified and results are reset? are points taken away?
  const updatedBlock = await ctx.prisma.session.update({
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
            id: sessionBlockId,
          },
          data: {
            status: SessionBlockStatus.EXECUTED,
            instances: {
              update: [],
            },
          },
        },
      },
    },
  })

  return session
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
