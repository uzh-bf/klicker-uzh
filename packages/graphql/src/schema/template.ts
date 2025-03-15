import * as DB from '@klicker-uzh/prisma'
import { ActivityType as ActivityTypeEnum } from '@klicker-uzh/types'
import builder from '../builder.js'
import { ActivityType } from './analytics.js'
import { GroupActivity } from './groupActivity.js'
import { LiveQuiz } from './liveQuiz.js'
import { MicroLearning } from './microLearning.js'
import { PracticeQuiz } from './practiceQuiz.js'
import { AnswerCollection } from './resource.js'

interface IActivityTemplateInfo {
  noInstances: boolean
  noResourcesRequired: boolean
  resourcesRequiredExist: boolean
  resourcesRequiredMissing: boolean
}

export const ActivityTemplateInfoRef = builder.objectRef<IActivityTemplateInfo>(
  'ActivityTemplateInfo'
)
export const ActivityTemplateInfo = ActivityTemplateInfoRef.implement({
  fields: (t) => ({
    noInstances: t.exposeBoolean('noInstances'),
    noResourcesRequired: t.exposeBoolean('noResourcesRequired'),
    resourcesRequiredExist: t.exposeBoolean('resourcesRequiredExist'),
    resourcesRequiredMissing: t.exposeBoolean('resourcesRequiredMissing'),
  }),
})

interface IActivityTemplateMetadata {
  templateId: string
  name: string
  description: string
  instructions: string
}

export const ActivityTemplateMetadataRef =
  builder.objectRef<IActivityTemplateMetadata>('ActivityTemplateMetadata')
export const ActivityTemplateMetadata = ActivityTemplateMetadataRef.implement({
  fields: (t) => ({
    templateId: t.exposeString('templateId'),
    name: t.exposeString('name'),
    description: t.exposeString('description'),
    instructions: t.exposeString('instructions'),
  }),
})

interface IActityTemplate extends DB.ActivityTemplate {
  activityType: ActivityTypeEnum
  liveQuiz?: DB.LiveQuiz | null
  practiceQuiz?: DB.PracticeQuiz | null
  microLearning?: DB.MicroLearning | null
  groupActivity?: DB.GroupActivity | null
  answerCollections?: DB.AnswerCollection[]
}

export const ActivityTemplateRef =
  builder.objectRef<IActityTemplate>('ActivityTemplate')
export const ActivityTemplate = ActivityTemplateRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    description: t.exposeString('description'),
    instructions: t.exposeString('instructions'),
    activityType: t.expose('activityType', { type: ActivityType }),
    liveQuiz: t.expose('liveQuiz', { type: LiveQuiz, nullable: true }),
    practiceQuiz: t.expose('practiceQuiz', {
      type: PracticeQuiz,
      nullable: true,
    }),
    microLearning: t.expose('microLearning', {
      type: MicroLearning,
      nullable: true,
    }),
    groupActivity: t.expose('groupActivity', {
      type: GroupActivity,
      nullable: true,
    }),
    answerCollections: t.expose('answerCollections', {
      type: [AnswerCollection],
      nullable: true,
    }),
  }),
})

interface ITemplateElementInformation {
  id: number
  name: string
  content: string
}

export const TemplateElementInformationRef =
  builder.objectRef<ITemplateElementInformation>('TemplateElementInformation')
export const TemplateElementInformation =
  TemplateElementInformationRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
      content: t.exposeString('content'),
    }),
  })
