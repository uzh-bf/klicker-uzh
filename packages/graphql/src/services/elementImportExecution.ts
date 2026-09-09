import * as DB from '@klicker-uzh/prisma/client'
import { canonicalizeElementDomain } from '../lib/elementDomain.js'
import type { CaseStudyOptionsWithSolutionReference } from '../lib/elementDomain/caseStudy.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION } from '../lib/importExportFingerprintCanonicalization.js'
import type {
  BoundElementImportExecutionElementPlan,
  BoundElementImportExecutionPlan,
} from './elementImportExecutionPlan.js'

const ENTRY_BATCH_SIZE = 500
const ELEMENT_BATCH_SIZE = 25
const METADATA_BATCH_SIZE = 500

export type ElementImportExecutionOperationCounters = {
  collectionCreates: number
  entryCreateBatches: number
  entryRowsCreated: number
  entryRequeries: number
  elementCreateBatches: number
  elementRowsCreated: number
  relationUpdates: number
  permissionCreateBatches: number
  permissionRowsCreated: number
  activityLogCreateBatches: number
  activityLogRowsCreated: number
}

export type ElementImportExecutionResult = {
  createdElementIds: number[]
  createdAnswerCollectionIds: number[]
  invalidations: Array<
    | { typename: 'AnswerCollection'; id: number }
    | { typename: 'Element'; id: number }
  >
}

type CreatedElement = {
  id: number
  originalId: string | null
  createdAt: Date
  updatedAt: Date
}

type PreparedElement = {
  source: BoundElementImportExecutionElementPlan
  data: DB.Prisma.ElementCreateManyInput
  selectedEntryIds: number[]
}

type BoundCaseStudyExecutionElement = Extract<
  BoundElementImportExecutionElementPlan,
  { type: typeof DB.ElementType.CASE_STUDY }
>

type PackageCaseStudyOptions = BoundCaseStudyExecutionElement['options']
type DatabaseCaseStudyOptions = CaseStudyOptionsWithSolutionReference<
  PackageCaseStudyOptions,
  'itemId',
  number
>

export function createElementImportExecutionOperationCounters(): ElementImportExecutionOperationCounters {
  return {
    collectionCreates: 0,
    entryCreateBatches: 0,
    entryRowsCreated: 0,
    entryRequeries: 0,
    elementCreateBatches: 0,
    elementRowsCreated: 0,
    relationUpdates: 0,
    permissionCreateBatches: 0,
    permissionRowsCreated: 0,
    activityLogCreateBatches: 0,
    activityLogRowsCreated: 0,
  }
}

function increment(
  counters: ElementImportExecutionOperationCounters | undefined,
  key: keyof ElementImportExecutionOperationCounters,
  amount = 1
) {
  if (counters) counters[key] += amount
}

function infrastructureFailure(cause?: unknown): never {
  throw new ImportExportDomainError(
    ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
    cause
  )
}

function assertCurrentBoundFingerprint(fingerprint: string, version: number) {
  if (
    !/^[a-f0-9]{64}$/.test(fingerprint) ||
    version !== IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION
  ) {
    infrastructureFailure('Import execution fingerprint is not current.')
  }
}

function* batches<T>(values: readonly T[], size: number) {
  for (let offset = 0; offset < values.length; offset += size) {
    yield values.slice(offset, offset + size)
  }
}

function mapCaseStudySolutionRefsToItemIds(
  options: PackageCaseStudyOptions,
  entryIdByRef: ReadonlyMap<string, number>
): DatabaseCaseStudyOptions {
  const cloned = structuredClone(options)
  return {
    ...cloned,
    cases: cloned.cases.map((caseItem) => ({
      ...caseItem,
      solutions: caseItem.solutions?.map((solution) => {
        if (typeof solution.itemId !== 'undefined') infrastructureFailure()
        const entryId =
          typeof solution.itemRef === 'string'
            ? entryIdByRef.get(solution.itemRef)
            : undefined
        if (typeof entryId !== 'number') infrastructureFailure()

        const { itemId: _itemId, itemRef: _itemRef, ...fields } = solution
        void _itemId
        void _itemRef
        return { ...fields, itemId: entryId }
      }),
    })),
  }
}

