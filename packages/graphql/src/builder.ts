import { PrismaClient, UserLoginScope, UserRole } from '@klicker-uzh/prisma'
import type PrismaTypes from '@klicker-uzh/prisma/dist/pothos'
import '@klicker-uzh/prisma/dist/types.ts'
import SchemaBuilder from '@pothos/core'
import DirectivePlugin from '@pothos/plugin-directives'
import PrismaPlugin from '@pothos/plugin-prisma'
import ScopeAuthPlugin from '@pothos/plugin-scope-auth'
import ValidationPlugin from '@pothos/plugin-validation'
import { GraphQLError } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'

import { Context, ContextWithUser } from './lib/context'

const prisma = new PrismaClient({})

const builder = new SchemaBuilder<{
  Directives: {
    oneOf: {
      locations: 'INPUT_OBJECT'
    }
  }
  Context: Context
  AuthContexts: {
    authenticated: ContextWithUser
    role: ContextWithUser
    scope: ContextWithUser
    catalyst: ContextWithUser
  }
  AuthScopes: {
    authenticated: boolean
    role?: UserRole
    scope?: UserLoginScope
    catalyst?: boolean
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
    authenticated: !!ctx.user?.sub,
    role: (role) => ctx.user?.role === role,
    scope: (requiredScope) => {
      switch (requiredScope) {
        case UserLoginScope.ACCOUNT_OWNER:
          return ctx?.user?.scope === UserLoginScope.ACCOUNT_OWNER

        case UserLoginScope.FULL_ACCESS:
          return (
            typeof ctx?.user?.scope === 'string' &&
            (ctx.user.scope === UserLoginScope.ACCOUNT_OWNER ||
              ctx.user.scope === UserLoginScope.FULL_ACCESS)
          )

        case UserLoginScope.SESSION_EXEC:
          return (
            typeof ctx?.user?.scope === 'string' &&
            (ctx.user.scope === UserLoginScope.ACCOUNT_OWNER ||
              ctx.user.scope === UserLoginScope.FULL_ACCESS ||
              ctx.user.scope === UserLoginScope.SESSION_EXEC)
          )

        case UserLoginScope.READ_ONLY:
          return (
            typeof ctx?.user?.scope === 'string' &&
            (ctx.user.scope === UserLoginScope.ACCOUNT_OWNER ||
              ctx.user.scope === UserLoginScope.FULL_ACCESS ||
              ctx.user.scope === UserLoginScope.SESSION_EXEC ||
              ctx.user.scope === UserLoginScope.READ_ONLY)
          )
      }

      return false
    },
    catalyst: ctx.user?.catalystInstitutional || ctx.user?.catalystIndividual,
  }),
  plugins: [ScopeAuthPlugin, PrismaPlugin, ValidationPlugin, DirectivePlugin],
  useGraphQLToolsUnorderedDirectives: true,
  prisma: {
    client: prisma,
    filterConnectionTotalCount: true,
  },
  scopeAuthOptions: {
    defaultStrategy: 'all',
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
