import type { PubSub } from 'graphql-yoga'
import { PrismaClient, UserRole } from '@klicker-uzh/prisma'
import { Request, Response } from 'express'
import type Redis from 'ioredis'
import type { EventEmitter } from 'node:events'

interface BaseContext {
  req: Request & { locals: { user?: any } }
  res: Response
}

export interface Context extends BaseContext {
  prisma: PrismaClient
  redisExec: Redis
  pubSub: PubSub<any>
  emitter: EventEmitter
}

export interface ContextWithOptionalUser extends Context {
  user?: {
    sub: string
    role: UserRole
  }
}

export interface ContextWithUser extends Context {
  user: {
    sub: string
    role: UserRole
  }
}

function enhanceContext(args = {}) {
  return ({ req }: BaseContext) => ({
    ...args,
    user: req?.locals?.user,
  })
}

export default enhanceContext