function prepareElementRows({
  plan,
  collectionIdByRef,
  entryIdByRef,
}: {
  plan: BoundElementImportExecutionPlan
  collectionIdByRef: ReadonlyMap<string, number>
  entryIdByRef: ReadonlyMap<string, number>
}): PreparedElement[] {
  return plan.elements.map((element) => {
    assertCurrentBoundFingerprint(
      element.importFingerprint,
      element.importFingerprintVersion
    )
    const answerCollectionId = element.answerCollectionRef
      ? collectionIdByRef.get(element.answerCollectionRef)
      : undefined
    const selectedEntryIds = element.answerCollectionItemRefs.map(
      (ref) => entryIdByRef.get(ref) ?? infrastructureFailure()
    )
    const options =
      element.type === DB.ElementType.CASE_STUDY
        ? mapCaseStudySolutionRefsToItemIds(element.options, entryIdByRef)
        : element.options
    const canonical = canonicalizeElementDomain({
      type: element.type,
      content: element.content,
      explanation: element.explanation,
      basePoints: element.basePoints,
      pointsMultiplier: element.pointsMultiplier,
      options,
      relations:
        element.type === DB.ElementType.SELECTION ||
        element.type === DB.ElementType.CASE_STUDY
          ? {
              answerCollectionId,
              selectedIds: selectedEntryIds,
              caseSolutionReferenceKey:
                element.type === DB.ElementType.CASE_STUDY
                  ? ('itemId' as const)
                  : undefined,
            }
          : undefined,
    })

    if (
      (element.type === DB.ElementType.SELECTION ||
        element.type === DB.ElementType.CASE_STUDY) &&
      typeof canonical.relations.answerCollectionId !== 'number'
    ) {
      infrastructureFailure()
    }

    return {
      source: element,
      selectedEntryIds: canonical.relations.selectedIds,
      data: {
        version: 1,
        originalId: element.originalId,
        importFingerprint: element.importFingerprint,
        importFingerprintVersion: element.importFingerprintVersion,
        isArchived: false,
        isDeleted: false,
        name: element.name,
        content: canonical.content,
        explanation: canonical.explanation,
        basePoints: canonical.basePoints,
        pointsMultiplier: canonical.pointsMultiplier,
        options: canonical.options as DB.Prisma.InputJsonValue,
        status: DB.ElementStatus.REVIEW,
        type: element.type,
        answerCollectionId: canonical.relations.answerCollectionId ?? null,
        ownerId: plan.ownerId,
      },
    }
  })
}

async function createCollections({
  plan,
  prisma,
  counters,
}: {
  plan: BoundElementImportExecutionPlan
  prisma: DB.Prisma.TransactionClient
  counters?: ElementImportExecutionOperationCounters
}) {
  const collectionIdByRef = new Map<string, number>()
  const createdAnswerCollectionIds: number[] = []

  for (const collection of plan.answerCollections) {
    assertCurrentBoundFingerprint(
      collection.importFingerprint,
      collection.importFingerprintVersion
    )
    const created = await prisma.answerCollection.create({
      data: {
        name: collection.name,
        description: collection.description,
        version: 1,
        importFingerprint: collection.importFingerprint,
        importFingerprintVersion: collection.importFingerprintVersion,
        ownerId: plan.ownerId,
      },
      select: { id: true },
    })
    increment(counters, 'collectionCreates')
    collectionIdByRef.set(collection.ref, created.id)
    createdAnswerCollectionIds.push(created.id)
  }

  if (collectionIdByRef.size !== plan.answerCollections.length) {
    infrastructureFailure()
  }

  return { collectionIdByRef, createdAnswerCollectionIds }
}

