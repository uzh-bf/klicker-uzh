import * as DB from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import {
  MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
  MAX_IMPORT_EXPORT_CONTENT_LENGTH,
  MAX_IMPORT_EXPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_EXPORT_ELEMENTS,
  MAX_IMPORT_EXPORT_NAME_LENGTH,
  MAX_IMPORT_EXPORT_OPTIONS_BYTES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
} from '../lib/importExportPackageConfig.js'
import { canUseElementImportExport } from './importExportAuthorization.js'

const EXPORT_PERMISSION_LEVELS = [
  DB.PermissionLevel.ADMIN,
  DB.PermissionLevel.OWNER,
]
const EXPORT_ELEMENT_QUERY_BATCH_SIZE = 20
const EXPORT_SNAPSHOT_MAX_WAIT_MS = 5_000
const EXPORT_SNAPSHOT_TIMEOUT_MS = 10_000

function exportPermissionFilter(userId: string) {
  return {
    permissions: {
      some: {
        userId,
        permissionLevel: { in: EXPORT_PERMISSION_LEVELS },
      },
    },
  }
}

function exportElementSelect(userId: string) {
  return {
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
    basePoints: true,
    updatedAt: true,
    answerCollectionItems: {
      select: {
        id: true,
        value: true,
        collectionId: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' as const },
      take: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 1,
    },
    permissions: {
      where: {
        userId,
        permissionLevel: { in: EXPORT_PERMISSION_LEVELS },
      },
      select: { permissionLevel: true },
    },
  } as const satisfies DB.Prisma.ElementSelect
}

function exportAnswerCollectionSelect(userId: string) {
  return {
    id: true,
    name: true,
    description: true,
    version: true,
    updatedAt: true,
    entries: {
      select: { id: true, value: true, updatedAt: true },
      orderBy: [{ value: 'asc' as const }, { id: 'asc' as const }],
      take: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 1,
    },
    permissions: {
      where: {
        userId,
        permissionLevel: { in: EXPORT_PERMISSION_LEVELS },
      },
      select: { permissionLevel: true },
    },
  } as const satisfies DB.Prisma.AnswerCollectionSelect
}

type ExportElementRecord = DB.Prisma.ElementGetPayload<{
  select: ReturnType<typeof exportElementSelect>
}>
type ExportAnswerCollectionRecord = DB.Prisma.AnswerCollectionGetPayload<{
  select: ReturnType<typeof exportAnswerCollectionSelect>
}>

export type ExportElementSnapshot = Omit<ExportElementRecord, 'permissions'> & {
  exportPermission: DB.PermissionLevel
}

export type ExportAnswerCollectionSnapshot = Omit<
  ExportAnswerCollectionRecord,
  'permissions'
> & {
  exportPermission: DB.PermissionLevel
}

export type ExportRevision = {
  token: string
  elementIds: number[]
  answerCollectionIds: number[]
}

export type ElementExportSnapshot = {
  elements: ExportElementSnapshot[]
  answerCollections: ExportAnswerCollectionSnapshot[]
  revision: ExportRevision
}

function assertRawElementBounds(element: ExportElementRecord) {
  if (
    element.name.length > MAX_IMPORT_EXPORT_NAME_LENGTH ||
    element.content.length > MAX_IMPORT_EXPORT_CONTENT_LENGTH ||
    (element.explanation?.length ?? 0) > MAX_IMPORT_EXPORT_CONTENT_LENGTH ||
    Buffer.byteLength(JSON.stringify(element.options), 'utf8') >
      MAX_IMPORT_EXPORT_OPTIONS_BYTES
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_NOT_PORTABLE
    )
  }
}

type ElementScalarBounds = {
  id: number
  nameLength: number
  contentLength: number
  explanationLength: number
  optionsTextBytes: number
  sourceBytes: bigint
}

type AnswerCollectionScalarBounds = {
  id: number
  nameLength: number
  descriptionLength: number
  maximumEntryValueLength: number
  sourceBytes: bigint
}

type SelectedAnswerCollectionItemScalarBounds = {
  maximumValueLength: number
  sourceBytes: bigint
}

type LockedAnswerCollectionEntry = {
  id: number
  collectionId: number
}

type LockedSelectedAnswerCollectionItem = {
  entryId: number
  elementId: number
}

