import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import EventEmitter from 'events'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import type { Logger as PinoLogger } from 'pino'
import pino from 'pino'

import { hatchetClient } from './client.js'
import { prepareHatchetTasks } from './tasks.js'

type WorkerLogger = Pick<PinoLogger, 'info' | 'warn' | 'error' | 'fatal'>

/** Pino logger configured the same way across all Hatchet worker apps. */
export function createWorkerLogger(fallbackServiceName: string): PinoLogger {
  const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase()
  const isPretty =
    (process.env.NODE_ENV !== 'production' &&
      process.env.PINO_PRETTY !== 'false') ??
    false
  const transport = isPretty
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: true,
          translateTime: 'SYS:standard',
        },
      })
    : undefined

  return pino(
    {
      level,
      base: {
        service: process.env.HATCHET_WORKER_NAME ?? fallbackServiceName,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      messageKey: 'message',
    },
    transport as any
  )
}

/** Factory for the env-driven workflow selector used by each worker app.
 *
 *  Behaviour:
 *   - HATCHET_WORKFLOWS set -> take the intersection of requested keys and
 *     available workflows; warn about unknown keys
 *   - HATCHET_WORKFLOWS unset -> fall back to `defaultKeys` (allow-list),
 *     otherwise all workflows minus `excludeKeys`
 */
export function buildSelectWorkflows<
  T extends Record<string, unknown>,
>(options: {
  logger: WorkerLogger
  defaultKeys?: ReadonlyArray<keyof T>
  excludeKeys?: ReadonlyArray<keyof T>
}) {
  const { logger, defaultKeys, excludeKeys = [] } = options
  return (workflows: T): Array<T[keyof T]> => {
    const allKeys = Object.keys(workflows) as Array<keyof T>
    const envRaw = process.env.HATCHET_WORKFLOWS
    const requestedKeysRaw = envRaw
      ? envRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined
    const hasRequested =
      Array.isArray(requestedKeysRaw) && requestedKeysRaw.length > 0

    const fallbackKeys = defaultKeys
      ? [...defaultKeys]
      : allKeys.filter((k) => !excludeKeys.includes(k))

    const validSelectedKeys = (
      hasRequested
        ? requestedKeysRaw!.filter((k): k is keyof T & string => k in workflows)
        : fallbackKeys
    ) as Array<keyof T>

    if (hasRequested) {
      const unknown = requestedKeysRaw!.filter((k) => !(k in workflows))
      if (unknown.length) {
        logger.warn(
          { unknownKeys: unknown, availableKeys: allKeys },
          'HATCHET_WORKFLOWS contains unknown task keys'
        )
      }
    }

    return validSelectedKeys.map((k) => workflows[k])
  }
}

/** One-shot bootstrap for a Hatchet worker app: wires Redis, PubSub, the
 *  emitter, and the Hatchet client in a single call. Each caller only supplies
 *  what's different between workers (name, workflow selection, optional
 *  pre-start check).
 */
export async function bootstrapHatchetWorker(options: {
  workerName: string
  logger: WorkerLogger
  handlers: Parameters<typeof prepareHatchetTasks>[0]['handlers']
  selectWorkflows: (
    workflows: ReturnType<typeof prepareHatchetTasks>
  ) => Array<
    ReturnType<typeof prepareHatchetTasks>[keyof ReturnType<
      typeof prepareHatchetTasks
    >]
  >
  onReady?: (logger: WorkerLogger) => void
}): Promise<void> {
  const { workerName, logger, handlers, selectWorkflows, onReady } = options
  logger.info({ workerName }, 'Starting Hatchet worker')

  const redisOpts = (
    host: string | undefined,
    port: string | undefined,
    pass: string | undefined,
    tls: string | undefined
  ) => ({
    family: 4 as const,
    host: host ?? 'localhost',
    password: pass ?? '',
    port: Number(port ?? 6379),
    tls: tls ? {} : undefined,
  })

  const redisExec = new Redis(
    redisOpts(
      process.env.REDIS_HOST,
      process.env.REDIS_PORT,
      process.env.REDIS_PASS,
      process.env.REDIS_TLS
    )
  )
  const redisAssessmentExec = new Redis(
    redisOpts(
      process.env.REDIS_ASSESSMENT_HOST,
      process.env.REDIS_ASSESSMENT_PORT ?? '6381',
      process.env.REDIS_ASSESSMENT_PASS,
      process.env.REDIS_ASSESSMENT_TLS
    )
  )
  const redisCache = new Redis(
    redisOpts(
      process.env.REDIS_CACHE_HOST,
      process.env.REDIS_CACHE_PORT ?? '6380',
      process.env.REDIS_CACHE_PASS,
      process.env.REDIS_CACHE_TLS
    )
  )
  const publishClient = new Redis(
    redisOpts(
      process.env.REDIS_CACHE_HOST,
      process.env.REDIS_CACHE_PORT ?? '6380',
      process.env.REDIS_CACHE_PASS,
      process.env.REDIS_CACHE_TLS
    )
  )
  const subscribeClient = new Redis(
    redisOpts(
      process.env.REDIS_CACHE_HOST,
      process.env.REDIS_CACHE_PORT ?? '6380',
      process.env.REDIS_CACHE_PASS,
      process.env.REDIS_CACHE_TLS
    )
  )

  const pubSub = createPubSub({
    eventTarget: createRedisEventTarget({ publishClient, subscribeClient }),
  })
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

  onReady?.(logger)

  logger.info(
    { workerName, workflowCount: workflows.length },
    'Creating Hatchet worker'
  )

  const worker = await hatchetClient.worker(workerName, { workflows })

  logger.info('Starting worker to process jobs...')
  await worker.start()

  logger.info('Worker started successfully and ready to process jobs')
}

/** Install standard crash handlers. Each worker's main script should call this
 *  once so an unhandled rejection terminates the process — orchestration will
 *  restart it. */
export function installWorkerCrashHandlers(logger: WorkerLogger) {
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection')
    process.exit(1)
  })
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception')
    process.exit(1)
  })
}
