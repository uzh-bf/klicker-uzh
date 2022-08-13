import { makeSchema } from 'nexus'
import path from 'path'
import * as types from './nexus'
export * as Prisma from '@prisma/client'
export { default as enhanceContext } from './lib/context'

export const schema = makeSchema({
  types,
  outputs: {
    typegen: path.join(process.cwd(), 'src/types/nexus-typegen.ts'),
    schema: path.join(process.cwd(), 'src/graphql/schema.graphql'),
  },
})
