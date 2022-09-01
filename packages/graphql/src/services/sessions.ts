import { SessionStatus } from '@klicker-uzh/prisma'
import { ContextWithUser } from '@lib/context'
import { getRedis } from '../lib/redis'

export async function startSession(
  { id }: { id: string },
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

export async function getSession({ id }: { id: string }, ctx: ContextWithUser) {
  const session = await ctx.prisma.session.findUnique({
    where: { id },
    include: {
      blocks: true,
    },
  })

  return session
}
