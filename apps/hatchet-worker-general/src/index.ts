// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import EventEmitter from 'events'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'

async function main() {
  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT) ?? 6379,
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

  const redisCache = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const publishClient = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const subscribeClient = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const eventTarget = createRedisEventTarget({
    publishClient,
    subscribeClient,
  })

  const pubSub = createPubSub({ eventTarget })

  const emitter = new EventEmitter()

  const workflows = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub,
    emitter,
    redisExec,
    redisCache,
  })

  const worker = await hatchetClient.worker('hatchet-worker-general', {
    workflows: [
      workflows.endExpiredGroupActivityTask,
      workflows.endExpiredMicroLearningTask,
      workflows.updateGroupAverageScoresTask,
      workflows.runningRandomGroupAssignmentsTask,
      workflows.finalRandomGroupAssignmentsTask,
      workflows.updateWeeklyTimelineEntriesTask,
      workflows.sendPushNotificationsTask,
      workflows.publishScheduledGroupActivityTask,
      workflows.publishScheduledLiveQuizTask,
      workflows.publishScheduledMicroLearningTask,
      workflows.publishScheduledPracticeQuizTask,
    ],
  })

  await worker.start()
}

await main()
