import { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { Request, Response } from 'express'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'
import type { EventEmitter } from 'node:events'
import {
  endExpiredGroupActivity,
  endExpiredMicroLearning,
  publishScheduledGroupActivity,
  publishScheduledLiveQuiz,
  publishScheduledMicroLearning,
  publishScheduledPracticeQuiz,
} from '../services/tasks.js'

interface BaseContext {
  req: Request & { locals: { user?: any } }
  res: Response
}

export interface Context extends BaseContext {
  prisma: PrismaClient
  redisExec: Redis
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
  tasks: {
    publishScheduledMicroLearningTask: ReturnType<
      typeof publishScheduledMicroLearning
    >
    publishScheduledPracticeQuizTask: ReturnType<
      typeof publishScheduledPracticeQuiz
    >
    publishScheduledGroupActivityTask: ReturnType<
      typeof publishScheduledGroupActivity
    >
    publishScheduledLiveQuizTask: ReturnType<typeof publishScheduledLiveQuiz>
    endExpiredMicroLearningTask: ReturnType<typeof endExpiredMicroLearning>
    endExpiredGroupActivityTask: ReturnType<typeof endExpiredGroupActivity>
  }
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
  })
}

export default enhanceContext
