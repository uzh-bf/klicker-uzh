// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import EventEmitter from 'node:events'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { handlers, settleKbKnowledgeGraphResult } from '@klicker-uzh/graphql'
import {
  createHatchetWorkerRuntime,
  getKBGraphTerminalResult,
  hatchetClient,
  prepareHatchetTasks,
  resolveWorkerRuntimeConfig,
} from '@klicker-uzh/hatchet'
import { toSafeError } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import logger from './logger.js'
import {
  selectWorkflows,
  validateKBWorkerConfiguration,
} from './workflowSelection.js'

async function main() {
  const integrationState = validateKBWorkerConfiguration()
  const runtimeConfig = resolveWorkerRuntimeConfig('general')
  logger.info(
    {
      event: 'hatchet.worker.starting',
      workerName: runtimeConfig.name,
      ...integrationState,
    },
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

  logger.info({ event: 'hatchet.worker.connecting' }, 'Connecting to Hatchet')

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
        event: 'hatchet.workflow.selection.invalid',
        unknownKeyCount: selection.unknownKeys.length,
        availableKeyCount: Object.keys(preparedWorkflows).length,
      },
      'HATCHET_WORKFLOWS contains unknown task keys'
    )
  }
  if (selection.disabledKeys.length > 0) {
    logger.info(
      {
        event: 'hatchet.workflow.disabled',
        disabledWorkflowCount: selection.disabledKeys.length,
      },
      'KB integration gates excluded workflows'
    )
  }
  const { workflows, selectedKeys } = selection
  logger.info(
    { event: 'hatchet.workflow.selected', workflowCount: selectedKeys.length },
    'Selected workflows'
  )

  logger.info(
    {
      event: 'hatchet.worker.creating',
      workerName: runtimeConfig.name,
      workflowCount: workflows.length,
    },
    'Creating Hatchet worker'
  )

  const runtime = createHatchetWorkerRuntime({
    config: runtimeConfig,
    workflows,
    workerFactory: (name, options) => hatchetClient.worker(name, options),
  })

  logger.info(
    { event: 'hatchet.worker.starting_jobs' },
    'Starting worker to process jobs'
  )
  await runtime.start()

  logger.info(
    { event: 'hatchet.worker.stopped' },
    'Worker runtime stopped after termination'
  )
  // The drain is complete here, but the Redis and Prisma clients opened above
  // keep the event loop alive and node runs as PID 1, so exit explicitly
  // instead of waiting for the kubelet's SIGKILL at the end of the grace period.
  process.exit(0)
}

process.on('unhandledRejection', () => {
  logger.fatal(
    {
      event: 'process.unhandled_rejection',
      err: toSafeError('Unhandled rejection'),
    },
    'Unhandled promise rejection'
  )
  // Let the process crash; orchestration should restart it
  process.exit(1)
})

process.on('uncaughtException', () => {
  logger.fatal(
    {
      event: 'process.uncaught_exception',
      err: toSafeError('Uncaught exception'),
    },
    'Uncaught exception'
  )
  process.exit(1)
})

await main()
