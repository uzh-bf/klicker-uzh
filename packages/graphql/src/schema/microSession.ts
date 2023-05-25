import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import type { ICourse } from './course'
import { Course } from './course'
import type { IQuestionInstance } from './question'
import { QuestionInstance } from './question'

export interface IMicroSession extends DB.MicroSession {
  numOfInstances?: number
  course?: ICourse | null
  instances?: IQuestionInstance[]
}

export const MicroSessionStatus = builder.enumType('MicroSessionStatus', {
  values: Object.values(DB.MicroSessionStatus),
})

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
