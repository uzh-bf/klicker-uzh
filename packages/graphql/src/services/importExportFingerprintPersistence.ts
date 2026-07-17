import type { ElementType, PrismaClient } from '@klicker-uzh/prisma/client'
import {
  computeAnswerCollectionDidacticFingerprint,
  computeElementDidacticFingerprint,
  IMPORT_EXPORT_FINGERPRINT_VERSION,
  type VersionedDidacticFingerprint,
} from '../lib/importExportFingerprintCanonicalization.js'
import {
  collectElementMediaReferences,
  MediaReferenceKind,
} from '../lib/importExportMediaReferences.js'

type JsonRecord = Record<string, unknown>

export type FingerprintPrisma = Pick<
  PrismaClient,
  'answerCollection' | 'element' | 'mediaFile'
>

type PersistedFingerprintState = {
  fingerprint: string | null
  version: number | null
}

export type ElementDidacticFingerprintSnapshot = {
  elementId: number
  elementVersion: number
  answerCollection: { id: number; version: number } | null
  previous: PersistedFingerprintState
  computed: VersionedDidacticFingerprint | null
}

export type AnswerCollectionDidacticFingerprintSnapshot = {
  answerCollectionId: number
  answerCollectionVersion: number
  previous: PersistedFingerprintState
  computed: VersionedDidacticFingerprint | null
}

export type DidacticFingerprintPersistenceResult = {
  status: 'updated' | 'unchanged' | 'stale'
  computed: VersionedDidacticFingerprint | null
}

export type DidacticFingerprintRefreshResult =
  | DidacticFingerprintPersistenceResult
  | { status: 'missing'; computed: null }

function targetState(
  computed: VersionedDidacticFingerprint | null
): PersistedFingerprintState {
  return computed
    ? { fingerprint: computed.fingerprint, version: computed.version }
    : {
        fingerprint: null,
        version: IMPORT_EXPORT_FINGERPRINT_VERSION,
      }
}

function statesEqual(
  left: PersistedFingerprintState,
  right: PersistedFingerprintState
) {
  return (
    left.fingerprint === right.fingerprint && left.version === right.version
  )
}

async function loadElementMediaContext(
  element: {
    type: ElementType
    content: string
    explanation: string | null
    options: unknown
  },
  prisma: FingerprintPrisma
) {
  const hrefs = Array.from(
    new Set(
      collectElementMediaReferences({
        type: element.type,
        content: element.content,
        explanation: element.explanation,
        options: element.options,
      })
        .filter((reference) => reference.kind === MediaReferenceKind.AUTO_LOAD)
        .map((reference) => reference.href)
    )
  )

  if (hrefs.length === 0) return undefined

  const mediaFiles = await prisma.mediaFile.findMany({
    where: { href: { in: hrefs } },
    select: {
      href: true,
      contentHash: true,
      importFingerprintVersion: true,
    },
  })
  const verifiedByHref = new Map<string, { sha256: string }>()
  const unresolvedHrefs = new Set<string>()

  for (const mediaFile of mediaFiles) {
    if (
      mediaFile.importFingerprintVersion !== IMPORT_EXPORT_FINGERPRINT_VERSION
    ) {
      unresolvedHrefs.add(mediaFile.href)
    } else if (mediaFile.contentHash) {
      verifiedByHref.set(mediaFile.href, { sha256: mediaFile.contentHash })
    }
  }

  return { verifiedByHref, unresolvedHrefs }
}

