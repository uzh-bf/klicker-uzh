import { PrismaClient, UserLoginScope, UserRole } from '@klicker-uzh/prisma'
import type PrismaTypes from '@klicker-uzh/prisma/dist/pothos.js'
import SchemaBuilder from '@pothos/core'
import DirectivePlugin from '@pothos/plugin-directives'
import PrismaPlugin from '@pothos/plugin-prisma'
import ScopeAuthPlugin from '@pothos/plugin-scope-auth'
import ZodPlugin from '@pothos/plugin-zod'
import { GraphQLError } from 'graphql'
import { DateTimeResolver, JSONResolver } from 'graphql-scalars'
import './types/app'

import { Context, ContextWithUser } from './lib/context.js'

const prisma = new PrismaClient({})

const builder = new SchemaBuilder<{
  DefaultFieldNullability: false
  Directives: {
    // TEMPLATE for future directives
    // oneOf: {
    //   locations: 'INPUT_OBJECT'
    // }
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
  // @ts-expect-error
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
  defaultFieldNullability: false,
  plugins: [ScopeAuthPlugin, PrismaPlugin, ZodPlugin, DirectivePlugin],
  useGraphQLToolsUnorderedDirectives: true,
  prisma: {
    client: prisma,
    filterConnectionTotalCount: true,
  },
  scopeAuth: {
    defaultStrategy: 'all',
    authorizeOnSubscribe: true,
    unauthorizedError: () => new GraphQLError('Unauthorized'),
    authScopes: async (ctx) => ({
      authenticated: !!ctx.user?.sub && ctx.user.scope !== UserLoginScope.OTP,
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
  },
  zod: {
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
