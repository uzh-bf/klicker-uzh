import { SessionBlockStatus, SessionStatus } from '@klicker-uzh/prisma'
import { ContextWithUser } from '@lib/context'
import { getRedis } from '../lib/redis'

interface BlockArgs {
  questionIds: string[]
  randomSelection?: number
  timeLimit?: number
}
interface CreateSessionArgs {
  name: string
  displayName?: string
  blocks: BlockArgs[]
}

export async function createSession(
  { name, displayName, blocks }: CreateSessionArgs,
  ctx: ContextWithUser
) {
  const allQuestionsIds = blocks.reduce<string[]>(
    (acc, block) => [...acc, ...block.questionIds],
    []
  )
  const questions = await ctx.prisma.question.findMany({
    where: {
      id: {
        in: allQuestionsIds,
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      content: true,
      contentPlain: true,
      options: true,
      attachments: true,
    },
  })

  const newSession = await ctx.prisma.session.create({
    data: {
      status: SessionStatus.SCHEDULED,
      name,
      displayName: displayName ?? name,
      blocks: {
        create: blocks.map(({ questionIds, randomSelection, timeLimit }) => ({
          randomSelection,
          timeLimit,
          instances: questionIds.map((questionId) => {
            const questionData = questions.find((q) => q.id === questionId)
            return {
              questionData,
              results: {},
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
          }),
        })),
      },
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
  })

  return newSession
}

interface StartSessionArgs {
  id: string
}

export async function startSession(
  { id }: StartSessionArgs,
  ctx: ContextWithUser
) {
  const redis = getRedis()

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

  try {
    const results = await redis
      .multi()
      .hmset(`session:${session.id}:meta`, {
        id: session.id,
        namespace: session.namespace,
        execution: session.execution,
      })
      .hset(`session:${session.id}:lb`, { participants: 0 })
      .exec()
    console.log(results)
  } catch (e) {
    console.error(e)
  }

  // if the session was alreadt completed, exit early
  if (session.status === SessionStatus.COMPLETED) {
    return null
  }

  // if the session is already running, return it
  if (session.status === SessionStatus.RUNNING) {
    return session
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
  if (session.activeBlock === newBlockIndex) return session

  // set the new block to active
  const updatedSession = await ctx.prisma.session.update({
    where: {
      id: sessionId,
    },
    data: {
      activeBlock: newBlockIndex,
      blocks: {
        updateMany: [
          session.activeBlock > -1
            ? {
                where: {
                  id: session.blocks[session.activeBlock].id,
                },
                data: {
                  status: SessionBlockStatus.EXECUTED,
                },
              }
            : undefined,
          {
            where: {
              id: sessionBlockId,
            },
            data: {
              status: SessionBlockStatus.ACTIVE,
            },
          },
        ].filter(Boolean) as any[],
      },
    },
    include: { blocks: true },
  })

  // get the details and instances of the newly activated session block
  const newActiveBlock = await ctx.prisma.sessionBlock.findUnique({
    where: {
      id: sessionBlockId,
    },
    include: {
      instances: true,
    },
  })

  newActiveBlock!.instances.map((instance) => {
    console.warn(instance)
  })
  // // initialize the cache for the new active block
  // const redisMulti = ctx.redisExec.multi().

  // TODO: if it has been executed already, rehydrate the cache
  // TODO: persist the data of the previously active block to db (async)

  return updatedSession
}

export async function getSession({ id }: { id: string }, ctx: ContextWithUser) {
  const session = await ctx.prisma.session.findUnique({
    where: { id },
    include: {
      blocks: true,
    },
  })

  return session
}
