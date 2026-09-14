// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import {
  assertImportExportPackageStorageConfig,
  getImportExportStartupResponsibilities,
  handlers,
  initializeImportExportRuntimeConfig,
} from '@klicker-uzh/graphql'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import EventEmitter from 'events'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import logger from './logger.js'
import {
  createWorkerHealthController,
  markWorkerReadyAfterRegistration,
  startWorkerHealthServer,
  waitForWorkerRegistration,
} from './workerHealth.js'
import { selectHatchetWorkflows } from './workflowSelection.js'

const HATCHET_WORKER_NAME =
  process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general'

function readHealthPort() {
  const value = process.env.HATCHET_HEALTH_PORT ?? '8081'
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error('HATCHET_HEALTH_PORT must be a positive integer.')
  }
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port > 65_535) {
    throw new Error('HATCHET_HEALTH_PORT must be between 1 and 65535.')
  }
  return port
}

async function main() {
  const importExportConfig = initializeImportExportRuntimeConfig()
  const importExportResponsibilities = getImportExportStartupResponsibilities(
    'general-worker',
    importExportConfig
  )
  if (importExportResponsibilities.requiresPackageStorage) {
    assertImportExportPackageStorageConfig()
  }
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

  const selected = selectHatchetWorkflows(preparedWorkflows, {
    requireImportExportMaintenance: importExportResponsibilities.maintenance,
  })
  logger.info({ selectedKeys: selected.keys }, 'Selected workflows')

  const health = createWorkerHealthController()
  const healthPort = readHealthPort()
  await startWorkerHealthServer({ controller: health, port: healthPort })
  logger.info({ healthPort }, 'Worker health server started')

  logger.info(
    {
      workerName: HATCHET_WORKER_NAME,
      workflowCount: selected.workflows.length,
    },
    'Creating Hatchet worker'
  )

  const worker = await hatchetClient.worker(HATCHET_WORKER_NAME, {
    workflows: selected.workflows,
  })

  logger.info('Starting worker to process jobs...')
  const workerRun = worker.start().catch((error) => {
    health.markControlPlaneLost()
    throw error
  })

  await markWorkerReadyAfterRegistration({
    controller: health,
    registration: waitForWorkerRegistration(worker.nonDurable),
    workerRun,
  })
  logger.info('Worker registered successfully and ready to process jobs')

  await workerRun
  health.markControlPlaneLost()
  throw new Error('Hatchet worker stopped unexpectedly.')
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
