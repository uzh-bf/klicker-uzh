import {
  Prisma,
  type ElementType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  computePersistedAnswerCollectionDidacticFingerprint,
  computePersistedElementDidacticFingerprint,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
  type FingerprintMediaContext,
  type VersionedDidacticFingerprint,
} from '../lib/importExportFingerprintCanonicalization.js'
import {
  hasDirectUploadLifecycleMarker,
  resolveKlickerMediaHref,
} from '../lib/importExportMediaIdentity.js'
import {
  collectElementMediaReferences,
  MediaReferenceKind,
} from '../lib/importExportMediaReferences.js'

type JsonRecord = Record<string, unknown>

export type FingerprintPrisma = Pick<
  PrismaClient,
  '$executeRaw' | 'answerCollection' | 'element' | 'mediaFile'
>

export type FingerprintBatchPrisma = FingerprintPrisma &
  Pick<PrismaClient, '$queryRaw'>

type PersistedFingerprintState = {
  fingerprint: string | null
  version: number | null
}

export type ElementDidacticFingerprintSnapshot = {
  elementId: number
  elementVersion: number
  answerCollection: { id: number; version: number } | null
  previous: PersistedFingerprintState
  computed: VersionedDidacticFingerprint
}

export type AnswerCollectionDidacticFingerprintSnapshot = {
  answerCollectionId: number
  answerCollectionVersion: number
  previous: PersistedFingerprintState
  computed: VersionedDidacticFingerprint
}

export type DidacticFingerprintPersistenceResult = {
  status: 'updated' | 'unchanged' | 'stale'
  computed: VersionedDidacticFingerprint
}

export type DidacticFingerprintRefreshResult =
  | DidacticFingerprintPersistenceResult
  | { status: 'missing'; computed: null }

function targetState(
  computed: VersionedDidacticFingerprint
): PersistedFingerprintState {
  return { fingerprint: computed.fingerprint, version: computed.version }
}

function statesEqual(
  left: PersistedFingerprintState,
  right: PersistedFingerprintState
) {
  return (
    left.fingerprint === right.fingerprint && left.version === right.version
  )
}

type ElementFingerprintSource = {
  id: number
  version: number
  importFingerprint: string | null
  importFingerprintVersion: number | null
  type: ElementType
  content: string
  explanation: string | null
  options: unknown
  pointsMultiplier: number
  basePoints: boolean
  answerCollectionId: number | null
  answerCollectionItems: readonly { id: number; value: string }[]
}

type AnswerCollectionFingerprintSource = {
  id: number
  version: number
  entries: readonly { id: number; value: string }[]
}

async function loadElementMediaContexts(
  elements: readonly ElementFingerprintSource[],
  prisma: FingerprintPrisma
) {
  const verifiedByElementId = new Map<
    number,
    Map<string, { sha256: string }> | undefined
  >()
  const createContexts = () =>
    new Map<number, FingerprintMediaContext | undefined>(
      Array.from(verifiedByElementId, ([elementId, verifiedByHref]) => [
        elementId,
        verifiedByHref ? { verifiedByHref } : undefined,
      ])
    )
  const resolvedByElementId = new Map<
    number,
    Array<{ href: string; canonicalHref: string; ownerId: string }>
  >()
  const canonicalHrefs = new Set<string>()

  for (const element of elements) {
    const hrefs = Array.from(
      new Set(
        collectElementMediaReferences({
          type: element.type,
          content: element.content,
          explanation: element.explanation,
          options: element.options,
        })
          .filter(
            (reference) => reference.kind === MediaReferenceKind.AUTO_LOAD
          )
          .map((reference) => reference.href)
      )
    )

    if (hrefs.length === 0) {
      verifiedByElementId.set(element.id, undefined)
      continue
    }

    const resolvedHrefs = hrefs.flatMap((href) => {
      const resolved = resolveKlickerMediaHref(href)
      return resolved
        ? [
            {
              href,
              canonicalHref: resolved.canonicalHref,
              ownerId: resolved.ownerId,
            },
          ]
        : []
    })
    resolvedByElementId.set(element.id, resolvedHrefs)
    verifiedByElementId.set(element.id, new Map())
    for (const { canonicalHref } of resolvedHrefs) {
      canonicalHrefs.add(canonicalHref)
    }
  }

  if (canonicalHrefs.size === 0) return createContexts()

  const mediaFiles = await prisma.mediaFile.findMany({
    where: { href: { in: Array.from(canonicalHrefs) } },
    select: {
      id: true,
      href: true,
      originalId: true,
      ownerId: true,
      contentHash: true,
      importFingerprintVersion: true,
    },
  })
  const mediaFileByHref = new Map(
    mediaFiles.map((mediaFile) => [mediaFile.href, mediaFile])
  )

  for (const element of elements) {
    const verifiedByHref = verifiedByElementId.get(element.id)
    if (!verifiedByHref) continue
    for (const resolved of resolvedByElementId.get(element.id) ?? []) {
      const mediaFile = mediaFileByHref.get(resolved.canonicalHref)
      if (
        mediaFile &&
        !hasDirectUploadLifecycleMarker(mediaFile.originalId) &&
        mediaFile.ownerId === resolved.ownerId &&
        mediaFile.importFingerprintVersion ===
          IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION &&
        mediaFile.contentHash &&
        /^[a-f0-9]{64}$/.test(mediaFile.contentHash)
      ) {
        verifiedByHref.set(resolved.href, {
          sha256: mediaFile.contentHash,
        })
      }
    }
  }

  return createContexts()
}

