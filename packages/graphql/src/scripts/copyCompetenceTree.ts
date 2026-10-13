import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  buildCompetenceTreeCopyInput,
  createCompetenceTree,
  validateCompetenceTreeInput,
} from '@klicker-uzh/adaptive-server/services/competenceTreeCommands'
import type { CompetenceTreeInput } from '@klicker-uzh/adaptive-server/services/competenceTreeInput'
import type { CompetenceTreeDetail } from '@klicker-uzh/adaptive-server/services/competenceTreeManagementTypes'
import { getCompetenceTree } from '@klicker-uzh/adaptive-server/services/competenceTreeReadModels'
import { prisma } from '@klicker-uzh/prisma'
import type { ContextWithUser } from '../lib/context.js'

// ! Script to copy one competence tree into another lecturer's account. The
// ! source tree stays untouched; the copy is a new, independent tree owned by
// ! the target user, created through the same service as "Duplicate".
//
// Safe by default: without DRY_RUN=false it only validates and prints the plan
// and writes a payload-bound "before" snapshot. A write requires that snapshot
// to still match the database, and leaves an "after" receipt that blocks reruns.
//
// Environment:
//   SOURCE_TREE_ID           UUID of the tree to copy (required)
//   TARGET_USERNAME          username of the receiving lecturer (or TARGET_USER_ID)
//   TARGET_USER_ID           UUID of the receiving lecturer (or TARGET_USERNAME)
//   COPY_NAME                optional internal name of the copy
//   COPY_DISPLAY_NAME        optional display name of the copy
//   UNREADABLE_ASSIGNMENTS   "fail" (default) or "drop": what to do with element
//                            assignments the target cannot read
//   DUMP_DIR                 directory for the snapshot files (default: cwd)
//   DRY_RUN                  set to "false" to write

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CopyCompetenceTreeConfig = {
  sourceTreeId: string
  targetUsername: string | null
  targetUserId: string | null
  copyName: string | null
  copyDisplayName: string | null
  unreadableAssignments: 'fail' | 'drop'
  dumpDir: string
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
  const unreadable = value('UNREADABLE_ASSIGNMENTS') ?? 'fail'
  if (unreadable !== 'fail' && unreadable !== 'drop') {
    throw new Error('UNREADABLE_ASSIGNMENTS must be "fail" or "drop"')
  }
  return {
    sourceTreeId,
    targetUsername,
    targetUserId,
    copyName: value('COPY_NAME'),
    copyDisplayName: value('COPY_DISPLAY_NAME'),
    unreadableAssignments: unreadable,
    dumpDir: value('DUMP_DIR') ?? process.cwd(),
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

type Snapshot = {
  payloadHash: string
  sourceTreeId: string
  sourceOwnerId: string
  sourceFingerprint: string
  targetUserId: string
  targetTreeIds: string[]
}

async function takeSnapshot(
  config: CopyCompetenceTreeConfig,
  sourceOwnerId: string,
  source: CompetenceTreeDetail,
  targetUserId: string,
  plannedInput: CompetenceTreeInput
): Promise<Snapshot> {
  const targetTrees = await prisma.competenceTree.findMany({
    where: { ownerId: targetUserId },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  return {
    payloadHash: sha256({
      sourceTreeId: config.sourceTreeId,
      targetUserId,
      unreadableAssignments: config.unreadableAssignments,
      plannedInput,
    }),
    sourceTreeId: config.sourceTreeId,
    sourceOwnerId,
    sourceFingerprint: competenceTreeFingerprint(source),
    targetUserId,
    targetTreeIds: targetTrees.map(({ id }) => id),
  }
}

export async function run(config: CopyCompetenceTreeConfig) {
  const sourceRow = await prisma.competenceTree.findFirst({
    where: { id: config.sourceTreeId, isDeleted: false },
    select: { id: true, ownerId: true },
  })
  if (!sourceRow) {
    throw new Error(`Competence tree ${config.sourceTreeId} not found`)
  }
  const source = await getCompetenceTree(
    { id: sourceRow.id },
    copyContext(sourceRow.ownerId)
  )
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
  const elementIds = [...new Set(fullInput.assignments.map((a) => a.elementId))]
  const readable = await prisma.element.findMany({
    where: {
      id: { in: elementIds },
      isDeleted: false,
      OR: [
        { ownerId: target.id },
        { permissions: { some: { userId: target.id } } },
      ],
    },
    select: { id: true },
  })
  const { input, droppedElementIds } = filterReadableAssignments(
    fullInput,
    new Set(readable.map(({ id }) => id))
  )

  console.log('Copy plan')
  console.log(`  source tree:   ${source.displayName} (${source.id})`)
  console.log(`  source owner:  ${sourceRow.ownerId}`)
  console.log(`  target user:   ${target.shortname} (${target.id})`)
  console.log(`  copy name:     ${input.name} / ${input.displayName}`)
  console.log(
    `  structure:     ${input.levels.length} levels, ${input.nodes.length} nodes, ${input.coverages.length} coverages`
  )
  console.log(
    `  assignments:   ${input.assignments.length} of ${fullInput.assignments.length} kept`
  )
  console.log(
    '  not copied:    course links, scale versions and calibration history'
  )
  if (droppedElementIds.length > 0) {
    console.log(
      `  unreadable elements for target: ${droppedElementIds.join(', ')}`
    )
    if (config.unreadableAssignments === 'fail') {
      throw new Error(
        'The target cannot read every assigned element. Share those elements with the target first, or set UNREADABLE_ASSIGNMENTS=drop to copy without their assignments.'
      )
    }
  }

  const targetCtx = copyContext(target.id)
  const validation = await validateCompetenceTreeInput({ input }, targetCtx)
  console.log(
    `  validation:    ${validation.valid ? 'valid' : 'INVALID'} (${validation.errors.length} errors, ${validation.warnings.length} warnings)`
  )
  for (const warning of validation.warnings) {
    console.log(`    warning: ${warning.message}`)
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
  const snapshot = await takeSnapshot(
    config,
    sourceRow.ownerId,
    source,
    target.id,
    input
  )

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
      'The source tree, target trees or payload changed since the dry run; rerun the dry run'
    )
  }

  const copy = await createCompetenceTree({ input }, targetCtx)

  const sourceAfter = await getCompetenceTree(
    { id: source.id },
    copyContext(sourceRow.ownerId)
  )
  const checks = {
    sourceUnchanged:
      !!sourceAfter &&
      competenceTreeFingerprint(sourceAfter) === before.sourceFingerprint,
    copyOwnedByTarget:
      (await prisma.competenceTree.count({
        where: { id: copy.id, ownerId: target.id },
      })) === 1,
    levels: copy.levels.length === input.levels.length,
    nodes: copy.nodes.length === input.nodes.length,
    coverages: copy.levelCoverages.length === input.coverages.length,
    assignments: copy.elementAssignments.length === input.assignments.length,
  }
  const mismatches = Object.entries(checks).filter(([, ok]) => !ok)
  writeFileSync(
    afterPath,
    `${JSON.stringify({ ...before, copyTreeId: copy.id, checks }, null, 2)}\n`
  )
  console.log(`Created copy ${copy.displayName} (${copy.id})`)
  console.log(
    `Verification Summary: ${Object.keys(checks).length - mismatches.length} Successes, ${mismatches.length} Mismatches`
  )
  if (mismatches.length > 0) {
    throw new Error(
      `Verification failed: ${mismatches.map(([key]) => key).join(', ')}`
    )
  }
  return { dryRun: false as const, copyTreeId: copy.id }
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
