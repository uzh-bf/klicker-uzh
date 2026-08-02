import * as DB from '@klicker-uzh/prisma/client'
import type {
  DiscussionReplyWithVotes,
  DiscussionThreadWithRelationsBase,
} from './relations.js'

export type DiscussionSort = 'ACTIVITY_DESC' | 'NEWEST_DESC' | 'UPVOTES_DESC'

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

export enum CourseDiscussionPostFailureCode {
  INVALID_INPUT = 'INVALID_INPUT',
  COURSE_QA_UNAVAILABLE = 'COURSE_QA_UNAVAILABLE',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INVALID_SCOPE = 'INVALID_SCOPE',
  INVALID_EMBED = 'INVALID_EMBED',
  RATE_LIMITED = 'RATE_LIMITED',
  THREAD_UNAVAILABLE = 'THREAD_UNAVAILABLE',
  REPLY_LIMIT_REACHED = 'REPLY_LIMIT_REACHED',
  POST_FAILED = 'POST_FAILED',
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

export interface GenerateCourseDiscussionEmbeddingInfoArgs {
  courseId: string
  externalBlock?: {
    externalSource: string
    externalRef: string
  } | null
  allowAnonymous?: boolean | null
  expiresInHours?: number | null
}

// Identifies the requesting viewer so mapped threads and replies can advertise
// whether to offer a delete affordance. Server-side authorization in
// canDeleteDiscussionContent stays the real gate.
export interface DiscussionViewer {
  participantId: string | null
  isModerator: boolean
}

export type DiscussionReplyWithRelations = DiscussionReplyWithVotes & {
  spaceId: number
  scopeId: number
  hasUpvoted?: boolean
  canDelete?: boolean
}

export type DiscussionScopeWithPresentation = Omit<
  DiscussionThreadWithRelationsBase['scope'],
  'space'
> & {
  stackType?: DB.ElementStackType | null
  stackOrder?: number | null
  stackDisplayName?: string | null
}

export type DiscussionThreadWithRelations = Omit<
  DiscussionThreadWithRelationsBase,
  'scope' | 'replies'
> & {
  spaceId: number
  scope: DiscussionScopeWithPresentation
  replies: DiscussionReplyWithRelations[]

  sourceKey?: string
  sourceLabel?: string
  hasUpvoted?: boolean
  canDelete?: boolean
}

export interface CourseDiscussionThreadPostResult {
  thread: DiscussionThreadWithRelations | null
  failureCode: CourseDiscussionPostFailureCode | null
}

export interface CourseDiscussionReplyPostResult {
  reply: DiscussionReplyWithRelations | null
  failureCode: CourseDiscussionPostFailureCode | null
}

export interface DiscussionThreadPage {
  threads: DiscussionThreadWithRelations[]
  nextCursor: string | null
  hasMore: boolean
  canPostAnonymously: boolean
  canPostIdentified: boolean
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
