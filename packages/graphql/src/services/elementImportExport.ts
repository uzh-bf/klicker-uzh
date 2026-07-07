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
import { createZip, parseZip } from '../lib/zip.js'
import { manipulateElement } from './elements.js'
import {
  downloadElementImportPackage,
  prepareElementImportPackageUpload as preparePackageUpload,
  uploadElementExportPackage,
} from './packageStorage.js'

const PACKAGE_TYPE = 'klicker-element-package'
const PACKAGE_VERSION = 1
const MAX_PACKAGE_BYTES = 10 * 1024 * 1024
const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_ELEMENTS = 100
const MAX_ANSWER_COLLECTIONS = 50
const MAX_ANSWER_COLLECTION_ENTRIES = 2000
const MAX_NAME_LENGTH = 255
const MAX_CONTENT_LENGTH = 200_000
const MAX_DESCRIPTION_LENGTH = 20_000
const MAX_OPTIONS_BYTES = 200_000
const IMPORT_TOKEN_TTL_MS = 60 * 60 * 1000
const RATE_LIMIT_WINDOW_SECONDS_ENV =
  'IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS'
const RATE_LIMIT_ERROR =
  'Too many import/export package requests. Please try again later.'

const EXPORT_PERMISSION_LEVELS = [
  DB.PermissionLevel.WRITE,
  DB.PermissionLevel.ADMIN,
  DB.PermissionLevel.OWNER,
]
const EXPORT_PREVIEW_ERROR_ELEMENT_PERMISSION = 'ELEMENT_EXPORT_PERMISSION'
const EXPORT_PREVIEW_ERROR_ANSWER_COLLECTION_PERMISSION =
  'ANSWER_COLLECTION_EXPORT_PERMISSION'

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

const sourceSchema = z
  .object({
    id: z.number().int().positive().optional(),
    version: z.number().int().positive().optional(),
  })
  .strict()

const manifestSchema = z
  .object({
    type: z.literal(PACKAGE_TYPE),
    version: z.literal(PACKAGE_VERSION),
    createdAt: z.string().datetime(),
    elements: z
      .array(
        z
          .object({
            ref: packageRefSchema,
            file: z.string(),
            answerCollectionRef: packageRefSchema.optional(),
            source: sourceSchema.optional(),
          })
          .strict()
      )
      .max(MAX_ELEMENTS),
    answerCollections: z
      .array(
        z
          .object({
            ref: packageRefSchema,
            file: z.string(),
            source: sourceSchema.optional(),
          })
          .strict()
      )
      .max(MAX_ANSWER_COLLECTIONS),
  })
  .strict()

const answerCollectionEntrySchema = z
  .object({
    ref: packageRefSchema,
    value: z.string().min(1).max(MAX_NAME_LENGTH),
    source: sourceSchema.optional(),
  })
  .strict()

const answerCollectionSchema = z
  .object({
    ref: packageRefSchema,
    name: z.string().min(1).max(MAX_NAME_LENGTH),
    description: z.string().max(MAX_DESCRIPTION_LENGTH),
    entries: z
      .array(answerCollectionEntrySchema)
      .min(1)
      .max(MAX_ANSWER_COLLECTION_ENTRIES),
    source: sourceSchema.optional(),
  })
  .strict()

const elementSchema = z
  .object({
    ref: packageRefSchema,
    name: z.string().min(1).max(MAX_NAME_LENGTH),
    content: z.string().min(1).max(MAX_CONTENT_LENGTH),
    type: z.nativeEnum(DB.ElementType),
    options: z.record(z.unknown()),
    pointsMultiplier: z.number().int().positive(),
    basePoints: z.boolean(),
    explanation: z.string().max(MAX_CONTENT_LENGTH).nullable().optional(),
    status: z.nativeEnum(DB.ElementStatus),
    answerCollectionRef: packageRefSchema.optional(),
    answerCollectionItemRefs: z.array(packageRefSchema).optional(),
    source: sourceSchema.optional(),
  })
  .strict()

