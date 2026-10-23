import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  buildCompetenceTreeCopyInput,
  createCompetenceTreeInTransaction,
  validateCompetenceTreeInput,
} from '@klicker-uzh/adaptive-server/services/competenceTreeCommands'
import type { CompetenceTreeInput } from '@klicker-uzh/adaptive-server/services/competenceTreeInput'
import type { CompetenceTreeDetail } from '@klicker-uzh/adaptive-server/services/competenceTreeManagementTypes'
import { getCompetenceTree } from '@klicker-uzh/adaptive-server/services/competenceTreeReadModels'
import { prisma } from '@klicker-uzh/prisma'
import {
  type PrismaTransactionClient,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import type { ContextWithUser } from '../lib/context.js'

// ! Script to copy one competence tree into another lecturer's account. The
// ! source tree and its questions stay untouched; the copy is a new tree owned
// ! by the target user and validated like an in-app "Duplicate".
//
// Safe by default: without DRY_RUN=false it only validates and prints the plan
// and writes a payload-bound "before" snapshot. A write requires that snapshot
// to still match the database, runs in a single transaction and leaves an
// "after" receipt that blocks reruns.
//
// Environment:
//   SOURCE_TREE_ID      UUID of the tree to copy (required)
//   TARGET_USERNAME     username of the receiving lecturer (or TARGET_USER_ID)
//   TARGET_USER_ID      UUID of the receiving lecturer (or TARGET_USERNAME)
//   COPY_NAME           optional internal name of the copy
//   COPY_DISPLAY_NAME   optional display name of the copy
//   ASSIGNED_ELEMENTS   how to handle the questions assigned in the tree:
//                         require-readable (default) fail unless the target can
//                                            read every assigned question
//                         drop-unreadable    copy without the assignments of
//                                            questions the target cannot read
//                         copy               copy every assigned question the
//                                            target does not own into the
//                                            target's account and assign the copies
//   DUMP_DIR            directory for the snapshot files (default: cwd)
//   TX_TIMEOUT_MS       write transaction timeout (default: 1800000)
//   DRY_RUN             set to "false" to write

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ASSIGNED_ELEMENT_MODES = [
  'require-readable',
  'drop-unreadable',
  'copy',
] as const
type AssignedElementMode = (typeof ASSIGNED_ELEMENT_MODES)[number]
const PRINTED_ID_LIMIT = 20

export type CopyCompetenceTreeConfig = {
  sourceTreeId: string
  targetUsername: string | null
  targetUserId: string | null
  copyName: string | null
  copyDisplayName: string | null
  assignedElements: AssignedElementMode
  dumpDir: string
  txTimeoutMs: number
  dryRun: boolean
}

export function readCopyCompetenceTreeConfig(
  env: NodeJS.ProcessEnv
): CopyCompetenceTreeConfig {
  const value = (name: string) => env[name]?.trim() || null
  const sourceTreeId = value('SOURCE_TREE_ID')
  if (!sourceTreeId || !UUID_PATTERN.test(sourceTreeId)) {
    throw new Error('SOURCE_TREE_ID must be a competence tree UUID')
  }
  const targetUsername = value('TARGET_USERNAME')
  const targetUserId = value('TARGET_USER_ID')
  if (!targetUsername === !targetUserId) {
    throw new Error('Set exactly one of TARGET_USERNAME or TARGET_USER_ID')
  }
  if (targetUserId && !UUID_PATTERN.test(targetUserId)) {
    throw new Error('TARGET_USER_ID must be a UUID')
  }
  if (targetUsername?.includes('@')) {
    throw new Error(
      'TARGET_USERNAME must be a KlickerUZH username, not an email address'
    )
  }
  if (value('UNREADABLE_ASSIGNMENTS')) {
    throw new Error(
      'UNREADABLE_ASSIGNMENTS was replaced by ASSIGNED_ELEMENTS (require-readable, drop-unreadable or copy)'
    )
  }
  const assignedElements = value('ASSIGNED_ELEMENTS') ?? 'require-readable'
  if (
    !ASSIGNED_ELEMENT_MODES.includes(assignedElements as AssignedElementMode)
  ) {
    throw new Error(
      `ASSIGNED_ELEMENTS must be one of ${ASSIGNED_ELEMENT_MODES.join(', ')}`
    )
  }
  const txTimeoutMs = Number(value('TX_TIMEOUT_MS') ?? 1_800_000)
  if (!Number.isSafeInteger(txTimeoutMs) || txTimeoutMs < 10_000) {
    throw new Error('TX_TIMEOUT_MS must be an integer of at least 10000')
  }
  return {
    sourceTreeId,
    targetUsername,
    targetUserId,
    copyName: value('COPY_NAME'),
    copyDisplayName: value('COPY_DISPLAY_NAME'),
    assignedElements: assignedElements as AssignedElementMode,
    dumpDir: value('DUMP_DIR') ?? process.cwd(),
    txTimeoutMs,
    dryRun: env.DRY_RUN !== 'false',
  }
}

// Keeps only assignments whose element the target can read. Coverages and
// structure are copied unchanged, so a dropped assignment only removes that
// element's mapping from the copy.
export function filterReadableAssignments(
  input: CompetenceTreeInput,
  readableElementIds: ReadonlySet<number>
): { input: CompetenceTreeInput; droppedElementIds: number[] } {
  const droppedElementIds = [
    ...new Set(
      input.assignments
        .filter(({ elementId }) => !readableElementIds.has(elementId))
        .map(({ elementId }) => elementId)
    ),
  ].sort((a, b) => a - b)
  return {
    input: {
      ...input,
      assignments: input.assignments.filter(({ elementId }) =>
        readableElementIds.has(elementId)
      ),
    },
    droppedElementIds,
  }
}

// Points every assignment at the copied element; assignments of elements that
// were not copied (already owned by the target) keep their element.
export function remapAssignedElements(
  input: CompetenceTreeInput,
  copiedElementIds: ReadonlyMap<number, number>
): CompetenceTreeInput {
  return {
    ...input,
    assignments: input.assignments.map((assignment) => ({
      ...assignment,
      elementId:
        copiedElementIds.get(assignment.elementId) ?? assignment.elementId,
    })),
  }
}

export function summarizeIds(ids: readonly number[]): string {
  const shown = ids.slice(0, PRINTED_ID_LIMIT).join(', ')
  return ids.length > PRINTED_ID_LIMIT
    ? `${shown}, ... (${ids.length} in total, full list in the snapshot file)`
    : shown
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

// A content fingerprint of the source tree that ignores volatile read-model
// fields, so the write can prove the source was neither changed beforehand
// nor touched by the copy.
export function competenceTreeFingerprint(tree: CompetenceTreeDetail): string {
  return sha256(buildCompetenceTreeCopyInput(tree, { name: tree.name }))
}

function copyContext(userId: string): ContextWithUser {
  // The competence tree services only read ctx.prisma and ctx.user.sub.
  return {
    prisma,
    user: {
      sub: userId,
      role: 'USER',
      scope: 'ACCOUNT_OWNER',
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

const ELEMENT_COPY_SELECT = {
  id: true,
  version: true,
  updatedAt: true,
  isDeleted: true,
  name: true,
  content: true,
  explanation: true,
  basePoints: true,
  pointsMultiplier: true,
  options: true,
  status: true,
  type: true,
  difficultyLevel: true,
  answerCollectionId: true,
  answerCollectionItems: { select: { id: true } },
} as const

type ElementToCopy = Awaited<ReturnType<typeof loadElementsToCopy>>[number]

async function loadElementsToCopy(
  client: Pick<PrismaTransactionClient, 'element'>,
  elementIds: number[]
) {
  return await client.element.findMany({
    where: { id: { in: elementIds } },
    select: ELEMENT_COPY_SELECT,
    orderBy: { id: 'asc' },
  })
}

// Mirrors catalog import (copyElementToAccount): the copy keeps the question
// content and answer collection, records its origin and starts a fresh history
// (version, tags, calibrations, instances and sharing stay with the original).
async function copyElements(
  tx: PrismaTransactionClient,
  elements: ElementToCopy[],
  targetUserId: string
): Promise<Map<number, number>> {
  const copied = new Map<number, number>()
  const answerCollectionIds = new Set<number>()
  for (const [index, element] of elements.entries()) {
    const copy = await tx.element.create({
      data: {
        originalId: String(element.id),
        name: element.name,
        content: element.content,
        explanation: element.explanation,
        basePoints: element.basePoints,
        pointsMultiplier: element.pointsMultiplier,
        options: element.options as object,
        status: element.status,
        type: element.type,
        difficultyLevel: element.difficultyLevel,
        answerCollection:
          element.answerCollectionId !== null
            ? { connect: { id: element.answerCollectionId } }
            : undefined,
        answerCollectionItems: {
          connect: element.answerCollectionItems.map(({ id }) => ({ id })),
        },
        owner: { connect: { id: targetUserId } },
      },
      select: { id: true },
    })
    await recomputeDerivedPermissions(
      { elementId: copy.id, userId: targetUserId },
      tx
    )
    if (element.answerCollectionId !== null) {
      answerCollectionIds.add(element.answerCollectionId)
    }
    copied.set(element.id, copy.id)
    if ((index + 1) % 250 === 0 || index + 1 === elements.length) {
      console.log(`  copied ${index + 1}/${elements.length} questions`)
    }
  }
  for (const answerCollectionId of answerCollectionIds) {
    await recomputeDerivedPermissions(
      { answerCollectionId, userId: targetUserId },
      tx
    )
  }
  return copied
}

type Snapshot = {
  payloadHash: string
  sourceTreeId: string
  sourceOwnerId: string
  sourceFingerprint: string
  targetUserId: string
  targetTreeIds: string[]
  assignedElements: AssignedElementMode
  elementIdsToCopy: number[]
  elementsToCopyFingerprint: string
  droppedElementIds: number[]
}

function elementsFingerprint(elements: ElementToCopy[]): string {
  return sha256(
    elements.map(({ id, version, updatedAt, isDeleted }) => [
      id,
      version,
      updatedAt.toISOString(),
      isDeleted,
    ])
  )
}

export async function run(config: CopyCompetenceTreeConfig) {
  const sourceRow = await prisma.competenceTree.findFirst({
    where: { id: config.sourceTreeId, isDeleted: false },
    select: { id: true, ownerId: true },
  })
  if (!sourceRow) {
    throw new Error(`Competence tree ${config.sourceTreeId} not found`)
  }
  const sourceCtx = copyContext(sourceRow.ownerId)
  const source = await getCompetenceTree({ id: sourceRow.id }, sourceCtx)
  if (!source) {
    throw new Error(`Competence tree ${config.sourceTreeId} is not readable`)
  }

  const targetUsers = await prisma.user.findMany({
    where: config.targetUserId
      ? { id: config.targetUserId }
      : { shortname: { equals: config.targetUsername!, mode: 'insensitive' } },
    select: { id: true, shortname: true },
  })
  if (targetUsers.length !== 1) {
    throw new Error(
      `Expected exactly one target user, found ${targetUsers.length}`
    )
  }
  const target = targetUsers[0]!
  if (target.id === sourceRow.ownerId) {
    throw new Error(
      'The target already owns the source tree; use "Duplicate" in the app'
    )
  }

  const fullInput = buildCompetenceTreeCopyInput(source, {
    name: config.copyName ?? source.name,
    displayName: config.copyDisplayName ?? source.displayName,
  })
  const assignedIds = [
    ...new Set(fullInput.assignments.map((a) => a.elementId)),
  ]
  const [readable, owned] = await Promise.all([
    prisma.element.findMany({
      where: {
        id: { in: assignedIds },
        isDeleted: false,
        OR: [
          { ownerId: target.id },
          { permissions: { some: { userId: target.id } } },
        ],
      },
      select: { id: true },
    }),
    prisma.element.findMany({
      where: { id: { in: assignedIds }, ownerId: target.id },
      select: { id: true },
    }),
  ])
  const readableIds = new Set(readable.map(({ id }) => id))
  const ownedIds = new Set(owned.map(({ id }) => id))

  let plannedInput = fullInput
  let droppedElementIds: number[] = []
  let elementsToCopy: ElementToCopy[] = []
  if (config.assignedElements === 'copy') {
    elementsToCopy = await loadElementsToCopy(
      prisma,
      assignedIds.filter((id) => !ownedIds.has(id))
    )
    const deleted = elementsToCopy.filter(({ isDeleted }) => isDeleted)
    if (deleted.length > 0) {
      throw new Error(
        `The source tree assigns deleted questions: ${summarizeIds(deleted.map(({ id }) => id))}`
      )
    }
  } else {
    const filtered = filterReadableAssignments(fullInput, readableIds)
    droppedElementIds = filtered.droppedElementIds
    if (config.assignedElements === 'drop-unreadable') {
      plannedInput = filtered.input
    }
  }

  console.log('Copy plan')
  console.log(`  source tree:   ${source.displayName} (${source.id})`)
  console.log(`  source owner:  ${sourceRow.ownerId}`)
  console.log(`  target user:   ${target.shortname} (${target.id})`)
  console.log(
    `  copy name:     ${plannedInput.name} / ${plannedInput.displayName}`
  )
  console.log(
    `  structure:     ${plannedInput.levels.length} levels, ${plannedInput.nodes.length} nodes, ${plannedInput.coverages.length} coverages`
  )
  console.log(
    `  questions:     ${assignedIds.length} assigned, ${ownedIds.size} owned and ${readableIds.size - ownedIds.size} readable by the target`
  )
  console.log(`  mode:          ASSIGNED_ELEMENTS=${config.assignedElements}`)
  if (config.assignedElements === 'copy') {
    console.log(
      `  copy questions: ${elementsToCopy.length} into the target's account`
    )
  }
  console.log(
    `  assignments:   ${plannedInput.assignments.length} of ${fullInput.assignments.length} kept`
  )
  console.log(
    '  not copied:    course links, scale versions, calibration history, question tags'
  )
  if (droppedElementIds.length > 0) {
    console.log(
      `  unreadable questions for target (${droppedElementIds.length}): ${summarizeIds(droppedElementIds)}`
    )
    if (config.assignedElements === 'require-readable') {
      throw new Error(
        'The target cannot read every assigned question. Use ASSIGNED_ELEMENTS=copy to copy the questions into their account, share them first, or use ASSIGNED_ELEMENTS=drop-unreadable to copy the tree without them.'
      )
    }
  }

  // Copied questions do not exist yet, so the structure is validated as the
  // source owner against the original questions; the write repeats the full
  // validation as the target inside the transaction.
  const validation = await validateCompetenceTreeInput(
    { input: plannedInput },
    config.assignedElements === 'copy' ? sourceCtx : copyContext(target.id)
  )
  console.log(
    `  validation:    ${validation.valid ? 'valid' : 'INVALID'} (${validation.errors.length} errors, ${validation.warnings.length} warnings)`
  )
  for (const issue of [...validation.errors, ...validation.warnings]) {
    console.log(`    ${issue.message}`)
  }
  if (!validation.valid) {
    throw new Error('The copy would not be a valid competence tree')
  }

  const baseName = `copyCompetenceTree_${config.sourceTreeId}_${target.id}`
  const beforePath = path.join(config.dumpDir, `${baseName}_dump_before.json`)
  const afterPath = path.join(config.dumpDir, `${baseName}_dump_after.json`)
  if (existsSync(afterPath)) {
    throw new Error(
      `This copy already ran (receipt ${afterPath}); refusing to copy again`
    )
  }
  const targetTrees = await prisma.competenceTree.findMany({
    where: { ownerId: target.id },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const snapshot: Snapshot = {
    payloadHash: sha256({
      sourceTreeId: config.sourceTreeId,
      targetUserId: target.id,
      assignedElements: config.assignedElements,
      plannedInput,
    }),
    sourceTreeId: config.sourceTreeId,
    sourceOwnerId: sourceRow.ownerId,
    sourceFingerprint: competenceTreeFingerprint(source),
    targetUserId: target.id,
    targetTreeIds: targetTrees.map(({ id }) => id),
    assignedElements: config.assignedElements,
    elementIdsToCopy: elementsToCopy.map(({ id }) => id),
    elementsToCopyFingerprint: elementsFingerprint(elementsToCopy),
    droppedElementIds,
  }

  if (config.dryRun) {
    if (existsSync(beforePath)) {
      const previous = JSON.parse(readFileSync(beforePath, 'utf8')) as Snapshot
      if (sha256(previous) !== sha256(snapshot)) {
        throw new Error(
          `${beforePath} no longer matches the database or payload; delete it deliberately before planning again`
        )
      }
    } else {
      writeFileSync(beforePath, `${JSON.stringify(snapshot, null, 2)}\n`)
    }
    console.log(`DRY RUN: nothing written. Snapshot: ${beforePath}`)
    console.log('Rerun with DRY_RUN=false to create the copy.')
    return { dryRun: true as const, snapshotPath: beforePath }
  }

  if (!existsSync(beforePath)) {
    throw new Error('Run a dry run first to create the before snapshot')
  }
  const before = JSON.parse(readFileSync(beforePath, 'utf8')) as Snapshot
  if (sha256(before) !== sha256(snapshot)) {
    throw new Error(
      'The source tree, its questions, the target trees or the payload changed since the dry run; rerun the dry run'
    )
  }

  const { copyTreeId, copiedElementIds } = await prisma.$transaction(
    async (tx) => {
      // Re-read inside the transaction so the copies match the planned state.
      const current = await loadElementsToCopy(tx, before.elementIdsToCopy)
      if (elementsFingerprint(current) !== before.elementsToCopyFingerprint) {
        throw new Error('A question to copy changed during the write')
      }
      const copiedElementIds = await copyElements(tx, current, target.id)
      const copyTreeId = await createCompetenceTreeInTransaction(tx, {
        input: remapAssignedElements(plannedInput, copiedElementIds),
        ownerId: target.id,
      })
      return { copyTreeId, copiedElementIds }
    },
    { timeout: config.txTimeoutMs, maxWait: 60_000 }
  )

  const [copy, sourceAfter, foreignAssignments, copiedOwned] =
    await Promise.all([
      getCompetenceTree({ id: copyTreeId }, copyContext(target.id)),
      getCompetenceTree({ id: source.id }, sourceCtx),
      config.assignedElements === 'copy'
        ? prisma.competenceTreeElementAssignment.count({
            where: {
              treeId: copyTreeId,
              element: { ownerId: { not: target.id } },
            },
          })
        : Promise.resolve(0),
      prisma.element.count({
        where: {
          id: { in: [...copiedElementIds.values()] },
          ownerId: target.id,
          isDeleted: false,
        },
      }),
    ])
  const checks = {
    sourceUnchanged:
      !!sourceAfter &&
      competenceTreeFingerprint(sourceAfter) === before.sourceFingerprint,
    copyOwnedByTarget: copy?.ownerId === target.id,
    levels: copy?.levels.length === plannedInput.levels.length,
    nodes: copy?.nodes.length === plannedInput.nodes.length,
    coverages: copy?.levelCoverages.length === plannedInput.coverages.length,
    assignments:
      copy?.elementAssignments.length === plannedInput.assignments.length,
    questionsCopied: copiedOwned === before.elementIdsToCopy.length,
    assignmentsUseOwnQuestions: foreignAssignments === 0,
  }
  const mismatches = Object.entries(checks).filter(([, ok]) => !ok)
  writeFileSync(
    afterPath,
    `${JSON.stringify(
      {
        ...before,
        copyTreeId,
        copiedElementIds: Object.fromEntries(copiedElementIds),
        checks,
      },
      null,
      2
    )}\n`
  )
  console.log(`Created copy ${copy?.displayName} (${copyTreeId})`)
  console.log(
    `Copied ${copiedElementIds.size} questions; mapping in ${afterPath}`
  )
  console.log(
    `Verification Summary: ${Object.keys(checks).length - mismatches.length} Successes, ${mismatches.length} Mismatches`
  )
  if (mismatches.length > 0) {
    throw new Error(
      `Verification failed: ${mismatches.map(([key]) => key).join(', ')}`
    )
  }
  return { dryRun: false as const, copyTreeId }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run(readCopyCompetenceTreeConfig(process.env))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
