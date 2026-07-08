import * as DB from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'

type PrismaForFingerprints = PrismaTransactionContextWithUser['prisma']

type JsonRecord = Record<string, unknown>

export type FingerprintAnswerCollectionPayload = {
  name: string
  description: string
  version?: number | null
  entries: readonly { value: string }[]
}

export type FingerprintElementPayload = {
  name: string
  content: string
  type: DB.ElementType
  options: JsonRecord
  pointsMultiplier: number
  basePoints: boolean
  explanation?: string | null
  status: DB.ElementStatus
  tags?: readonly string[] | null
  answerCollection?: FingerprintAnswerCollectionPayload | null
  selectedAnswerCollectionValues?: readonly string[] | null
  entryValueById?: ReadonlyMap<number, string>
  mediaIdentityByUrl?: ReadonlyMap<string, string>
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .filter(([, entryValue]) => typeof entryValue !== 'undefined')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)])
    )
  }

  return value
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

function fingerprintPayload(kind: string, value: unknown) {
  return sha256(stableJson({ kind, version: 1, value }))
}

export function normalizeImportExportTags(tags?: readonly string[] | null) {
  return Array.from(
    new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right))
}

function normalizeStringMediaIdentity(
  value: string,
  mediaIdentityByUrl?: ReadonlyMap<string, string>
) {
  if (!mediaIdentityByUrl || mediaIdentityByUrl.size === 0) {
    return value
  }

  let normalized = value
  for (const [url, identity] of mediaIdentityByUrl) {
    normalized = normalized.replaceAll(url, identity)
  }
  return normalized
}

function normalizeValueForFingerprint(
  value: unknown,
  mediaIdentityByUrl?: ReadonlyMap<string, string>
): unknown {
  if (typeof value === 'string') {
    return normalizeStringMediaIdentity(value, mediaIdentityByUrl)
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      normalizeValueForFingerprint(entry, mediaIdentityByUrl)
    )
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, entryValue]) => [
        key,
        normalizeValueForFingerprint(entryValue, mediaIdentityByUrl),
      ])
    )
  }

  return value
}

function normalizeCaseStudyItemIds(
  value: unknown,
  entryValueById?: ReadonlyMap<number, string>,
  mediaIdentityByUrl?: ReadonlyMap<string, string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      normalizeCaseStudyItemIds(entry, entryValueById, mediaIdentityByUrl)
    )
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, entryValue]) => {
        if (key === 'itemId' && typeof entryValue === 'number') {
          return [
            'itemValue',
            entryValueById?.get(entryValue) ?? `__unknown-item:${entryValue}`,
          ]
        }

        return [
          key,
          normalizeCaseStudyItemIds(
            entryValue,
            entryValueById,
            mediaIdentityByUrl
          ),
        ]
      })
    )
  }

  return normalizeValueForFingerprint(value, mediaIdentityByUrl)
}

function normalizeElementOptionsForFingerprint({
  type,
  options,
  entryValueById,
  mediaIdentityByUrl,
}: {
  type: DB.ElementType
  options: JsonRecord
  entryValueById?: ReadonlyMap<number, string>
  mediaIdentityByUrl?: ReadonlyMap<string, string>
}) {
  const normalizedOptions = normalizeValueForFingerprint(
    options,
    mediaIdentityByUrl
  ) as JsonRecord

  if (type === DB.ElementType.SELECTION) {
    const { answerCollection, correctAnswers, ...rest } = normalizedOptions
    void answerCollection
    void correctAnswers
    return rest
  }

  if (type === DB.ElementType.CASE_STUDY) {
    const { answerCollection, collectionItemIds, ...rest } = normalizedOptions
    void answerCollection
    void collectionItemIds
    return normalizeCaseStudyItemIds(rest, entryValueById, mediaIdentityByUrl)
  }

  return normalizedOptions
}

export function computeAnswerCollectionImportFingerprint(
  collection: FingerprintAnswerCollectionPayload
) {
  return fingerprintPayload('answer-collection', {
    name: collection.name,
    description: collection.description,
    version: collection.version ?? 1,
    entries: collection.entries
      .map((entry) => entry.value)
      .sort((left, right) => left.localeCompare(right)),
  })
}

export function computeElementImportFingerprint(
  element: FingerprintElementPayload
) {
  const answerCollectionFingerprint = element.answerCollection
    ? computeAnswerCollectionImportFingerprint(element.answerCollection)
    : null

  return fingerprintPayload('element', {
    name: element.name,
    content: normalizeStringMediaIdentity(
      element.content,
      element.mediaIdentityByUrl
    ),
    type: element.type,
    options: normalizeElementOptionsForFingerprint({
      type: element.type,
      options: element.options,
      entryValueById: element.entryValueById,
      mediaIdentityByUrl: element.mediaIdentityByUrl,
    }),
    pointsMultiplier: element.pointsMultiplier,
    basePoints: element.basePoints,
    explanation:
      typeof element.explanation === 'undefined'
        ? null
        : element.explanation === null
          ? null
          : normalizeStringMediaIdentity(
              element.explanation,
              element.mediaIdentityByUrl
            ),
    status: element.status,
    tags: normalizeImportExportTags(element.tags),
    answerCollectionFingerprint,
    selectedAnswerCollectionValues: (
      element.selectedAnswerCollectionValues ?? []
    )
      .map((value) =>
        normalizeStringMediaIdentity(value, element.mediaIdentityByUrl)
      )
      .sort((left, right) => left.localeCompare(right)),
  })
}

