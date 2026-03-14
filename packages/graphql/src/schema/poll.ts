import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import { CourseRef, type ICourse } from './course.js'
import {
  ElementStackRef,
  IElementStack,
  PublicationStatus,
} from './practiceQuiz.js'

export interface IPoll
  extends Pick<
    DB.Poll,
    | 'id'
    | 'name'
    | 'displayName'
    | 'description'
    | 'templateName'
    | 'status'
    | 'areInstancesOutdated'
    | 'createdAt'
    | 'updatedAt'
  > {
  course?: ICourse
  stacks?: IElementStack[]
  numOfStacks?: number
  isOwner?: boolean
}
export const PollRef = builder.objectRef<IPoll>('Poll')
export const Poll = PollRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    templateName: t.exposeString('templateName', { nullable: true }),

    status: t.expose('status', { type: PublicationStatus }),
    stacks: t.expose('stacks', { type: [ElementStackRef], nullable: true }),
    course: t.expose('course', { type: CourseRef, nullable: true }),
    numOfStacks: t.exposeInt('numOfStacks', { nullable: true }),

    isOwner: t.exposeBoolean('isOwner', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
  }),
})
