import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import { ElementImportError } from './errors.js'
import type { WorkbookElement } from './parse.js'
import {
  digest,
  type ExistingIdentity,
  elementIdentity,
  planImport,
  type TextNormalizer,
} from './plan.js'

/** Largest library the duplicate check reads; also bounds a library after import. */
export const MAX_IMPORT_LIBRARY_ELEMENTS = 50_000

const selection = {
  id: true,
  name: true,
  content: true,
  explanation: true,
  type: true,
  options: true,
  basePoints: true,
  pointsMultiplier: true,
  status: true,
  version: true,
  originalId: true,
  isArchived: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  tags: { select: { id: true }, orderBy: { id: 'asc' } },
  permissions: {
    select: { userId: true, permissionLevel: true, derived: true },
    orderBy: { userId: 'asc' },
  },
} satisfies Prisma.ElementSelect

/**
 * Imported images are copies whose `originalId` is the source link. Mapping
 * them back keeps an imported element identical to the workbook row it came
 * from, so re-importing the same file is still detected as a duplicate.
 */
async function mediaNormalizer(
  tx: Prisma.TransactionClient,
  ownerId: string
): Promise<TextNormalizer> {
  const copies = await tx.mediaFile.findMany({
    where: { ownerId, originalId: { not: null } },
    select: { href: true, originalId: true },
  })
  if (copies.length === 0) return (text) => text
  const links = copies
    .map((copy) => [copy.href, copy.originalId!] as const)
    .sort(([a], [b]) => b.length - a.length)
  // Most texts contain no image link, so skip the rewrite unless one occurs.
  return (text) =>
    links.reduce(
      (result, [href, source]) =>
        result.includes(href) ? result.replaceAll(href, source) : result,
      text
    )
}

/** Snapshot hashes avoid writing existing teaching content or user profiles to disk. */
export async function readImportState(
  tx: Prisma.TransactionClient,
  ownerId: string,
  { identities = true }: { identities?: boolean } = {}
) {
  const owner = await tx.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true },
  })
  if (!owner || !['USER', 'ADMIN'].includes(owner.role))
    throw new ElementImportError(
      'Target owner must be an existing lecturer or administrator',
      'INVALID_OWNER'
    )
  const normalize = await mediaNormalizer(tx, ownerId)
  const existing: ExistingIdentity[] = []
  const rows: { id: number; hash: string }[] = []
  let cursor: number | undefined
  for (;;) {
    const batch = await tx.element.findMany({
      where: {
        ownerId,
        type: {
          in: [
            'SC',
            'MC',
            'KPRIM',
            'NUMERICAL',
            'FREE_TEXT',
            'CONTENT',
            'FLASHCARD',
          ],
        },
        isDeleted: false,
      },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      select: selection,
    })
    for (const element of batch) {
      if (identities)
        existing.push({
          id: element.id,
          identity: elementIdentity(
            {
              ...element,
              type: element.type as WorkbookElement['type'],
            },
            normalize
          ),
        })
      rows.push({ id: element.id, hash: digest(element) })
    }
    if (rows.length > MAX_IMPORT_LIBRARY_ELEMENTS)
      throw new ElementImportError(
        'Target library exceeds the operator script limit',
        'LIBRARY_TOO_LARGE'
      )
    if (batch.length < 1000) break
    cursor = batch.at(-1)!.id
  }
  const tags = await tx.tag.findMany({
    where: { ownerId },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, order: true, updatedAt: true },
  })
  return {
    existing,
    normalize,
    state: {
      owner,
      elements: rows,
      tags: tags.map((tag) => ({ id: tag.id, hash: digest(tag) })),
    },
  }
}

export async function previewImport(
  prisma: PrismaClient,
  ownerId: string,
  elements: WorkbookElement[]
) {
  return prisma.$transaction(
    async (tx) => {
      const snapshot = await readImportState(tx, ownerId)
      const decisions = planImport(
        elements,
        snapshot.existing,
        snapshot.normalize
      )
      // Reject here what the import would only discover after writing.
      const creates = decisions.filter((d) => d.action === 'CREATE').length
      if (
        snapshot.state.elements.length + creates >
        MAX_IMPORT_LIBRARY_ELEMENTS
      )
        throw new ElementImportError(
          'Import would exceed the operator script library limit',
          'LIBRARY_TOO_LARGE'
        )
      return { state: snapshot.state, decisions }
    },
    { isolationLevel: 'RepeatableRead', timeout: 120_000 }
  )
}

