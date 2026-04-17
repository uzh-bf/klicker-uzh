// Dedicated Hatchet worker for the learning-analytics recompute pipeline.
// Runs only the `recomputeLearningAnalytics` task by default so its container
// can ship with Python + uv + apps/analytics without bloating the general worker.

import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { handlers } from '@klicker-uzh/graphql'
import type { PreparedHatchetTasks } from '@klicker-uzh/hatchet'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import EventEmitter from 'events'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import logger from './logger.js'

const HATCHET_WORKER_NAME =
  process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-analytics'

// Default set of workflows to register on this worker. The general worker picks
// up everything else — this worker is specifically for the heavy Python pipeline.
const DEFAULT_WORKFLOW_KEYS: Array<keyof PreparedHatchetTasks> = [
  'recomputeLearningAnalytics',
]

function selectWorkflows(workflows: PreparedHatchetTasks) {
  // HATCHET_WORKFLOWS overrides the default selection for this worker. Empty /
  // whitespace / unset falls back to DEFAULT_WORKFLOW_KEYS (not all workflows —
  // this worker is intentionally scoped).
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
      : DEFAULT_WORKFLOW_KEYS
  ) as Array<keyof PreparedHatchetTasks>

  if (hasRequested) {
    const unknown = requestedKeysRaw.filter((k) => !(k in workflows))
    if (unknown.length) {
      logger.warn(
        {
          unknownKeys: unknown,
          availableKeys: Object.keys(workflows),
        },
        'HATCHET_WORKFLOWS contains unknown task keys'
      )
    }
  }

  return validSelectedKeys.map((k) => workflows[k])
}

async function main() {
  logger.info({ workerName: HATCHET_WORKER_NAME }, 'Starting Hatchet worker')

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
  })

  const workflows = selectWorkflows(preparedWorkflows)
  const selectedKeys = Object.keys(preparedWorkflows).filter((k) =>
    workflows.includes((preparedWorkflows as any)[k])
  )
  logger.info({ selectedKeys }, 'Selected workflows')

  if (!process.env.ANALYTICS_CWD) {
    logger.warn(
      'ANALYTICS_CWD is not set — the recompute handler will refuse to run. ' +
        'Point it at the apps/analytics directory inside this container.'
    )
  }

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
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception')
  process.exit(1)
})

await main()
