// basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo

import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { handlers } from '@klicker-uzh/graphql'
import type { PreparedHatchetTasks } from '@klicker-uzh/hatchet'
import { hatchetClient, prepareHatchetTasks } from '@klicker-uzh/hatchet'
import EventEmitter from 'events'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'

const HATCHET_WORKER_NAME =
  process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general'

function selectWorkflows(workflows: PreparedHatchetTasks) {
  // Select which workflows to load using an env var and keep it type-safe.
  // If no env var is provided, default to ALL available workflows dynamically.
  const defaultWorkflowKeys = Object.keys(workflows) as Array<
    keyof PreparedHatchetTasks
  >

  const requestedKeysRaw = process.env.HATCHET_WORKFLOWS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const validSelectedKeys = (
    requestedKeysRaw
      ? requestedKeysRaw.filter(
          (k): k is keyof PreparedHatchetTasks => k in workflows
        )
      : defaultWorkflowKeys
  ) as Array<keyof PreparedHatchetTasks>

  if (requestedKeysRaw) {
    const unknown = requestedKeysRaw.filter((k) => !(k in workflows))
    if (unknown.length) {
      console.warn(
        `HATCHET_WORKFLOWS contains unknown task keys: ${unknown.join(
          ', '
        )}. Available keys: ${Object.keys(workflows).join(', ')}`
      )
    }
  }

  const selectedWorkflows = validSelectedKeys.map((k) => workflows[k])

  return selectedWorkflows
}

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

  const preparedWorkflows = prepareHatchetTasks({
    hatchet: hatchetClient,
    pubSub,
    emitter,
    redisExec,
    redisCache,
    handlers,
  })

  const workflows = selectWorkflows(preparedWorkflows)

  const worker = await hatchetClient.worker(HATCHET_WORKER_NAME, {
    workflows,
  })

  await worker.start()
}

await main()
