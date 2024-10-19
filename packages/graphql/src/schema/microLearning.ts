import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { type ICourse, CourseRef } from './course.js'
import {
  type IElementStack,
  ElementStackRef,
  PublicationStatus,
} from './practiceQuizzes.js'

export interface IMicroLearning extends DB.MicroLearning {
  course?: ICourse | null
  stacks?: IElementStack[]
  numOfStacks?: number
}

export const MicroLearningRef =
  builder.objectRef<IMicroLearning>('MicroLearning')
export const MicroLearning = MicroLearningRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    status: t.expose('status', { type: PublicationStatus }),
    description: t.exposeString('description', { nullable: true }),
    pointsMultiplier: t.exposeFloat('pointsMultiplier'),

    scheduledStartAt: t.expose('scheduledStartAt', { type: 'Date' }),
    scheduledEndAt: t.expose('scheduledEndAt', { type: 'Date' }),
    arePushNotificationsSent: t.exposeBoolean('arePushNotificationsSent'),
    numOfStacks: t.exposeInt('numOfStacks', { nullable: true }),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),
    stacks: t.expose('stacks', {
      type: [ElementStackRef],
      nullable: true,
    }),
  }),
})
