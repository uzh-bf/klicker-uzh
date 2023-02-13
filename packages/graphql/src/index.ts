export { default as enhanceContext } from './lib/context'
// import { writeFileSync } from 'fs'
// import { lexicographicSortSchema, printSchema } from 'graphql'

import builder from './builder'

import './schema/achievement'
import './schema/course'
import './schema/groupActivity'
import './schema/learningElements'
import './schema/microSession'
import './schema/participant'
import './schema/question'
import './schema/questionData'
import './schema/session'
import './schema/user'

import './schema/mutation'
import './schema/query'
import './schema/subscription'

export const schema = builder.toSchema()
// const schemaAsString = printSchema(lexicographicSortSchema(schema))

// writeFileSync('./graphql/schema.graphql', schemaAsString)
