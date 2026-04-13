import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  CourseDiscussionEmbeddingInfo,
  CourseDiscussionOverview,
  CourseDiscussionOverviewGroup,
  DiscussionScopeSummary,
  DiscussionThreadPage,
} from '../services/discussions.js'

export const DiscussionSpaceType = builder.enumType('DiscussionSpaceType', {
  values: Object.values(DB.DiscussionSpaceType),
})

export const DiscussionScopeType = builder.enumType('DiscussionScopeType', {
  values: Object.values(DB.DiscussionScopeType),
})

export const DiscussionSort = builder.enumType('DiscussionSort', {
  values: {
    ACTIVITY_DESC: { value: 'ACTIVITY_DESC' },
    NEWEST_DESC: { value: 'NEWEST_DESC' },
    UPVOTES_DESC: { value: 'UPVOTES_DESC' },
  },
})

export const DiscussionSpaceInput = builder.inputType('DiscussionSpaceInput', {
  fields: (t) => ({
    spaceType: t.field({ type: DiscussionSpaceType, required: true }),
    courseId: t.string({ required: false }),
    liveQuizId: t.string({ required: false }),
  }),
})

export const DiscussionScopeInput = builder.inputType('DiscussionScopeInput', {
  fields: (t) => ({
    scopeType: t.field({ type: DiscussionScopeType, required: true }),
    practiceQuizId: t.string({ required: false }),
    stackId: t.int({ required: false }),
    instanceId: t.int({ required: false }),
    liveBlockId: t.int({ required: false }),
    externalSource: t.string({ required: false }),
    externalRef: t.string({ required: false }),
  }),
})

export const CreateCourseDiscussionThreadInput = builder.inputType(
  'CreateCourseDiscussionThreadInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      content: t.string({ required: true }),
      scope: t.field({ type: DiscussionScopeInput, required: true }),
      scopeLabel: t.string({ required: false }),
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

export interface IDiscussionScope extends DB.DiscussionScope {}
export const DiscussionScopeRef =
  builder.objectRef<IDiscussionScope>('DiscussionScope')
export const DiscussionScope = DiscussionScopeRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    spaceId: t.exposeInt('spaceId'),
    scopeType: t.expose('scopeType', { type: DiscussionScopeType }),
    scopeKey: t.exposeString('scopeKey'),
    scopeLabel: t.exposeString('scopeLabel'),

    practiceQuizId: t.exposeString('practiceQuizId', { nullable: true }),
    stackId: t.exposeInt('stackId', { nullable: true }),
    instanceId: t.exposeInt('instanceId', { nullable: true }),
    liveBlockId: t.exposeInt('liveBlockId', { nullable: true }),
    externalSource: t.exposeString('externalSource', { nullable: true }),
    externalRef: t.exposeString('externalRef', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export interface IDiscussionReply extends DB.DiscussionReply {
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

    authorParticipantId: t.exposeString('authorParticipantId', {
      nullable: true,
    }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export interface IDiscussionThread extends DB.DiscussionThread {
  scope: DB.DiscussionScope
  replies: IDiscussionReply[]
  sourceKey?: string
  sourceLabel?: string
  liveQuizId?: string | null
  liveQuizName?: string | null
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

    authorParticipantId: t.exposeString('authorParticipantId', {
      nullable: true,
    }),

    upvotes: t.exposeInt('upvotes'),
    hasUpvoted: t.exposeBoolean('hasUpvoted', { nullable: true }),
    replyCount: t.exposeInt('replyCount'),
    lastActivityAt: t.expose('lastActivityAt', { type: 'Date' }),

    sourceKey: t.exposeString('sourceKey', { nullable: true }),
    sourceLabel: t.exposeString('sourceLabel', { nullable: true }),
    liveQuizId: t.exposeID('liveQuizId', { nullable: true }),
    liveQuizName: t.exposeString('liveQuizName', { nullable: true }),

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
    isAccessible: t.exposeBoolean('isAccessible'),
  }),
})

export const DiscussionScopeSummaryRef =
  builder.objectRef<DiscussionScopeSummary>('DiscussionScopeSummary')
export const DiscussionScopeSummaryObject = DiscussionScopeSummaryRef.implement(
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      spaceId: t.exposeInt('spaceId'),
      scopeType: t.expose('scopeType', { type: DiscussionScopeType }),
      scopeKey: t.exposeString('scopeKey'),
      scopeLabel: t.exposeString('scopeLabel'),

      threadCount: t.exposeInt('threadCount'),
      lastActivityAt: t.expose('lastActivityAt', {
        type: 'Date',
        nullable: true,
      }),

      sourceKey: t.exposeString('sourceKey'),
      sourceLabel: t.exposeString('sourceLabel'),
      spaceType: t.expose('spaceType', { type: DiscussionSpaceType }),
      liveQuizId: t.exposeID('liveQuizId', { nullable: true }),
      liveQuizName: t.exposeString('liveQuizName', { nullable: true }),
    }),
  }
)

export const CourseDiscussionOverviewGroupRef =
  builder.objectRef<CourseDiscussionOverviewGroup>(
    'CourseDiscussionOverviewGroup'
  )
export const CourseDiscussionOverviewGroupObject =
  CourseDiscussionOverviewGroupRef.implement({
    fields: (t) => ({
      sourceKey: t.exposeString('sourceKey'),
      sourceLabel: t.exposeString('sourceLabel'),
      spaceType: t.expose('spaceType', { type: DiscussionSpaceType }),
      liveQuizId: t.exposeID('liveQuizId', { nullable: true }),
      liveQuizName: t.exposeString('liveQuizName', { nullable: true }),
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
