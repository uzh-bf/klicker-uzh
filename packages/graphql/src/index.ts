import type { HatchetHandlers } from '@klicker-uzh/types'

export { default as enhanceContext } from './lib/context.js'
export { getChatModelRegistry } from './services/chatbots.js'
export { settleKbKnowledgeGraphResult } from './services/knowledge.js'
export {
  handleKBSourceGateway,
  type KBSourceGatewayResult,
} from './services/knowledgeSourceGateway.js'
export {
  handleKBIngestionWebhook,
  signKBIngestionWebhook,
} from './services/knowledgeWebhooks.js'
export {
  createQuestionGenerationRuntimeFromEnv as createElementGenerationRuntimeFromEnv,
  type QuestionGenerationRuntime as ElementGenerationRuntime,
} from './services/questionGenerationRuntime.js'

import builder from './builder.js'

import './schema/achievement.js'
import './schema/activities.js'
import './schema/assessment.js'
import './schema/course.js'
import './schema/element.js'
import './schema/elementData.js'
import './schema/elementGeneration.js'
import './schema/evaluation.js'
import './schema/freeTextEvaluation.js'
import './schema/groupActivity.js'
import './schema/kbKnowledgeGraph.js'
import './schema/knowledge.js'
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
  handleProcessCourseDuplication,
  handleSweepStaleCourseDuplications,
} from './services/courseDuplication.js'
import {
  handleEvaluateFreeTextAttempt,
  handleEvaluateFreeTextAttemptFailure,
  handleReapStalledFreeTextAttempts,
} from './services/freeTextEvaluationHandler.js'
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
  handleEvaluateFreeTextAttempt,
  handleEvaluateFreeTextAttemptFailure,
  handleReapStalledFreeTextAttempts,
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
  handleProcessCourseDuplication,
  handleSweepStaleCourseDuplications,
}
