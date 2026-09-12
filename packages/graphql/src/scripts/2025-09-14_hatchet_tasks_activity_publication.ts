import {
  getKBGraphTerminalResult,
  hatchetClient,
  prepareHatchetTasks,
} from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import { PublicationStatus } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import {
  handleEndExpiredGroupActivity,
  handleFinalRandomGroupAssignments,
  handlePublishScheduledGroupActivity,
  handleRunningRandomGroupAssignments,
  handleUpdateGroupAverageScores,
} from '../services/groups.js'
import { settleKbKnowledgeGraphResult } from '../services/knowledge.js'
import {
  handleAssessmentLiveQuizBlockClosureAggregation,
  handlePublishScheduledLiveQuiz,
  handleStandardLiveQuizBlockClosureAggregation,
} from '../services/liveQuizzes.js'
import {
  handleEndExpiredMicroLearning,
  handlePublishScheduledMicroLearning,
} from '../services/microLearning.js'
import {
  handleSendPushNotifications,
  handleSendTeamsNotification,
} from '../services/notifications.js'
import { handleUpdateWeeklyTimelineEntries } from '../services/participants.js'
import { handlePublishScheduledPracticeQuiz } from '../services/practiceQuizzes.js'

const DRY_RUN = false

// ! INFORMATION
// The publication and completion workflows for all activity types has been migrated from cronjobs to a Hatchet-based approach.
// -> This script adds scheduled hatchet tasks for all scheduled activities with an automatic publication date and all
//    ongoing asynchronous activities with a defined completion date.

