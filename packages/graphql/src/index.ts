export { default as enhanceContext } from './lib/context'

import builder from './builder'

import './schema/achievement'
import './schema/course'
import './schema/groupActivity'
import './schema/mutation'
import './schema/participant'
import './schema/query'
import './schema/question'
import './schema/session'
import './schema/user'

export const schema = builder.toSchema()
