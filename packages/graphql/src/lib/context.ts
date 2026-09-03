import { Hatchet } from '@hatchet-dev/typescript-sdk'
import type { AppLogger } from '@klicker-uzh/logging/node'
import type { RequestContext } from '@klicker-uzh/logging/request'
import {
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { PreparedHatchetTasks } from '@klicker-uzh/types'
import type { Request, Response } from 'express'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'
import type { EventEmitter } from 'node:events'

interface BaseContext {
  req: Request & {
    locals: {
      user?: any
      requestContext: RequestContext
      log: AppLogger
    }
  }
  res: Response
}

export interface Context extends BaseContext {
  prisma: PrismaClient
  redisExec: Redis
  redisAssessmentExec: Redis
  pubSub: PubSub<any>
  emitter: EventEmitter
  user?: {
    sub: string
    role: UserRole
    scope: UserLoginScope
    catalystInstitutional: boolean
    catalystIndividual: boolean
    // affiliations?: string[]
  }
  // hatchet client to access / modify existing hatchet tasks
  hatchet: Hatchet
  // available hatchet tasks
  tasks: PreparedHatchetTasks
  requestContext: RequestContext
  log: AppLogger
}

export interface ContextWithUser extends Context {
  user: {
    sub: string
    role: UserRole
    scope: UserLoginScope
    catalystInstitutional: boolean
    catalystIndividual: boolean
    // affiliations?: string[]
  }
}

export type PrismaTransactionContextWithUser = Omit<
  ContextWithUser,
  'prisma'
> & {
  prisma: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >
}

function enhanceContext(args = {}) {
  return ({ req }: BaseContext) => ({
    ...args,
    user: req?.locals?.user,
    requestContext: req.locals.requestContext,
    log: req.locals.log,
  })
}

export default enhanceContext