export async function computeElementImportFingerprintFromDb(
  elementId: number,
  prisma: PrismaForFingerprints
) {
  const element = await prisma.element.findUnique({
    where: { id: elementId },
    select: {
      name: true,
      content: true,
      type: true,
      options: true,
      pointsMultiplier: true,
      basePoints: true,
      explanation: true,
      status: true,
      ownerId: true,
      tags: {
        select: { name: true },
        orderBy: { name: 'asc' },
      },
      answerCollection: {
        select: {
          name: true,
          description: true,
          version: true,
          entries: {
            select: { value: true },
            orderBy: { value: 'asc' },
          },
        },
      },
      answerCollectionItems: {
        select: {
          id: true,
          value: true,
        },
        orderBy: { value: 'asc' },
      },
    },
  })

  if (!element) {
    return null
  }

  const entryValueById = new Map(
    element.answerCollectionItems.map((entry) => [entry.id, entry.value])
  )

  return computeElementImportFingerprint({
    name: element.name,
    content: element.content,
    type: element.type,
    options: element.options as JsonRecord,
    pointsMultiplier: element.pointsMultiplier,
    basePoints: element.basePoints,
    explanation: element.explanation,
    status: element.status,
    tags: element.tags.map((tag) => tag.name),
    answerCollection: element.answerCollection,
    selectedAnswerCollectionValues: element.answerCollectionItems.map(
      (entry) => entry.value
    ),
    entryValueById,
  })
}

export async function refreshElementImportFingerprint(
  elementId: number,
  prisma: PrismaForFingerprints
) {
  const importFingerprint = await computeElementImportFingerprintFromDb(
    elementId,
    prisma
  )

  if (!importFingerprint) {
    return null
  }

  await prisma.element.update({
    where: { id: elementId },
    data: { importFingerprint },
  })

  return importFingerprint
}

export async function computeAnswerCollectionImportFingerprintFromDb(
  answerCollectionId: number,
  prisma: PrismaForFingerprints
) {
  const collection = await prisma.answerCollection.findUnique({
    where: { id: answerCollectionId },
    select: {
      name: true,
      description: true,
      version: true,
      entries: {
        select: { value: true },
        orderBy: { value: 'asc' },
      },
    },
  })

  if (!collection) {
    return null
  }

  return computeAnswerCollectionImportFingerprint(collection)
}

export async function refreshAnswerCollectionImportFingerprint(
  answerCollectionId: number,
  prisma: PrismaForFingerprints
) {
  const importFingerprint =
    await computeAnswerCollectionImportFingerprintFromDb(
      answerCollectionId,
      prisma
    )

  if (!importFingerprint) {
    return null
  }

  await prisma.answerCollection.update({
    where: { id: answerCollectionId },
    data: { importFingerprint },
  })

  return importFingerprint
}

export async function refreshImportedResourceFingerprints(
  {
    elementIds,
    answerCollectionIds,
  }: {
    elementIds: number[]
    answerCollectionIds: number[]
  },
  ctx: ContextWithUser
) {
  await Promise.all([
    ...answerCollectionIds.map((id) =>
      refreshAnswerCollectionImportFingerprint(id, ctx.prisma)
    ),
    ...elementIds.map((id) => refreshElementImportFingerprint(id, ctx.prisma)),
  ])
}

async function refreshInChunks(
  ids: number[],
  refresh: (id: number) => Promise<unknown>
) {
  const chunkSize = 25
  for (let index = 0; index < ids.length; index += chunkSize) {
    await Promise.all(ids.slice(index, index + chunkSize).map(refresh))
  }
}

export async function backfillMissingImportFingerprintsForOwner(
  ctx: ContextWithUser,
  { take = 500 }: { take?: number } = {}
) {
  const [answerCollections, elements] = await Promise.all([
    ctx.prisma.answerCollection.findMany({
      where: {
        ownerId: ctx.user.sub,
        isDeleted: false,
        importFingerprint: null,
      },
      select: { id: true },
      take,
      orderBy: { id: 'asc' },
    }),
    ctx.prisma.element.findMany({
      where: {
        ownerId: ctx.user.sub,
        isDeleted: false,
        importFingerprint: null,
      },
      select: { id: true },
      take,
      orderBy: { id: 'asc' },
    }),
  ])

  await refreshInChunks(
    answerCollections.map((collection) => collection.id),
    (id) => refreshAnswerCollectionImportFingerprint(id, ctx.prisma)
  )
  await refreshInChunks(
    elements.map((element) => element.id),
    (id) => refreshElementImportFingerprint(id, ctx.prisma)
  )

  return {
    answerCollections: answerCollections.length,
    elements: elements.length,
  }
}
