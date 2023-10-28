export { default as enhanceContext } from './lib/context.js'

import builder from './builder.js'

import './schema/achievement.js'
import './schema/course.js'
import './schema/groupActivity.js'
import './schema/learningElements.js'
import './schema/microSession.js'
import './schema/participant.js'
import './schema/question.js'
import './schema/questionData.js'
import './schema/session.js'
import './schema/user.js'

import './schema/mutation.js'
import './schema/query.js'
import './schema/subscription.js'

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
