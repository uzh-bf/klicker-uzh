import * as DB from '@klicker-uzh/prisma/client'

export type DiscussionSort = 'ACTIVITY_DESC' | 'NEWEST_DESC' | 'UPVOTES_DESC'

export interface DiscussionSpaceInput {
  spaceType: DB.DiscussionSpaceType
  courseId: string
}

export interface DiscussionScopeInput {
  scopeType: DB.DiscussionScopeType
  stackId?: number | null
  externalSource?: string | null
  externalRef?: string | null
}

export interface CreateCourseDiscussionThreadArgs {
  courseId: string
  content: string
  scope: DiscussionScopeInput
  isAnonymous?: boolean | null
  embedToken?: string | null
}

export interface CreateCourseDiscussionReplyArgs {
  courseId: string
  threadId: number
  content: string
  isAnonymous?: boolean | null
  embedToken?: string | null
}

export interface CourseDiscussionThreadsArgs {
  courseId: string
  scopeKey?: string | null
  sort?: DiscussionSort | null
  limit?: number | null
  cursor?: string | null
  embedToken?: string | null
}

export interface CourseDiscussionOverviewArgs {
  courseId: string
  sort?: DiscussionSort | null
  limit?: number | null
  cursor?: string | null
}

export interface GetCourseDiscussionEmbeddingInfoArgs {
  courseId: string
  externalBlock?: {
    externalSource: string
    externalRef: string
  } | null
  allowAnonymous?: boolean | null
  expiresInHours?: number | null
}

type DiscussionReplyWithVotes = DB.Prisma.DiscussionReplyGetPayload<{
  include: {
    votes: {
      select: {
        participantId: true
      }
    }
  }
}>

type DiscussionThreadWithRelationsBase = DB.Prisma.DiscussionThreadGetPayload<{
  include: {
    scope: true
    space: true
    replies: {
      include: {
        votes: {
          select: {
            participantId: true
          }
        }
      }
    }
    votes: {
      select: {
        participantId: true
      }
    }
  }
}>

export interface DiscussionReplyWithRelations extends DiscussionReplyWithVotes {
  hasUpvoted?: boolean
}

export type DiscussionScopeWithPresentation =
  DiscussionThreadWithRelationsBase['scope'] & {
    stackType?: DB.ElementStackType | null
    stackOrder?: number | null
    stackDisplayName?: string | null
  }

export type DiscussionThreadWithRelations = Omit<
  DiscussionThreadWithRelationsBase,
  'scope' | 'replies'
> & {
  scope: DiscussionScopeWithPresentation
  replies: DiscussionReplyWithRelations[]

  sourceKey?: string
  sourceLabel?: string
  hasUpvoted?: boolean
}

export interface DiscussionThreadPage {
  threads: DiscussionThreadWithRelations[]
  nextCursor: string | null
  hasMore: boolean
  canPostAnonymously: boolean
  isAccessible: boolean
}

export interface CourseDiscussionOverviewGroup {
  sourceKey: string
  sourceLabel: string
  spaceType: DB.DiscussionSpaceType
  threads: DiscussionThreadWithRelations[]
}

export interface CourseDiscussionOverview {
  groups: CourseDiscussionOverviewGroup[]
  nextCursor: string | null
  hasMore: boolean
  totalThreads: number
}

export interface CourseDiscussionEmbeddingInfo {
  courseId: string
  scopeKey: string
  scopeLabel: string
  allowAnonymous: boolean
  expiresAt: Date
  embedToken: string
  embedUrl: string
}

export interface CourseEmbedClaims {
  sub: string
  scope: string
  version: number
  spaceType: DB.DiscussionSpaceType
  courseId: string
  scopeKey: string
  allowAnonymous: boolean
  iat?: number
  exp?: number
}

export interface ResolvedActor {
  participantId?: string
  userId?: string
}

export interface CanonicalScope {
  scopeType: DB.DiscussionScopeType
  scopeKey: string
  scopeLabel: string
  stackId?: number | null
  externalSource?: string | null
  externalRef?: string | null
}
