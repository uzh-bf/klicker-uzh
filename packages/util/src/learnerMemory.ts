import { createHmac } from 'node:crypto'
import type { PrismaClient } from '@klicker-uzh/prisma/client'

/**
 * Client for the learner-memory contract, version 1.
 *
 * The contract is `learnerMemory/learner-memory.v1.schema.json` next to this
 * file. Public KlickerUZH owns it; a memory service implements it and pins the
 * same file. Without a configured service this module reports the capability
 * as absent and makes no call, and everything that depends on learner memory
 * works without it.
 *
 * The service never learns who a learner is: it receives a keyed hash of the
 * participant id and the course id, and no name, e-mail or account identifier.
 */

export const LEARNER_MEMORY_CONTRACT_VERSION = 1

const ROUTE_PREFIX = `/learner-memory/v${LEARNER_MEMORY_CONTRACT_VERSION}`

/** Recall sits in front of a chat turn, so it gives up quickly. */
export const LEARNER_MEMORY_RECALL_TIMEOUT_MS = 1_500
/** Observe includes the service's own model call. */
export const LEARNER_MEMORY_OBSERVE_TIMEOUT_MS = 30_000
export const LEARNER_MEMORY_DEFAULT_TIMEOUT_MS = 5_000

export const LEARNER_MEMORY_MAX_USER_MESSAGE_LENGTH = 8_000
export const LEARNER_MEMORY_MAX_ASSISTANT_MESSAGE_LENGTH = 16_000

const MAX_TOPICS = 12
const MAX_DIFFICULTIES = 5
const MAX_TOPIC_LENGTH = 80
const MAX_NOTE_LENGTH = 160
const MAX_DIFFICULTY_LENGTH = 160
const MAX_GOAL_LENGTH = 200
const MIN_SECRET_LENGTH = 32

export type LearnerMemoryTopicStatus =
  | 'struggling'
  | 'progressing'
  | 'confident'

export interface LearnerMemoryTopic {
  topic: string
  status: LearnerMemoryTopicStatus
  note?: string
  lastSeenAt: string
}

export interface LearnerMemoryRecord {
  topics: LearnerMemoryTopic[]
  difficulties: string[]
  goal: string | null
  updatedAt: string
}

export interface LearnerMemoryCourseScope {
  learnerKey: string
  courseId: string
  epoch: number
}

export type LearnerMemoryObserveStatus = 'stored' | 'unchanged' | 'dropped'

export interface LearnerMemoryConfig {
  url: string
  token: string
}

type Env = Record<string, string | undefined>

/**
 * The service a deployment has configured, or null. Both values are required;
 * a half-configured deployment has no learner memory.
 */
export function getLearnerMemoryConfig(
  env: Env = process.env
): LearnerMemoryConfig | null {
  const url = env.LEARNER_MEMORY_SERVICE_URL?.trim().replace(/\/+$/, '')
  const token = env.LEARNER_MEMORY_SERVICE_TOKEN?.trim()
  if (!url || !token) return null
  return { url, token }
}

/**
 * Whether this deployment offers learner memory at all. It needs the service
 * and the key secret, because no call can be addressed without a learner key.
 */
export function isLearnerMemoryConfigured(env: Env = process.env): boolean {
  return (
    getLearnerMemoryConfig(env) !== null &&
    deriveLearnerMemoryKey('probe', env) !== null
  )
}

/**
 * The learner key for a participant: HMAC-SHA-256 of the participant id under
 * the deployment's key secret, as lowercase hex. Null when the secret is
 * missing or too short. Callers must treat null as "no memory", never as an
 * error, so an opt-out or an account deletion cannot fail on it.
 */
export function deriveLearnerMemoryKey(
  participantId: string,
  env: Env = process.env
): string | null {
  const secret = env.LEARNER_MEMORY_KEY_SECRET?.trim()
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null
  return createHmac('sha256', secret).update(participantId).digest('hex')
}

/** A timestamp in the contract's format: ISO 8601, UTC, milliseconds. */
export function toLearnerMemoryTimestamp(date: Date): string {
  return date.toISOString()
}

export class LearnerMemoryError extends Error {
  constructor(
    readonly code:
      | 'LEARNER_MEMORY_NOT_CONFIGURED'
      | 'LEARNER_MEMORY_UNREACHABLE'
      | 'LEARNER_MEMORY_STALE_EPOCH'
      | 'LEARNER_MEMORY_REJECTED'
      | 'LEARNER_MEMORY_INVALID_RESPONSE',
    readonly status?: number
  ) {
    super(code)
    this.name = 'LearnerMemoryError'
  }
}

interface CallOptions {
  config?: LearnerMemoryConfig | null
  fetch?: typeof fetch
  timeoutMs?: number
}

