// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import EventEmitter from 'node:events'
import { createServer } from 'node:http'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { renderAssessmentAuditPrometheusMetrics } from '@klicker-uzh/audit'
import { handlers, settleKbKnowledgeGraphResult } from '@klicker-uzh/graphql'
import {
  createHatchetWorkerRuntime,
  getKBGraphTerminalResult,
  hatchetClient,
  prepareHatchetTasks,
  resolveWorkerRuntimeConfig,
} from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import logger from './logger.js'
import {
  selectWorkflows,
  validateKBWorkerConfiguration,
} from './workflowSelection.js'

function startAuditMetricsServer(): void {
  const portValue = process.env.ASSESSMENT_AUDIT_METRICS_PORT
  if (portValue === undefined || portValue === '') {
    return
  }
  const port = Number(portValue)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('ASSESSMENT_AUDIT_METRICS_PORT must be a valid port')
  }
  const environment = process.env.ASSESSMENT_AUDIT_ENVIRONMENT ?? 'unknown'
  const role = process.env.ASSESSMENT_AUDIT_WORKER_ROLE ?? 'general'
  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('ok\n')
      return
    }
    if (request.url === '/metrics') {
      response.writeHead(200, {
        'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      })
      response.end(renderAssessmentAuditPrometheusMetrics(environment, role))
      return
    }
    response.writeHead(404, { 'content-type': 'text/plain' })
    response.end('not found\n')
  })
  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Assessment audit metrics server listening')
  })
}

async function main() {
  const auditWorkerEnabled =
    process.env.ASSESSMENT_AUDIT_WORKER_ENABLED === 'true'
  const integrationState = auditWorkerEnabled
    ? { ingestionDisabled: true, graphDisabled: true }
    : validateKBWorkerConfiguration()
  const runtimeConfig = resolveWorkerRuntimeConfig('general')
  logger.info(
    { workerName: runtimeConfig.name, ...integrationState },
    'Starting Hatchet worker'
  )

  startAuditMetricsServer()

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
    auditWorkerEnabled,
    auditWorkerRole: process.env.ASSESSMENT_AUDIT_WORKER_ROLE,
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
    { workerName: runtimeConfig.name, workflowCount: workflows.length },
    'Creating Hatchet worker'
  )

  const runtime = createHatchetWorkerRuntime({
    config: runtimeConfig,
    workflows,
    workerFactory: (name, options) => hatchetClient.worker(name, options),
  })

  logger.info('Starting worker to process jobs...')
  await runtime.start()

  logger.info('Worker runtime stopped after termination')
  // The drain is complete here, but the Redis and Prisma clients opened above
  // keep the event loop alive and node runs as PID 1, so exit explicitly
  // instead of waiting for the kubelet's SIGKILL at the end of the grace period.
  process.exit(0)
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
