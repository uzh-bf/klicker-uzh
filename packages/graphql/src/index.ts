export { default as enhanceContext } from './lib/context.js'

import builder from './builder.js'

import './schema/achievement'
import './schema/course'
import './schema/elementData'
import './schema/evaluation'
import './schema/groupActivity'
import './schema/microLearning'
import './schema/participant'
import './schema/question'
import './schema/questionData'
import './schema/session'
import './schema/user'

import './schema/mutation'
import './schema/query'
import './schema/subscription'

// TEMPLATE for future directives
// function upperDirectiveTransformer(schema: any) {
//   throw new Error('Not implemented')
//   console.error(schema)
//   return mapSchema(schema, {
//     [MapperKind.INPUT_OBJECT_TYPE]: (fieldConfig) => {
//       console.log(fieldConfig)
//       // Check whether this field has the specified directive

//       return fieldConfig
//     },
//   })
// }

export const schema = builder.toSchema({
  schemaDirectives: {
    // oneOf: upperDirectiveTransformer,
  },
})
