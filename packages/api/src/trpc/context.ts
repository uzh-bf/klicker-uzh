import type {
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { TRPCError } from '@trpc/server'
import type { EventEmitter } from 'node:events'

export interface TRPCUser extends Record<string, unknown> {
  sub: string
  role?: UserRole
  scope?: UserLoginScope
  email?: string
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
  iat?: number
  exp?: number
}

export interface TRPCRequest {
  locals?: {
    user?: TRPCUser | null
  }
  headers?: Record<string, string | string[] | undefined>
}

export interface TRPCContext {
  req?: TRPCRequest
  res?: unknown
  prisma?: PrismaClient
  redisExec?: unknown
  redisAssessmentExec?: unknown
  pubSub?: unknown
  cache?: unknown
  emitter?: EventEmitter
  user?: TRPCUser | null
  hatchet?: unknown
  tasks?: unknown
}

export interface TRPCContextWithUser extends TRPCContext {
  prisma: PrismaClient
  user: TRPCUser & {
    sub: string
    role: UserRole
    scope: UserLoginScope
    catalystInstitutional: boolean
    catalystIndividual: boolean
  }
}

export function getPrisma(ctx: TRPCContext) {
  if (!ctx.prisma) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Prisma client unavailable in tRPC context',
    })
  }

  return ctx.prisma
}
