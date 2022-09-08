import 'dotenv/config'
import { makeSchema, nullabilityGuardPlugin } from 'nexus'
import path from 'path'
import * as types from './nexus'
export { default as enhanceContext } from './lib/context'

const guardPlugin = nullabilityGuardPlugin({
  onGuarded({ ctx, info }) {
    console.error(
      `Error: Saw a null value for non-null field ${info.parentType.name}.${info.fieldName}`
    )
  },

  fallbackValues: {
    Int: () => 0,
    String: () => '',
    ID: ({ info }) => `${info.parentType.name}:N/A`,
    Boolean: () => false,
    Float: () => 0,
    DateTime: () => new Date(),
    JSONObject: () => ({}),
  },
})

export const schema = makeSchema({
  types,
  outputs: {
    typegen: path.join(process.cwd(), 'src/types/nexus-typegen.ts'),
    schema: path.join(process.cwd(), 'src/graphql/schema.graphql'),
  },
  plugins: [guardPlugin],
})
