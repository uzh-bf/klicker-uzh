// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import EventEmitter from 'node:events'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { handlers } from '@klicker-uzh/graphql'
import type { PreparedHatchetTasks } from '@klicker-uzh/hatchet'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import { toSafeError } from '@klicker-uzh/logging/node'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import logger from './logger.js'

const HATCHET_WORKER_NAME =
  process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general'

function selectWorkflows(workflows: PreparedHatchetTasks) {
  // Select which workflows to load using an env var and keep it type-safe.
  // If no env var is provided, default to ALL available workflows dynamically.
  const defaultWorkflowKeys = Object.keys(workflows) as Array<
    keyof PreparedHatchetTasks
  >

  // Parse requested keys; treat empty/whitespace as "unset" so we default to all
  const envRaw = process.env.HATCHET_WORKFLOWS
  const requestedKeysRaw = envRaw
    ? envRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined

  const hasRequested =
    Array.isArray(requestedKeysRaw) && requestedKeysRaw.length > 0

  const validSelectedKeys = (
    hasRequested
      ? requestedKeysRaw.filter(
          (k): k is keyof PreparedHatchetTasks => k in workflows
        )
      : defaultWorkflowKeys
  ) as Array<keyof PreparedHatchetTasks>

  if (hasRequested) {
    const unknown = requestedKeysRaw.filter((k) => !(k in workflows))
    if (unknown.length) {
      logger.warn(
        {
          event: 'hatchet.workflow.selection.invalid',
          unknownKeys: unknown,
          availableKeys: Object.keys(workflows),
        },
        'HATCHET_WORKFLOWS contains unknown task keys'
      )
    }
  }

  return {
    selectedKeys: validSelectedKeys,
    workflows: validSelectedKeys.map((key) => workflows[key]),
  }
}

async function main() {
  logger.info(
    {
      event: 'hatchet.worker.starting',
      workerName: HATCHET_WORKER_NAME,
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

  logger.info({ event: 'hatchet.client.connecting' }, 'Connecting to Hatchet')

  const preparedWorkflows = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub,
    emitter,
    redisExec,
    redisAssessmentExec,
    redisCache,
    handlers,
  })

  const { selectedKeys, workflows } = selectWorkflows(preparedWorkflows)
  logger.info(
    {
      event: 'hatchet.workflow.selected',
      selectedKeys,
    },
    'Selected Hatchet workflows'
  )

  logger.info(
    {
      event: 'hatchet.worker.creating',
      workerName: HATCHET_WORKER_NAME,
      workflowCount: workflows.length,
    },
    'Creating Hatchet worker'
  )

  const worker = await hatchetClient.worker(HATCHET_WORKER_NAME, {
    workflows,
  })

  await worker.start()

  logger.info(
    {
      event: 'hatchet.worker.started',
      workerName: HATCHET_WORKER_NAME,
      workflowCount: workflows.length,
    },
    'Hatchet worker is ready'
  )
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
