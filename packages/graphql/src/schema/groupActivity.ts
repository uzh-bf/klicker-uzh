import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { Course } from './course'
import { Participant, ParticipantGroup } from './participant'
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

export const GroupActivityClueInstance = builder.prismaObject(
  'GroupActivityClueInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),

      name: t.exposeString('name'),
      displayName: t.exposeString('displayName'),
      type: t.expose('type', { type: ParameterType }),
      unit: t.exposeString('unit', { nullable: true }),
      value: t.exposeString('value', { nullable: true }),

      participant: t.field({
        type: Participant,
        resolve: (instance) => instance.participant,
      }),
    }),
  }
)

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

interface GroupActivityDetails {
  id: string
  name: string
  displayName: string
  description?: string | null
  scheduledStartAt?: Date
  scheduledEndAt?: Date
  group: DB.ParticipantGroup
  course: DB.Course
  activityInstance?: DB.GroupActivityInstance | null
  clues: DB.GroupActivityClue[]
  instances: DB.QuestionInstance[]
}

export const GroupActivityDetails = builder
  .objectRef<GroupActivityDetails>('GroupActivityDetails')
  .implement({
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

      activityInstance: t.field({
        type: GroupActivityInstance,
        resolve: (root, args, ctx) => {
          return root.activityInstance
        },
        nullable: true,
      }),

      clues: t.field({
        type: [GroupActivityClue],
        resolve: (root, args, ctx) => {
          return root.clues
        },
      }),

      instances: t.field({
        type: [QuestionInstance],
        resolve: (root, args, ctx) => {
          return root.instances
        },
      }),

      course: t.field({
        type: Course,
        resolve: (root, args, ctx) => {
          return root.course
        },
      }),

      group: t.field({
        type: ParticipantGroup,
        resolve: (root, args, ctx) => {
          return root.group
        },
      }),
    }),
  })
