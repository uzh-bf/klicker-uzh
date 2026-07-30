import * as DB from '@klicker-uzh/prisma/client'
import {
  COURSE_QA_EXTERNAL_REF_MAX_LENGTH,
  COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import type {
  CourseDiscussionEmbeddingInfo,
  CourseDiscussionOverview,
  CourseDiscussionOverviewGroup,
  DiscussionThreadPage,
} from '../services/discussions.js'
import { ElementStackType } from './practiceQuiz.js'

export const DiscussionSpaceType = builder.enumType('DiscussionSpaceType', {
  values: {
    COURSE: { value: DB.DiscussionSpaceType.COURSE },
  },
})

export const DiscussionScopeType = builder.enumType('DiscussionScopeType', {
  values: {
    COURSE: { value: DB.DiscussionScopeType.COURSE },
    PRACTICE_STACK: { value: DB.DiscussionScopeType.PRACTICE_STACK },
    EXTERNAL_BLOCK: { value: DB.DiscussionScopeType.EXTERNAL_BLOCK },
  },
})

export const DiscussionSort = builder.enumType('DiscussionSort', {
  values: {
    ACTIVITY_DESC: { value: 'ACTIVITY_DESC' },
    NEWEST_DESC: { value: 'NEWEST_DESC' },
    UPVOTES_DESC: { value: 'UPVOTES_DESC' },
  },
})

export const DiscussionScopeInput = builder.inputType('DiscussionScopeInput', {
  fields: (t) => ({
    scopeType: t.field({ type: DiscussionScopeType, required: true }),
    stackId: t.int({ required: false }),
    externalSource: t.string({ required: false }),
    externalRef: t.string({ required: false }),
  }),
})

export const DiscussionExternalBlockInput = builder.inputType(
  'DiscussionExternalBlockInput',
  {
    fields: (t) => ({
      externalSource: t.string({
        required: true,
        validate: {
          minLength: 1,
          maxLength: COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH,
          regex: /\S/,
        },
      }),
      externalRef: t.string({
        required: true,
        validate: {
          minLength: 1,
          maxLength: COURSE_QA_EXTERNAL_REF_MAX_LENGTH,
          regex: /\S/,
        },
      }),
    }),
  }
)

export const CreateCourseDiscussionThreadInput = builder.inputType(
  'CreateCourseDiscussionThreadInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      content: t.string({ required: true }),
      scope: t.field({ type: DiscussionScopeInput, required: true }),
      isAnonymous: t.boolean({ required: false }),
      embedToken: t.string({ required: false }),
    }),
  }
)

export const CreateCourseDiscussionReplyInput = builder.inputType(
  'CreateCourseDiscussionReplyInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      threadId: t.int({ required: true }),
      content: t.string({ required: true }),
      isAnonymous: t.boolean({ required: false }),
      embedToken: t.string({ required: false }),
    }),
  }
)

export interface IDiscussionScope extends DB.DiscussionScope {
  stackType?: DB.ElementStackType | null
  stackOrder?: number | null
  stackDisplayName?: string | null
}
export const DiscussionScopeRef =
  builder.objectRef<IDiscussionScope>('DiscussionScope')