async function createAndIndexEntries({
  plan,
  collectionIdByRef,
  prisma,
  counters,
}: {
  plan: BoundElementImportExecutionPlan
  collectionIdByRef: ReadonlyMap<string, number>
  prisma: DB.Prisma.TransactionClient
  counters?: ElementImportExecutionOperationCounters
}) {
  const rows = plan.answerCollections.flatMap((collection) => {
    const collectionId =
      collectionIdByRef.get(collection.ref) ?? infrastructureFailure()
    return collection.entries.map((entry) => ({
      collectionId,
      value: entry.value,
    }))
  })

  for (const batch of batches(rows, ENTRY_BATCH_SIZE)) {
    await prisma.answerCollectionEntry.createMany({ data: batch })
    increment(counters, 'entryCreateBatches')
    increment(counters, 'entryRowsCreated', batch.length)
  }

  const collectionIds = Array.from(collectionIdByRef.values())
  const createdEntries =
    collectionIds.length === 0
      ? []
      : await prisma.answerCollectionEntry.findMany({
          where: { collectionId: { in: collectionIds } },
          select: { id: true, collectionId: true, value: true },
        })
  increment(counters, 'entryRequeries')
  if (createdEntries.length !== rows.length) infrastructureFailure()

  const entryIdByCollectionIdAndValue = new Map<number, Map<string, number>>()
  for (const entry of createdEntries) {
    const valueMap =
      entryIdByCollectionIdAndValue.get(entry.collectionId) ?? new Map()
    if (valueMap.has(entry.value)) infrastructureFailure()
    valueMap.set(entry.value, entry.id)
    entryIdByCollectionIdAndValue.set(entry.collectionId, valueMap)
  }

  const entryIdByRef = new Map<string, number>()
  for (const collection of plan.answerCollections) {
    const collectionId =
      collectionIdByRef.get(collection.ref) ?? infrastructureFailure()
    const valueMap = entryIdByCollectionIdAndValue.get(collectionId)
    if (!valueMap || valueMap.size !== collection.entries.length) {
      infrastructureFailure()
    }
    for (const entry of collection.entries) {
      const entryId = valueMap.get(entry.value)
      if (typeof entryId !== 'number') infrastructureFailure()
      entryIdByRef.set(entry.ref, entryId)
    }
  }

  return entryIdByRef
}

