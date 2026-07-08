import * as DB from '@klicker-uzh/prisma/client'
import { ElementManipulationInput } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import { z } from 'zod'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  IMPORT_EXPORT_PACKAGE_TYPE,
  IMPORT_EXPORT_PACKAGE_VERSION,
  isImportExportLocalRuntime,
  MAX_ELEMENT_POINTS_MULTIPLIER,
  MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
  MAX_IMPORT_EXPORT_CONTENT_LENGTH,
  MAX_IMPORT_EXPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_EXPORT_ELEMENTS,
  MAX_IMPORT_EXPORT_JSON_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_FILES,
  MAX_IMPORT_EXPORT_NAME_LENGTH,
  MAX_IMPORT_EXPORT_OPTIONS_BYTES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TAGS,
  readPositiveIntegerEnv,
} from '../lib/importExportPackageConfig.js'
import validateAndProcessElementOptions from '../lib/validateAndProcessElementOptions.js'
import { createZip, parseZip } from '../lib/zip.js'
import { manipulateElement } from './elements.js'
import {
  backfillMissingImportFingerprintsForOwner,
  computeAnswerCollectionImportFingerprint,
  computeElementImportFingerprint,
  normalizeImportExportTags,
} from './importExportFingerprints.js'
import {
  deleteImportedMediaFile,
  downloadKlickerMediaFile,
  finalizeStagedImportedMediaFile,
  isKlickerMediaFileExportable,
  parseKlickerMediaUrl,
  stageImportedMediaFile,
  type StagedImportedMediaFile,
} from './mediaStorage.js'
import {
  downloadElementImportPackage,
  prepareElementImportPackageUpload as preparePackageUpload,
  uploadElementExportPackage,
} from './packageStorage.js'

const IMPORT_TOKEN_TTL_MS = 60 * 60 * 1000
const IMPORT_EXPORT_TOKEN_SECRET_ENV = 'IMPORT_EXPORT_TOKEN_SECRET'
const RATE_LIMIT_WINDOW_SECONDS_ENV =
  'IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS'
const RATE_LIMIT_ERROR =
  'Too many import/export package requests. Please try again later.'
const RATE_LIMIT_UNAVAILABLE_ERROR =
  'Import/export package rate limiting is temporarily unavailable.'
const PACKAGE_MEDIA_HREF_PREFIX = 'klicker-package-media://'

class ImportExportRateLimitError extends Error {
  constructor(
    readonly kind: 'exceeded' | 'unavailable',
    message: string
  ) {
    super(message)
    this.name = 'ImportExportRateLimitError'
  }
}

const EXPORT_PERMISSION_LEVELS = [
  DB.PermissionLevel.WRITE,
  DB.PermissionLevel.ADMIN,
  DB.PermissionLevel.OWNER,
]
const EXPORT_PREVIEW_ERROR_ELEMENT_PERMISSION = 'ELEMENT_EXPORT_PERMISSION'
const EXPORT_PREVIEW_ERROR_ANSWER_COLLECTION_PERMISSION =
  'ANSWER_COLLECTION_EXPORT_PERMISSION'
const EXPORT_PREVIEW_ERROR_TOO_MANY_ELEMENTS = 'TOO_MANY_ELEMENTS'

const IMPORT_ERROR_INVALID_PACKAGE = 'IMPORT_INVALID_PACKAGE'
const IMPORT_ERROR_INVALID_OPTIONS = 'IMPORT_INVALID_OPTIONS'
const IMPORT_ERROR_PACKAGE_TOO_LARGE = 'IMPORT_PACKAGE_TOO_LARGE'
const IMPORT_ERROR_PACKAGE_NOT_FOUND = 'IMPORT_PACKAGE_NOT_FOUND'
const IMPORT_ERROR_TAGS_IN_MANIFEST = 'IMPORT_ELEMENT_TAGS_IN_MANIFEST'
const IMPORT_ERROR_MANIFEST_NOT_AT_ROOT = 'IMPORT_MANIFEST_NOT_AT_ROOT'
const IMPORT_WARNING_STATUS_NORMALIZED = 'IMPORT_STATUS_NORMALIZED_TO_REVIEW'
const IMPORT_WARNING_TAGS_OMITTED = 'IMPORT_TAGS_OMITTED'
const IMPORT_WARNING_EXTERNAL_MEDIA = 'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED'
const IMPORT_WARNING_INACCESSIBLE_MEDIA = 'IMPORT_MEDIA_NOT_INCLUDED'

const SLIDING_WINDOW_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)
if count >= limit then
  redis.call('PEXPIRE', key, windowMs)
  return {0, count}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return {1, count + 1}
