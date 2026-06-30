import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import type { TRPCContext } from './context.js'

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const createCallerFactory = t.createCallerFactory
export const middleware = t.middleware
export const procedure = t.procedure
export const publicProcedure = t.procedure
export const router = t.router
