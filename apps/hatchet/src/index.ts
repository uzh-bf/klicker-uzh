import { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  endExpiredGroupActivity,
  endExpiredMicroLearning,
  finalRandomGroupAssignmentsCron,
  publishScheduledGroupActivity,
  publishScheduledLiveQuiz,
  publishScheduledMicroLearning,
  publishScheduledPracticeQuiz,
  runningRandomGroupAssignmentsCron,
  sendPushNotificationsCron,
  updateGroupAverageScoresCron,
  updateWeeklyTimelineEntriesCron,
} from '@klicker-uzh/graphql'

// ! Hatchet setup
const validLogLevels = ['INFO', 'OFF', 'DEBUG', 'WARN', 'ERROR']
const hatchet = Hatchet.init({
  token: process.env.HATCHET_CLIENT_TOKEN,
  log_level:
    typeof process.env.HATCHET_LOG_LEVEL !== 'undefined' &&
    validLogLevels.some(
      (logLevel) => logLevel === process.env.HATCHET_LOG_LEVEL
    )
      ? (process.env.HATCHET_LOG_LEVEL as
          | 'INFO'
          | 'OFF'
          | 'DEBUG'
          | 'WARN'
          | 'ERROR')
      : 'INFO',
})

const publicationWorker = await hatchet.worker('activity-publications', {
  workflows: [
    publishScheduledMicroLearning(hatchet),
    publishScheduledPracticeQuiz(hatchet),
    publishScheduledGroupActivity(hatchet),
    publishScheduledLiveQuiz(hatchet),
  ],
  slots: 100,
})

const completionWorker = await hatchet.worker('activity-endings', {
  workflows: [
    endExpiredMicroLearning(hatchet),
    endExpiredGroupActivity(hatchet),
  ],
  slots: 100,
})

const cronjobWorker = await hatchet.worker('cron-jobs', {
  workflows: [
    updateGroupAverageScoresCron(hatchet),
    runningRandomGroupAssignmentsCron(hatchet),
    finalRandomGroupAssignmentsCron(hatchet),
    updateWeeklyTimelineEntriesCron(hatchet),
    sendPushNotificationsCron(hatchet),
  ],
})

// run all workers concurrently
publicationWorker.start()
completionWorker.start()
cronjobWorker.start()