type PackageManifest = z.infer<typeof manifestSchema>
type PackageAnswerCollection = z.infer<typeof answerCollectionSchema>
type PackageElement = z.infer<typeof elementSchema>

type NormalizedImportPackage = {
  manifest: PackageManifest
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
}

type PreviewEntry = {
  id: number
  value: string
}

function assertOptionsSize(options: Record<string, unknown>) {
  if (Buffer.byteLength(JSON.stringify(options), 'utf8') > MAX_OPTIONS_BYTES) {
    throw new Error('Element options are too large.')
  }
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
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
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  const key = `rate-limit:import-export-package:${operation}:${ctx.user.sub}:${bucket}`

  try {
    const count = await ctx.redisExec.incr(key)

    if (count === 1) {
      await ctx.redisExec.expire(key, windowSeconds)
    }

    if (count > limit) {
      throw new Error(RATE_LIMIT_ERROR)
    }
  } catch (error) {
    if (error instanceof Error && error.message === RATE_LIMIT_ERROR) {
      throw error
    }

    throw new Error(RATE_LIMIT_ERROR)
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
}: {
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
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
  answerCollectionId?: number | null
  answerCollectionRef?: string | null
  answerCollectionItems: PreviewEntry[]
  answerCollectionEntries: PreviewEntry[]
}

export type ElementImportPackagePreviewAnswerCollection = {
  ref: string
  name: string
  description: string
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
    errors,
  }
}

type SignedImportToken = {
  blobName: string
  sha256: string
  userId: string
  expiresAt: number
}

function parseJsonBuffer<T>(
  buffer: Buffer,
  schema: z.ZodType<T>,
  label: string
) {
  if (buffer.length > MAX_JSON_BYTES) {
    throw new Error(`${label} is too large.`)
  }

  const parsed = JSON.parse(buffer.toString('utf8'))
  return schema.parse(parsed)
}