export async function computeElementDidacticFingerprintFromDbV1(
  elementId: number,
  prisma: FingerprintPrisma
): Promise<ElementDidacticFingerprintSnapshot | null> {
  const element = await prisma.element.findUnique({
    where: { id: elementId },
    select: {
      id: true,
      version: true,
      importFingerprint: true,
      importFingerprintVersion: true,
      type: true,
      content: true,
      explanation: true,
      options: true,
      pointsMultiplier: true,
      basePoints: true,
      answerCollectionId: true,
      answerCollection: {
        select: {
          id: true,
          version: true,
          entries: {
            select: { id: true, value: true },
            orderBy: [{ value: 'asc' }, { id: 'asc' }],
          },
        },
      },
      answerCollectionItems: {
        select: { id: true, value: true },
        orderBy: [{ value: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!element) return null

  const media = await loadElementMediaContext(element, prisma)
  const entries = element.answerCollection?.entries ?? []
  const computed = computeElementDidacticFingerprint({
    type: element.type,
    content: element.content,
    explanation: element.explanation,
    options: element.options as JsonRecord,
    pointsMultiplier: element.pointsMultiplier,
    basePoints: element.basePoints,
    answerPoolValues: entries.map((entry) => entry.value),
    selectedAnswerValues: element.answerCollectionItems.map(
      (entry) => entry.value
    ),
    relationValueById: new Map(
      entries.map((entry) => [entry.id, entry.value] as const)
    ),
    media,
  })

  return {
    elementId: element.id,
    elementVersion: element.version,
    answerCollection: element.answerCollection
      ? {
          id: element.answerCollection.id,
          version: element.answerCollection.version,
        }
      : null,
    previous: {
      fingerprint: element.importFingerprint,
      version: element.importFingerprintVersion,
    },
    computed,
  }
}

export async function persistElementDidacticFingerprintSnapshot(
  snapshot: ElementDidacticFingerprintSnapshot,
  prisma: FingerprintPrisma
): Promise<DidacticFingerprintPersistenceResult> {
  const target = targetState(snapshot.computed)
  if (statesEqual(snapshot.previous, target)) {
    const currentCount = await prisma.element.count({
      where: {
        id: snapshot.elementId,
        version: snapshot.elementVersion,
        importFingerprint: snapshot.previous.fingerprint,
        importFingerprintVersion: snapshot.previous.version,
        answerCollectionId: snapshot.answerCollection?.id ?? null,
        answerCollection: snapshot.answerCollection
          ? {
              is: {
                id: snapshot.answerCollection.id,
                version: snapshot.answerCollection.version,
              },
            }
          : { is: null },
      },
    })

    return {
      status: currentCount === 1 ? 'unchanged' : 'stale',
      computed: snapshot.computed,
    }
  }

  const result = await prisma.element.updateMany({
    where: {
      id: snapshot.elementId,
      version: snapshot.elementVersion,
      importFingerprint: snapshot.previous.fingerprint,
      importFingerprintVersion: snapshot.previous.version,
      answerCollectionId: snapshot.answerCollection?.id ?? null,
      answerCollection: snapshot.answerCollection
        ? {
            is: {
              id: snapshot.answerCollection.id,
              version: snapshot.answerCollection.version,
            },
          }
        : { is: null },
    },
    data: {
      importFingerprint: target.fingerprint,
      importFingerprintVersion: target.version,
    },
  })

  return {
    status: result.count === 1 ? 'updated' : 'stale',
    computed: snapshot.computed,
  }
}

export async function refreshElementDidacticFingerprintV1(
  elementId: number,
  prisma: FingerprintPrisma
): Promise<DidacticFingerprintRefreshResult> {
  const snapshot = await computeElementDidacticFingerprintFromDbV1(
    elementId,
    prisma
  )
  if (!snapshot) return { status: 'missing', computed: null }
  return await persistElementDidacticFingerprintSnapshot(snapshot, prisma)
}

export async function computeAnswerCollectionDidacticFingerprintFromDbV1(
  answerCollectionId: number,
  prisma: FingerprintPrisma
): Promise<AnswerCollectionDidacticFingerprintSnapshot | null> {
  const collection = await prisma.answerCollection.findUnique({
    where: { id: answerCollectionId },
    select: {
      id: true,
      version: true,
      importFingerprint: true,
      importFingerprintVersion: true,
      entries: {
        select: { value: true },
        orderBy: [{ value: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!collection) return null

  return {
    answerCollectionId: collection.id,
    answerCollectionVersion: collection.version,
    previous: {
      fingerprint: collection.importFingerprint,
      version: collection.importFingerprintVersion,
    },
    computed: computeAnswerCollectionDidacticFingerprint({
      entries: collection.entries,
    }),
  }
}

export async function persistAnswerCollectionDidacticFingerprintSnapshot(
  snapshot: AnswerCollectionDidacticFingerprintSnapshot,
  prisma: FingerprintPrisma
): Promise<DidacticFingerprintPersistenceResult> {
  const target = targetState(snapshot.computed)
  if (statesEqual(snapshot.previous, target)) {
    const currentCount = await prisma.answerCollection.count({
      where: {
        id: snapshot.answerCollectionId,
        version: snapshot.answerCollectionVersion,
        importFingerprint: snapshot.previous.fingerprint,
        importFingerprintVersion: snapshot.previous.version,
      },
    })

    return {
      status: currentCount === 1 ? 'unchanged' : 'stale',
      computed: snapshot.computed,
    }
  }

  const result = await prisma.answerCollection.updateMany({
    where: {
      id: snapshot.answerCollectionId,
      version: snapshot.answerCollectionVersion,
      importFingerprint: snapshot.previous.fingerprint,
      importFingerprintVersion: snapshot.previous.version,
    },
    data: {
      importFingerprint: target.fingerprint,
      importFingerprintVersion: target.version,
    },
  })

  return {
    status: result.count === 1 ? 'updated' : 'stale',
    computed: snapshot.computed,
  }
}

export async function refreshAnswerCollectionDidacticFingerprintV1(
  answerCollectionId: number,
  prisma: FingerprintPrisma
): Promise<DidacticFingerprintRefreshResult> {
  const snapshot = await computeAnswerCollectionDidacticFingerprintFromDbV1(
    answerCollectionId,
    prisma
  )
  if (!snapshot) return { status: 'missing', computed: null }
  return await persistAnswerCollectionDidacticFingerprintSnapshot(
    snapshot,
    prisma
  )
}
