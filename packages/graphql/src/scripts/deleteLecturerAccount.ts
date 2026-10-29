#!/usr/bin/env tsx
import { createHash, randomUUID } from 'node:crypto'
import { constants, readFileSync } from 'node:fs'
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  stat,
  unlink,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { Redis as RedisClient } from 'ioredis'
import type {
  DeletionAction,
  DeletionTarget,
  LecturerDeletionPreview,
} from '../services/lecturerDeletion.js'

const help = `Preview a cooperative lecturer account deletion (default is read-only).
  pnpm exec tsx src/scripts/deleteLecturerAccount.ts --user <UUID> --email <email> --state-dir /private/run
  Repeat with --apply --confirm-user <UUID> --confirm-email <email> --confirm-environment <hash>.
  Use --resume with --apply only after inspecting a partial run and its current preview.

The lecturer must remain out of the account. Shared content, retained records,
active work and incomplete dependency discovery block deletion before effects.
The script calls existing GraphQL deletion mutations; it does not freeze accounts.
Supply DATABASE_URL, APP_SECRET, LECTURER_DELETION_API_URL,
BLOB_STORAGE_ACCOUNT_NAME, BLOB_STORAGE_ACCESS_KEY and REDIS_HOST/REDIS_PORT/
REDIS_PASS/REDIS_TLS using the target environment's existing configuration.
Explicitly confirm that API, database, Redis and storage belong to that same environment.
Never commit state files. No real deletion is authorized merely by generating a preview.`

type Saved = {
  version: 1
  environment: string
  preview: LecturerDeletionPreview
  workBlockers: string[]
}
type Receipt = {
  version: 1
  environment: string
  target: DeletionTarget
  originalActions: DeletionAction[]
  originalMediaIds: string[]
  intended: string[]
  completed: string[]
  storageIntended: boolean
  storageComplete: boolean
  accountIntended: boolean
  accountComplete: boolean
}

export class LecturerDeletionCommandError extends Error {}

class OperatorLeaseLostError extends LecturerDeletionCommandError {}

const MAX_STATE_BYTES = 4 * 1024 * 1024
const MAX_ACTIONS = 10_000
const MAX_SCAN_RESULTS = 100_000
const MAX_SCAN_STEPS = 10_000
const UUID_RE = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i
const ACTION_KINDS = new Set<DeletionAction['kind']>([
  'element',
  'tag',
  'liveQuiz',
  'practiceQuiz',
  'microLearning',
  'groupActivity',
  'course',
  'answerCollection',
  'catalogCollection',
  'chatbotDisclaimer',
  'competencyTree',
])
const NUMERIC_ACTION_KINDS = new Set<DeletionAction['kind']>([
  'element',
  'tag',
  'answerCollection',
  'competencyTree',
])
const ACTIVITY_TYPE_BY_KIND = new Map<DeletionAction['kind'], string>([
  ['liveQuiz', 'LIVE_QUIZ'],
  ['practiceQuiz', 'PRACTICE_QUIZ'],
  ['microLearning', 'MICRO_LEARNING'],
  ['groupActivity', 'GROUP_ACTIVITY'],
])
const PUBLICATION_STATUSES = new Set([
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'ENDED',
  'GRADED',
  'TEMPLATE',
])
const ELEMENT_REVIEW_STATUSES = new Set(['READY', 'DRAFT', 'REVIEW'])
const BLOCKED_NEXT_STEP =
  'Choose transfer or delete for shared content, resolve work-state blockers, then rerun a reviewed preview before applying.'

function invalidState(): never {
  throw new LecturerDeletionCommandError(
    'Private run state is invalid or has been tampered with'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = []
) {
  const keys = Object.keys(value)
  if (
    required.some((key) => !(key in value)) ||
    keys.some((key) => !required.includes(key) && !optional.includes(key))
  )
    invalidState()
}

function stateString(value: unknown, maxLength = 256) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength
  )
    invalidState()
  return value
}

function stringArray(value: unknown, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxLength) invalidState()
  const strings = value.map((item) => stateString(item))
  if (new Set(strings).size !== strings.length) invalidState()
  return strings
}

function validateTarget(value: unknown): DeletionTarget {
  if (!isRecord(value)) invalidState()
  exactKeys(value, ['id', 'email'])
  const id = stateString(value.id, 36).toLowerCase()
  if (!UUID_RE.test(id)) invalidState()
  return { id, email: stateString(value.email, 320) }
}