export async function executeImport(
  prisma: PrismaClient,
  ownerId: string,
  elements: WorkbookElement[],
  expected: Awaited<ReturnType<typeof previewImport>> | string,
  payloadHash: string
) {
  return prisma.$transaction(
    async (tx) => {
      // Serialize this operator script for one owner. Serialization conflicts
      // from other writers fail closed; there is no automatic write retry.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('klicker-excel-v6'), hashtext(${ownerId}))`
      const before = await readImportState(tx, ownerId)
      const decisions = planImport(elements, before.existing, before.normalize)
      const expectedDigest =
        typeof expected === 'string' ? expected : digest(expected)
      if (digest({ state: before.state, decisions }) !== expectedDigest)
        throw new ElementImportError(
          'Database changed since the dry run; use a fresh preview',
          'STALE'
        )
      const created: {
        sheet: string
        row: number
        name: string
        id: number
      }[] = []
      for (const [index, element] of elements.entries()) {
        if (decisions[index]!.action !== 'CREATE') continue
        const tagIds: { id: number }[] = []
        for (const name of element.tags) {
          const tag = await tx.tag.upsert({
            where: { ownerId_name: { ownerId, name } },
            create: { ownerId, name },
            update: {},
            select: { id: true },
          })
          tagIds.push(tag)
        }
        const inserted = await tx.element.create({
          data: {
            ownerId,
            type: element.type,
            name: element.name,
            content: element.content,
            explanation: element.explanation,
            basePoints: element.basePoints,
            pointsMultiplier: element.pointsMultiplier,
            options: element.options as Prisma.InputJsonValue,
            status: 'REVIEW',
            originalId: `excel-v6:${payloadHash}:${element.sheet}:${element.row}`,
            tags: { connect: tagIds },
            // New private source Elements have no inherited/direct shares.
            permissions: {
              create: { userId: ownerId, permissionLevel: 'OWNER' },
            },
          },
          select: { id: true },
        })
        const saved = await tx.element.findUniqueOrThrow({
          where: { id: inserted.id },
          select: selection,
        })
        if (
          saved.name !== element.name ||
          saved.ownerId !== ownerId ||
          saved.status !== 'REVIEW' ||
          saved.isArchived ||
          saved.isDeleted ||
          elementIdentity(
            { ...saved, type: element.type },
            before.normalize
          ) !== elementIdentity(element, before.normalize) ||
          digest(saved.tags.map((t) => t.id).sort((a, b) => a - b)) !==
            digest(tagIds.map((t) => t.id).sort((a, b) => a - b)) ||
          saved.permissions.length !== 1 ||
          saved.permissions[0]?.userId !== ownerId ||
          saved.permissions[0]?.permissionLevel !== 'OWNER'
        )
          throw new ElementImportError(
            'Imported element verification failed; rolling back',
            'VERIFICATION_FAILED'
          )
        created.push({
          sheet: element.sheet,
          row: element.row,
          name: element.name,
          id: inserted.id,
        })
      }
      // Only the state hashes are compared, so skip the duplicate identities.
      const after = await readImportState(tx, ownerId, { identities: false })
      const afterRows = new Map(after.state.elements.map((e) => [e.id, e.hash]))
      const afterTags = new Map(after.state.tags.map((t) => [t.id, t.hash]))
      if (
        before.state.elements.some((e) => afterRows.get(e.id) !== e.hash) ||
        before.state.tags.some((t) => afterTags.get(t.id) !== t.hash) ||
        after.state.elements.length !==
          before.state.elements.length + created.length
      )
        throw new ElementImportError(
          'Existing state changed; rolling back',
          'STALE'
        )
      return {
        state: after.state,
        created,
        skipped: decisions.filter((d) => d.action !== 'CREATE'),
        verified: created.length,
      }
    },
    { isolationLevel: 'Serializable', timeout: 120_000, maxWait: 10_000 }
  )
}
