import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION as IMPORT_EXPORT_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import type { FingerprintPrisma } from '../src/services/importExportFingerprintPersistence.js'

export type FakeFingerprintResource = {
  id: number
  importFingerprint: string | null
  importFingerprintVersion: number | null
  isDeleted: boolean
  answerCollectionId?: number | null
}

type FingerprintFindManyArgs = {
  where: {
    id?: { gt: number }
    isDeleted?: boolean
    answerCollectionId?: number
    OR?: unknown[]
  }
  take: number
}

type FingerprintFindFirstArgs = {
  where: FingerprintFindManyArgs['where']
}

export function isDirtyFingerprint(resource: FakeFingerprintResource) {
  return (
    resource.importFingerprint === null ||
    resource.importFingerprintVersion === null ||
    resource.importFingerprintVersion !== IMPORT_EXPORT_FINGERPRINT_VERSION
  )
}

function matchesFingerprintWhere(
  resource: FakeFingerprintResource,
  where: FingerprintFindManyArgs['where']
) {
  const retriesNullFingerprint = where.OR?.some(
    (condition) =>
      typeof condition === 'object' &&
      condition !== null &&
      'importFingerprint' in condition
  )

  return (
    (where.isDeleted !== false || !resource.isDeleted) &&
    (typeof where.answerCollectionId === 'undefined' ||
      resource.answerCollectionId === where.answerCollectionId) &&
    (!where.id || resource.id > where.id.gt) &&
    (!where.OR ||
      isDirtyFingerprint(resource) ||
      (retriesNullFingerprint && resource.importFingerprint === null))
  )
}

export function createFingerprintFindMany(
  resources: FakeFingerprintResource[]
) {
  return vi.fn(async ({ where, take }: FingerprintFindManyArgs) => {
    return resources
      .filter((resource) => matchesFingerprintWhere(resource, where))
      .sort((left, right) => left.id - right.id)
      .slice(0, take)
      .map(({ id }) => ({ id }))
  })
}

function createFingerprintFindFirst(resources: FakeFingerprintResource[]) {
  return vi.fn(async ({ where }: FingerprintFindFirstArgs) => {
    const resource = resources.find((candidate) =>
      matchesFingerprintWhere(candidate, where)
    )
    return resource ? { id: resource.id } : null
  })
}

export function markFingerprintCurrent(
  resources: FakeFingerprintResource[],
  resourceId: number
) {
  const resource = resources.find(({ id }) => id === resourceId)
  if (!resource)
    throw new Error(`Missing fake fingerprint resource ${resourceId}`)

  resource.importFingerprint = `fingerprint-${resourceId}`
  resource.importFingerprintVersion = IMPORT_EXPORT_FINGERPRINT_VERSION
}

export function createFingerprintPrisma({
  answerCollections = [],
  elements = [],
}: {
  answerCollections?: FakeFingerprintResource[]
  elements?: FakeFingerprintResource[]
}) {
  const answerCollectionFindMany = createFingerprintFindMany(answerCollections)
  const elementFindMany = createFingerprintFindMany(elements)
  const answerCollectionFindFirst =
    createFingerprintFindFirst(answerCollections)
  const elementFindFirst = createFingerprintFindFirst(elements)
  const prisma = {
    answerCollection: {
      findMany: answerCollectionFindMany,
      findFirst: answerCollectionFindFirst,
    },
    element: { findMany: elementFindMany, findFirst: elementFindFirst },
  } as unknown as FingerprintPrisma

  return {
    answerCollectionFindFirst,
    answerCollectionFindMany,
    elementFindFirst,
    elementFindMany,
    prisma,
  }
}