async function createElements({
  preparedElements,
  prisma,
  counters,
}: {
  preparedElements: readonly PreparedElement[]
  prisma: DB.Prisma.TransactionClient
  counters?: ElementImportExecutionOperationCounters
}) {
  const createdByOriginalId = new Map<string, CreatedElement>()

  for (const batch of batches(preparedElements, ELEMENT_BATCH_SIZE)) {
    const created = await prisma.element.createManyAndReturn({
      data: batch.map((entry) => entry.data),
      select: {
        id: true,
        originalId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    increment(counters, 'elementCreateBatches')
    increment(counters, 'elementRowsCreated', batch.length)
    if (created.length !== batch.length) infrastructureFailure()

    const expectedOriginalIds = new Set(
      batch.map((entry) => entry.source.originalId)
    )
    for (const element of created) {
      if (
        !element.originalId ||
        !expectedOriginalIds.has(element.originalId) ||
        createdByOriginalId.has(element.originalId)
      ) {
        infrastructureFailure()
      }
      createdByOriginalId.set(element.originalId, element)
    }
  }

  if (createdByOriginalId.size !== preparedElements.length) {
    infrastructureFailure()
  }
  return createdByOriginalId
}

async function connectElementRelations({
  preparedElements,
  createdByOriginalId,
  prisma,
  counters,
}: {
  preparedElements: readonly PreparedElement[]
  createdByOriginalId: ReadonlyMap<string, CreatedElement>
  prisma: DB.Prisma.TransactionClient
  counters?: ElementImportExecutionOperationCounters
}) {
  for (const prepared of preparedElements) {
    if (prepared.selectedEntryIds.length === 0) continue
    const created =
      createdByOriginalId.get(prepared.source.originalId) ??
      infrastructureFailure()
    const updated = await prisma.element.update({
      where: { id: created.id },
      data: {
        answerCollectionItems: {
          connect: prepared.selectedEntryIds.map((id) => ({ id })),
        },
      },
      select: { updatedAt: true },
    })
    created.updatedAt = updated.updatedAt
    increment(counters, 'relationUpdates')
  }
}

async function createPermissionsAndActivityLog({
  plan,
  createdAnswerCollectionIds,
  preparedElements,
  createdByOriginalId,
  prisma,
  counters,
}: {
  plan: BoundElementImportExecutionPlan
  createdAnswerCollectionIds: readonly number[]
  preparedElements: readonly PreparedElement[]
  createdByOriginalId: ReadonlyMap<string, CreatedElement>
  prisma: DB.Prisma.TransactionClient
  counters?: ElementImportExecutionOperationCounters
}) {
  const createdElements = preparedElements.map(
    (entry) =>
      createdByOriginalId.get(entry.source.originalId) ??
      infrastructureFailure()
  )
  const permissionRows: DB.Prisma.DerivedPermissionCreateManyInput[] = [
    ...createdAnswerCollectionIds.map((answerCollectionId) => ({
      permissionLevel: DB.PermissionLevel.OWNER,
      derived: false,
      userId: plan.ownerId,
      answerCollectionId,
    })),
    ...createdElements.map((element) => ({
      permissionLevel: DB.PermissionLevel.OWNER,
      derived: false,
      userId: plan.ownerId,
      elementId: element.id,
    })),
  ]
  for (const batch of batches(permissionRows, METADATA_BATCH_SIZE)) {
    await prisma.derivedPermission.createMany({ data: batch })
    increment(counters, 'permissionCreateBatches')
    increment(counters, 'permissionRowsCreated', batch.length)
  }

  const activityRows: DB.Prisma.ActivityLogEntryCreateManyInput[] =
    createdElements.map((element) => ({
      type: DB.ActivityLogType.CREATION,
      objectType: DB.ObjectType.ELEMENT,
      elementId: element.id,
      userId: plan.ownerId,
      createdAt: element.createdAt,
      updatedAt: element.updatedAt,
    }))
  for (const batch of batches(activityRows, METADATA_BATCH_SIZE)) {
    await prisma.activityLogEntry.createMany({ data: batch })
    increment(counters, 'activityLogCreateBatches')
    increment(counters, 'activityLogRowsCreated', batch.length)
  }
}

export async function executeElementImportExecutionPlan({
  plan,
  prisma,
  counters,
}: {
  plan: BoundElementImportExecutionPlan
  prisma: DB.Prisma.TransactionClient
  counters?: ElementImportExecutionOperationCounters
}): Promise<ElementImportExecutionResult> {
  const { collectionIdByRef, createdAnswerCollectionIds } =
    await createCollections({ plan, prisma, counters })
  const entryIdByRef = await createAndIndexEntries({
    plan,
    collectionIdByRef,
    prisma,
    counters,
  })
  const preparedElements = prepareElementRows({
    plan,
    collectionIdByRef,
    entryIdByRef,
  })
  const createdByOriginalId = await createElements({
    preparedElements,
    prisma,
    counters,
  })
  await connectElementRelations({
    preparedElements,
    createdByOriginalId,
    prisma,
    counters,
  })
  await createPermissionsAndActivityLog({
    plan,
    createdAnswerCollectionIds,
    preparedElements,
    createdByOriginalId,
    prisma,
    counters,
  })

  const createdElementIds = preparedElements.map(
    (entry) =>
      createdByOriginalId.get(entry.source.originalId)?.id ??
      infrastructureFailure()
  )

  return {
    createdElementIds,
    createdAnswerCollectionIds,
    invalidations: [
      ...createdAnswerCollectionIds.map((id) => ({
        typename: 'AnswerCollection' as const,
        id,
      })),
      ...createdElementIds.map((id) => ({
        typename: 'Element' as const,
        id,
      })),
    ],
  }
}