async function preflightAuthorizedElementBatch(
  elementIds: number[],
  ctx: PrismaTransactionContextWithUser,
  {
    remainingSelectedItems,
    remainingSourceBytes,
  }: { remainingSelectedItems: number; remainingSourceBytes: number }
) {
  const authorized = await ctx.prisma.element.findMany({
    where: {
      id: { in: elementIds },
      isDeleted: false,
      ...exportPermissionFilter(ctx.user.sub),
    },
    select: {
      id: true,
      _count: { select: { answerCollectionItems: true } },
    },
  })
  if (authorized.length !== elementIds.length) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION
    )
  }
  if (
    authorized.some(
      (element) =>
        element._count.answerCollectionItems >
        MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES
    )
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
    )
  }
  const selectedItemCount = authorized.reduce(
    (total, element) => total + element._count.answerCollectionItems,
    0
  )
  if (selectedItemCount > remainingSelectedItems) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
    )
  }

  const scalarBounds = await ctx.prisma.$queryRaw<ElementScalarBounds[]>`
    SELECT
      "id",
      char_length("name")::int AS "nameLength",
      char_length("content")::int AS "contentLength",
      char_length(COALESCE("explanation", ''))::int AS "explanationLength",
      octet_length("options"::text)::int AS "optionsTextBytes",
      (
        octet_length("name")::bigint +
        octet_length("content")::bigint +
        octet_length(COALESCE("explanation", ''))::bigint +
        octet_length("options"::text)::bigint
      ) AS "sourceBytes"
    FROM "public"."Element"
    WHERE "id" IN (${DB.Prisma.join(elementIds)})
    ORDER BY "id"
  `
  if (
    scalarBounds.length !== elementIds.length ||
    scalarBounds.some(
      ({ nameLength, contentLength, explanationLength, optionsTextBytes }) =>
        nameLength > MAX_IMPORT_EXPORT_NAME_LENGTH ||
        contentLength > MAX_IMPORT_EXPORT_CONTENT_LENGTH ||
        explanationLength > MAX_IMPORT_EXPORT_CONTENT_LENGTH ||
        // PostgreSQL's jsonb text adds insignificant whitespace that is not
        // present in JSON.stringify. This conservative preflight still caps
        // materialization; assertRawElementBounds applies the exact contract.
        optionsTextBytes > MAX_IMPORT_EXPORT_OPTIONS_BYTES * 4 + 4_096
    )
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_NOT_PORTABLE
    )
  }
  const sourceBytes = scalarBounds.reduce(
    (total, element) => total + element.sourceBytes,
    0n
  )
  if (sourceBytes > BigInt(remainingSourceBytes)) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  }

  const [selectedItemBounds] = await ctx.prisma.$queryRaw<
    SelectedAnswerCollectionItemScalarBounds[]
  >`
    SELECT
      COALESCE(MAX(char_length(entry."value")), 0)::int AS "maximumValueLength",
      COALESCE(SUM(octet_length(entry."value")::bigint), 0) AS "sourceBytes"
    FROM "public"."Element" element
    LEFT JOIN "public"."_ElementAnswerCollectionUsedItems" relation
      ON relation."B" = element."id"
    LEFT JOIN "public"."AnswerCollectionEntry" entry
      ON entry."id" = relation."A"
    WHERE element."id" IN (${DB.Prisma.join(elementIds)})
  `
  if (
    !selectedItemBounds ||
    selectedItemBounds.maximumValueLength > MAX_IMPORT_EXPORT_NAME_LENGTH ||
    selectedItemBounds.sourceBytes >
      BigInt(
        MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS *
          MAX_IMPORT_EXPORT_NAME_LENGTH *
          4
      )
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_NOT_PORTABLE
    )
  }

  return { selectedItemCount, sourceBytes: Number(sourceBytes) }
}