function validateAction(value: unknown): DeletionAction {
  if (!isRecord(value)) invalidState()
  exactKeys(value, ['kind', 'id'], ['status', 'activityType'])
  if (
    typeof value.kind !== 'string' ||
    !ACTION_KINDS.has(value.kind as DeletionAction['kind'])
  )
    invalidState()
  const kind = value.kind as DeletionAction['kind']
  const id = NUMERIC_ACTION_KINDS.has(kind)
    ? value.id
    : stateString(value.id, 300)
  if (
    NUMERIC_ACTION_KINDS.has(kind) &&
    (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)
  )
    invalidState()
  if (typeof id === 'string' && !UUID_RE.test(id)) invalidState()
  const expectedActivityType = ACTIVITY_TYPE_BY_KIND.get(kind)
  if (expectedActivityType) {
    if (value.activityType !== expectedActivityType) invalidState()
    if (
      typeof value.status !== 'string' ||
      !PUBLICATION_STATUSES.has(value.status)
    )
      invalidState()
  } else {
    if ('activityType' in value) invalidState()
    if (
      kind === 'element' &&
      'status' in value &&
      (typeof value.status !== 'string' ||
        !ELEMENT_REVIEW_STATUSES.has(value.status))
    )
      invalidState()
    if (kind !== 'element' && 'status' in value) invalidState()
  }
  return {
    kind,
    id: id as string | number,
    ...(expectedActivityType
      ? {
          status: value.status as string,
          activityType: expectedActivityType,
        }
      : kind === 'element' && 'status' in value
        ? { status: value.status as string }
        : {}),
  }
}

function validatePreview(value: unknown): LecturerDeletionPreview {
  if (!isRecord(value)) invalidState()
  exactKeys(value, [
    'version',
    'target',
    'fingerprint',
    'actions',
    'blockers',
    'mediaIds',
  ])
  if (value.version !== 1) invalidState()
  if (!Array.isArray(value.actions) || value.actions.length > MAX_ACTIONS)
    invalidState()
  const actions = value.actions.map(validateAction)
  if (new Set(actions.map(actionKey)).size !== actions.length) invalidState()
  if (!Array.isArray(value.blockers) || value.blockers.length > MAX_ACTIONS)
    invalidState()
  const blockers = value.blockers.map((item) => {
    if (!isRecord(item)) invalidState()
    exactKeys(item, ['kind', 'table', 'id', 'reason'])
    return {
      kind: stateString(item.kind),
      table: stateString(item.table),
      id: stateString(item.id),
      reason: stateString(item.reason),
    }
  })
  const fingerprint = stateString(value.fingerprint, 128)
  if (!/^[\da-f]{64}$/i.test(fingerprint)) invalidState()
  return {
    version: 1,
    target: validateTarget(value.target),
    fingerprint,
    actions,
    blockers,
    mediaIds: stringArray(value.mediaIds, MAX_ACTIONS).map((id) => {
      if (!UUID_RE.test(id)) invalidState()
      return id
    }),
  }
}

function validateSaved(value: unknown): Saved {
  if (!isRecord(value)) invalidState()
  exactKeys(value, ['version', 'environment', 'preview', 'workBlockers'])
  if (value.version !== 1) invalidState()
  const workBlockers = stringArray(value.workBlockers, 32)
  if (
    workBlockers.some(
      (blocker) =>
        blocker !== 'COURSE_DUPLICATION_SOURCE_LOCK' &&
        blocker !== 'WORK_STATE_UNAVAILABLE'
    )
  )
    invalidState()
  return {
    version: 1,
    environment: stateString(value.environment, 128),
    preview: validatePreview(value.preview),
    workBlockers,
  }
}

function validateReceipt(value: unknown): Receipt {
  if (!isRecord(value)) invalidState()
  exactKeys(value, [
    'version',
    'environment',
    'target',
    'originalActions',
    'originalMediaIds',
    'intended',
    'completed',
    'storageIntended',
    'storageComplete',
    'accountIntended',
    'accountComplete',
  ])
  if (value.version !== 1) invalidState()
  if (
    !Array.isArray(value.originalActions) ||
    value.originalActions.length > MAX_ACTIONS
  )
    invalidState()
  const originalActions = value.originalActions.map(validateAction)
  const known = new Set(originalActions.map(actionKey))
  if (known.size !== originalActions.length) invalidState()
  const intended = stringArray(value.intended, MAX_ACTIONS)
  const completed = stringArray(value.completed, MAX_ACTIONS)
  if ([...intended, ...completed].some((key) => !known.has(key))) invalidState()
  for (const key of [
    'storageIntended',
    'storageComplete',
    'accountIntended',
    'accountComplete',
  ] as const) {
    if (typeof value[key] !== 'boolean') invalidState()
  }
  if (
    value.accountComplete === true &&
    (value.accountIntended !== true || value.storageComplete !== true)
  )
    invalidState()
  if (
    (value.storageComplete === true && value.storageIntended !== true) ||
    (value.accountIntended === true && value.storageComplete !== true)
  )
    invalidState()
  return {
    version: 1,
    environment: stateString(value.environment, 128),
    target: validateTarget(value.target),
    originalActions,
    originalMediaIds: stringArray(value.originalMediaIds, MAX_ACTIONS),
    intended,
    completed,
    storageIntended: value.storageIntended as boolean,
    storageComplete: value.storageComplete as boolean,
    accountIntended: value.accountIntended as boolean,
    accountComplete: value.accountComplete as boolean,
  }
}