function getTokenSecret() {
  return (
    process.env.APP_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.BLOB_STORAGE_ACCESS_KEY ??
    'development-import-export-secret'
  )
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

function assertExpectedPackagePath(path: string, folder: string) {
  return path.startsWith(`${folder}/`) && path.endsWith('.json')
}

function parseElementImportPackage(buffer: Buffer): NormalizedImportPackage {
  if (buffer.length > MAX_PACKAGE_BYTES) {
    throw new Error('Import package is too large.')
  }

  const entries = parseZip(buffer, {
    maxEntries: MAX_ELEMENTS + MAX_ANSWER_COLLECTIONS + 1,
    maxUncompressedBytes: MAX_PACKAGE_BYTES,
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

  const expectedPaths = new Set(['manifest.json'])

  const answerCollections = manifest.answerCollections.map((entry) => {
    if (!assertExpectedPackagePath(entry.file, 'answer-collections')) {
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

    return collection
  })

  const elements = manifest.elements.map((entry) => {
    if (!assertExpectedPackagePath(entry.file, 'elements')) {
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

  for (const path of files.keys()) {
    if (!expectedPaths.has(path)) {
      throw new Error('Import package contains unexpected files.')
    }
  }

  validatePackageDependencies({ answerCollections, elements })

  return {
    manifest,
    answerCollections,
    elements,
  }
}

function validatePackageDependencies({
  answerCollections,
  elements,
}: {
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
}) {
  assertUniqueRefs(
    elements.map((element) => element.ref),
    'Element references'
  )
  assertUniqueRefs(
    answerCollections.map((collection) => collection.ref),
    'Answer collection references'
  )
  assertGloballyUniquePackageRefs({ answerCollections, elements })

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

function buildPreview(normalizedPackage: NormalizedImportPackage) {
  let nextPreviewEntryId = -1
  const previewIdByEntryRef = new Map<string, number>()
  const previewCollectionsByRef = new Map<
    string,
    ElementImportPackagePreviewAnswerCollection
  >()

  normalizedPackage.answerCollections.forEach((collection) => {
    const entries = collection.entries.map((entry) => {
      const id = nextPreviewEntryId--
      previewIdByEntryRef.set(entry.ref, id)
      return { id, value: entry.value }
    })

    previewCollectionsByRef.set(collection.ref, {
      ref: collection.ref,
      name: collection.name,
      description: collection.description,
      entries,
    })
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

    const options =
      element.type === DB.ElementType.CASE_STUDY
        ? mapCaseStudySolutionRefsToItemIds(
            element.options,
            previewIdByEntryRef
          )
        : structuredClone(element.options)

    return {
      ref: element.ref,
      name: element.name,
      content: element.content,
      type: element.type,
      options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      explanation: element.explanation ?? null,
      status: element.status,
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
    answerCollections,
    elements,
  }
}

function createPackageFilePath(
  folder: 'elements' | 'answer-collections',
  ref: string
) {
  return `${folder}/${ref}.json`
}

export async function createElementExportPackage(
  { elementIds }: { elementIds: number[] },
  ctx: ContextWithUser
) {
  const uniqueElementIds = Array.from(new Set(elementIds))
  if (uniqueElementIds.length === 0) {
    throw new Error('No elements selected for export.')
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
  const entryRefById = new Map<number, string>()
  const manifestAnswerCollections = answerCollections.map((collection) => {
    const ref = `answer-collection-${collection.id}`
    for (const entry of collection.entries) {
      entryRefById.set(entry.id, `${ref}-entry-${entry.id}`)
    }

    return {
      ref,
      file: createPackageFilePath('answer-collections', ref),
      source: {
        id: collection.id,
        version: collection.version,
      },
    }
  })

  const elementFiles = orderedElements.map((element) => {
    const ref = `element-${element.id}`
    const answerCollectionRef = element.answerCollectionId
      ? `answer-collection-${element.answerCollectionId}`
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
        source: {
          id: element.id,
          version: element.version,
        },
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
        source: {
          id: element.id,
          version: element.version,
        },
      },
    }
  })

  const collectionFiles = answerCollections.map((collection) => {
    const ref = `answer-collection-${collection.id}`
    return {
      path: createPackageFilePath('answer-collections', ref),
      data: JSON.stringify(
        {
          ref,
          name: collection.name,
          description: collection.description,
          entries: collection.entries.map((entry) => ({
            ref: entryRefById.get(entry.id),
            value: entry.value,
            source: { id: entry.id },
          })),
          source: {
            id: collection.id,
            version: collection.version,
          },
        },
        null,
        2
      ),
    }
  })

  const manifest: PackageManifest = {
    type: PACKAGE_TYPE,
    version: PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    elements: elementFiles.map((file) => file.manifest),
    answerCollections: manifestAnswerCollections,
  }

  const buffer = createZip([
    {
      path: 'manifest.json',
      data: JSON.stringify(manifest, null, 2),
    },
    ...collectionFiles,
    ...elementFiles.map((file) => ({
      path: file.manifest.file,
      data: JSON.stringify(file.content, null, 2),
    })),
  ])
  const filename = `klicker-elements-${randomUUID()}.zip`

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

  const elements = await ctx.prisma.element.findMany({
    where: {
      id: { in: uniqueElementIds },
      isDeleted: false,
      ...exportPermissionFilter(ctx.user.sub),
    },
    select: {
      id: true,
      name: true,
      type: true,
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

  const buffer = await downloadElementImportPackage({ blobName }, ctx)
  const normalizedPackage = parseElementImportPackage(buffer)
  const preview = buildPreview(normalizedPackage)
  const token = signImportToken({
    blobName,
    sha256: hashBuffer(buffer),
    userId: ctx.user.sub,
    expiresAt: Date.now() + IMPORT_TOKEN_TTL_MS,
  })

  return {
    importToken: token,
    elements: preview.elements,
    answerCollections: preview.answerCollections,
    warnings: [],
    errors: [],
  }
}

function buildElementManipulationArgs(
  element: PackageElement,
  entryIdByRef: Map<string, number>,
  collectionIdByRef: Map<string, number>
): ElementManipulationInput {
  const answerCollectionId = element.answerCollectionRef
    ? collectionIdByRef.get(element.answerCollectionRef)
    : undefined

  if (
    (element.type === DB.ElementType.SELECTION ||
      element.type === DB.ElementType.CASE_STUDY) &&
    !answerCollectionId
  ) {
    throw new Error(
      `Element "${element.name}" is missing its answer collection.`
    )
  }

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
    return {
      type: element.type,
      status: element.status,
      name: element.name,
      content: element.content,
      explanation: element.explanation ?? undefined,
      basePoints: element.basePoints,
      pointsMultiplier: element.pointsMultiplier,
      tags: [],
      options: {
        ...element.options,
        answerCollection: answerCollectionId,
        correctAnswers: collectionItemIds,
      } as any,
    }
  }

  if (element.type === DB.ElementType.CASE_STUDY) {
    return {
      type: element.type,
      status: element.status,
      name: element.name,
      content: element.content,
      explanation: element.explanation ?? undefined,
      basePoints: element.basePoints,
      pointsMultiplier: element.pointsMultiplier,
      tags: [],
      options: {
        ...mapCaseStudySolutionRefsToItemIds(element.options, entryIdByRef),
        answerCollection: answerCollectionId,
        collectionItemIds,
      } as any,
    }
  }

  return {
    type: element.type,
    status: element.status,
    name: element.name,
    content: element.content,
    explanation: element.explanation ?? undefined,
    basePoints: element.basePoints,
    pointsMultiplier: element.pointsMultiplier,
    tags: [],
    options: element.options as any,
  }
}

export async function importElementPackage(
  {
    importToken,
    selectedElementRefs,
  }: { importToken: string; selectedElementRefs: string[] },
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
  }: { buffer: Buffer; selectedElementRefs: string[] },
  ctx: ContextWithUser
) {
  const selectedRefs = new Set(selectedElementRefs)
  if (selectedRefs.size === 0) {
    throw new Error('Select at least one element to import.')
  }

  const normalizedPackage = parseElementImportPackage(buffer)
  const elementsToImport = normalizedPackage.elements.filter((element) =>
    selectedRefs.has(element.ref)
  )

  if (elementsToImport.length !== selectedRefs.size) {
    throw new Error('Selected import elements could not be found.')
  }

  const requiredCollectionRefs = new Set(
    elementsToImport.flatMap((element) =>
      element.answerCollectionRef ? [element.answerCollectionRef] : []
    )
  )

  const result = await ctx.prisma.$transaction(async (prisma) => {
    const txCtx: PrismaTransactionContextWithUser = {
      ...ctx,
      prisma,
    }
    const collectionIdByRef = new Map<string, number>()
    const entryIdByRef = new Map<string, number>()

    for (const collection of normalizedPackage.answerCollections.filter(
      (collection) => requiredCollectionRefs.has(collection.ref)
    )) {
      const created = await prisma.answerCollection.create({
        data: {
          name: collection.name,
          description: collection.description,
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

      for (const entry of collection.entries) {
        const createdEntry = created.entries.find(
          (candidate) => candidate.value === entry.value
        )
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
    for (const element of elementsToImport) {
      const importedElement = await manipulateElement(
        buildElementManipulationArgs(element, entryIdByRef, collectionIdByRef),
        txCtx
      )

      if (!importedElement) {
        throw new Error(`Element "${element.name}" could not be imported.`)
      }

      importedElements++
    }

    return {
      importedElements,
      importedAnswerCollections: collectionIdByRef.size,
    }
  })

  return result
}

export function validateElementImportPackageBuffer(buffer: Buffer) {
  const normalizedPackage = parseElementImportPackage(buffer)
  return {
    normalizedPackage,
    preview: buildPreview(normalizedPackage),
  }
}
