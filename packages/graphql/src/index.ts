export { default as enhanceContext } from './lib/context'

import builder from './builder'

import './schema/achievement'
import './schema/course'
import './schema/groupActivity'
import './schema/learningElements'
import './schema/microSession'
import './schema/mutation'
import './schema/participant'
import './schema/query'
import './schema/question'
import './schema/questionData'
import './schema/session'
import './schema/subscription'
import './schema/user'

export const schema = builder.toSchema()