`

const RATE_LIMITS = {
  export: {
    limitEnv: 'IMPORT_EXPORT_PACKAGE_EXPORT_RATE_LIMIT',
    defaultLimit: 30,
  },
  upload: {
    limitEnv: 'IMPORT_EXPORT_PACKAGE_UPLOAD_RATE_LIMIT',
    defaultLimit: 30,
  },
  validate: {
    limitEnv: 'IMPORT_EXPORT_PACKAGE_VALIDATE_RATE_LIMIT',
    defaultLimit: 30,
  },
  import: {
    limitEnv: 'IMPORT_EXPORT_PACKAGE_IMPORT_RATE_LIMIT',
    defaultLimit: 10,
  },
} as const

type RateLimitedOperation = keyof typeof RATE_LIMITS

function exportPermissionFilter(userId: string) {
  return {
    OR: [
      {
        permissions: {
          some: {
            userId,
            permissionLevel: { in: EXPORT_PERMISSION_LEVELS },
          },
        },
      },
      {
        directPermissions: {
          some: {
            userId,
            permissionLevel: { in: EXPORT_PERMISSION_LEVELS },
          },
        },
      },
    ],
  }
}

const packageRefSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/)

const mediaManifestEntrySchema = z
  .object({
    ref: packageRefSchema,
    file: z.string(),
    filename: z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH),
    contentType: z.string().min(1).max(120),
    bytes: z.number().int().nonnegative().max(MAX_IMPORT_EXPORT_MEDIA_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceHref: z.string().url(),
  })
  .strict()

const manifestSchema = z
  .object({
    type: z.literal(IMPORT_EXPORT_PACKAGE_TYPE),
    version: z.literal(IMPORT_EXPORT_PACKAGE_VERSION),
    createdAt: z.string().datetime(),
    elements: z
      .array(
        z
          .object({
            ref: packageRefSchema,
            file: z.string(),
            answerCollectionRef: packageRefSchema.optional(),
          })
          .strict()
      )
      .max(MAX_IMPORT_EXPORT_ELEMENTS),
    answerCollections: z
      .array(
        z
          .object({
            ref: packageRefSchema,
            file: z.string(),
          })
          .strict()
      )
      .max(MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS),
    media: z.array(mediaManifestEntrySchema).max(MAX_IMPORT_EXPORT_MEDIA_FILES),
    warnings: z.array(z.string().min(1).max(160)).optional(),
  })
  .strict()

const answerCollectionEntrySchema = z
  .object({
    ref: packageRefSchema,
    value: z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH),
  })
  .strict()

const answerCollectionSchema = z
  .object({
    ref: packageRefSchema,
    name: z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH),
    description: z.string().max(MAX_IMPORT_EXPORT_DESCRIPTION_LENGTH),
    version: z.number().int().positive().default(1),
    entries: z
      .array(answerCollectionEntrySchema)
      .min(1)
      .max(MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES),
  })
  .strict()

const elementSchema = z
  .object({
    ref: packageRefSchema,
    name: z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH),
    content: z.string().min(1).max(MAX_IMPORT_EXPORT_CONTENT_LENGTH),
    type: z.nativeEnum(DB.ElementType),
    options: z.record(z.unknown()),
    pointsMultiplier: z
      .number()
      .int()
      .min(1)
      .max(MAX_ELEMENT_POINTS_MULTIPLIER),
    basePoints: z.boolean(),
    explanation: z
      .string()
      .max(MAX_IMPORT_EXPORT_CONTENT_LENGTH)
      .nullable()
      .optional(),
    status: z.nativeEnum(DB.ElementStatus),
    answerCollectionRef: packageRefSchema.optional(),
    answerCollectionItemRefs: z.array(packageRefSchema).optional(),
    tags: z
      .array(z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH))
      .max(MAX_IMPORT_EXPORT_TAGS)
      .optional(),
  })
  .strict()

type PackageManifest = z.infer<typeof manifestSchema>
type PackageMediaManifestEntry = z.infer<typeof mediaManifestEntrySchema>
type PackageAnswerCollection = z.infer<typeof answerCollectionSchema>
type PackageElement = z.infer<typeof elementSchema>

type PackageMedia = PackageMediaManifestEntry & {
  data: Buffer
}

type NormalizedImportPackage = {
  manifest: PackageManifest
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
  media: PackageMedia[]
  warnings: string[]
}

type PreviewEntry = {
  id: number
  value: string
}

function logImportExportPackageEvent(
  event: string,
  fields: Record<string, number | string | string[] | boolean | null>
) {
  console.info(
    '[ImportExportPackageMetric]',
    JSON.stringify({
      event,
      ...fields,
    })
  )
}

function assertOptionsSize(options: Record<string, unknown>) {
  if (
    Buffer.byteLength(JSON.stringify(options), 'utf8') >
    MAX_IMPORT_EXPORT_OPTIONS_BYTES
  ) {
    throw new Error('Element options are too large.')
  }
}

async function assertImportExportRateLimit(
  ctx: ContextWithUser,
  operation: RateLimitedOperation
) {
  const windowSeconds = readPositiveIntegerEnv(
    RATE_LIMIT_WINDOW_SECONDS_ENV,
    15 * 60
  )
  const limit = readPositiveIntegerEnv(
    RATE_LIMITS[operation].limitEnv,
    RATE_LIMITS[operation].defaultLimit
  )
  const windowMs = windowSeconds * 1000
  const key = `rate-limit:import-export-package:${operation}:${ctx.user.sub}`

  try {
    const rateLimitResult = await ctx.redisExec.eval(
      SLIDING_WINDOW_RATE_LIMIT_SCRIPT,
      1,
      key,
      Date.now(),
      windowMs,
      limit,
      randomUUID()
    )
    const [allowed, count] = Array.isArray(rateLimitResult)
      ? rateLimitResult.map((value) => Number(value))
      : []

    if (allowed !== 0 && allowed !== 1) {
      throw new Error('Unexpected import/export rate-limit response.')
    }

    if (allowed === 0) {
      logImportExportPackageEvent('rate_limit_exceeded', {
        operation,
        limit,
        windowSeconds,
        count: count ?? limit,
      })
      throw new ImportExportRateLimitError('exceeded', RATE_LIMIT_ERROR)
    }
  } catch (error) {
    if (
      error instanceof ImportExportRateLimitError &&
      error.kind === 'exceeded'
    ) {
      throw error
    }

    console.error(
      `[ImportExportPackageRateLimit] ${operation} rate limit check failed`,
      error
    )
    logImportExportPackageEvent('rate_limit_unavailable', {
      operation,
      limit,
      windowSeconds,
    })
    throw new ImportExportRateLimitError(
      'unavailable',
      RATE_LIMIT_UNAVAILABLE_ERROR
    )
  }
}

function assertUniqueRefs(refs: string[], label: string) {
  const seenRefs = new Set<string>()

  for (const ref of refs) {
    if (seenRefs.has(ref)) {
      throw new Error(`${label} must be unique.`)
    }

    seenRefs.add(ref)
  }
}

function assertGloballyUniquePackageRefs({
  answerCollections,
  elements,
  media = [],
}: {
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
  media?: PackageMediaManifestEntry[]
}) {
  const refs = new Map<string, string>()

  function addRef(ref: string, label: string) {
    const existingLabel = refs.get(ref)
    if (existingLabel) {
      throw new Error(
        `Package references must be globally unique. Reference ${ref} is used for ${existingLabel} and ${label}.`
      )
    }

    refs.set(ref, label)
  }

  for (const element of elements) {
    addRef(element.ref, 'element')
  }

  for (const collection of answerCollections) {
    addRef(collection.ref, 'answer collection')

    for (const entry of collection.entries) {
      addRef(entry.ref, 'answer collection entry')
    }
  }

  for (const mediaEntry of media) {
    addRef(mediaEntry.ref, 'media')
  }
}

export type ElementImportPackagePreviewElement = {
  ref: string
  name: string
  content: string
  type: DB.ElementType
  options: Record<string, unknown>
  pointsMultiplier: number
  basePoints: boolean
  explanation?: string | null
  status: DB.ElementStatus
  tags: string[]
  alreadyImported: boolean
  existingElementId?: number | null
  answerCollectionId?: number | null
  answerCollectionRef?: string | null
  answerCollectionItems: PreviewEntry[]
  answerCollectionEntries: PreviewEntry[]
}

export type ElementImportPackagePreviewAnswerCollection = {
  ref: string
  name: string
  description: string
  alreadyImported: boolean
  existingAnswerCollectionId?: number | null
  entries: PreviewEntry[]
}

export type ElementExportPackagePreviewElement = {
  id: number
  name: string
  type: DB.ElementType
  answerCollectionRef?: string | null
}

export type ElementExportPackagePreviewAnswerCollection = {
  ref: string
  name: string
  description: string
  entries: PreviewEntry[]
  elementNames: string[]
}

function emptyExportPackagePreview(errors: string[]) {
  return {
    elements: [],
    answerCollections: [],
    warnings: [],
    errors,
  }
}

type SignedImportToken = {
  blobName: string
  sha256: string
  userId: string
  expiresAt: number
}

function uniqueCodes(codes: string[]) {
  return Array.from(new Set(codes))
}

function parseJsonBuffer<T>(
  buffer: Buffer,
  schema: z.ZodType<T>,
  label: string
) {
  if (buffer.length > MAX_IMPORT_EXPORT_JSON_BYTES) {
    throw new Error(`${label} is too large.`)
  }

  const parsed = JSON.parse(buffer.toString('utf8'))
  return schema.parse(parsed)
}

function isManifestElementTagsError(error: unknown) {
  return (
    error instanceof z.ZodError &&
    error.issues.some((issue) => {
      const keys =
        'keys' in issue && Array.isArray(issue.keys) ? issue.keys : []

      return (
        issue.code === z.ZodIssueCode.unrecognized_keys &&
        issue.path.length === 2 &&
        issue.path[0] === 'elements' &&
        typeof issue.path[1] === 'number' &&
        keys.includes('tags')
      )
    })
  )
}

function getImportPackageErrorCode(error: unknown) {
  if (!(error instanceof Error)) {
    return IMPORT_ERROR_INVALID_PACKAGE
  }

  if (error.message === IMPORT_ERROR_INVALID_OPTIONS) {
    return IMPORT_ERROR_INVALID_OPTIONS
  }

  if (isManifestElementTagsError(error)) {
    return IMPORT_ERROR_TAGS_IN_MANIFEST
  }

  if (/manifest must be at the ZIP root/i.test(error.message)) {
    return IMPORT_ERROR_MANIFEST_NOT_AT_ROOT
  }

  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    return IMPORT_ERROR_PACKAGE_NOT_FOUND
  }

  if (/too large/i.test(error.message)) {
    return IMPORT_ERROR_PACKAGE_TOO_LARGE
  }

  if (/could not be found|not found/i.test(error.message)) {
    return IMPORT_ERROR_PACKAGE_NOT_FOUND
  }

  return IMPORT_ERROR_INVALID_PACKAGE
}

function getTokenSecret() {
  const secret =
    process.env[IMPORT_EXPORT_TOKEN_SECRET_ENV] ??
    (!isImportExportLocalRuntime()
      ? undefined
      : (process.env.APP_SECRET ??
        process.env.NEXTAUTH_SECRET ??
        process.env.BLOB_STORAGE_ACCESS_KEY))

  if (!secret) {
    throw new Error('Import/export token secret is not configured.')
  }

  return secret
}

export function assertImportExportTokenSecretConfig() {
  if (isImportExportLocalRuntime()) {
    return
  }

  if (!process.env[IMPORT_EXPORT_TOKEN_SECRET_ENV]) {
    throw new Error(
      `${IMPORT_EXPORT_TOKEN_SECRET_ENV} must be configured in production.`
    )
  }

  getTokenSecret()
}

function signImportToken(payload: SignedImportToken) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  )
  const signature = createHmac('sha256', getTokenSecret())
    .update(body)
    .digest('base64url')

  return `${body}.${signature}`
}

function verifyImportToken(token: string, ctx: ContextWithUser) {
  const [body, signature] = token.split('.')
  if (!body || !signature) {
    throw new Error('Invalid import token.')
  }

  const expectedSignature = createHmac('sha256', getTokenSecret())
    .update(body)
    .digest()
  const providedSignature = Buffer.from(signature, 'base64url')

  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    throw new Error('Invalid import token.')
  }

  const payload = JSON.parse(
    Buffer.from(body, 'base64url').toString('utf8')
  ) as SignedImportToken

  if (payload.userId !== ctx.user.sub || payload.expiresAt < Date.now()) {
    throw new Error('Import token has expired.')
  }

  return payload
}

function hashBuffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function createImportedElementOriginalId(packageHash: string, ref: string) {
  return `import-package:${packageHash.slice(0, 16)}:${ref}`
}

function getElementImportOriginalId(
  packageHash: string,
  element: PackageElement
) {
  return createImportedElementOriginalId(packageHash, element.ref)
}

function normalizePackageTags(tags: string[] | undefined) {
  return normalizeImportExportTags(tags)
}

function createPackageMediaHref(ref: string) {
  return `${PACKAGE_MEDIA_HREF_PREFIX}${ref}`
}

function isExpectedPackagePath(path: string, folder: string) {
  return (
    path.startsWith(`${folder}/`) &&
    (folder === 'media' || path.endsWith('.json'))
  )
}

function parseElementImportPackage(buffer: Buffer): NormalizedImportPackage {
  if (buffer.length > MAX_IMPORT_EXPORT_PACKAGE_BYTES) {
    throw new Error('Import package is too large.')
  }

  const entries = parseZip(buffer, {
    maxEntries:
      MAX_IMPORT_EXPORT_ELEMENTS +
      MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS +
      MAX_IMPORT_EXPORT_MEDIA_FILES +
      1,
    maxUncompressedBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  })
  const files = new Map<string, Buffer>()

  for (const entry of entries) {
    if (files.has(entry.path)) {
      throw new Error('Import package contains duplicate files.')
    }
    files.set(entry.path, entry.data)
  }

  const manifestBuffer = files.get('manifest.json')
  if (!manifestBuffer) {
    if (
      Array.from(files.keys()).some((path) => path.endsWith('/manifest.json'))
    ) {
      throw new Error('Import package manifest must be at the ZIP root.')
    }

    throw new Error('Import package manifest is missing.')
  }

  const manifest = parseJsonBuffer(
    manifestBuffer,
    manifestSchema,
    'Import package manifest'
  )
  assertUniqueRefs(
    manifest.elements.map((element) => element.ref),
    'Element references'
  )
  assertUniqueRefs(
    manifest.answerCollections.map((collection) => collection.ref),
    'Answer collection references'
  )
  assertUniqueRefs(
    manifest.media.map((media) => media.ref),
    'Media references'
  )

  const expectedPaths = new Set(['manifest.json'])

  const answerCollections = manifest.answerCollections.map((entry) => {
    if (!isExpectedPackagePath(entry.file, 'answer-collections')) {
      throw new Error(
        'Import package contains an invalid answer collection file.'
      )
    }

    const file = files.get(entry.file)
    if (!file) {
      throw new Error('Import package is missing an answer collection file.')
    }

    expectedPaths.add(entry.file)
    const collection = parseJsonBuffer(
      file,
      answerCollectionSchema,
      'Answer collection file'
    )

    if (collection.ref !== entry.ref) {
      throw new Error('Answer collection reference mismatch.')
    }

    return {
      ...collection,
      version: collection.version ?? 1,
    }
  })

  const elements = manifest.elements.map((entry) => {
    if (!isExpectedPackagePath(entry.file, 'elements')) {
      throw new Error('Import package contains an invalid element file.')
    }

    const file = files.get(entry.file)
    if (!file) {
      throw new Error('Import package is missing an element file.')
    }

    expectedPaths.add(entry.file)
    const element = parseJsonBuffer(file, elementSchema, 'Element file')

    if (
      element.ref !== entry.ref ||
      element.answerCollectionRef !== entry.answerCollectionRef
    ) {
      throw new Error('Element reference mismatch.')
    }

    return element
  })

  const media = manifest.media.map((entry) => {
    if (!isExpectedPackagePath(entry.file, 'media')) {
      throw new Error('Import package contains an invalid media file.')
    }

    const file = files.get(entry.file)
    if (!file) {
      throw new Error('Import package is missing a media file.')
    }

    if (file.length !== entry.bytes || hashBuffer(file) !== entry.sha256) {
      throw new Error('Import package media checksum mismatch.')
    }

    expectedPaths.add(entry.file)
    return {
      ...entry,
      data: file,
    }
  })

  for (const path of files.keys()) {
    if (!expectedPaths.has(path)) {
      throw new Error('Import package contains unexpected files.')
    }
  }

  validatePackageDependencies({ answerCollections, elements, media })

  return {
    manifest,
    answerCollections,
    elements,
    media,
    warnings: uniqueCodes(manifest.warnings ?? []),
  }
}

function validatePackageDependencies({
  answerCollections,
  elements,
  media,
}: {
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
  media: PackageMedia[]
}) {
  assertUniqueRefs(
    elements.map((element) => element.ref),
    'Element references'
  )
  assertUniqueRefs(
    answerCollections.map((collection) => collection.ref),
    'Answer collection references'
  )
  assertUniqueRefs(
    media.map((entry) => entry.sourceHref),
    'Media package references'
  )
  assertGloballyUniquePackageRefs({ answerCollections, elements, media })

  const collectionRefs = new Set<string>()
  const entryRefsByCollectionRef = new Map<string, Set<string>>()
  const entryRefs = new Set<string>()

  for (const collection of answerCollections) {
    const values = new Set<string>()
    const refs = new Set<string>()

    collectionRefs.add(collection.ref)

    for (const entry of collection.entries) {
      if (values.has(entry.value) || refs.has(entry.ref)) {
        throw new Error('Answer collection contains duplicate entries.')
      }

      if (entryRefs.has(entry.ref)) {
        throw new Error('Answer collection entry references must be unique.')
      }

      values.add(entry.value)
      refs.add(entry.ref)
      entryRefs.add(entry.ref)
    }

    entryRefsByCollectionRef.set(collection.ref, refs)
  }

  for (const entry of media) {
    if (entry.sourceHref !== createPackageMediaHref(entry.ref)) {
      throw new Error('Media package reference mismatch.')
    }
  }

  for (const element of elements) {
    assertOptionsSize(element.options)

    const requiresAnswerCollection =
      element.type === DB.ElementType.SELECTION ||
      element.type === DB.ElementType.CASE_STUDY

    if (requiresAnswerCollection && !element.answerCollectionRef) {
      throw new Error(
        `Element "${element.name}" is missing an answer collection.`
      )
    }

    if (
      element.answerCollectionRef &&
      !collectionRefs.has(element.answerCollectionRef)
    ) {
      throw new Error(
        `Element "${element.name}" references an unknown collection.`
      )
    }

    const collectionEntryRefs = element.answerCollectionRef
      ? entryRefsByCollectionRef.get(element.answerCollectionRef)
      : undefined

    for (const itemRef of getElementEntryRefs(element)) {
      if (!entryRefs.has(itemRef) || !collectionEntryRefs?.has(itemRef)) {
        throw new Error(
          `Element "${element.name}" references an unknown entry.`
        )
      }
    }
  }
}

function getElementEntryRefs(element: PackageElement) {
  const refs = new Set(element.answerCollectionItemRefs ?? [])

  if (
    element.type !== DB.ElementType.CASE_STUDY ||
    !Array.isArray((element.options as any).cases)
  ) {
    return refs
  }

  for (const caseItem of (element.options as any).cases) {
    if (!Array.isArray(caseItem?.solutions)) continue

    for (const solution of caseItem.solutions) {
      if (typeof solution.itemId !== 'undefined') {
        throw new Error(
          'Case study package must not contain database item IDs.'
        )
      }

      if (typeof solution.itemRef === 'string') {
        refs.add(solution.itemRef)
      }
    }
  }

  return refs
}

function mapCaseStudySolutionItemIdsToRefs(
  options: Record<string, unknown>,
  entryRefById: Map<number, string>
) {
  const cloned = structuredClone(options) as Record<string, any>

  if (!Array.isArray(cloned.cases)) {
    return cloned
  }

  cloned.cases = cloned.cases.map((caseItem: any) => ({
    ...caseItem,
    solutions: Array.isArray(caseItem.solutions)
      ? caseItem.solutions.map((solution: any) => {
          const itemRef = entryRefById.get(solution.itemId)
          if (!itemRef) {
            throw new Error('Case study solution references an unknown entry.')
          }

          const { itemId, ...rest } = solution
          return {
            ...rest,
            itemRef,
          }
        })
      : caseItem.solutions,
  }))

  return cloned
}

function mapCaseStudySolutionRefsToItemIds(
  options: Record<string, unknown>,
  entryIdByRef: Map<string, number>
) {
  const cloned = structuredClone(options) as Record<string, any>

  if (!Array.isArray(cloned.cases)) {
    return cloned
  }

  cloned.cases = cloned.cases.map((caseItem: any) => ({
    ...caseItem,
    solutions: Array.isArray(caseItem.solutions)
      ? caseItem.solutions.map((solution: any) => {
          if (typeof solution.itemId !== 'undefined') {
            throw new Error(
              'Case study package must not contain database item IDs.'
            )
          }

          const itemId =
            typeof solution.itemRef === 'string'
              ? entryIdByRef.get(solution.itemRef)
              : undefined

          if (!itemId) {
            throw new Error('Case study solution references an unknown entry.')
          }

          const { itemRef, ...rest } = solution
          return {
            ...rest,
            itemId,
          }
        })
      : caseItem.solutions,
  }))

  return cloned
}

const URL_PATTERN = /(?:https?:\/\/|klicker-package-media:\/\/)[^\s<>"')\]]+/g

function collectStringValues(value: unknown, strings: string[]) {
  if (typeof value === 'string') {
    strings.push(value)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringValues(entry, strings))
    return
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStringValues(entry, strings))
  }
}

function extractUrlsFromStrings(values: string[]) {
  const urls = new Set<string>()

  for (const value of values) {
    for (const match of value.matchAll(URL_PATTERN)) {
      urls.add(match[0]!.replace(/[.,;:!?]+$/, ''))
    }
  }

  return Array.from(urls)
}

function collectElementUrls(element: {
  content: string
  explanation?: string | null
  options: unknown
}) {
  const values = [element.content, element.explanation ?? '']
  collectStringValues(element.options, values)
  return extractUrlsFromStrings(values)
}

function rewriteStringValue(value: string, replacements: Map<string, string>) {
  let rewritten = value
  for (const [from, to] of replacements) {
    rewritten = rewritten.split(from).join(to)
  }

  return rewritten
}

function rewriteUrlsInValue(value: unknown, replacements: Map<string, string>) {
  if (typeof value === 'string') {
    return rewriteStringValue(value, replacements)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => rewriteUrlsInValue(entry, replacements))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        rewriteUrlsInValue(entry, replacements),
      ])
    )
  }

  return value
}

function rewriteElementMediaUrls(
  element: PackageElement,
  replacements: Map<string, string>
) {
  if (replacements.size === 0) return element

  return {
    ...element,
    content: rewriteStringValue(element.content, replacements),
    explanation:
      typeof element.explanation === 'string'
        ? rewriteStringValue(element.explanation, replacements)
        : element.explanation,
    options: rewriteUrlsInValue(element.options, replacements) as Record<
      string,
      unknown
    >,
  }
}

function buildElementOptionsForManipulation(
  element: PackageElement,
  entryIdByRef: Map<string, number>,
  collectionIdByRef: Map<string, number>
) {
  const answerCollectionId = element.answerCollectionRef
    ? collectionIdByRef.get(element.answerCollectionRef)
    : undefined
  const collectionItemIds = (element.answerCollectionItemRefs ?? []).map(
    (ref) => {
      const id = entryIdByRef.get(ref)
      if (!id) {
        throw new Error(
          `Element "${element.name}" references an unknown entry.`
        )
      }

      return id
    }
  )

  if (element.type === DB.ElementType.SELECTION) {
    if (!answerCollectionId) {
      throw new Error(
        `Element "${element.name}" is missing its answer collection.`
      )
    }

    return {
      ...element.options,
      answerCollection: answerCollectionId,
      correctAnswers: collectionItemIds,
    } as Record<string, unknown>
  }

  if (element.type === DB.ElementType.CASE_STUDY) {
    if (!answerCollectionId) {
      throw new Error(
        `Element "${element.name}" is missing its answer collection.`
      )
    }

    return {
      ...mapCaseStudySolutionRefsToItemIds(element.options, entryIdByRef),
      answerCollection: answerCollectionId,
      collectionItemIds,
    } as Record<string, unknown>
  }

  return element.options
}

function assertValidElementOptions(
  element: PackageElement,
  options: Record<string, unknown>
) {
  const processedOptions = validateAndProcessElementOptions(
    element.type,
    options as any
  )

  if (processedOptions === null) {
    throw new Error(IMPORT_ERROR_INVALID_OPTIONS)
  }

  return processedOptions as Record<string, unknown>
}

function buildImportWarnings(normalizedPackage: NormalizedImportPackage) {
  const warnings = [...normalizedPackage.warnings]
  if (
    normalizedPackage.elements.some(
      (element) => normalizePackageTags(element.tags).length > 0
    )
  ) {
    warnings.push(IMPORT_WARNING_TAGS_OMITTED)
  }

  if (
    normalizedPackage.elements.some(
      (element) => element.status !== DB.ElementStatus.REVIEW
    )
  ) {
    warnings.push(IMPORT_WARNING_STATUS_NORMALIZED)
  }

  const packagedUrls = new Set(
    normalizedPackage.media.map((media) => media.sourceHref)
  )
  const unpackagedUrls = normalizedPackage.elements
    .flatMap((element) => collectElementUrls(element))
    .filter((url) => !packagedUrls.has(url))

  if (unpackagedUrls.some((url) => parseKlickerMediaUrl(url))) {
    warnings.push(IMPORT_WARNING_INACCESSIBLE_MEDIA)
  }

  if (unpackagedUrls.some((url) => !parseKlickerMediaUrl(url))) {
    warnings.push(IMPORT_WARNING_EXTERNAL_MEDIA)
  }

  return uniqueCodes(warnings)
}

type ImportPackageDuplicateMatches = {
  elementIdByFingerprint?: ReadonlyMap<string, number>
  answerCollectionIdByFingerprint?: ReadonlyMap<string, number>
}

function buildPackageMediaIdentityByUrl(
  normalizedPackage: NormalizedImportPackage
) {
  return new Map(
    normalizedPackage.media.map((media) => [
      media.sourceHref,
      `klicker-package-media-sha256:${media.sha256}`,
    ])
  )
}

function buildPreviewModel(
  normalizedPackage: NormalizedImportPackage,
  duplicateMatches: ImportPackageDuplicateMatches = {}
) {
  let nextPreviewEntryId = -1
  const previewIdByEntryRef = new Map<string, number>()
  const previewEntryValueById = new Map<number, string>()
  const previewCollectionIdByRef = new Map<string, number>()
  const previewCollectionsByRef = new Map<
    string,
    ElementImportPackagePreviewAnswerCollection
  >()
  const answerCollectionsByRef = new Map(
    normalizedPackage.answerCollections.map((collection) => [
      collection.ref,
      collection,
    ])
  )
  const answerCollectionFingerprintByRef = new Map<string, string>()
  const elementFingerprintByRef = new Map<string, string>()
  const mediaIdentityByUrl = buildPackageMediaIdentityByUrl(normalizedPackage)

  normalizedPackage.answerCollections.forEach((collection) => {
    const fingerprint = computeAnswerCollectionImportFingerprint(collection)
    answerCollectionFingerprintByRef.set(collection.ref, fingerprint)
    const entries = collection.entries.map((entry) => {
      const id = nextPreviewEntryId--
      previewIdByEntryRef.set(entry.ref, id)
      previewEntryValueById.set(id, entry.value)
      return { id, value: entry.value }
    })
    const existingAnswerCollectionId =
      duplicateMatches.answerCollectionIdByFingerprint?.get(fingerprint) ?? null

    previewCollectionsByRef.set(collection.ref, {
      ref: collection.ref,
      name: collection.name,
      description: collection.description,
      alreadyImported: existingAnswerCollectionId !== null,
      existingAnswerCollectionId,
      entries,
    })
    previewCollectionIdByRef.set(collection.ref, -previewCollectionsByRef.size)
  })

  const answerCollections = Array.from(previewCollectionsByRef.values())
  const elements = normalizedPackage.elements.map((element) => {
    const previewCollection = element.answerCollectionRef
      ? previewCollectionsByRef.get(element.answerCollectionRef)
      : undefined
    const itemRefs = element.answerCollectionItemRefs ?? []
    const answerCollectionItems = itemRefs.map((ref) => {
      const id = previewIdByEntryRef.get(ref)
      const value = previewCollection?.entries.find(
        (entry) => entry.id === id
      )?.value

      if (!id || !value) {
        throw new Error(
          `Element "${element.name}" references an unknown entry.`
        )
      }

      return { id, value }
    })

    const manipulationOptions = buildElementOptionsForManipulation(
      element,
      previewIdByEntryRef,
      previewCollectionIdByRef
    )
    const options = assertValidElementOptions(element, manipulationOptions)
    const entryValueById = new Map(
      Array.from(previewEntryValueById.entries()).filter(([id]) =>
        previewCollection?.entries.some((entry) => entry.id === id)
      )
    )
    const answerCollection = element.answerCollectionRef
      ? answerCollectionsByRef.get(element.answerCollectionRef)
      : undefined
    const fingerprint = computeElementImportFingerprint({
      name: element.name,
      content: element.content,
      type: element.type,
      options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      explanation: element.explanation ?? null,
      status: element.status,
      tags: normalizePackageTags(element.tags),
      answerCollection,
      selectedAnswerCollectionValues: answerCollectionItems.map(
        (entry) => entry.value
      ),
      entryValueById,
      mediaIdentityByUrl,
    })
    elementFingerprintByRef.set(element.ref, fingerprint)
    const existingElementId =
      duplicateMatches.elementIdByFingerprint?.get(fingerprint) ?? null

    return {
      ref: element.ref,
      name: element.name,
      content: element.content,
      type: element.type,
      options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      explanation: element.explanation ?? null,
      status: DB.ElementStatus.REVIEW,
      tags: normalizePackageTags(element.tags),
      alreadyImported: existingElementId !== null,
      existingElementId,
      answerCollectionId: element.answerCollectionRef
        ? -(
            normalizedPackage.answerCollections.findIndex(
              (collection) => collection.ref === element.answerCollectionRef
            ) + 1
          )
        : null,
      answerCollectionRef: element.answerCollectionRef ?? null,
      answerCollectionItems,
      answerCollectionEntries: previewCollection?.entries ?? [],
    }
  })

  return {
    preview: {
      answerCollections,
      elements,
    },
    elementFingerprintByRef,
    answerCollectionFingerprintByRef,
  }
}

function buildPreview(
  normalizedPackage: NormalizedImportPackage,
  duplicateMatches: ImportPackageDuplicateMatches = {}
) {
  return buildPreviewModel(normalizedPackage, duplicateMatches).preview
}

async function findImportPackageDuplicateMatches(
  previewModel: ReturnType<typeof buildPreviewModel>,
  ctx: ContextWithUser
): Promise<ImportPackageDuplicateMatches> {
  await backfillMissingImportFingerprintsForOwner(ctx)

  const elementFingerprints = Array.from(
    new Set(previewModel.elementFingerprintByRef.values())
  )
  const answerCollectionFingerprints = Array.from(
    new Set(previewModel.answerCollectionFingerprintByRef.values())
  )
  const [existingElements, existingAnswerCollections] = await Promise.all([
    elementFingerprints.length === 0
      ? []
      : ctx.prisma.element.findMany({
          where: {
            ownerId: ctx.user.sub,
            isDeleted: false,
            importFingerprint: { in: elementFingerprints },
          },
          select: {
            id: true,
            importFingerprint: true,
          },
          orderBy: {
            id: 'asc',
          },
        }),
    answerCollectionFingerprints.length === 0
      ? []
      : ctx.prisma.answerCollection.findMany({
          where: {
            ownerId: ctx.user.sub,
            isDeleted: false,
            importFingerprint: { in: answerCollectionFingerprints },
          },
          select: {
            id: true,
            importFingerprint: true,
          },
          orderBy: {
            id: 'asc',
          },
        }),
  ])

  const elementIdByFingerprint = new Map<string, number>()
  for (const element of existingElements) {
    if (
      element.importFingerprint &&
      !elementIdByFingerprint.has(element.importFingerprint)
    ) {
      elementIdByFingerprint.set(element.importFingerprint, element.id)
    }
  }

  const answerCollectionIdByFingerprint = new Map<string, number>()
  for (const collection of existingAnswerCollections) {
    if (
      collection.importFingerprint &&
      !answerCollectionIdByFingerprint.has(collection.importFingerprint)
    ) {
      answerCollectionIdByFingerprint.set(
        collection.importFingerprint,
        collection.id
      )
    }
  }

  return {
    elementIdByFingerprint,
    answerCollectionIdByFingerprint,
  }
}

async function buildPreviewWithDuplicateWarnings(
  normalizedPackage: NormalizedImportPackage,
  ctx: ContextWithUser
) {
  const previewModel = buildPreviewModel(normalizedPackage)
  const duplicateMatches = await findImportPackageDuplicateMatches(
    previewModel,
    ctx
  )

  return buildPreview(normalizedPackage, duplicateMatches)
}

function createPackageFilePath(
  folder: 'elements' | 'answer-collections' | 'media',
  ref: string
) {
  return folder === 'media' ? `${folder}/${ref}` : `${folder}/${ref}.json`
}

function sanitizeMediaFilename(filename: string) {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitized || 'media.bin'
}

function createAnonymousMediaFilename(index: number, filename: string) {
  const sanitized = sanitizeMediaFilename(filename)
  const extension = sanitized.match(/\.([a-z0-9]{1,12})$/)?.[1]
  return `media-${index}.${extension ?? 'bin'}`
}

type PackageZipFile = {
  path: string
  data: Buffer | string
}

function createJsonPackageFile(path: string, value: unknown, label: string) {
  const data = Buffer.from(JSON.stringify(value, null, 2), 'utf8')
  if (data.length > MAX_IMPORT_EXPORT_JSON_BYTES) {
    throw new Error(`${label} is too large.`)
  }

  return { path, data }
}

function getPackageZipFileDataLength(data: Buffer | string) {
  return Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, 'utf8')
}

function assertStoredZipSize(files: PackageZipFile[]) {
  let estimatedBytes = 22

  for (const file of files) {
    const fileNameBytes = Buffer.byteLength(file.path, 'utf8')
    estimatedBytes +=
      30 +
      fileNameBytes +
      getPackageZipFileDataLength(file.data) +
      46 +
      fileNameBytes

    if (estimatedBytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES) {
      throw new Error('Export package is too large.')
    }
  }
}

async function buildExportMediaWarnings(
  elements: Array<{
    content: string
    explanation?: string | null
    options: Record<string, unknown>
  }>,
  ctx: ContextWithUser
) {
  const warnings: string[] = []
  const urls = uniqueCodes(
    elements.flatMap((element) => collectElementUrls(element))
  )

  for (const url of urls) {
    if (!parseKlickerMediaUrl(url)) {
      warnings.push(IMPORT_WARNING_EXTERNAL_MEDIA)
      continue
    }

    if (!(await isKlickerMediaFileExportable(url, ctx))) {
      warnings.push(IMPORT_WARNING_INACCESSIBLE_MEDIA)
    }
  }

  return uniqueCodes(warnings)
}

async function createExportMediaFiles(
  elements: PackageElement[],
  ctx: ContextWithUser
) {
  const warnings: string[] = []
  const urls = uniqueCodes(
    elements.flatMap((element) => collectElementUrls(element))
  )
  const mediaEntries: PackageMediaManifestEntry[] = []
  const mediaFiles: { path: string; data: Buffer }[] = []
  const replacements = new Map<string, string>()
  let totalMediaBytes = 0

  for (const url of urls) {
    if (!parseKlickerMediaUrl(url)) {
      warnings.push(IMPORT_WARNING_EXTERNAL_MEDIA)
      continue
    }

    try {
      if (mediaEntries.length >= MAX_IMPORT_EXPORT_MEDIA_FILES) {
        throw new Error('Export package contains too many media files.')
      }

      const mediaFile = await downloadKlickerMediaFile(url, ctx)
      if (!mediaFile) {
        warnings.push(IMPORT_WARNING_INACCESSIBLE_MEDIA)
        continue
      }

      if (
        totalMediaBytes + mediaFile.buffer.length >
        MAX_IMPORT_EXPORT_PACKAGE_BYTES
      ) {
        throw new Error('Export package media is too large.')
      }
      totalMediaBytes += mediaFile.buffer.length

      const sha256 = hashBuffer(mediaFile.buffer)
      const index = mediaEntries.length + 1
      const ref = `media-${index}`
      const filename = createAnonymousMediaFilename(index, mediaFile.filename)
      const file = createPackageFilePath('media', filename)
      const sourceHref = createPackageMediaHref(ref)

      mediaEntries.push({
        ref,
        file,
        filename,
        contentType: mediaFile.contentType,
        bytes: mediaFile.buffer.length,
        sha256,
        sourceHref,
      })
      mediaFiles.push({ path: file, data: mediaFile.buffer })
      replacements.set(url, sourceHref)
    } catch (error) {
      if (
        error instanceof Error &&
        /too many media files|media is too large/i.test(error.message)
      ) {
        throw error
      }

      warnings.push(IMPORT_WARNING_INACCESSIBLE_MEDIA)
    }
  }

  return {
    mediaEntries,
    mediaFiles,
    replacements,
    warnings: uniqueCodes(warnings),
  }
}

export async function createElementExportPackage(
  { elementIds }: { elementIds: number[] },
  ctx: ContextWithUser
) {
  const uniqueElementIds = Array.from(new Set(elementIds))
  if (uniqueElementIds.length === 0) {
    throw new Error('No elements selected for export.')
  }
  if (uniqueElementIds.length > MAX_IMPORT_EXPORT_ELEMENTS) {
    throw new Error('Too many elements selected for export.')
  }

  const elements = await ctx.prisma.element.findMany({
    where: {
      id: { in: uniqueElementIds },
      isDeleted: false,
      ...exportPermissionFilter(ctx.user.sub),
    },
    select: {
      id: true,
      name: true,
      content: true,
      options: true,
      type: true,
      pointsMultiplier: true,
      explanation: true,
      version: true,
      status: true,
      answerCollectionId: true,
      answerCollectionItems: {
        select: {
          id: true,
          value: true,
          collectionId: true,
        },
      },
      tags: {
        where: {
          ownerId: ctx.user.sub,
        },
        select: {
          name: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
      basePoints: true,
    },
  })

  if (elements.length !== uniqueElementIds.length) {
    throw new Error('Some selected elements could not be exported.')
  }

  const elementsById = new Map(elements.map((element) => [element.id, element]))
  const orderedElements = uniqueElementIds.map((id) => elementsById.get(id)!)
  const answerCollectionIds = Array.from(
    new Set(
      orderedElements.flatMap((element) =>
        element.answerCollectionId ? [element.answerCollectionId] : []
      )
    )
  )

  const answerCollections =
    answerCollectionIds.length === 0
      ? []
      : await ctx.prisma.answerCollection.findMany({
          where: {
            id: { in: answerCollectionIds },
            isDeleted: false,
            ...exportPermissionFilter(ctx.user.sub),
          },
          select: {
            id: true,
            name: true,
            description: true,
            version: true,
            entries: {
              select: {
                id: true,
                value: true,
              },
              orderBy: {
                value: 'asc',
              },
            },
          },
        })

  if (answerCollections.length !== answerCollectionIds.length) {
    throw new Error(
      'Some linked answer collections could not be exported with WRITE permissions.'
    )
  }

  const answerCollectionsById = new Map(
    answerCollections.map((collection) => [collection.id, collection])
  )
  const orderedAnswerCollections = answerCollectionIds.map(
    (id) => answerCollectionsById.get(id)!
  )
  const answerCollectionRefById = new Map(
    orderedAnswerCollections.map((collection, index) => [
      collection.id,
      `answer-collection-${index + 1}`,
    ])
  )
  const entryRefById = new Map<number, string>()
  const manifestAnswerCollections = orderedAnswerCollections.map(
    (collection) => {
      const ref = answerCollectionRefById.get(collection.id)!
      for (const [entryIndex, entry] of collection.entries.entries()) {
        entryRefById.set(entry.id, `${ref}-entry-${entryIndex + 1}`)
      }

      return {
        ref,
        file: createPackageFilePath('answer-collections', ref),
      }
    }
  )

  const elementFiles = orderedElements.map((element, elementIndex) => {
    const ref = `element-${elementIndex + 1}`
    const answerCollectionRef = element.answerCollectionId
      ? answerCollectionRefById.get(element.answerCollectionId)
      : undefined

    if (
      (element.type === DB.ElementType.SELECTION ||
        element.type === DB.ElementType.CASE_STUDY) &&
      (!answerCollectionRef ||
        !answerCollectionsById.has(element.answerCollectionId!))
    ) {
      throw new Error(
        `Element "${element.name}" is missing its answer collection.`
      )
    }

    const options =
      element.type === DB.ElementType.CASE_STUDY
        ? mapCaseStudySolutionItemIdsToRefs(
            element.options as Record<string, unknown>,
            entryRefById
          )
        : structuredClone(element.options as Record<string, unknown>)

    const answerCollectionItemRefs = element.answerCollectionItems.map(
      (item) => {
        const ref = entryRefById.get(item.id)
        if (!ref) {
          throw new Error(
            `Element "${element.name}" references an unknown entry.`
          )
        }

        return ref
      }
    )

    return {
      manifest: {
        ref,
        file: createPackageFilePath('elements', ref),
        answerCollectionRef,
      },
      content: {
        ref,
        name: element.name,
        content: element.content,
        type: element.type,
        options,
        pointsMultiplier: element.pointsMultiplier,
        basePoints: element.basePoints,
        explanation: element.explanation ?? null,
        status: element.status,
        answerCollectionRef,
        answerCollectionItemRefs,
        tags: normalizePackageTags(element.tags.map((tag) => tag.name)),
      },
    }
  })

  const collectionFiles = orderedAnswerCollections.map((collection) => {
    const ref = answerCollectionRefById.get(collection.id)!
    return createJsonPackageFile(
      createPackageFilePath('answer-collections', ref),
      {
        ref,
        name: collection.name,
        description: collection.description,
        version: collection.version,
        entries: collection.entries.map((entry) => ({
          ref: entryRefById.get(entry.id),
          value: entry.value,
        })),
      },
      'Answer collection export file'
    )
  })

  const exportElements: PackageElement[] = elementFiles.map(
    (file) => file.content
  )
  const { mediaEntries, mediaFiles, replacements, warnings } =
    await createExportMediaFiles(exportElements, ctx)
  const packagedElementFiles = elementFiles.map((file) => ({
    ...file,
    content: rewriteElementMediaUrls(file.content, replacements),
  }))

  const manifest: PackageManifest = {
    type: IMPORT_EXPORT_PACKAGE_TYPE,
    version: IMPORT_EXPORT_PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    elements: elementFiles.map((file) => file.manifest),
    answerCollections: manifestAnswerCollections,
    media: mediaEntries,
    warnings,
  }

  const packageFiles: PackageZipFile[] = [
    createJsonPackageFile('manifest.json', manifest, 'Export package manifest'),
    ...collectionFiles,
    ...packagedElementFiles.map((file) =>
      createJsonPackageFile(
        file.manifest.file,
        file.content,
        'Element export file'
      )
    ),
    ...mediaFiles,
  ]
  assertStoredZipSize(packageFiles)

  const buffer = createZip(packageFiles)
  if (buffer.length > MAX_IMPORT_EXPORT_PACKAGE_BYTES) {
    throw new Error('Export package is too large.')
  }
  const filename = `klicker-elements-${randomUUID()}.zip`

  logImportExportPackageEvent('export_created', {
    packageBytes: buffer.length,
    elements: orderedElements.length,
    answerCollections: answerCollections.length,
    mediaFiles: mediaEntries.length,
    warnings,
  })

  return {
    filename,
    buffer,
  }
}

export async function getElementExportPackageLink(
  { elementIds }: { elementIds: number[] },
  ctx: ContextWithUser
) {
  await assertImportExportRateLimit(ctx, 'export')

  const { filename, buffer } = await createElementExportPackage(
    { elementIds },
    ctx
  )

  return await uploadElementExportPackage({ filename, buffer }, ctx)
}

export async function getElementExportPackagePreview(
  { elementIds }: { elementIds: number[] },
  ctx: ContextWithUser
) {
  const uniqueElementIds = Array.from(new Set(elementIds))
  if (uniqueElementIds.length === 0) {
    throw new Error('No elements selected for export.')
  }
  if (uniqueElementIds.length > MAX_IMPORT_EXPORT_ELEMENTS) {
    return emptyExportPackagePreview([EXPORT_PREVIEW_ERROR_TOO_MANY_ELEMENTS])
  }

  const elements = await ctx.prisma.element.findMany({
    where: {
      id: { in: uniqueElementIds },
      isDeleted: false,
      ...exportPermissionFilter(ctx.user.sub),
    },
    select: {
      id: true,
      name: true,
      content: true,
      options: true,
      type: true,
      explanation: true,
      answerCollectionId: true,
    },
  })

  if (elements.length !== uniqueElementIds.length) {
    return emptyExportPackagePreview([EXPORT_PREVIEW_ERROR_ELEMENT_PERMISSION])
  }

  const elementsById = new Map(elements.map((element) => [element.id, element]))
  const orderedElements = uniqueElementIds.map((id) => elementsById.get(id)!)
  const answerCollectionIds = Array.from(
    new Set(
      orderedElements.flatMap((element) =>
        element.answerCollectionId ? [element.answerCollectionId] : []
      )
    )
  )
  const answerCollections =
    answerCollectionIds.length === 0
      ? []
      : await ctx.prisma.answerCollection.findMany({
          where: {
            id: { in: answerCollectionIds },
            isDeleted: false,
            ...exportPermissionFilter(ctx.user.sub),
          },
          select: {
            id: true,
            name: true,
            description: true,
            entries: {
              select: {
                id: true,
                value: true,
              },
              orderBy: {
                value: 'asc',
              },
            },
          },
        })

  if (answerCollections.length !== answerCollectionIds.length) {
    return emptyExportPackagePreview([
      EXPORT_PREVIEW_ERROR_ANSWER_COLLECTION_PERMISSION,
    ])
  }

  return {
    elements: orderedElements.map((element) => ({
      id: element.id,
      name: element.name,
      type: element.type,
      answerCollectionRef: element.answerCollectionId
        ? `answer-collection-${element.answerCollectionId}`
        : null,
    })),
    answerCollections: answerCollections.map((collection) => {
      const ref = `answer-collection-${collection.id}`
      return {
        ref,
        name: collection.name,
        description: collection.description,
        entries: collection.entries,
        elementNames: orderedElements
          .filter((element) => element.answerCollectionId === collection.id)
          .map((element) => element.name),
      }
    }),
    warnings: await buildExportMediaWarnings(
      orderedElements.map((element) => ({
        content: element.content,
        explanation: element.explanation,
        options: element.options as Record<string, unknown>,
      })),
      ctx
    ),
    errors: [],
  }
}

export async function prepareElementImportPackageUpload(
  { filename }: { filename: string },
  ctx: ContextWithUser
) {
  await assertImportExportRateLimit(ctx, 'upload')

  if (!filename.toLowerCase().endsWith('.zip')) {
    throw new Error('Only ZIP import packages are supported.')
  }

  return await preparePackageUpload({ filename }, ctx)
}

export async function validateElementImportPackage(
  { blobName }: { blobName: string },
  ctx: ContextWithUser
) {
  await assertImportExportRateLimit(ctx, 'validate')

  let buffer: Buffer
  let normalizedPackage: NormalizedImportPackage
  let preview: ReturnType<typeof buildPreview>

  try {
    buffer = await downloadElementImportPackage({ blobName }, ctx)
    normalizedPackage = parseElementImportPackage(buffer)
    preview = await buildPreviewWithDuplicateWarnings(normalizedPackage, ctx)
  } catch (error) {
    const errorCode = getImportPackageErrorCode(error)
    logImportExportPackageEvent('validation_failed', {
      errorCode,
    })

    return {
      importToken: null,
      elements: [],
      answerCollections: [],
      warnings: [],
      errors: [errorCode],
    }
  }

  const packageHash = hashBuffer(buffer)
  const warnings = buildImportWarnings(normalizedPackage)
  logImportExportPackageEvent('validation_succeeded', {
    packageBytes: buffer.length,
    elements: normalizedPackage.elements.length,
    answerCollections: normalizedPackage.answerCollections.length,
    mediaFiles: normalizedPackage.media.length,
    warnings,
  })

  return {
    importToken: signImportToken({
      blobName,
      sha256: packageHash,
      userId: ctx.user.sub,
      expiresAt: Date.now() + IMPORT_TOKEN_TTL_MS,
    }),
    elements: preview.elements,
    answerCollections: preview.answerCollections,
    warnings,
    errors: [],
  }
}

function buildElementManipulationArgs(
  element: PackageElement,
  entryIdByRef: Map<string, number>,
  collectionIdByRef: Map<string, number>
): ElementManipulationInput {
  const options = buildElementOptionsForManipulation(
    element,
    entryIdByRef,
    collectionIdByRef
  )
  assertValidElementOptions(element, options)

  return {
    type: element.type,
    status: DB.ElementStatus.REVIEW,
    name: element.name,
    content: element.content,
    explanation: element.explanation ?? undefined,
    basePoints: element.basePoints,
    pointsMultiplier: element.pointsMultiplier,
    tags: [],
    options: options as any,
  }
}

type StagedPackageMedia = PackageMedia & {
  staged: StagedImportedMediaFile
}

async function stagePackageMediaFiles(
  mediaFiles: PackageMedia[],
  ctx: ContextWithUser,
  createdStagedMediaHrefs: string[]
) {
  const stagedMediaFiles: StagedPackageMedia[] = []

  for (const media of mediaFiles) {
    const staged = await stageImportedMediaFile(
      {
        buffer: media.data,
        contentType: media.contentType,
        filename: media.filename,
        originalId: `import-media:${media.sha256}`,
      },
      ctx
    )
    if (staged.createdBlob) {
      createdStagedMediaHrefs.push(staged.href)
    }
    stagedMediaFiles.push({ ...media, staged })
  }

  return stagedMediaFiles
}

async function finalizePackageMediaFiles(
  mediaFiles: StagedPackageMedia[],
  ctx: PrismaTransactionContextWithUser
) {
  const replacements = new Map<string, string>()
  const unusedStagedMediaHrefs: string[] = []

  for (const media of mediaFiles) {
    const finalized = await finalizeStagedImportedMediaFile(media.staged, ctx)
    replacements.set(media.sourceHref, finalized.href)

    if (finalized.unusedStagedHref) {
      unusedStagedMediaHrefs.push(finalized.unusedStagedHref)
    }
  }

  return {
    replacements,
    unusedStagedMediaHrefs,
  }
}

async function cleanupCreatedImportedMedia(createdMediaHrefs: string[]) {
  await Promise.all(
    createdMediaHrefs.map((href) =>
      deleteImportedMediaFile(href).catch((error) => {
        console.error(
          '[ImportExportMediaStorage] Failed to delete imported media blob after failed import',
          error
        )
      })
    )
  )
}

export async function importElementPackage(
  {
    importToken,
    selectedElementRefs,
  }: {
    importToken: string
    selectedElementRefs: string[]
  },
  ctx: ContextWithUser
) {
  await assertImportExportRateLimit(ctx, 'import')

  const selectedRefs = new Set(selectedElementRefs)
  if (selectedRefs.size === 0) {
    throw new Error('Select at least one element to import.')
  }

  const token = verifyImportToken(importToken, ctx)
  const buffer = await downloadElementImportPackage(
    { blobName: token.blobName },
    ctx
  )

  if (hashBuffer(buffer) !== token.sha256) {
    throw new Error('Import package changed after validation.')
  }

  return await importElementPackageBuffer({ buffer, selectedElementRefs }, ctx)
}

export async function importElementPackageBuffer(
  {
    buffer,
    selectedElementRefs,
  }: {
    buffer: Buffer
    selectedElementRefs: string[]
  },
  ctx: ContextWithUser
) {
  const selectedRefs = new Set(selectedElementRefs)
  if (selectedRefs.size === 0) {
    throw new Error('Select at least one element to import.')
  }

  const normalizedPackage = parseElementImportPackage(buffer)
  const packageHash = hashBuffer(buffer)
  const previewModel = buildPreviewModel(normalizedPackage)
  const selectedElements = normalizedPackage.elements.filter((element) =>
    selectedRefs.has(element.ref)
  )

  if (selectedElements.length !== selectedRefs.size) {
    throw new Error('Selected import elements could not be found.')
  }

  const elementsToImport = selectedElements
  const skippedElements = 0

  const requiredCollectionRefs = new Set(
    elementsToImport.flatMap((element) =>
      element.answerCollectionRef ? [element.answerCollectionRef] : []
    )
  )

  const createdStagedMediaHrefs: string[] = []
  let stagedPackageMediaFiles: StagedPackageMedia[] = []
  let unusedStagedMediaHrefs: string[] = []
  let result: {
    importedElements: number
    importedAnswerCollections: number
    skippedElements: number
  }

  if (elementsToImport.length === 0) {
    result = {
      importedElements: 0,
      importedAnswerCollections: 0,
      skippedElements,
    }
  } else {
    try {
      const selectedMediaUrls = new Set(
        elementsToImport.flatMap((element) => collectElementUrls(element))
      )
      stagedPackageMediaFiles = await stagePackageMediaFiles(
        normalizedPackage.media.filter((media) =>
          selectedMediaUrls.has(media.sourceHref)
        ),
        ctx,
        createdStagedMediaHrefs
      )

      result = await ctx.prisma.$transaction(
        async (prisma) => {
          const txCtx: PrismaTransactionContextWithUser = {
            ...ctx,
            prisma,
          }
          const collectionIdByRef = new Map<string, number>()
          const entryIdByRef = new Map<string, number>()
          const finalizedMedia = await finalizePackageMediaFiles(
            stagedPackageMediaFiles,
            txCtx
          )
          unusedStagedMediaHrefs = finalizedMedia.unusedStagedMediaHrefs
          const rewrittenElementsToImport = elementsToImport.map((element) =>
            rewriteElementMediaUrls(element, finalizedMedia.replacements)
          )

          for (const collection of normalizedPackage.answerCollections.filter(
            (collection) => requiredCollectionRefs.has(collection.ref)
          )) {
            const created = await prisma.answerCollection.create({
              data: {
                name: collection.name,
                description: collection.description,
                version: collection.version,
                importFingerprint:
                  previewModel.answerCollectionFingerprintByRef.get(
                    collection.ref
                  ),
                entries: {
                  create: collection.entries.map((entry) => ({
                    value: entry.value,
                  })),
                },
                owner: {
                  connect: {
                    id: ctx.user.sub,
                  },
                },
              },
              include: {
                entries: true,
              },
            })

            collectionIdByRef.set(collection.ref, created.id)
            await recomputeDerivedPermissions(
              { answerCollectionId: created.id, userId: ctx.user.sub },
              prisma
            )

            const createdEntriesBySourceOrder = [...created.entries].sort(
              (first, second) => first.id - second.id
            )
            for (const [index, entry] of collection.entries.entries()) {
              const createdEntry = createdEntriesBySourceOrder[index]
              if (!createdEntry) {
                throw new Error(
                  'Imported answer collection entry could not be mapped.'
                )
              }

              entryIdByRef.set(entry.ref, createdEntry.id)
            }

            ctx.emitter.emit('invalidate', {
              typename: 'AnswerCollection',
              id: created.id,
            })
          }

          let importedElements = 0
          for (const element of rewrittenElementsToImport) {
            const importedElement = await manipulateElement(
              buildElementManipulationArgs(
                element,
                entryIdByRef,
                collectionIdByRef
              ),
              txCtx
            )

            if (!importedElement) {
              throw new Error(
                `Element "${element.name}" could not be imported.`
              )
            }

            await prisma.element.update({
              where: { id: importedElement.id },
              data: {
                // Mark the element as imported without persisting exported DB IDs.
                originalId: getElementImportOriginalId(packageHash, element),
                importFingerprint: previewModel.elementFingerprintByRef.get(
                  element.ref
                ),
              },
            })

            importedElements++
          }

          return {
            importedElements,
            importedAnswerCollections: collectionIdByRef.size,
            skippedElements,
          }
        },
        {
          maxWait: 10_000,
          timeout: 60_000,
        }
      )
    } catch (error) {
      await cleanupCreatedImportedMedia(createdStagedMediaHrefs)
      throw error
    }
  }

  await cleanupCreatedImportedMedia(unusedStagedMediaHrefs)

  logImportExportPackageEvent('import_completed', {
    packageBytes: buffer.length,
    selectedElements: selectedRefs.size,
    importedElements: result.importedElements,
    importedAnswerCollections: result.importedAnswerCollections,
    skippedElements: result.skippedElements,
    mediaFiles: createdStagedMediaHrefs.length - unusedStagedMediaHrefs.length,
  })

  return result
}

export function validateElementImportPackageBuffer(buffer: Buffer) {
  const normalizedPackage = parseElementImportPackage(buffer)
  return {
    normalizedPackage,
    preview: buildPreview(normalizedPackage),
    warnings: buildImportWarnings(normalizedPackage),
  }
}
