import { TRPCError } from '@trpc/server'

export function throwUnauthorized(message = 'Unauthorized'): never {
  throw new TRPCError({ code: 'UNAUTHORIZED', message })
}

export function throwForbidden(message = 'Forbidden'): never {
  throw new TRPCError({ code: 'FORBIDDEN', message })
}
