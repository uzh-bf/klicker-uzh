// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { handlers, settleKbKnowledgeGraphResult } from '@klicker-uzh/graphql'
import {
  getKBGraphTerminalResult,
  hatchetClient,
  prepareHatchetTasks,
} from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import EventEmitter from 'events'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import logger from './logger.js'
import {
  selectWorkflows,
  validateKBWorkerConfiguration,
} from './workflowSelection.js'

const HATCHET_WORKER_NAME =
  process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general'

async function main() {
  const integrationState = validateKBWorkerConfiguration()
  logger.info(
    { workerName: HATCHET_WORKER_NAME, ...integrationState },
    'Starting Hatchet worker'
  )

  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT ?? 6379),
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

  const redisAssessmentExec = new Redis({
    family: 4,
    host: process.env.REDIS_ASSESSMENT_HOST ?? 'localhost',
    password: process.env.REDIS_ASSESSMENT_PASS ?? '',
    port: Number(process.env.REDIS_ASSESSMENT_PORT ?? 6381),
    tls: process.env.REDIS_ASSESSMENT_TLS ? {} : undefined,
  })

  const redisCache = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT ?? 6380),
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const publishClient = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT ?? 6380),
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const subscribeClient = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT ?? 6380),
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const eventTarget = createRedisEventTarget({
    publishClient,
    subscribeClient,
  })

  const pubSub = createPubSub({ eventTarget })

  const emitter = new EventEmitter()

  logger.info('Connecting to Hatchet...')

  const preparedWorkflows = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub,
    emitter,
    redisExec,
    redisAssessmentExec,
    redisCache,
    handlers,
    getKBGraphTerminalResult,
    kbIngestionDispatchEnabled: !integrationState.ingestionDisabled,
    kbGraphDispatchEnabled: !integrationState.graphDisabled,
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

  const selection = selectWorkflows(preparedWorkflows, {
    ...integrationState,
    requestedWorkflowNames: process.env.HATCHET_WORKFLOWS,
  })
  if (selection.unknownKeys.length > 0) {
    logger.warn(
      {
        unknownKeys: selection.unknownKeys,
        availableKeys: Object.keys(preparedWorkflows),
      },
      'HATCHET_WORKFLOWS contains unknown task keys'
    )
  }
  if (selection.disabledKeys.length > 0) {
    logger.info(
      { disabledKeys: selection.disabledKeys },
      'KB integration gates excluded workflows'
    )
  }
  const { workflows, selectedKeys } = selection
  logger.info({ selectedKeys }, 'Selected workflows')

  logger.info(
    { workerName: HATCHET_WORKER_NAME, workflowCount: workflows.length },
    'Creating Hatchet worker'
  )

  const worker = await hatchetClient.worker(HATCHET_WORKER_NAME, {
    workflows,
  })

  logger.info('Starting worker to process jobs...')
  await worker.start()

  logger.info('Worker started successfully and ready to process jobs')
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection')
  // Let the process crash; orchestration should restart it
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception')
  process.exit(1)
})

await main()
