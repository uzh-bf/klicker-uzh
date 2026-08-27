import type { HatchetHandlers } from '@klicker-uzh/types'

export { default as enhanceContext } from './lib/context.js'
export { getChatModelRegistry } from './services/chatbots.js'

import builder from './builder.js'

import './schema/achievement.js'
import './schema/activities.js'
import './schema/assessment.js'
import './schema/course.js'
import './schema/element.js'
import './schema/elementData.js'
import './schema/evaluation.js'
import './schema/groupActivity.js'
import './schema/microLearning.js'
import './schema/participant.js'
import './schema/participantInvitation.js'
import './schema/resource.js'
import './schema/sharing.js'
import './schema/template.js'
import './schema/user.js'
import './schema/verification.js'

import './schema/mutation.js'
import './schema/query.js'
import './schema/subscription.js'

// TEMPLATE for future directives
// function upperDirectiveTransformer(schema: any) {
//   throw new Error('Not implemented')
//   console.error(schema)
//   return mapSchema(schema, {
//     [MapperKind.INPUT_OBJECT_TYPE]: (fieldConfig) => {
//       console.log(fieldConfig)
//       // Check whether this field has the specified directive

//       return fieldConfig
//     },
//   })
// }

import {
  handleProcessCourseDeletion,
  handleSweepStaleCourseDeletions,
} from './services/courseDeletion.js'
import {
  handleProcessCourseDuplication,
  handleSweepStaleCourseDuplications,
} from './services/courseDuplication.js'
import {
  handleEndExpiredGroupActivity,
  handleFinalRandomGroupAssignments,
  handlePublishScheduledGroupActivity,
  handleRunningRandomGroupAssignments,
  handleUpdateGroupAverageScores,
} from './services/groups.js'
import {
  handleAssessmentLiveQuizBlockClosureAggregation,
  handlePublishScheduledLiveQuiz,
  handleStandardLiveQuizBlockClosureAggregation,
} from './services/liveQuizzes.js'
import {
  handleEndExpiredMicroLearning,
  handlePublishScheduledMicroLearning,
} from './services/microLearning.js'
import {
  handleSendPushNotifications,
  handleSendTeamsNotification,
} from './services/notifications.js'
import { handleUpdateWeeklyTimelineEntries } from './services/participants.js'
import { handlePublishScheduledPracticeQuiz } from './services/practiceQuizzes.js'

export const schema = builder.toSchema({
  schemaDirectives: {
    // oneOf: upperDirectiveTransformer,
  },
})

export const handlers: HatchetHandlers = {
  handleFinalRandomGroupAssignments,
  handleRunningRandomGroupAssignments,
  handleUpdateGroupAverageScores,
  handleSendPushNotifications,
  handleSendTeamsNotification,
  handleUpdateWeeklyTimelineEntries,
  handleEndExpiredGroupActivity,
  handleEndExpiredMicroLearning,
  handlePublishScheduledLiveQuiz,
  handlePublishScheduledPracticeQuiz,
  handlePublishScheduledGroupActivity,
  handlePublishScheduledMicroLearning,
  handleStandardLiveQuizBlockClosureAggregation,
  handleAssessmentLiveQuizBlockClosureAggregation,
  handleProcessCourseDeletion,
  handleProcessCourseDuplication,
  handleSweepStaleCourseDeletions,
  handleSweepStaleCourseDuplications,
}
