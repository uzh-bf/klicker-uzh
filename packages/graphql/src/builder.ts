import { PrismaClient } from '@klicker-uzh/prisma'
import type PrismaTypes from '@klicker-uzh/prisma/dist/pothos'
import SchemaBuilder from '@pothos/core'
import PrismaPlugin from '@pothos/plugin-prisma'
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
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
    filterConnectionTotalCount: true,
  },
})

export const DateScalar = builder.addScalarType('Date', DateTimeResolver, {})
export const JsonScalar = builder.addScalarType('Json', JSONObjectResolver, {})

export default builder
