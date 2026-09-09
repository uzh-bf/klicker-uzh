import type { HatchetHandlers } from '@klicker-uzh/types'

export { default as enhanceContext, type Context } from './lib/context.js'
export {
  getImportExportErrorCode,
  ImportExportErrorCode,
} from './lib/importExportErrors.js'
export {
  getImportExportStartupResponsibilities,
  initializeImportExportRuntimeConfig,
} from './lib/importExportRuntimeConfig.js'
export { assertImportExportTokenSecretConfig } from './lib/importExportTokenSecret.js'
export { getLocalImportedMediaDownload } from './services/mediaStorage.js'
export {
  assertImportExportPackageStorageConfig,
  downloadLocalElementExportPackage,
  isLocalImportExportPackageStorageEnabled,
  uploadPreparedElementImportPackage,
} from './services/packageStorage.js'
export { getChatModelRegistry } from './services/chatbots.js'

import builder from './builder.js'

import './schema/achievement.js'
import './schema/activities.js'
import './schema/assessment.js'
import './schema/course.js'
import './schema/element.js'
import './schema/elementData.js'
import './schema/elementImportExport.js'
import './schema/elementSpreadsheet.js'
import './schema/evaluation.js'
import './schema/groupActivity.js'
import './schema/mediaUpload.js'
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

import { handleProcessCourseDeletion } from './services/courseDeletion.js'
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
  handleRefreshImportExportFingerprints,
  handleRepairImportExportFingerprints,
} from './services/importExportFingerprintMaintenance.js'
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
import { handleCleanupImportExportPackages } from './services/packageStorage.js'
import { handleUpdateWeeklyTimelineEntries } from './services/participants.js'
import { handlePublishScheduledPracticeQuiz } from './services/practiceQuizzes.js'

export const schema = builder.toSchema({
  schemaDirectives: {
    // oneOf: upperDirectiveTransformer,
  },
})

export const handlers: HatchetHandlers = {
  handleRefreshImportExportFingerprints,
  handleRepairImportExportFingerprints,
  handleFinalRandomGroupAssignments,
  handleRunningRandomGroupAssignments,
  handleUpdateGroupAverageScores,
  handleSendPushNotifications,
  handleSendTeamsNotification,
  handleUpdateWeeklyTimelineEntries,
  handleCleanupImportExportPackages,
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
  handleProcessCourseDeletion,
}
