import * as DB from '@klicker-uzh/prisma'
import type { EnumRef } from '@pothos/core'
import builder from '../builder.js'
import type { ICourse } from './course.js'
import { Course } from './course.js'
import type { IQuestionInstance } from './question.js'
import { QuestionInstance } from './question.js'

export interface IMicroSession extends DB.MicroSession {
  numOfInstances?: number
  course?: ICourse | null
  instances?: IQuestionInstance[]
}

export const MicroSessionStatus: EnumRef<string, string> = builder.enumType(
  'MicroSessionStatus',
  {
    values: Object.values(DB.MicroSessionStatus),
  }
)

export const MicroSessionRef = builder.objectRef<IMicroSession>('MicroSession')
export const MicroSession = MicroSessionRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    status: t.expose('status', { type: MicroSessionStatus }),
    description: t.exposeString('description', { nullable: true }),
    pointsMultiplier: t.exposeFloat('pointsMultiplier'),

    scheduledStartAt: t.expose('scheduledStartAt', { type: 'Date' }),
    scheduledEndAt: t.expose('scheduledEndAt', { type: 'Date' }),
    arePushNotificationsSent: t.exposeBoolean('arePushNotificationsSent'),
    numOfInstances: t.exposeInt('numOfInstances', { nullable: true }),

    course: t.expose('course', {
      type: Course,
      nullable: true,
    }),
    instances: t.expose('instances', {
      type: [QuestionInstance],
      nullable: true,
    }),
  }),
})