function hash(value: unknown) {
  const serialized = JSON.stringify(value)
  if (serialized === undefined)
    throw new LecturerDeletionCommandError('Cannot hash private run state')
  return createHash('sha256').update(serialized).digest('hex')
}
function actionKey(action: DeletionAction) {
  return `${action.kind}:${action.id}`
}

function unsafeOwnerOrMode(info: { uid: number; mode: number }) {
  const uid = process.getuid?.()
  return (uid !== undefined && info.uid !== uid) || (info.mode & 0o077) !== 0
}

async function load<T>(
  path: string,
  validate: (value: unknown) => T
): Promise<T | undefined> {
  let file: Awaited<ReturnType<typeof open>>
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw new LecturerDeletionCommandError('Cannot read private run state')
  }
  try {
    const info = await file.stat()
    if (
      !info.isFile() ||
      info.size > MAX_STATE_BYTES ||
      unsafeOwnerOrMode(info)
    )
      throw new LecturerDeletionCommandError(
        'Private run state must be a regular, owner-only file'
      )
    const buffer = Buffer.alloc(MAX_STATE_BYTES + 1)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        offset,
        buffer.length - offset,
        offset
      )
      if (bytesRead === 0) break
      offset += bytesRead
    }
    if (offset > MAX_STATE_BYTES)
      throw new LecturerDeletionCommandError('Private run state is too large')
    let parsed: unknown
    try {
      parsed = JSON.parse(buffer.subarray(0, offset).toString('utf8'))
    } catch {
      throw new LecturerDeletionCommandError(
        'Private run state is invalid or has been tampered with'
      )
    }
    return validate(parsed)
  } finally {
    await file.close()
  }
}

async function assertSafeExistingStateFile(path: string) {
  try {
    const info = await lstat(path)
    if (info.isSymbolicLink() || !info.isFile() || unsafeOwnerOrMode(info))
      throw new LecturerDeletionCommandError(
        'Private run state must be a regular, owner-only file'
      )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
}
async function save(path: string, value: unknown) {
  await assertSafeExistingStateFile(path)
  const serialized = `${JSON.stringify(value, null, 2)}\n`
  if (Buffer.byteLength(serialized) > MAX_STATE_BYTES)
    throw new LecturerDeletionCommandError('Private run state is too large')
  const temporary = `${path}.${randomUUID()}.tmp`
  const file = await open(
    temporary,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600
  )
  try {
    await file.writeFile(serialized)
    await file.sync()
  } finally {
    await file.close()
  }
  await rename(temporary, path)
  const directory = await open(dirname(path), 'r')
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}

async function prepareStateDirectory(dir: string, root: string) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const [realDir, realRoot] = await Promise.all([realpath(dir), realpath(root)])
  const fromRoot = relative(realRoot, realDir)
  if (!fromRoot.startsWith('..') && !isAbsolute(fromRoot))
    throw new LecturerDeletionCommandError(
      'Run state must resolve outside the repository'
    )
  const info = await stat(realDir)
  if (!info.isDirectory() || unsafeOwnerOrMode(info))
    throw new LecturerDeletionCommandError(
      'Run state directory must be an owner-only directory'
    )
  return realDir
}

let manifests:
  | { client: Record<string, string>; server: Record<string, string> }
  | undefined
function operation(name: string) {
  try {
    manifests ??= {
      client: JSON.parse(
        readFileSync(new URL('../public/client.json', import.meta.url), 'utf8')
      ),
      server: JSON.parse(
        readFileSync(new URL('../public/server.json', import.meta.url), 'utf8')
      ),
    }
    const id = manifests.client[name]
    const query = id && manifests.server[id]
    if (!id || !query) throw new Error('missing operation')
    return { id, query }
  } catch {
    throw new LecturerDeletionCommandError(
      'Generate the GraphQL manifests from the matching application revision before applying'
    )
  }
}

