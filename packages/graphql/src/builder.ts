import { PrismaClient, UserRole } from '@klicker-uzh/prisma'
import type PrismaTypes from '@klicker-uzh/prisma/dist/pothos'
import SchemaBuilder from '@pothos/core'
import PrismaPlugin from '@pothos/plugin-prisma'
import ScopeAuthPlugin from '@pothos/plugin-scope-auth'
import ValidationPlugin from '@pothos/plugin-validation'
import { GraphQLError } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import { Context, ContextWithUser } from './lib/context'

const prisma = new PrismaClient({})

const builder = new SchemaBuilder<{
  Context: Context
  AuthContexts: {
    anonymous: Context
    authenticated: ContextWithUser
    role: ContextWithUser
  }
  AuthScopes: {
    anonymous: boolean
    authenticated: boolean
    role?: UserRole
  }
  PrismaTypes: PrismaTypes
  Scalars: {
    Date: {
      Input: Date
      Output: Date
    }
    Json: {
      Input: any
      Output: any
    }
  }
}>({
  authScopes: async (ctx) => ({
    anonymous: !ctx.user?.sub,
    authenticated: !!ctx.user?.sub,
    role: (role) => ctx.user?.role === role,
  }),
  plugins: [ScopeAuthPlugin, PrismaPlugin, ValidationPlugin],
  prisma: {
    client: prisma,
    filterConnectionTotalCount: true,
  },
  scopeAuthOptions: {
    authorizeOnSubscribe: true,
    unauthorizedError: () => new GraphQLError('Unauthorized'),
  },
  validationOptions: {
    validationError: (zodError, args, context, info) => {
      return new GraphQLError(
        zodError.issues.map((issue) => issue.message).join(', ')
      )
    },
  },
})

export const DateScalar = builder.addScalarType('Date', DateTimeResolver, {})
export const JsonScalar = builder.addScalarType('Json', JSONResolver, {})

export default builder