async function post(
  path: string,
  body: unknown,
  timeoutMs: number,
  options: CallOptions
): Promise<unknown> {
  const config =
    options.config === undefined ? getLearnerMemoryConfig() : options.config
  if (!config) throw new LearnerMemoryError('LEARNER_MEMORY_NOT_CONFIGURED')

  let response: Response
  try {
    response = await (options.fetch ?? fetch)(
      `${config.url}${ROUTE_PREFIX}${path}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? timeoutMs),
      }
    )
  } catch {
    throw new LearnerMemoryError('LEARNER_MEMORY_UNREACHABLE')
  }
  if (response.status === 409) {
    throw new LearnerMemoryError('LEARNER_MEMORY_STALE_EPOCH', 409)
  }
  if (!response.ok) {
    throw new LearnerMemoryError('LEARNER_MEMORY_REJECTED', response.status)
  }
  try {
    return await response.json()
  } catch {
    throw new LearnerMemoryError('LEARNER_MEMORY_INVALID_RESPONSE')
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Stored text is model output about a learner; keep it short and on one line. */
function boundedLine(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const line = value.replace(/\s+/g, ' ').trim()
  if (!line) return null
  return line.length > maxLength ? line.slice(0, maxLength) : line
}

const TOPIC_STATUSES: readonly string[] = [
  'struggling',
  'progressing',
  'confident',
]

/**
 * Read a record from a service response. The record is derived by a model, so
 * nothing in it is trusted: unknown fields are dropped, every text is cut to
 * the contract's bound and to one line, and a response of the wrong shape is
 * an error. Returns null when the service holds no record.
 */
export function parseLearnerMemoryRecord(
  response: unknown
): LearnerMemoryRecord | null {
  if (!isObject(response) || !('record' in response)) {
    throw new LearnerMemoryError('LEARNER_MEMORY_INVALID_RESPONSE')
  }
  const record = response.record
  if (record === null) return null
  if (
    !isObject(record) ||
    !Array.isArray(record.topics) ||
    !Array.isArray(record.difficulties) ||
    typeof record.updatedAt !== 'string'
  ) {
    throw new LearnerMemoryError('LEARNER_MEMORY_INVALID_RESPONSE')
  }

  const topics: LearnerMemoryTopic[] = []
  for (const entry of record.topics.slice(0, MAX_TOPICS)) {
    if (!isObject(entry)) continue
    const topic = boundedLine(entry.topic, MAX_TOPIC_LENGTH)
    if (
      !topic ||
      typeof entry.status !== 'string' ||
      !TOPIC_STATUSES.includes(entry.status) ||
      typeof entry.lastSeenAt !== 'string'
    ) {
      continue
    }
    const note = boundedLine(entry.note, MAX_NOTE_LENGTH)
    topics.push({
      topic,
      status: entry.status as LearnerMemoryTopicStatus,
      ...(note ? { note } : {}),
      lastSeenAt: entry.lastSeenAt,
    })
  }

  const difficulties = record.difficulties
    .slice(0, MAX_DIFFICULTIES)
    .map((entry) => boundedLine(entry, MAX_DIFFICULTY_LENGTH))
    .filter((entry): entry is string => entry !== null)

  return {
    topics,
    difficulties,
    goal: boundedLine(record.goal, MAX_GOAL_LENGTH),
    updatedAt: record.updatedAt,
  }
}

/** Exactly the contract's fields; the service rejects any other property. */
function scopeBody(scope: LearnerMemoryCourseScope): LearnerMemoryCourseScope {
  return {
    learnerKey: scope.learnerKey,
    courseId: scope.courseId,
    epoch: scope.epoch,
  }
}

/** The record the Tutor may use on a turn. */
export async function recallLearnerMemory(
  scope: LearnerMemoryCourseScope,
  options: CallOptions = {}
): Promise<LearnerMemoryRecord | null> {
  return parseLearnerMemoryRecord(
    await post(
      '/recall',
      scopeBody(scope),
      LEARNER_MEMORY_RECALL_TIMEOUT_MS,
      options
    )
  )
}

/** The same record, read for the student's own view. */
export async function inspectLearnerMemory(
  scope: LearnerMemoryCourseScope,
  options: CallOptions = {}
): Promise<LearnerMemoryRecord | null> {
  return parseLearnerMemoryRecord(
    await post(
      '/inspect',
      scopeBody(scope),
      LEARNER_MEMORY_DEFAULT_TIMEOUT_MS,
      options
    )
  )
}

/**
 * Hand a completed Tutor exchange to the service. The service distils it into
 * the record and keeps no message text. Texts longer than the contract allows
 * are cut; an empty side means there is nothing to observe.
 */
export async function observeLearnerExchange(
  input: LearnerMemoryCourseScope & {
    exchangeAt: Date
    locale?: 'de' | 'en'
    userMessage: string
    assistantMessage: string
  },
  options: CallOptions = {}
): Promise<LearnerMemoryObserveStatus | 'skipped'> {
  const userMessage = input.userMessage
    .trim()
    .slice(0, LEARNER_MEMORY_MAX_USER_MESSAGE_LENGTH)
  const assistantMessage = input.assistantMessage
    .trim()
    .slice(0, LEARNER_MEMORY_MAX_ASSISTANT_MESSAGE_LENGTH)
  if (!userMessage || !assistantMessage) return 'skipped'

  const response = await post(
    '/observe',
    {
      learnerKey: input.learnerKey,
      courseId: input.courseId,
      epoch: input.epoch,
      exchangeAt: toLearnerMemoryTimestamp(input.exchangeAt),
      ...(input.locale ? { locale: input.locale } : {}),
      exchange: { userMessage, assistantMessage },
    },
    LEARNER_MEMORY_OBSERVE_TIMEOUT_MS,
    options
  )
  if (
    isObject(response) &&
    (response.status === 'stored' ||
      response.status === 'unchanged' ||
      response.status === 'dropped')
  ) {
    return response.status
  }
  throw new LearnerMemoryError('LEARNER_MEMORY_INVALID_RESPONSE')
}

function expectForgotten(response: unknown) {
  if (!isObject(response) || response.status !== 'forgotten') {
    throw new LearnerMemoryError('LEARNER_MEMORY_INVALID_RESPONSE')
  }
}

/** Delete the record of one learner in one course. */
export async function forgetLearnerMemory(
  input: LearnerMemoryCourseScope & { forgottenAt: Date },
  options: CallOptions = {}
): Promise<void> {
  expectForgotten(
    await post(
      '/forget',
      {
        learnerKey: input.learnerKey,
        courseId: input.courseId,
        epoch: input.epoch,
        forgottenAt: toLearnerMemoryTimestamp(input.forgottenAt),
      },
      LEARNER_MEMORY_DEFAULT_TIMEOUT_MS,
      options
    )
  )
}

/** Delete every record of one learner. */
export async function forgetAllLearnerMemory(
  input: { learnerKey: string; epoch: number },
  options: CallOptions = {}
): Promise<void> {
  expectForgotten(
    await post(
      '/forget-all',
      { learnerKey: input.learnerKey, epoch: input.epoch },
      LEARNER_MEMORY_DEFAULT_TIMEOUT_MS,
      options
    )
  )
}

type ForgetRequestStore = Pick<PrismaClient, 'learnerMemoryForgetRequest'>

/**
 * Send open forget requests to the service and mark the confirmed ones. Used
 * right after a request is written and by the retry task, so a request the
 * service could not take is tried again until it is confirmed.
 *
 * Without a configured service nothing is sent and nothing is counted as an
 * attempt: the requests stay open and go out once a service is configured.
 */
export async function deliverLearnerMemoryForgets(input: {
  prisma: ForgetRequestStore
  ids?: number[]
  limit?: number
  options?: CallOptions
}): Promise<{ configured: boolean; delivered: number; failed: number }> {
  const config =
    input.options?.config === undefined
      ? getLearnerMemoryConfig()
      : input.options.config
  if (!config) return { configured: false, delivered: 0, failed: 0 }
  const options = { ...input.options, config }

  const requests = await input.prisma.learnerMemoryForgetRequest.findMany({
    where: {
      completedAt: null,
      ...(input.ids ? { id: { in: input.ids } } : {}),
    },
    // Requests never tried come first, then the ones waiting longest, so a
    // request the service keeps refusing cannot hold back newer ones.
    orderBy: [
      { lastAttemptAt: { sort: 'asc', nulls: 'first' } },
      { id: 'asc' },
    ],
    take: input.limit ?? 50,
  })

  let delivered = 0
  let failed = 0
  for (const request of requests) {
    let confirmed = false
    try {
      if (request.courseId === null) {
        await forgetAllLearnerMemory(
          { learnerKey: request.learnerKey, epoch: request.epoch },
          options
        )
      } else {
        await forgetLearnerMemory(
          {
            learnerKey: request.learnerKey,
            courseId: request.courseId,
            epoch: request.epoch,
            forgottenAt: request.requestedAt,
          },
          options
        )
      }
      confirmed = true
    } catch (error) {
      // The service has already seen a higher epoch for this learner and
      // deleted everything stored below it, which includes what this request
      // asked for.
      confirmed =
        error instanceof LearnerMemoryError &&
        error.code === 'LEARNER_MEMORY_STALE_EPOCH'
    }
    const attemptedAt = new Date()
    await input.prisma.learnerMemoryForgetRequest.update({
      where: { id: request.id },
      data: confirmed
        ? { completedAt: attemptedAt, lastAttemptAt: attemptedAt }
        : { attempts: { increment: 1 }, lastAttemptAt: attemptedAt },
    })
    if (confirmed) delivered += 1
    else failed += 1
  }
  return { configured: true, delivered, failed }
}

/** How long a confirmed deletion request is kept as a record that it ran. */
export const LEARNER_MEMORY_FORGET_RETENTION_DAYS = 30

/**
 * Remove confirmed deletion requests after the retention period. A request
 * holds a learner key and a course id, which nothing needs once the deletion
 * is confirmed and the period has passed.
 */
export async function purgeConfirmedLearnerMemoryForgets(input: {
  prisma: ForgetRequestStore
  now?: Date
}): Promise<number> {
  const now = input.now ?? new Date()
  const before = new Date(
    now.getTime() - LEARNER_MEMORY_FORGET_RETENTION_DAYS * 24 * 60 * 60 * 1000
  )
  const result = await input.prisma.learnerMemoryForgetRequest.deleteMany({
    where: { completedAt: { lt: before } },
  })
  return result.count
}
