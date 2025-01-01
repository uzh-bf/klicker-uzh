import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'

export const CollectionAccess = builder.enumType('CollectionAccess', {
  values: Object.values(DB.CollectionAccess),
})