export function mutationForDeletion(action: DeletionAction) {
  if (action.kind === 'chatbotDisclaimer' || action.kind === 'competencyTree')
    throw new LecturerDeletionCommandError(
      'Unused leaves use their checked helper'
    )
  const definitions = {
    element: ['DeleteElement', 'deleteElement', 'id'],
    tag: ['DeleteTag', 'deleteTag', 'id'],
    liveQuiz: ['DeleteLiveQuiz', 'deleteLiveQuiz', 'id'],
    practiceQuiz: ['DeletePracticeQuizBatch', 'deletePracticeQuiz', 'id'],
    microLearning: ['DeleteMicroLearningBatch', 'deleteMicroLearning', 'id'],
    groupActivity: ['DeleteGroupActivityBatch', 'deleteGroupActivity', 'id'],
    course: ['RequestCourseDeletion', 'requestCourseDeletion', 'id'],
    answerCollection: [
      'DeleteAnswerCollection',
      'deleteAnswerCollection',
      'collectionId',
    ],
    catalogCollection: [
      'DeleteCatalogCollection',
      'deleteCatalogCollection',
      'catalogCollectionId',
    ],
  } as const
  if (action.status === 'TEMPLATE') {
    if (!action.activityType)
      throw new LecturerDeletionCommandError(
        'Template activity type is missing'
      )
    return {
      ...operation('DeleteActivityTemplate'),
      field: 'deleteActivityTemplate',
      variables: { activityId: action.id, activityType: action.activityType },
    }
  }
  const [name, field, argument] = definitions[action.kind]
  return {
    ...operation(name),
    field,
    variables: {
      [argument]: action.id,
      ...(action.kind === 'course' ? { deleteDraftActivities: false } : {}),
    },
  }
}

type GraphQLRequest = <T>(
  query: string,
  variables: Record<string, unknown>
) => Promise<T>

export async function performDeletionAction(
  action: DeletionAction,
  request: GraphQLRequest
) {
  const operation = mutationForDeletion(action)
  const result = await request<Record<string, unknown>>(
    operation.query,
    operation.variables
  )
  const value = result[operation.field]
  if (value === null || value === false || value === undefined)
    throw new LecturerDeletionCommandError(
      'Existing deletion mutation refused the action'
    )
}

async function observeAction(prisma: PrismaClient, action: DeletionAction) {
  const tables = {
    element: 'Element',
    tag: 'Tag',
    liveQuiz: 'LiveQuiz',
    practiceQuiz: 'PracticeQuiz',
    microLearning: 'MicroLearning',
    groupActivity: 'GroupActivity',
    course: 'Course',
    answerCollection: 'AnswerCollection',
    catalogCollection: 'CatalogCollection',
    chatbotDisclaimer: 'ChatbotDisclaimer',
    competencyTree: 'CompetencyTree',
  }
  const rows = await prisma.$queryRawUnsafe<{ deleted: boolean }[]>(
    `SELECT coalesce((to_jsonb(t)->>'isDeleted')::boolean, false) AS deleted FROM "public"."${tables[action.kind]}" t WHERE id::text = $1`,
    String(action.id)
  )
  return rows.length === 0
    ? 'absent'
    : rows[0]?.deleted
      ? 'soft-deleted'
      : 'present'
}

type CourseObservation = {
  state: 'absent' | 'pending' | 'present'
  deletionRequestedAt: Date | string | null
}

async function observeCourse(
  prisma: PrismaClient,
  id: string
): Promise<CourseObservation> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ pending: boolean; deletionRequestedAt: Date | string | null }>
  >(
    `SELECT ("deletionRequestedAt" IS NOT NULL) AS pending, "deletionRequestedAt" FROM "public"."Course" WHERE id::text = $1 LIMIT 1`,
    id
  )
  const row = rows[0]
  return {
    state: !row ? 'absent' : row.pending ? 'pending' : 'present',
    deletionRequestedAt: row?.deletionRequestedAt ?? null,
  }
}

function courseRecoveryError(
  action: DeletionAction,
  observation?: CourseObservation
) {
  const requestedAt =
    observation?.deletionRequestedAt instanceof Date
      ? observation.deletionRequestedAt.toISOString()
      : (observation?.deletionRequestedAt ?? 'none')
  return new LecturerDeletionCommandError(
    [
      'Course deletion is stuck or uncertain.',
      `course=${String(action.id)}`,
      `deletionRequestedAt=${requestedAt}`,
      `receiptActionKey=${actionKey(action)}`,
      'Fix the course deletion worker/job manually. Never cancel or resubmit it from this command.',
      'Rerun a reviewed preview only after the pending course state is reconciled.',
    ].join('\n')
  )
}

async function observeExactUser(
  prisma: PrismaClient,
  target: DeletionTarget
): Promise<'absent' | 'present'> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; email: string }>
  >(
    `SELECT "id"::text AS "id", "email" FROM "public"."User" WHERE "id" = $1::uuid OR "email" = $2 LIMIT 2`,
    target.id,
    target.email
  )
  if (rows.length === 0) return 'absent'
  if (
    rows.length === 1 &&
    rows[0]?.id === target.id &&
    rows[0]?.email === target.email
  )
    return 'present'
  throw new LecturerDeletionCommandError(
    'The exact User identity is inconsistent; inspect before continuing'
  )
}

type RedisScanClient = Pick<RedisClient, 'scan'>

function courseDuplicationPatterns(userId: string, actions: DeletionAction[]) {
  const patterns = new Set([`course-duplication:source:${userId}:*`])
  for (const action of actions) {
    if (action.kind === 'course')
      patterns.add(`course-duplication:source:*:${action.id}`)
  }
  return [...patterns].sort()
}