async function preflightAuthorizedAnswerCollections(
  answerCollectionIds: number[],
  ctx: PrismaTransactionContextWithUser,
  remainingSourceBytes: number
) {
  if (answerCollectionIds.length === 0) return 0

  const authorized = await ctx.prisma.answerCollection.findMany({
    where: {
      id: { in: answerCollectionIds },
      isDeleted: false,
      ...exportPermissionFilter(ctx.user.sub),
    },
    select: { id: true, _count: { select: { entries: true } } },
  })
  if (authorized.length !== answerCollectionIds.length) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION
    )
  }
  const totalEntryCount = authorized.reduce(
    (total, collection) => total + collection._count.entries,
    0
  )
  if (
    authorized.some(
      (collection) =>
        collection._count.entries > MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES
    ) ||
    totalEntryCount > MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
    )
  }

  const scalarBounds = await ctx.prisma.$queryRaw<
    AnswerCollectionScalarBounds[]
  >`
    SELECT
      collection."id",
      char_length(collection."name")::int AS "nameLength",
      char_length(collection."description")::int AS "descriptionLength",
      COALESCE(MAX(char_length(entry."value")), 0)::int AS "maximumEntryValueLength",
      (
        octet_length(collection."name")::bigint +
        octet_length(collection."description")::bigint +
        COALESCE(SUM(octet_length(entry."value")::bigint), 0)
      ) AS "sourceBytes"
    FROM "public"."AnswerCollection" collection
    LEFT JOIN "public"."AnswerCollectionEntry" entry
      ON entry."collectionId" = collection."id"
    WHERE collection."id" IN (${DB.Prisma.join(answerCollectionIds)})
    GROUP BY collection."id"
    ORDER BY collection."id"
  `
  if (
    scalarBounds.length !== answerCollectionIds.length ||
    scalarBounds.some(
      ({ nameLength, descriptionLength, maximumEntryValueLength }) =>
        nameLength > MAX_IMPORT_EXPORT_NAME_LENGTH ||
        descriptionLength > MAX_IMPORT_EXPORT_DESCRIPTION_LENGTH ||
        maximumEntryValueLength > MAX_IMPORT_EXPORT_NAME_LENGTH
    )
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_NOT_PORTABLE
    )
  }
  const sourceBytes = scalarBounds.reduce(
    (total, collection) => total + collection.sourceBytes,
    0n
  )
  if (sourceBytes > BigInt(remainingSourceBytes)) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  }

  return Number(sourceBytes)
}

function canonicalizeRevisionValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonicalizeRevisionValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => typeof entry !== 'undefined')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalizeRevisionValue(entry)])
    )
  }
  return value
}

export function createElementExportRevision({
  elements,
  answerCollections,
}: Pick<
  ElementExportSnapshot,
  'elements' | 'answerCollections'
>): ExportRevision {
  const elementIds = elements.map(({ id }) => id)
  const answerCollectionIds = answerCollections.map(({ id }) => id)
  const token = createHash('sha256')
    .update(
      JSON.stringify(
        canonicalizeRevisionValue({
          elements,
          answerCollections,
        })
      )
    )
    .digest('hex')

  return { token, elementIds, answerCollectionIds }
}

async function readAuthorizedElementExportSnapshot(
  elementIds: number[],
  ctx: PrismaTransactionContextWithUser
): Promise<ElementExportSnapshot> {
  const elements: ExportElementSnapshot[] = []
  let totalSelectedItemCount = 0
  let totalSourceBytes = 0

  for (
    let start = 0;
    start < elementIds.length;
    start += EXPORT_ELEMENT_QUERY_BATCH_SIZE
  ) {
    const ids = elementIds.slice(start, start + EXPORT_ELEMENT_QUERY_BATCH_SIZE)
    const preflight = await preflightAuthorizedElementBatch(ids, ctx, {
      remainingSelectedItems:
        MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS -
        totalSelectedItemCount,
      remainingSourceBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES - totalSourceBytes,
    })
    totalSelectedItemCount += preflight.selectedItemCount
    totalSourceBytes += preflight.sourceBytes
    const batch = await ctx.prisma.element.findMany({
      where: {
        id: { in: ids },
        isDeleted: false,
        ...exportPermissionFilter(ctx.user.sub),
      },
      select: exportElementSelect(ctx.user.sub),
    })
    if (batch.length !== ids.length) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION
      )
    }

    const byId = new Map(batch.map((element) => [element.id, element]))
    for (const id of ids) {
      const element = byId.get(id)
      const exportPermission = element?.permissions[0]?.permissionLevel
      if (!element || !exportPermission) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION
        )
      }
      assertRawElementBounds(element)
      if (
        element.answerCollectionItems.length >
        MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES
      ) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
        )
      }

      const { permissions: _permissions, ...source } = element
      elements.push({ ...source, exportPermission })
    }
  }

  const answerCollectionIds = Array.from(
    new Set(
      elements.flatMap((element) =>
        (element.type === DB.ElementType.SELECTION ||
          element.type === DB.ElementType.CASE_STUDY) &&
        element.answerCollectionId
          ? [element.answerCollectionId]
          : []
      )
    )
  )
  if (answerCollectionIds.length > MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
    )
  }

  totalSourceBytes += await preflightAuthorizedAnswerCollections(
    answerCollectionIds,
    ctx,
    MAX_IMPORT_EXPORT_PACKAGE_BYTES - totalSourceBytes
  )

  const collectionRecords =
    answerCollectionIds.length === 0
      ? []
      : await ctx.prisma.answerCollection.findMany({
          where: {
            id: { in: answerCollectionIds },
            isDeleted: false,
            ...exportPermissionFilter(ctx.user.sub),
          },
          select: exportAnswerCollectionSelect(ctx.user.sub),
        })
  if (collectionRecords.length !== answerCollectionIds.length) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION
    )
  }

  const collectionById = new Map(
    collectionRecords.map((collection) => [collection.id, collection])
  )
  const answerCollections: ExportAnswerCollectionSnapshot[] = []
  let totalEntryCount = 0
  for (const id of answerCollectionIds) {
    const collection = collectionById.get(id)
    const exportPermission = collection?.permissions[0]?.permissionLevel
    if (!collection || !exportPermission) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION
      )
    }
    totalEntryCount += collection.entries.length
    if (
      collection.entries.length > MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES ||
      totalEntryCount > MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES
    ) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
      )
    }

    const { permissions: _permissions, ...source } = collection
    answerCollections.push({ ...source, exportPermission })
  }

  const snapshot = { elements, answerCollections }
  return {
    ...snapshot,
    revision: createElementExportRevision(snapshot),
  }
}