async function run() {
  const emitter = new EventEmitter()
  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT) ?? 6379,
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

  const redisAssessmentExec = new Redis({
    family: 4,
    host: process.env.REDIS_ASSESSMENT_HOST ?? 'localhost',
    password: process.env.REDIS_ASSESSMENT_PASS ?? '',
    port: Number(process.env.REDIS_ASSESSMENT_PORT ?? 6381),
    tls: process.env.REDIS_ASSESSMENT_TLS ? {} : undefined,
  })

  // get all hatchet tasks
  const tasks = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub: {} as any,
    emitter,
    redisExec,
    redisAssessmentExec,
    handlers: {
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
    },
    getKBGraphTerminalResult,
    settleKBGraphTerminalResult: ({
      buildId,
      result,
      finishedAt,
      allowLateSuccess,
    }) =>
      settleKbKnowledgeGraphResult(
        prisma,
        { buildId, result, allowLateSuccess },
        finishedAt
      ),
  })

  // get all live quizzes that are scheduled for publication and add a corresponding hatchet task instance
  const scheduledLiveQuizzes = await prisma.liveQuiz.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      scheduledPublicationTaskId: null,
      availableFrom: { not: null },
    },
  })

  console.log(
    `Found ${scheduledLiveQuizzes.length} live quizzes scheduled for publication.`
  )

  let lqCounter = 0
  for (const lq of scheduledLiveQuizzes) {
    console.log(
      `Scheduling hatchet task for live quiz publication at ${lq.availableFrom!.toISOString()}: ${++lqCounter}/${scheduledLiveQuizzes.length} (ID ${lq.id})`
    )

    try {
      if (!DRY_RUN) {
        const scheduledTask = await tasks.publishScheduledLiveQuiz.schedule(
          lq.availableFrom!,
          { liveQuizId: lq.id }
        )
        const taskId = scheduledTask.metadata.id
        await prisma.liveQuiz.update({
          where: { id: lq.id },
          data: { scheduledPublicationTaskId: taskId },
        })
      }
    } catch (error) {
      console.error(
        `Failed to schedule hatchet task for live quiz ${lq.id}:`,
        error
      )
    }
  }

  // get all practice quizzes that are scheduled for publication and add a corresponding hatchet task instance
  const scheduledPracticeQuizzes = await prisma.practiceQuiz.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      scheduledPublicationTaskId: null,
      availableFrom: { not: null },
    },
  })

  console.log(
    `Found ${scheduledPracticeQuizzes.length} practice quizzes scheduled for publication.`
  )

  let pqCounter = 0
  for (const pq of scheduledPracticeQuizzes) {
    console.log(
      `Scheduling hatchet task for practice quiz publication at ${pq.availableFrom!.toISOString()}: ${++pqCounter}/${scheduledPracticeQuizzes.length} (ID ${pq.id})`
    )

    try {
      if (!DRY_RUN) {
        const scheduledTask = await tasks.publishScheduledPracticeQuiz.schedule(
          pq.availableFrom!,
          { practiceQuizId: pq.id }
        )
        const taskId = scheduledTask.metadata.id
        await prisma.practiceQuiz.update({
          where: { id: pq.id },
          data: { scheduledPublicationTaskId: taskId },
        })
      }
    } catch (error) {
      console.error(
        `Failed to schedule hatchet task for practice quiz ${pq.id}:`,
        error
      )
    }
  }

  // get all microlearnings that are scheduled for publication or ongoing and add corresponding hatchet task instances
  const scheduledMicroLearnings = await prisma.microLearning.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      scheduledPublicationTaskId: null,
    },
  })

  console.log(
    `Found ${scheduledMicroLearnings.length} scheduled microlearnings.`
  )

  let mlCounter = 0
  for (const ml of scheduledMicroLearnings) {
    console.log(
      `Scheduling hatchet task for microlearning publication at ${ml.scheduledStartAt.toISOString()}: ${++mlCounter}/${scheduledMicroLearnings.length} (ID ${ml.id})`
    )

    try {
      if (!DRY_RUN) {
        const scheduledTask =
          await tasks.publishScheduledMicroLearning.schedule(
            ml.scheduledStartAt,
            { microLearningId: ml.id }
          )
        const taskId = scheduledTask.metadata.id
        await prisma.microLearning.update({
          where: { id: ml.id },
          data: { scheduledPublicationTaskId: taskId },
        })
      }
    } catch (error) {
      console.error(
        `Failed to schedule hatchet task for microlearning ${ml.id}:`,
        error
      )
    }
  }

  const publishedMicroLearnings = await prisma.microLearning.findMany({
    where: {
      status: PublicationStatus.PUBLISHED,
      scheduledCompletionTaskId: null,
    },
  })

  console.log(
    `Found ${publishedMicroLearnings.length} published microlearnings with end date.`
  )

  let pmlCounter = 0
  for (const ml of publishedMicroLearnings) {
    console.log(
      `Scheduling hatchet task for microlearning completion at ${ml.scheduledEndAt.toISOString()}: ${++pmlCounter}/${publishedMicroLearnings.length} (ID ${ml.id})`
    )

    try {
      if (!DRY_RUN) {
        const scheduledTask = await tasks.endExpiredMicroLearning.schedule(
          ml.scheduledEndAt,
          { microLearningId: ml.id }
        )
        const taskId = scheduledTask.metadata.id
        await prisma.microLearning.update({
          where: { id: ml.id },
          data: { scheduledCompletionTaskId: taskId },
        })
      }
    } catch (error) {
      console.error(
        `Failed to schedule hatchet task for microlearning ${ml.id}:`,
        error
      )
    }
  }

  // get all group activities that are scheduled for publication or ongoing and add corresponding hatchet task instances
  const scheduledGroupActivities = await prisma.groupActivity.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      scheduledPublicationTaskId: null,
    },
  })

  console.log(
    `Found ${scheduledGroupActivities.length} scheduled group activities.`
  )

  let gaCounter = 0
  for (const ga of scheduledGroupActivities) {
    console.log(
      `Scheduling hatchet task for group activity publication at ${ga.scheduledStartAt.toISOString()}: ${++gaCounter}/${scheduledGroupActivities.length} (ID ${ga.id})`
    )

    try {
      if (!DRY_RUN) {
        const scheduledTask =
          await tasks.publishScheduledGroupActivity.schedule(
            ga.scheduledStartAt,
            { groupActivityId: ga.id }
          )
        const taskId = scheduledTask.metadata.id
        await prisma.groupActivity.update({
          where: { id: ga.id },
          data: { scheduledPublicationTaskId: taskId },
        })
      }
    } catch (error) {
      console.error(
        `Failed to schedule hatchet task for group activity ${ga.id}:`,
        error
      )
    }
  }

  const publishedGroupActivities = await prisma.groupActivity.findMany({
    where: {
      status: PublicationStatus.PUBLISHED,
      scheduledCompletionTaskId: null,
    },
  })

  console.log(
    `Found ${publishedGroupActivities.length} published group activities with end date.`
  )

  let pgaCounter = 0
  for (const ga of publishedGroupActivities) {
    console.log(
      `Scheduling hatchet task for group activity completion at ${ga.scheduledEndAt.toISOString()}: ${++pgaCounter}/${publishedGroupActivities.length} (ID ${ga.id})`
    )

    try {
      if (!DRY_RUN) {
        const scheduledTask = await tasks.endExpiredGroupActivity.schedule(
          ga.scheduledEndAt,
          { groupActivityId: ga.id }
        )
        const taskId = scheduledTask.metadata.id
        await prisma.groupActivity.update({
          where: { id: ga.id },
          data: { scheduledCompletionTaskId: taskId },
        })
      }
    } catch (error) {
      console.error(
        `Failed to schedule hatchet task for group activity ${ga.id}:`,
        error
      )
    }
  }

  // return / exit the process
  return process.exit(0)
}

await run()