async function findCourseDuplicationLocks(
  redis: RedisScanClient,
  actions: DeletionAction[],
  userId: string
) {
  let steps = 0
  let results = 0
  for (const pattern of courseDuplicationPatterns(userId, actions)) {
    let cursor = '0'
    do {
      if (++steps > MAX_SCAN_STEPS) throw new Error('scan step limit')
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '250'
      )
      results += keys.length
      if (results > MAX_SCAN_RESULTS) throw new Error('scan result limit')
      if (keys.length > 0) return true
      cursor = next
    } while (cursor !== '0')
  }
  return false
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      user: { type: 'string' },
      email: { type: 'string' },
      'state-dir': { type: 'string' },
      apply: { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
      'confirm-user': { type: 'string' },
      'confirm-email': { type: 'string' },
      'confirm-environment': { type: 'string' },
    },
  })
  if (values.help) {
    console.log(help)
    return
  }
  if (
    !values.user ||
    !UUID_RE.test(values.user) ||
    !values.email ||
    !values['state-dir']
  )
    throw new LecturerDeletionCommandError(
      '--user UUID, --email and --state-dir are required'
    )
  const target = { id: values.user.toLowerCase(), email: values.email }
  const sourceRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../..'
  )
  const root =
    basename(dirname(sourceRoot)) === 'trees'
      ? resolve(sourceRoot, '../..')
      : sourceRoot
  if (!isAbsolute(values['state-dir']))
    throw new LecturerDeletionCommandError(
      'Run state must be outside the repository'
    )
  const dir = await prepareStateDirectory(resolve(values['state-dir']), root)
  if (Object.keys(process.env).some((key) => key.startsWith('PG')))
    throw new LecturerDeletionCommandError(
      'Use DATABASE_URL without PG environment overrides'
    )
  const required = [
    'DATABASE_URL',
    'APP_SECRET',
    'LECTURER_DELETION_API_URL',
    'BLOB_STORAGE_ACCOUNT_NAME',
    'BLOB_STORAGE_ACCESS_KEY',
    'REDIS_HOST',
  ]
  if (required.some((key) => !process.env[key]))
    throw new LecturerDeletionCommandError(
      'Target environment configuration is incomplete'
    )
  const database = new URL(process.env.DATABASE_URL!)
  const endpoint = new URL(process.env.LECTURER_DELETION_API_URL!)
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !['https:', 'http:'].includes(endpoint.protocol)
  )
    throw new LecturerDeletionCommandError(
      'Use an explicit API URL without credentials or query parameters'
    )
  if (
    endpoint.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(endpoint.hostname)
  )
    throw new LecturerDeletionCommandError(
      'The API requires HTTPS outside loopback tests'
    )
  const schemas = database.searchParams.getAll('schema')
  if (
    schemas.length > 1 ||
    database.searchParams.has('options') ||
    database.searchParams.has('search_path') ||
    database.searchParams.has('currentSchema')
  )
    throw new LecturerDeletionCommandError(
      'DATABASE_URL has an ambiguous schema configuration'
    )
  const databaseSchema = schemas[0] ?? 'public'
  if (databaseSchema !== 'public')
    throw new LecturerDeletionCommandError(
      'This command supports the repository public schema only'
    )
  const environment = hash({
    database: [
      database.hostname,
      database.port,
      database.pathname,
      databaseSchema,
    ],
    api: endpoint.href,
    storage: process.env.BLOB_STORAGE_ACCOUNT_NAME,
    redis: [process.env.REDIS_HOST, process.env.REDIS_PORT ?? '6379'],
  })
  const lockPath = resolve(dir, '.running')
  let lock: Awaited<ReturnType<typeof open>>
  try {
    lock = await open(lockPath, 'wx', 0o600)
  } catch {
    throw new LecturerDeletionCommandError(
      'This state directory is locked; reconcile any previous process before removing its lock'
    )
  }
  try {
    const beforePath = resolve(dir, 'preview.json')
    const receiptPath = resolve(dir, 'receipt.json')
    const receipt = await load(receiptPath, validateReceipt)
    if (values.resume && !receipt)
      throw new LecturerDeletionCommandError(
        'Resume requires an existing inspected receipt'
      )
    if (receipt && !values.resume)
      throw new LecturerDeletionCommandError(
        'A run exists; inspect its receipt before using --resume'
      )
    if (
      receipt &&
      (receipt.environment !== environment ||
        hash(receipt.target) !== hash(target))
    )
      throw new LecturerDeletionCommandError(
        'Receipt target/environment mismatch'
      )
    const { PrismaClient: Client } = await import('@klicker-uzh/prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const { Redis } = await import('ioredis')
    const service = await import('../services/lecturerDeletion.js')
    const prisma = new Client({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: [],
    })
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASS,
      tls: process.env.REDIS_TLS ? {} : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    redis.on('error', () => {})
    let lease: Promise<void> | undefined
    let releaseLease: (() => void) | undefined
    let leaseFailure: unknown
    let verifyLease: (() => Promise<void>) | undefined
    try {
      if (values.apply) {
        let acquired!: () => void
        let failed!: (error: unknown) => void
        const ready = new Promise<void>((resolve, reject) => {
          acquired = resolve
          failed = reject
        })
        const held = new Promise<void>((resolve) => {
          releaseLease = resolve
        })
        lease = prisma
          .$transaction(
            async (transaction) => {
              const [result] = await transaction.$queryRaw<
                { acquired: boolean }[]
              >`SELECT pg_try_advisory_xact_lock(hashtext('klicker-lecturer-delete'), hashtext(${target.id})) AS acquired`
              if (!result?.acquired)
                throw new LecturerDeletionCommandError(
                  'Another deletion command owns this account'
                )
              verifyLease = async () => {
                await transaction.$queryRaw`SELECT 1`
              }
              acquired()
              await held
            },
            { timeout: 15 * 60_000 }
          )
          .catch((error: unknown) => {
            leaseFailure = error
            failed(error)
          })
        await ready
      }
      async function assertLease() {
        try {
          if (leaseFailure || !verifyLease) throw new Error('lease unavailable')
          await verifyLease()
        } catch {
          throw new OperatorLeaseLostError(
            'Operator exclusion was lost; reconcile before continuing'
          )
        }
      }
      let redisConnected = false
      async function hasCourseDuplicationLock(actions: DeletionAction[]) {
        if (!redisConnected) {
          await redis.connect()
          redisConnected = true
        }
        return findCourseDuplicationLocks(redis, actions, target.id)
      }
      async function assertCourseDuplicationClear(actions: DeletionAction[]) {
        try {
          if (await hasCourseDuplicationLock(actions))
            throw new LecturerDeletionCommandError(
              `Course duplication is active. ${BLOCKED_NEXT_STEP}`
            )
        } catch (error) {
          if (error instanceof LecturerDeletionCommandError) throw error
          throw new LecturerDeletionCommandError(
            `Course duplication work state cannot be verified. ${BLOCKED_NEXT_STEP}`
          )
        }
      }
      const userState = await observeExactUser(prisma, target)
      if (receipt?.accountComplete) {
        if (userState === 'absent') {
          console.log('The recorded deletion is complete.')
          return
        }
        throw new LecturerDeletionCommandError(
          'The recorded completion no longer has exact User absence; inspect before resuming'
        )
      }
      if (userState === 'absent') {
        if (
          receipt &&
          receipt.accountIntended === true &&
          receipt.storageComplete === true
        ) {
          receipt.accountComplete = true
          await save(receiptPath, receipt)
          console.log('The recorded deletion is complete.')
          return
        }
        throw new LecturerDeletionCommandError(
          'The exact target User is absent without a verified completion checkpoint'
        )
      }
      const preview = await service.previewLecturerDeletion(prisma, target)
      const workBlockers: string[] = []
      try {
        if (
          await hasCourseDuplicationLock([
            ...preview.actions,
            ...(receipt?.originalActions ?? []),
          ])
        )
          workBlockers.push('COURSE_DUPLICATION_SOURCE_LOCK')
      } catch {
        workBlockers.push('WORK_STATE_UNAVAILABLE')
      }
      const current: Saved = { version: 1, environment, preview, workBlockers }
      if (!values.apply) {
        await save(beforePath, current)
        console.log(
          JSON.stringify(
            {
              environment,
              actions: preview.actions.length,
              blockers: [...preview.blockers, ...workBlockers],
              ...(preview.blockers.length || workBlockers.length
                ? { nextStep: BLOCKED_NEXT_STEP }
                : {}),
              report: beforePath,
            },
            null,
            2
          )
        )
        return
      }
      if (
        values['confirm-user'] !== target.id ||
        values['confirm-email'] !== target.email ||
        values['confirm-environment'] !== environment
      )
        throw new LecturerDeletionCommandError(
          'Exact user, email and paired environment confirmation is required'
        )
      const saved = await load(beforePath, validateSaved)
      if (
        !saved ||
        saved.environment !== environment ||
        hash(saved.preview.target) !== hash(target)
      )
        throw new LecturerDeletionCommandError(
          'A matching saved preview is required'
        )
      if (!receipt && hash(saved) !== hash(current))
        throw new LecturerDeletionCommandError(
          'State changed; generate and review a fresh preview'
        )
      const run: Receipt = receipt ?? {
        version: 1,
        environment,
        target,
        originalActions: preview.actions,
        originalMediaIds: preview.mediaIds,
        intended: [],
        completed: [],
        storageIntended: false,
        storageComplete: false,
        accountIntended: false,
        accountComplete: false,
      }
      const allowed = new Set(run.originalActions.map(actionKey))
      const mediaUnchanged = (current: LecturerDeletionPreview) =>
        hash([...current.mediaIds].sort()) ===
        hash([...run.originalMediaIds].sort())
      if (!mediaUnchanged(preview))
        throw new LecturerDeletionCommandError(
          'Media changed; inspect the partial run'
        )
      if (preview.actions.some((action) => !allowed.has(actionKey(action))))
        throw new LecturerDeletionCommandError(
          'New content appeared; stop and inspect the partial run'
        )
      const intendedCourses = new Map(
        run.originalActions
          .filter(
            (action) =>
              action.kind === 'course' &&
              run.intended.includes(actionKey(action))
          )
          .map((action) => [String(action.id), action] as const)
      )
      for (const blocker of preview.blockers) {
        const courseAction = intendedCourses.get(blocker.id)
        if (
          !(
            blocker.kind === 'activeWork' &&
            blocker.table === 'Course' &&
            blocker.reason === 'deletion-marker'
          ) ||
          !courseAction
        ) {
          throw new LecturerDeletionCommandError(
            `Deletion is blocked. ${BLOCKED_NEXT_STEP}`
          )
        }
        const courseObservation = await observeCourse(prisma, blocker.id)
        if (
          courseObservation.state !== 'pending' &&
          courseObservation.state !== 'absent'
        )
          throw courseRecoveryError(courseAction, courseObservation)
      }
      if (workBlockers.length)
        throw new LecturerDeletionCommandError(
          `Deletion is blocked. ${BLOCKED_NEXT_STEP}`
        )
      await assertLease()
      await assertCourseDuplicationClear(run.originalActions)
      const { signJWT } = await import('@klicker-uzh/util')
      const signDeletionToken = () =>
        signJWT(
          {
            sub: target.id,
            role: 'USER',
            scope: 'ACCOUNT_OWNER',
            catalystInstitutional: false,
            catalystIndividual: false,
          },
          process.env.APP_SECRET!,
          { algorithm: 'HS256', expiresIn: '30m', issuer: endpoint.origin }
        )
      const request: GraphQLRequest = async <T>(
        query: string,
        variables: Record<string, unknown>
      ) => {
        await assertLease()
        const token = await signDeletionToken()
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            redirect: 'error',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${token}`,
              'x-graphql-yoga-csrf': 'lecturer-deletion',
            },
            body: JSON.stringify({
              variables,
              extensions: {
                persistedQuery: {
                  version: 1,
                  sha256Hash: Object.entries(manifests!.server).find(
                    ([, document]) => document === query
                  )?.[0],
                },
              },
            }),
            signal: AbortSignal.timeout(30_000),
          })
          const body = (await response.json()) as {
            data?: T
            errors?: unknown[]
          }
          if (!response.ok || body.errors?.length || !body.data)
            throw new Error('refused')
          return body.data
        } catch {
          throw new LecturerDeletionCommandError(
            'API request failed or outcome is uncertain; inspect read-back before resuming'
          )
        }
      }
      const identity = await request<{
        userProfile: { id: string; email: string } | null
      }>(operation('UserProfile').query, {})
      const profile = identity.userProfile
      if (
        !profile ||
        profile.id !== target.id ||
        profile.email !== target.email
      )
        throw new LecturerDeletionCommandError(
          'API lecturer identity does not match the database target'
        )
      await save(receiptPath, run)
      const order: DeletionAction['kind'][] = [
        'liveQuiz',
        'practiceQuiz',
        'microLearning',
        'groupActivity',
        'course',
        'catalogCollection',
        'chatbotDisclaimer',
        'competencyTree',
        'element',
        'answerCollection',
        'tag',
      ]
      const actions = [...run.originalActions].sort(
        (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)
      )
      for (const action of actions) {
        await assertLease()
        const key = actionKey(action)
        if (run.completed.includes(key)) {
          if ((await observeAction(prisma, action)) !== 'absent')
            throw new LecturerDeletionCommandError(
              'A recorded completed action is not absent; inspect before resuming'
            )
          continue
        }
        const fresh = await service.previewLecturerDeletion(prisma, target)
        if (
          fresh.blockers.some(
            (b) =>
              !(
                b.table === 'Course' &&
                b.reason === 'deletion-marker' &&
                intendedCourses.has(b.id)
              )
          ) ||
          !mediaUnchanged(fresh) ||
          fresh.actions.some((item) => !allowed.has(actionKey(item)))
        ) {
          throw new LecturerDeletionCommandError(
            `Dependencies changed; stop the partial run. ${BLOCKED_NEXT_STEP}`
          )
        }
        const state = await observeAction(prisma, action)
        if (run.intended.includes(key)) {
          if (action.kind === 'course') {
            const courseObservation = await observeCourse(
              prisma,
              String(action.id)
            )
            if (courseObservation.state === 'present')
              throw courseRecoveryError(action, courseObservation)
          } else if (state === 'present')
            throw new LecturerDeletionCommandError(
              'An earlier mutation has an uncertain outcome; reconcile it before continuing'
            )
        } else {
          if (state === 'absent') {
            if (action.kind !== 'tag')
              throw new LecturerDeletionCommandError(
                'An unplanned object disappeared; inspect the run'
              )
          } else {
            await assertCourseDuplicationClear(run.originalActions)
            await assertLease()
            run.intended.push(key)
            await save(receiptPath, run)
            try {
              if (
                action.kind === 'chatbotDisclaimer' ||
                action.kind === 'competencyTree'
              ) {
                await assertLease()
                await service.deleteUnusedLecturerLeaf(prisma, target, action)
              } else if (
                action.kind !== 'element' ||
                state !== 'soft-deleted'
              ) {
                await performDeletionAction(action, request)
              }
            } catch (error) {
              if (error instanceof OperatorLeaseLostError) {
                run.intended = run.intended.filter((item) => item !== key)
                await save(receiptPath, run)
                throw error
              }
              if (action.kind === 'course') {
                const observation = await observeCourse(
                  prisma,
                  String(action.id)
                ).catch(() => undefined)
                throw courseRecoveryError(action, observation)
              }
              throw error
            }
          }
        }
        if (action.kind === 'course') {
          const deadline = Date.now() + 60_000
          let pending = true
          while (pending) {
            const courseObservation = await observeCourse(
              prisma,
              String(action.id)
            )
            pending = courseObservation.state !== 'absent'
            if (!pending) break
            if (courseObservation.state !== 'pending' || Date.now() >= deadline)
              throw courseRecoveryError(action, courseObservation)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        } else if (action.kind === 'element') {
          if ((await observeAction(prisma, action)) !== 'absent') {
            await assertCourseDuplicationClear(run.originalActions)
            await assertLease()
            await service.purgePrivateElement(prisma, target, Number(action.id))
          }
        }
        if ((await observeAction(prisma, action)) !== 'absent')
          throw new LecturerDeletionCommandError(
            'Deletion retained a database row; stop before finalization'
          )
        run.completed.push(key)
        await save(receiptPath, run)
      }
      const remaining = await service.previewLecturerDeletion(prisma, target)
      if (
        remaining.blockers.length ||
        remaining.actions.length ||
        !mediaUnchanged(remaining)
      )
        throw new LecturerDeletionCommandError(
          `Residual teaching content prevents account finalization. ${BLOCKED_NEXT_STEP}`
        )
      const { BlobServiceClient, StorageSharedKeyCredential } = await import(
        '@azure/storage-blob'
      )
      const account = process.env.BLOB_STORAGE_ACCOUNT_NAME!
      const blob = new BlobServiceClient(
        `https://${account}.blob.core.windows.net`,
        new StorageSharedKeyCredential(
          account,
          process.env.BLOB_STORAGE_ACCESS_KEY!
        ),
        { retryOptions: { maxTries: 1, tryTimeoutInMs: 30_000 } }
      )
      const container = blob.getContainerClient(target.id)
      if (!run.storageComplete) {
        await assertLease()
        run.storageIntended = true
        await save(receiptPath, run)
        await assertCourseDuplicationClear(run.originalActions)
        await assertLease()
        await container.deleteIfExists()
        const acceptedAt = Date.now()
        const deadline = acceptedAt + 60_000
        do {
          const exists = await container.exists()
          if (!exists && Date.now() >= acceptedAt + 31_000) {
            run.storageComplete = true
            break
          }
          if (Date.now() >= deadline) break
          await new Promise((resolve) => setTimeout(resolve, 2000))
        } while (Date.now() < deadline)
        if (!run.storageComplete)
          throw new LecturerDeletionCommandError(
            'Storage deletion has not reached confirmed absence'
          )
        await save(receiptPath, run)
      } else if (await container.exists()) {
        throw new LecturerDeletionCommandError(
          'Storage reappeared; reconcile it before continuing'
        )
      }
      run.accountIntended = true
      await save(receiptPath, run)
      await assertLease()
      await assertCourseDuplicationClear(run.originalActions)
      // The finalizer checks every remaining relation and only then removes
      // verified unused media metadata and authentication/grantee records.
      await service.finalizeLecturerDeletion(prisma, target, {
        mediaIds: remaining.mediaIds,
      })
      if ((await observeExactUser(prisma, target)) !== 'absent')
        throw new LecturerDeletionCommandError(
          'Account finalization did not establish exact User absence'
        )
      run.accountComplete = true
      await save(receiptPath, run)
      console.log('Lecturer account and eligible active contents deleted.')
    } finally {
      releaseLease?.()
      await lease
      redis.disconnect()
      await prisma.$disconnect()
    }
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof LecturerDeletionCommandError
        ? error.message
        : 'Lecturer deletion stopped; inspect private state before resuming'
    )
    process.exitCode = 1
  })
}
