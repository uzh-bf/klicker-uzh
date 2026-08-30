import { Hatchet } from '@hatchet-dev/typescript-sdk'
import type {
  FeatureFlagAttributes,
  FeatureFlagKey,
} from '@klicker-uzh/feature-flags'
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
  req: Request & { locals: { user?: any } }
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
  // request-local evaluations on a process-level, multi-user client
  featureFlags?: FeatureFlagEvaluator
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

export interface FeatureFlagEvaluator {
  isEnabled(key: FeatureFlagKey, attributes: FeatureFlagAttributes): boolean
}

function enhanceContext(args = {}) {
  return ({ req }: BaseContext) => ({
    ...args,
    user: req?.locals?.user,
  })
}

export default enhanceContext
