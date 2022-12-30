import { PrismaClient } from '@klicker-uzh/prisma'
import type PrismaTypes from '@klicker-uzh/prisma/dist/pothos'
import SchemaBuilder from '@pothos/core'
import PrismaPlugin from '@pothos/plugin-prisma'
import ValidationPlugin from '@pothos/plugin-validation'
import { GraphQLError } from 'graphql'
import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import { ContextWithOptionalUser, ContextWithUser } from './lib/context'

const prisma = new PrismaClient({})

const builder = new SchemaBuilder<{
  Context: ContextWithOptionalUser | ContextWithUser
  PrismaTypes: PrismaTypes
  Scalars: {
    Date: {
      Input: any
      Output: any
    }
    Json: {
      Input: any
      Output: any
    }
  }
}>({
  plugins: [PrismaPlugin, ValidationPlugin],
  prisma: {
    client: prisma,
    filterConnectionTotalCount: true,
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
export const JsonScalar = builder.addScalarType('Json', JSONObjectResolver, {})

export default builder
