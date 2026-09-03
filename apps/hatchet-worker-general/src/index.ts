// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import EventEmitter from 'node:events'
import { createServer } from 'node:http'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { renderAssessmentAuditPrometheusMetrics } from '@klicker-uzh/audit'
import { handlers } from '@klicker-uzh/graphql'
import type { PreparedHatchetTasks } from '@klicker-uzh/hatchet'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import logger from './logger.js'

const HATCHET_WORKER_NAME =
  process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general'

function selectWorkflows(workflows: PreparedHatchetTasks) {
  // Select which workflows to load using an env var and keep it type-safe.
  // Privileged audit workflows require an explicit dedicated-worker opt-in.
  const auditWorkflowKeys = new Set<keyof PreparedHatchetTasks>([
    'dispatchAssessmentAuditOutbox',
    'monitorAssessmentAudit',
  ])
  const auditWorkerEnabled =
    process.env.ASSESSMENT_AUDIT_WORKER_ENABLED === 'true'
  const allowedWorkflowKeys = new Set(
    (Object.keys(workflows) as Array<keyof PreparedHatchetTasks>).filter(
      (key) =>
        auditWorkerEnabled
          ? auditWorkflowKeys.has(key)
          : !auditWorkflowKeys.has(key)
    )
  )

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
          (k): k is keyof PreparedHatchetTasks =>
            k in workflows &&
            allowedWorkflowKeys.has(k as keyof PreparedHatchetTasks)
        )
      : [...allowedWorkflowKeys]
  ) as Array<keyof PreparedHatchetTasks>

  if (hasRequested) {
    const unknown = requestedKeysRaw.filter((k) => !(k in workflows))
    if (unknown.length) {
      if (auditWorkerEnabled) {
        throw new Error(
          `HATCHET_WORKFLOWS contains unknown tasks for the audit worker: ${unknown.join(', ')}`
        )
      }
      logger.warn(
        {
          unknownKeys: unknown,
          availableKeys: Object.keys(workflows),
        },
        'HATCHET_WORKFLOWS contains unknown task keys'
      )
    }
  }

  if (hasRequested) {
    const forbidden = requestedKeysRaw.filter(
      (key) =>
        key in workflows &&
        !allowedWorkflowKeys.has(key as keyof PreparedHatchetTasks)
    )
    if (forbidden.length > 0) {
      throw new Error(
        `HATCHET_WORKFLOWS contains tasks forbidden for this worker identity: ${forbidden.join(', ')}`
      )
    }
  }

  const selectedKeySet = new Set(validSelectedKeys)
  if (
    auditWorkerEnabled &&
    (selectedKeySet.size !== auditWorkflowKeys.size ||
      validSelectedKeys.length !== selectedKeySet.size ||
      [...auditWorkflowKeys].some((key) => !selectedKeySet.has(key)))
  ) {
    throw new Error(
      'The audit worker must select every required audit workflow exactly'
    )
  }

  const selectedWorkflows = validSelectedKeys.map((k) => workflows[k])

  return selectedWorkflows
}

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
      response.end(renderAssessmentAuditPrometheusMetrics(environment))
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
  logger.info({ workerName: HATCHET_WORKER_NAME }, 'Starting Hatchet worker')
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
  })

  const workflows = selectWorkflows(preparedWorkflows)
  const selectedKeys = (
    Object.keys(preparedWorkflows) as Array<keyof PreparedHatchetTasks>
  ).filter((key) => workflows.includes(preparedWorkflows[key]))
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
