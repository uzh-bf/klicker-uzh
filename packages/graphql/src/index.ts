import { makeSchema } from 'nexus'
import path from 'path'
export { default as enhanceContext } from './lib/context'
export * from './prisma/client'

import * as types from './nexus'

export const schema = makeSchema({
  types,
  outputs: {
    typegen: path.join(process.cwd(), 'src/types/nexus-typegen.ts'),
    schema: path.join(process.cwd(), 'src/graphql/schema.graphql'),
  },
})
