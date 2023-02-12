import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import type { ICourse } from './course'
import { Course } from './course'
import type { IParticipant, IParticipantGroup } from './participant'
import { Participant, ParticipantGroup } from './participant'
import type { IQuestionInstance } from './question'
import { QuestionInstance } from './question'

export const ParameterType = builder.enumType('ParameterType', {
  values: Object.values(DB.ParameterType),
})

export const GroupActivityDecisionInput = builder.inputType(
  'GroupActivityDecisionInput',
  {
    fields: (t) => ({
      id: t.int({ required: true }),

      selectedOptions: t.intList({ required: true }),
      response: t.string({ required: false }),
    }),
  }
)

export const GroupActivity = builder.prismaObject('GroupActivity', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const GroupActivityInstance = builder.prismaObject(
  'GroupActivityInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),

      clues: t.relation('clues', {}),
      decisions: t.expose('decisions', { type: 'Json', nullable: true }),
      decisionsSubmittedAt: t.expose('decisionsSubmittedAt', {
        type: 'Date',
        nullable: true,
      }),
    }),
  }
)

export const GroupActivityClue = builder.prismaObject('GroupActivityClue', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
  }),
})

export interface IGroupActivityClueInstance
  extends DB.GroupActivityClueInstance {
  participant: IParticipant
}
export const GroupActivityClueInstance =
  builder.objectRef<IGroupActivityClueInstance>('GroupActivityClueInstance')
GroupActivityClueInstance.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    type: t.expose('type', { type: ParameterType }),
    unit: t.exposeString('unit', { nullable: true }),
    value: t.exposeString('value', { nullable: true }),

    participant: t.expose('participant', {
      type: Participant,
    }),
  }),
})

export const GroupActivityClueAssignment = builder.prismaObject(
  'GroupActivityClueAssignment',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const GroupActivityParameter = builder.prismaObject(
  'GroupActivityParameter',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export interface IGroupActivityDetails {
  id: string
  name: string
  displayName: string
  description?: string | null
  scheduledStartAt?: Date
  scheduledEndAt?: Date
  group: IParticipantGroup
  course: ICourse
  activityInstance?: DB.GroupActivityInstance | null
  clues: DB.GroupActivityClue[]
  instances: IQuestionInstance[]
}
export const GroupActivityDetails = builder.objectRef<IGroupActivityDetails>(
  'GroupActivityDetails'
)
GroupActivityDetails.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    name: t.exposeString('name', { nullable: false }),
    displayName: t.exposeString('displayName', { nullable: false }),
    description: t.exposeString('description', { nullable: true }),

    scheduledStartAt: t.expose('scheduledStartAt', {
      type: 'Date',
      nullable: true,
    }),
    scheduledEndAt: t.expose('scheduledEndAt', {
      type: 'Date',
      nullable: true,
    }),

    activityInstance: t.expose('activityInstance', {
      type: GroupActivityInstance,
      nullable: true,
    }),

    clues: t.expose('clues', {
      type: [GroupActivityClue],
    }),

    instances: t.expose('instances', {
      type: [QuestionInstance],
    }),

    course: t.expose('course', {
      type: Course,
    }),

    group: t.expose('group', {
      type: ParticipantGroup,
    }),
  }),
})
