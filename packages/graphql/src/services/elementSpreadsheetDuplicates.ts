import type { Prisma } from '@klicker-uzh/prisma/client'
import { computeSpreadsheetElementIdentity } from '../lib/elementSpreadsheetIdentity.js'
import type {
  PackageAnswerCollection,
  PackageElement,
} from '../lib/importExportPackageContract.js'

export function spreadsheetIdentity(
  element: PackageElement,
  collections: readonly PackageAnswerCollection[]
) {
  const entries =
    collections.find(
      (collection) => collection.ref === element.answerCollectionRef
    )?.entries ?? []
  const values = new Map(entries.map((entry) => [entry.ref, entry.value]))
  return computeSpreadsheetElementIdentity({
    ...element,
    answerPoolValues: entries.map((entry) => entry.value),
    selectedAnswerValues: (element.answerCollectionItemRefs ?? []).map(
      (ref) => values.get(ref)!
    ),
    relationValueByRef: values,
  })
}

/** Caller holds the per-owner transaction lock when these results drive writes.
 * Preview calls are advisory. Read current content, not repairable cached hashes. */
export async function findSpreadsheetDuplicates({
  ownerId,
  elements,
  answerCollections,
  prisma,
}: {
  ownerId: string
  elements: readonly PackageElement[]
  answerCollections: readonly PackageAnswerCollection[]
  prisma: Prisma.TransactionClient
}) {
  const identities = new Map<string, { id: number | null; name: string }>()
  if (elements.length) {
    let cursor: number | undefined
    do {
      const candidates = await prisma.element.findMany({
        where: {
          ownerId,
          isDeleted: false,
          OR: elements.map((element) => ({
            type: element.type,
            content: element.content,
          })),
        },
        select: {
          id: true,
          name: true,
          type: true,
          content: true,
          explanation: true,
          options: true,
          pointsMultiplier: true,
          basePoints: true,
          answerCollection: {
            select: { entries: { select: { id: true, value: true } } },
          },
          answerCollectionItems: { select: { value: true } },
        },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      })
      for (const candidate of candidates) {
        const entries = candidate.answerCollection?.entries ?? []
        const identity = computeSpreadsheetElementIdentity({
          ...candidate,
          options: candidate.options as Record<string, unknown>,
          answerPoolValues: entries.map((entry) => entry.value),
          selectedAnswerValues: candidate.answerCollectionItems.map(
            (entry) => entry.value
          ),
          relationValueById: new Map(
            entries.map((entry) => [entry.id, entry.value])
          ),
        })
        if (identity && !identities.has(identity))
          identities.set(identity, { id: candidate.id, name: candidate.name })
      }
      if (candidates.length < 100) break
      cursor = candidates[candidates.length - 1]!.id
    } while (cursor !== undefined)
  }
  const duplicates = new Map<string, { id: number | null; name: string }>()
  for (const element of elements) {
    const identity = spreadsheetIdentity(element, answerCollections)
    if (!identity) throw new Error('Invalid spreadsheet comparison domain')
    const existing = identities.get(identity)
    if (existing) duplicates.set(element.ref, existing)
    else identities.set(identity, { id: null, name: element.name })
  }
  return duplicates
}
