export type {
  CourseDiscussionEmbeddingInfo,
  CourseDiscussionOverview,
  CourseDiscussionOverviewArgs,
  CourseDiscussionOverviewGroup,
  CourseDiscussionThreadsArgs,
  CreateCourseDiscussionReplyArgs,
  CreateCourseDiscussionThreadArgs,
  DiscussionScopeInput,
  DiscussionSpaceInput,
  DiscussionThreadPage,
  GetCourseDiscussionEmbeddingInfoArgs,
} from './discussions/types.js'

export { getCourseDiscussionEmbeddingInfo } from './discussions/embeds.js'
export {
  deleteCourseDiscussionReply,
  deleteCourseDiscussionThread,
  toggleCourseDiscussionReplyUpvote,
  toggleCourseDiscussionThreadUpvote,
} from './discussions/interactions.js'
export {
  createCourseDiscussionReply,
  createCourseDiscussionThread,
} from './discussions/posting.js'
export {
  courseDiscussionOverview,
  courseDiscussionThreads,
} from './discussions/queries.js'