export async function loadElementExportSnapshot(
  elementIds: number[],
  ctx: ContextWithUser
) {
  const uniqueElementIds = Array.from(new Set(elementIds))
  if (uniqueElementIds.length === 0) {
    throw new ImportExportDomainError(ImportExportErrorCode.INVALID_SELECTION)
  }
  if (uniqueElementIds.length > MAX_IMPORT_EXPORT_ELEMENTS) {
    throw new ImportExportDomainError(ImportExportErrorCode.TOO_MANY_ELEMENTS)
  }

  return await ctx.prisma.$transaction(
    async (prisma) =>
      await readAuthorizedElementExportSnapshot(uniqueElementIds, {
        ...ctx,
        prisma,
      }),
    {
      isolationLevel: DB.Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: EXPORT_SNAPSHOT_MAX_WAIT_MS,
      timeout: EXPORT_SNAPSHOT_TIMEOUT_MS,
    }
  )
}

async function lockExportSources(
  revision: ExportRevision,
  ctx: PrismaTransactionContextWithUser
) {
  const { elementIds, answerCollectionIds } = revision
  if (
    elementIds.length === 0 ||
    elementIds.length > MAX_IMPORT_EXPORT_ELEMENTS ||
    new Set(elementIds).size !== elementIds.length ||
    answerCollectionIds.length > MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS ||
    new Set(answerCollectionIds).size !== answerCollectionIds.length
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_SOURCE_CHANGED
    )
  }

  await ctx.prisma.$queryRaw`
    SELECT "id"
    FROM "public"."User"
    WHERE "id" = ${ctx.user.sub}::uuid
    FOR UPDATE NOWAIT
  `
  await ctx.prisma.$queryRaw`
    SELECT "id"
    FROM "public"."Element"
    WHERE "id" IN (${DB.Prisma.join(elementIds)})
    ORDER BY "id"
    FOR UPDATE NOWAIT
  `
  if (answerCollectionIds.length > 0) {
    await ctx.prisma.$queryRaw`
      SELECT "id"
      FROM "public"."AnswerCollection"
      WHERE "id" IN (${DB.Prisma.join(answerCollectionIds)})
      ORDER BY "id"
      FOR UPDATE NOWAIT
    `

    const lockedEntries = await ctx.prisma.$queryRaw<
      LockedAnswerCollectionEntry[]
    >`
      WITH bounded_entries_per_collection AS MATERIALIZED (
        SELECT entry."id", entry."collectionId"
        FROM unnest(
          ARRAY[${DB.Prisma.join(answerCollectionIds)}]::integer[]
        ) AS requested("collectionId")
        CROSS JOIN LATERAL (
          SELECT source."id", source."collectionId"
          FROM "public"."AnswerCollectionEntry" source
          WHERE source."collectionId" = requested."collectionId"
          ORDER BY source."id"
          LIMIT ${MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 1}
        ) entry
      ),
      bounded_entries AS MATERIALIZED (
        SELECT "id", "collectionId"
        FROM bounded_entries_per_collection
        ORDER BY "collectionId", "id"
        LIMIT ${MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES + 1}
      )
      SELECT source."id", source."collectionId"
      FROM "public"."AnswerCollectionEntry" source
      INNER JOIN bounded_entries bounded
        ON bounded."id" = source."id"
      ORDER BY source."collectionId", source."id"
      FOR UPDATE OF source NOWAIT
    `
    const entryCountByCollection = new Map<number, number>()
    for (const entry of lockedEntries) {
      entryCountByCollection.set(
        entry.collectionId,
        (entryCountByCollection.get(entry.collectionId) ?? 0) + 1
      )
    }
    if (
      lockedEntries.length >
        MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES ||
      Array.from(entryCountByCollection.values()).some(
        (count) => count > MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES
      )
    ) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.EXPORT_SOURCE_CHANGED
      )
    }
  }

  const lockedSelectedItems = await ctx.prisma.$queryRaw<
    LockedSelectedAnswerCollectionItem[]
  >`
    WITH bounded_selected_relations AS MATERIALIZED (
      SELECT relation."A", relation."B"
      FROM unnest(
        ARRAY[${DB.Prisma.join(elementIds)}]::integer[]
      ) AS requested("elementId")
      CROSS JOIN LATERAL (
        SELECT source."A", source."B"
        FROM "public"."_ElementAnswerCollectionUsedItems" source
        WHERE source."B" = requested."elementId"
        ORDER BY source."A"
        LIMIT ${MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 1}
      ) relation
    ),
    bounded_selected_relations_aggregate AS MATERIALIZED (
      SELECT "A", "B"
      FROM bounded_selected_relations
      ORDER BY "B", "A"
      LIMIT ${MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS + 1}
    )
    SELECT
      source."A" AS "entryId",
      source."B" AS "elementId"
    FROM "public"."_ElementAnswerCollectionUsedItems" source
    INNER JOIN bounded_selected_relations_aggregate bounded
      ON bounded."A" = source."A" AND bounded."B" = source."B"
    ORDER BY source."B", source."A"
    FOR UPDATE OF source NOWAIT
  `
  const selectedItemCountByElement = new Map<number, number>()
  for (const item of lockedSelectedItems) {
    selectedItemCountByElement.set(
      item.elementId,
      (selectedItemCountByElement.get(item.elementId) ?? 0) + 1
    )
  }
  if (
    lockedSelectedItems.length >
      MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS ||
    Array.from(selectedItemCountByElement.values()).some(
      (count) => count > MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES
    )
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_SOURCE_CHANGED
    )
  }

  await ctx.prisma.$queryRaw`
    SELECT "id"
    FROM "public"."DerivedPermission"
    WHERE "userId" = ${ctx.user.sub}::uuid
      AND "elementId" IN (${DB.Prisma.join(elementIds)})
    ORDER BY "id"
    FOR UPDATE NOWAIT
  `
  if (answerCollectionIds.length > 0) {
    await ctx.prisma.$queryRaw`
      SELECT "id"
      FROM "public"."DerivedPermission"
      WHERE "userId" = ${ctx.user.sub}::uuid
        AND "answerCollectionId" IN (${DB.Prisma.join(answerCollectionIds)})
      ORDER BY "id"
      FOR UPDATE NOWAIT
    `
  }
}

