import type { EventEmitter } from 'node:events'

export interface TRPCUser extends Record<string, unknown> {
  sub: string
  role?: string
  scope?: string
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
  prisma?: unknown
  redisExec?: unknown
  redisAssessmentExec?: unknown
  pubSub?: unknown
  cache?: unknown
  emitter?: EventEmitter
  user?: TRPCUser | null
  hatchet?: unknown
  tasks?: unknown
}
