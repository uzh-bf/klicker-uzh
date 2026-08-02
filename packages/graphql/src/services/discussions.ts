export { CourseDiscussionPostFailureCode } from './discussions/types.js'
export type {
  CourseDiscussionEmbeddingInfo,
  CourseDiscussionOverview,
  CourseDiscussionOverviewArgs,
  CourseDiscussionOverviewGroup,
  CourseDiscussionReplyPostResult,
  CourseDiscussionThreadPostResult,
  CourseDiscussionThreadsArgs,
  CreateCourseDiscussionReplyArgs,
  CreateCourseDiscussionThreadArgs,
  DiscussionScopeInput,
  DiscussionThreadPage,
  GenerateCourseDiscussionEmbeddingInfoArgs,
} from './discussions/types.js'

export { generateCourseDiscussionEmbeddingInfo } from './discussions/embeds.js'
export {
  deleteCourseDiscussionReply,
  deleteCourseDiscussionThread,
  toggleCourseDiscussionReplyUpvote,
  toggleCourseDiscussionThreadUpvote,
} from './discussions/interactions.js'
export {
  createCourseDiscussionReply,
  createCourseDiscussionReplyResult,
  createCourseDiscussionThread,
  createCourseDiscussionThreadResult,
} from './discussions/posting.js'
export {
  courseDiscussionOverview,
  courseDiscussionThreads,
} from './discussions/queries.js'