function hasPostgresErrorCode(error: unknown, expectedCode: string) {
  const pending: unknown[] = [error]
  const seen = new Set<object>()

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)

    if (
      Reflect.get(current, 'code') === expectedCode ||
      Reflect.get(current, 'originalCode') === expectedCode
    ) {
      return true
    }
    for (const key of ['meta', 'cause', 'driverAdapterError']) {
      pending.push(Reflect.get(current, key))
    }
  }

  return false
}

export async function assertElementExportSnapshotPublishable(
  expectedRevision: ExportRevision,
  ctx: PrismaTransactionContextWithUser
) {
  try {
    await lockExportSources(expectedRevision, ctx)
  } catch (error) {
    if (hasPostgresErrorCode(error, '55P03')) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
        error
      )
    }
    throw error
  }

  if (!(await canUseElementImportExport(ctx))) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_SOURCE_CHANGED
    )
  }

  const [elements, answerCollections] = await Promise.all([
    ctx.prisma.element.findMany({
      where: { id: { in: expectedRevision.elementIds } },
      select: { id: true, isDeleted: true },
    }),
    expectedRevision.answerCollectionIds.length === 0
      ? []
      : ctx.prisma.answerCollection.findMany({
          where: { id: { in: expectedRevision.answerCollectionIds } },
          select: { id: true, isDeleted: true },
        }),
  ])
  if (
    elements.length !== expectedRevision.elementIds.length ||
    elements.some(({ isDeleted }) => isDeleted) ||
    answerCollections.length !== expectedRevision.answerCollectionIds.length ||
    answerCollections.some(({ isDeleted }) => isDeleted)
  ) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_SOURCE_CHANGED
    )
  }

  let current: ElementExportSnapshot
  try {
    current = await readAuthorizedElementExportSnapshot(
      expectedRevision.elementIds,
      ctx
    )
  } catch (error) {
    if (error instanceof ImportExportDomainError) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
        error
      )
    }
    throw error
  }
  if (current.revision.token !== expectedRevision.token) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_SOURCE_CHANGED
    )
  }
}