function createElementDidacticFingerprintSnapshot(
  element: ElementFingerprintSource,
  answerCollection: AnswerCollectionFingerprintSource | null,
  media: FingerprintMediaContext | undefined
): ElementDidacticFingerprintSnapshot {
  const entries = answerCollection?.entries ?? []
  return {
    elementId: element.id,
    elementVersion: element.version,
    answerCollection: answerCollection
      ? { id: answerCollection.id, version: answerCollection.version }
      : null,
    previous: {
      fingerprint: element.importFingerprint,
      version: element.importFingerprintVersion,
    },
    computed: computePersistedElementDidacticFingerprint({
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
    }),
  }
}

const ELEMENT_FINGERPRINT_SELECT = {
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
  answerCollectionItems: {
    select: { id: true, value: true },
    orderBy: [{ value: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.ElementSelect

export async function computeElementDidacticFingerprintFromDb(
  elementId: number,
  prisma: FingerprintPrisma
): Promise<ElementDidacticFingerprintSnapshot | null> {
  const element = await prisma.element.findUnique({
    where: { id: elementId },
    select: {
      ...ELEMENT_FINGERPRINT_SELECT,
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
    },
  })

  if (!element) return null

  const media = await loadElementMediaContexts([element], prisma)
  return createElementDidacticFingerprintSnapshot(
    element,
    element.answerCollection,
    media.get(element.id)
  )
}

const LINKED_ELEMENT_FINGERPRINT_PAGE_SIZE = 100

export async function refreshLinkedElementDidacticFingerprintPages(
  answerCollectionId: number,
  prisma: FingerprintBatchPrisma
) {
  const answerCollection = await prisma.answerCollection.findUnique({
    where: { id: answerCollectionId },
    select: {
      id: true,
      version: true,
      entries: {
        select: { id: true, value: true },
        orderBy: [{ value: 'asc' }, { id: 'asc' }],
      },
    },
  })
  if (!answerCollection) return null

  const staleElementIds: number[] = []
  let afterId: number | undefined
  do {
    const elements = await prisma.element.findMany({
      where: {
        answerCollectionId,
        isDeleted: false,
        id: typeof afterId === 'number' ? { gt: afterId } : undefined,
      },
      select: ELEMENT_FINGERPRINT_SELECT,
      orderBy: { id: 'asc' },
      take: LINKED_ELEMENT_FINGERPRINT_PAGE_SIZE,
    })
    if (elements.length === 0) break

    const media = await loadElementMediaContexts(elements, prisma)
    const snapshots = elements.map((element) =>
      createElementDidacticFingerprintSnapshot(
        element,
        answerCollection,
        media.get(element.id)
      )
    )
    const proposedRows = snapshots.map(
      (snapshot) =>
        Prisma.sql`(
        ${snapshot.elementId}::integer,
        ${snapshot.elementVersion}::integer,
        ${snapshot.previous.fingerprint}::text,
        ${snapshot.previous.version}::integer,
        ${snapshot.computed.fingerprint}::text,
        ${snapshot.computed.version}::integer
      )`
    )
    const persisted = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      WITH proposed(
        "id",
        "elementVersion",
        "previousFingerprint",
        "previousFingerprintVersion",
        "nextFingerprint",
        "nextFingerprintVersion"
      ) AS (
        VALUES ${Prisma.join(proposedRows)}
      )
      UPDATE "public"."Element" AS element
      SET "importFingerprint" = proposed."nextFingerprint",
          "importFingerprintVersion" = proposed."nextFingerprintVersion",
          "updatedAt" = CASE
            WHEN element."importFingerprint" IS DISTINCT FROM proposed."nextFingerprint"
              OR element."importFingerprintVersion" IS DISTINCT FROM proposed."nextFingerprintVersion"
            THEN GREATEST(element."updatedAt", statement_timestamp())
            ELSE element."updatedAt"
          END
      FROM proposed
      WHERE element."id" = proposed."id"
        AND element."version" = proposed."elementVersion"
        AND element."importFingerprint" IS NOT DISTINCT FROM proposed."previousFingerprint"
        AND element."importFingerprintVersion" IS NOT DISTINCT FROM proposed."previousFingerprintVersion"
        AND element."answerCollectionId" = ${answerCollection.id}
        AND element."isDeleted" = false
        AND EXISTS (
          SELECT 1
          FROM "public"."AnswerCollection" AS collection
          WHERE collection."id" = ${answerCollection.id}
            AND collection."version" = ${answerCollection.version}
        )
      RETURNING element."id"
    `)
    const persistedIds = new Set(persisted.map(({ id }) => id))
    for (const element of elements) {
      if (!persistedIds.has(element.id)) staleElementIds.push(element.id)
    }

    afterId =
      elements.length === LINKED_ELEMENT_FINGERPRINT_PAGE_SIZE
        ? elements.at(-1)?.id
        : undefined
  } while (typeof afterId === 'number')

  return { staleElementIds }
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

  const relationFence = snapshot.answerCollection
    ? Prisma.sql`
        AND element."answerCollectionId" = ${snapshot.answerCollection.id}
        AND EXISTS (
          SELECT 1
          FROM "public"."AnswerCollection" AS collection
          WHERE collection."id" = ${snapshot.answerCollection.id}
            AND collection."version" = ${snapshot.answerCollection.version}
        )
      `
    : Prisma.sql`AND element."answerCollectionId" IS NULL`
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE "public"."Element" AS element
    SET "importFingerprint" = ${target.fingerprint},
        "importFingerprintVersion" = ${target.version}
    WHERE element."id" = ${snapshot.elementId}
      AND element."version" = ${snapshot.elementVersion}
      AND element."importFingerprint" IS NOT DISTINCT FROM ${snapshot.previous.fingerprint}::text
      AND element."importFingerprintVersion" IS NOT DISTINCT FROM ${snapshot.previous.version}::integer
      ${relationFence}
  `)

  return {
    status: updated === 1 ? 'updated' : 'stale',
    computed: snapshot.computed,
  }
}

export async function refreshElementDidacticFingerprint(
  elementId: number,
  prisma: FingerprintPrisma
): Promise<DidacticFingerprintRefreshResult> {
  const snapshot = await computeElementDidacticFingerprintFromDb(
    elementId,
    prisma
  )
  if (!snapshot) return { status: 'missing', computed: null }
  return await persistElementDidacticFingerprintSnapshot(snapshot, prisma)
}

export async function computeAnswerCollectionDidacticFingerprintFromDb(
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
    computed: computePersistedAnswerCollectionDidacticFingerprint({
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

  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE "public"."AnswerCollection" AS collection
    SET "importFingerprint" = ${target.fingerprint},
        "importFingerprintVersion" = ${target.version}
    WHERE collection."id" = ${snapshot.answerCollectionId}
      AND collection."version" = ${snapshot.answerCollectionVersion}
      AND collection."importFingerprint" IS NOT DISTINCT FROM ${snapshot.previous.fingerprint}::text
      AND collection."importFingerprintVersion" IS NOT DISTINCT FROM ${snapshot.previous.version}::integer
  `)

  return {
    status: updated === 1 ? 'updated' : 'stale',
    computed: snapshot.computed,
  }
}

export async function refreshAnswerCollectionDidacticFingerprint(
  answerCollectionId: number,
  prisma: FingerprintPrisma
): Promise<DidacticFingerprintRefreshResult> {
  const snapshot = await computeAnswerCollectionDidacticFingerprintFromDb(
    answerCollectionId,
    prisma
  )
  if (!snapshot) return { status: 'missing', computed: null }
  return await persistAnswerCollectionDidacticFingerprintSnapshot(
    snapshot,
    prisma
  )
}
