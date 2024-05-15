import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { ResponseCorrectness } from '../types/app.js'
import { CourseRef, type ICourse } from './course.js'
import type { IParticipant, IParticipantGroup } from './participant.js'
import { ParticipantGroupRef, ParticipantRef } from './participant.js'
import { ElementStackRef, IElementStack } from './practiceQuizzes.js'
import { ElementType } from './questionData.js'

export const ParameterType = builder.enumType('ParameterType', {
  values: Object.values(DB.ParameterType),
})

export const GroupActivityStatus = builder.enumType('GroupActivityStatus', {
  values: Object.values(DB.GroupActivityStatus),
})

export const ResponseCorrectnessType = builder.enumType(
  'ResponseCorrectnessType',
  {
    values: Object.values(ResponseCorrectness),
  }
)

export const GroupActivityDecisionInput = builder.inputType(
  'GroupActivityDecisionInput',
  {
    fields: (t) => ({
      id: t.int({ required: true }),

      selectedOptions: t.intList({ required: false }),
      response: t.string({ required: false }),
    }),
  }
)

export interface IGroupActivity extends DB.GroupActivity {
  stacks?: IElementStack[]
  numOfQuestions?: number
  activityInstances?: IGroupActivityInstance[]
  course?: ICourse
  clues?: DB.GroupActivityClue[]
}
export const GroupActivityRef =
  builder.objectRef<IGroupActivity>('GroupActivity')
export const GroupActivity = GroupActivityRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    status: t.expose('status', { type: GroupActivityStatus }),
    numOfQuestions: t.exposeInt('numOfQuestions', { nullable: true }),

    pointsMultiplier: t.exposeInt('pointsMultiplier', { nullable: true }),

    scheduledStartAt: t.expose('scheduledStartAt', { type: 'Date' }),
    scheduledEndAt: t.expose('scheduledEndAt', { type: 'Date' }),

    stacks: t.expose('stacks', {
      type: [ElementStackRef],
      nullable: true,
    }),

    instances: t.expose('activityInstances', {
      type: [GroupActivityInstanceRef],
      nullable: true,
    }),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),

    clues: t.expose('clues', {
      type: [GroupActivityClueRef],
      nullable: true,
    }),
  }),
})

export interface IGroupActivityDecision {
  instanceId: number
  type: DB.ElementType
  freeTextResponse?: string
  choicesResponse?: number[]
  numericalResponse?: number
  contentResponse?: boolean
}
export const GroupActivityDecisionRef =
  builder.objectRef<IGroupActivityDecision>('GroupActivityDecision')

export const GroupActivityDecision = GroupActivityDecisionRef.implement({
  fields: (t) => ({
    instanceId: t.exposeInt('instanceId'),
    type: t.expose('type', { type: ElementType }),
    freeTextResponse: t.exposeString('freeTextResponse', { nullable: true }),
    choicesResponse: t.exposeIntList('choicesResponse', { nullable: true }),
    numericalResponse: t.exposeFloat('numericalResponse', { nullable: true }),
    contentResponse: t.exposeBoolean('contentResponse', { nullable: true }),
  }),
})

export interface IGroupActivityGrading {
  instanceId: number
  score: number
  maxPoints: number
  feedback?: string | null
}
export const GroupActivityGradingRef = builder.objectRef<IGroupActivityGrading>(
  'GroupActivityGrading'
)

export const GroupActivityGrading = GroupActivityGradingRef.implement({
  fields: (t) => ({
    instanceId: t.exposeInt('instanceId'),
    score: t.exposeFloat('score'),
    maxPoints: t.exposeFloat('maxPoints'),
    feedback: t.exposeString('feedback', { nullable: true }),
  }),
})

export interface IGroupActivityResults {
  passed: boolean
  points: number
  comment?: string | null
  grading: IGroupActivityGrading[]
}
export const GroupActivityResultsRef = builder.objectRef<IGroupActivityResults>(
  'GroupActivityResults'
)

export const GroupActivityResults = GroupActivityResultsRef.implement({
  fields: (t) => ({
    passed: t.exposeBoolean('passed'),
    points: t.exposeFloat('points'),
    comment: t.exposeString('comment', { nullable: true }),
    grading: t.expose('grading', {
      type: [GroupActivityGradingRef],
    }),
  }),
})

export interface IGroupActivityInstance extends DB.GroupActivityInstance {
  clues?: IGroupActivityClueInstance[]
}
export const GroupActivityInstanceRef =
  builder.objectRef<IGroupActivityInstance>('GroupActivityInstance')
export const GroupActivityInstance = GroupActivityInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    decisions: t.expose('decisions', { type: 'Json', nullable: true }),
    decisionsSubmittedAt: t.expose('decisionsSubmittedAt', {
      type: 'Date',
      nullable: true,
    }),
    results: t.expose('results', { type: 'Json', nullable: true }),
    resultsComputedAt: t.expose('resultsComputedAt', {
      type: 'Date',
      nullable: true,
    }),
    clues: t.expose('clues', {
      type: [GroupActivityClueInstanceRef],
      nullable: true,
    }),
    groupActivityId: t.exposeID('groupActivityId'),
  }),
})

export const GroupActivityClueRef =
  builder.objectRef<DB.GroupActivityClue>('GroupActivityClue')
export const GroupActivityClue = GroupActivityClueRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    type: t.expose('type', { type: ParameterType }),
    value: t.exposeString('value'),
    unit: t.exposeString('unit', { nullable: true }),
  }),
})

export interface IGroupActivityClueInstance
  extends DB.GroupActivityClueInstance {
  participant: IParticipant
}
export const GroupActivityClueInstanceRef =
  builder.objectRef<IGroupActivityClueInstance>('GroupActivityClueInstance')
export const GroupActivityClueInstance = GroupActivityClueInstanceRef.implement(
  {
    fields: (t) => ({
      id: t.exposeInt('id'),

      name: t.exposeString('name'),
      displayName: t.exposeString('displayName'),
      type: t.expose('type', { type: ParameterType }),
      unit: t.exposeString('unit', { nullable: true }),
      value: t.exposeString('value', { nullable: true }),

      participant: t.expose('participant', {
        type: ParticipantRef,
      }),
    }),
  }
)

export const GroupActivityClueAssignmentRef =
  builder.objectRef<DB.GroupActivityClueAssignment>(
    'GroupActivityClueAssignment'
  )
export const GroupActivityClueAssignment =
  GroupActivityClueAssignmentRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  })

export const GroupActivityParameterRef =
  builder.objectRef<DB.GroupActivityParameter>('GroupActivityParameter')
export const GroupActivityParameter = GroupActivityParameterRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

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
  stacks: IElementStack[]
}
export const GroupActivityDetailsRef = builder.objectRef<IGroupActivityDetails>(
  'GroupActivityDetails'
)
export const GroupActivityDetails = GroupActivityDetailsRef.implement({
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
      type: GroupActivityInstanceRef,
      nullable: true,
    }),

    clues: t.expose('clues', {
      type: [GroupActivityClueRef],
    }),

    stacks: t.expose('stacks', {
      type: [ElementStackRef],
    }),

    course: t.expose('course', {
      type: CourseRef,
    }),

    group: t.expose('group', {
      type: ParticipantGroupRef,
    }),
  }),
})

export const GroupActivityClueInput = builder.inputType(
  'GroupActivityClueInput',
  {
    fields: (t) => ({
      name: t.string({ required: true }),
      displayName: t.string({ required: true }),
      type: t.field({ type: ParameterType, required: true }),
      value: t.string({ required: true }),
      unit: t.string({ required: false }),
    }),
  }
)
