import {
  getKBGraphTerminalResult,
  hatchetClient,
  prepareHatchetTasks,
} from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import { PublicationStatus } from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'
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

// ! IMPORTANT INFORMATION
// This script will automatically trigger the database-based aggregation tasks for all completed assessment live quizzes in the system
// When reaching the last block of the assessment quiz, the hatchet task will automatically unlink any cache data of the quiz

const DRY_RUN = true

async function run() {
  const emitter = new EventEmitter()

  // connect to the assessment live quiz
  const redis = new Redis({
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
    redisExec: redis, // we only need to modify the assessment cache
    redisAssessmentExec: redis,
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

  // find all ended assessment live quizzes
  const endedAssessmentLiveQuizzes = await prisma.liveQuiz.findMany({
    where: {
      isAssessmentEnabled: true,
      finishedAt: { lt: new Date() },
      status: PublicationStatus.ENDED,
    },
    include: {
      blocks: {
        include: {
          elements: {
            include: { liveQuizResponses: { orderBy: { submittedAt: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })
  console.log(
    `Found ${endedAssessmentLiveQuizzes.length} ended assessment live quizzes.`
  )

  // toggle block closure tasks (-> will remove any cache data on last block)
  for (const quiz of endedAssessmentLiveQuizzes) {
    console.log(`Processing quiz ${quiz.id}...`)

    let blockCounter = 0
    for (const block of quiz.blocks) {
      // trigger block closure aggregation for assessment quizzes
      if (!DRY_RUN) {
        await tasks.aggregateLiveQuizBlockResultsAssessment.schedule(
          dayjs()
            .add(30 + blockCounter * 20, 'seconds')
            .toDate(),
          { liveQuizId: quiz.id, blockId: block.id }
        )
      }
      blockCounter++
    }
  }

  // return / exit the process
  return process.exit(0)
}

await run()