export const DiscussionScope = DiscussionScopeRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    spaceId: t.exposeInt('spaceId'),
    scopeType: t.field({
      type: DiscussionScopeType,
      resolve: (scope) => scope.scopeType as never,
    }),
    scopeKey: t.exposeString('scopeKey'),
    scopeLabel: t.exposeString('scopeLabel'),

    stackId: t.exposeInt('stackId', { nullable: true }),
    stackType: t.field({
      type: ElementStackType,
      nullable: true,
      resolve: (scope) => scope.stackType ?? null,
    }),
    stackOrder: t.exposeInt('stackOrder', { nullable: true }),
    stackDisplayName: t.exposeString('stackDisplayName', { nullable: true }),
    externalSource: t.exposeString('externalSource', { nullable: true }),
    externalRef: t.exposeString('externalRef', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export interface IDiscussionReply extends DB.DiscussionReply {
  spaceId: number
  scopeId: number
  hasUpvoted?: boolean
}
export const DiscussionReplyRef =
  builder.objectRef<IDiscussionReply>('DiscussionReply')
export const DiscussionReply = DiscussionReplyRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    threadId: t.exposeInt('threadId'),
    spaceId: t.exposeInt('spaceId'),
    scopeId: t.exposeInt('scopeId'),

    content: t.exposeString('content'),
    isAnonymous: t.exposeBoolean('isAnonymous'),
    isDeleted: t.exposeBoolean('isDeleted'),
    upvotes: t.exposeInt('upvotes'),
    hasUpvoted: t.exposeBoolean('hasUpvoted', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export interface IDiscussionThread extends DB.DiscussionThread {
  spaceId: number
  scope: DB.DiscussionScope
  replies: IDiscussionReply[]
  sourceKey?: string
  sourceLabel?: string
  hasUpvoted?: boolean
}
export const DiscussionThreadRef =
  builder.objectRef<IDiscussionThread>('DiscussionThread')
export const DiscussionThread = DiscussionThreadRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    spaceId: t.exposeInt('spaceId'),
    scopeId: t.exposeInt('scopeId'),

    content: t.exposeString('content'),
    isAnonymous: t.exposeBoolean('isAnonymous'),
    isDeleted: t.exposeBoolean('isDeleted'),

    upvotes: t.exposeInt('upvotes'),
    hasUpvoted: t.exposeBoolean('hasUpvoted', { nullable: true }),
    replyCount: t.exposeInt('replyCount'),
    lastActivityAt: t.expose('lastActivityAt', { type: 'Date' }),

    sourceKey: t.exposeString('sourceKey', { nullable: true }),
    sourceLabel: t.exposeString('sourceLabel', { nullable: true }),

    scope: t.expose('scope', {
      type: DiscussionScopeRef,
    }),
    replies: t.expose('replies', {
      type: [DiscussionReplyRef],
    }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const DiscussionThreadPageRef = builder.objectRef<DiscussionThreadPage>(
  'DiscussionThreadPage'
)
export const DiscussionThreadPageObject = DiscussionThreadPageRef.implement({
  fields: (t) => ({
    threads: t.expose('threads', { type: [DiscussionThreadRef] }),
    nextCursor: t.exposeString('nextCursor', { nullable: true }),
    hasMore: t.exposeBoolean('hasMore'),
    canPostAnonymously: t.exposeBoolean('canPostAnonymously'),
    canPostIdentified: t.exposeBoolean('canPostIdentified'),
    isAccessible: t.exposeBoolean('isAccessible'),
  }),
})

export const CourseDiscussionOverviewGroupRef =
  builder.objectRef<CourseDiscussionOverviewGroup>(
    'CourseDiscussionOverviewGroup'
  )
export const CourseDiscussionOverviewGroupObject =
  CourseDiscussionOverviewGroupRef.implement({
    fields: (t) => ({
      sourceKey: t.exposeString('sourceKey'),
      sourceLabel: t.exposeString('sourceLabel'),
      spaceType: t.field({
        type: DiscussionSpaceType,
        resolve: () => DB.DiscussionSpaceType.COURSE,
      }),
      threads: t.expose('threads', { type: [DiscussionThreadRef] }),
    }),
  })

export const CourseDiscussionOverviewRef =
  builder.objectRef<CourseDiscussionOverview>('CourseDiscussionOverview')
export const CourseDiscussionOverviewObject =
  CourseDiscussionOverviewRef.implement({
    fields: (t) => ({
      groups: t.expose('groups', {
        type: [CourseDiscussionOverviewGroupRef],
      }),
      nextCursor: t.exposeString('nextCursor', { nullable: true }),
      hasMore: t.exposeBoolean('hasMore'),
      totalThreads: t.exposeInt('totalThreads'),
    }),
  })

export const CourseDiscussionEmbeddingInfoRef =
  builder.objectRef<CourseDiscussionEmbeddingInfo>(
    'CourseDiscussionEmbeddingInfo'
  )
export const CourseDiscussionEmbeddingInfoObject =
  CourseDiscussionEmbeddingInfoRef.implement({
    fields: (t) => ({
      courseId: t.exposeID('courseId'),
      scopeKey: t.exposeString('scopeKey'),
      scopeLabel: t.exposeString('scopeLabel'),
      allowAnonymous: t.exposeBoolean('allowAnonymous'),
      expiresAt: t.expose('expiresAt', { type: 'Date' }),
      embedToken: t.exposeString('embedToken'),
      embedUrl: t.exposeString('embedUrl'),
    }),
  })
