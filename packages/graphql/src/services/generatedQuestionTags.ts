import * as DB from '@klicker-uzh/prisma/client'
import {
  type GeneratedQuestionTagSelection,
  type GeneratedQuestionTagSelectionInput,
  normalizeGeneratedQuestionTagLabel,
} from '@klicker-uzh/types'
import { questionGenerationServiceError } from './questionGenerationErrors.js'

export type QuestionTagSelection = GeneratedQuestionTagSelection

// A draft keeps the requested selection, not the resolved tag set, so an
// identical retry stays an exact retry after a proposal became an existing tag.
export type QuestionTagSelectionWrite =
  | { mode: 'legacy'; selection: QuestionTagSelection }
  | { mode: 'selection'; selection: QuestionTagSelection }
  | { mode: 'none' }

export type QuestionTagResolutionMode = 'resolve-or-create' | 'resolve-only'

const MAX_NEW_TAG_NAME_LENGTH = 200
const MAX_TAG_SELECTION_SIZE = 100
const MAX_TAG_NAME_CONFLICT_ATTEMPTS = 3

function tagSelectionError(message: string): never {
  throw questionGenerationServiceError('DRAFT_INVALID', message)
}

export function normalizeQuestionTagSelection(
  value: GeneratedQuestionTagSelectionInput | null | undefined
): QuestionTagSelection {
  const existingTagIds: number[] = []
  for (const raw of value?.existingTagIds ?? []) {
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) {
      tagSelectionError('Selected tag identifiers are invalid')
    }
    if (!existingTagIds.includes(raw)) existingTagIds.push(raw)
  }

  const newTagNames: string[] = []
  for (const raw of value?.newTagNames ?? []) {
    if (typeof raw !== 'string') {
      tagSelectionError('Proposed tag names are invalid')
    }
    const label = normalizeGeneratedQuestionTagLabel(raw)
    if (!label || label.length > MAX_NEW_TAG_NAME_LENGTH) {
      tagSelectionError('Proposed tag names are invalid')
    }
    if (!newTagNames.includes(label)) newTagNames.push(label)
  }

  if (existingTagIds.length + newTagNames.length > MAX_TAG_SELECTION_SIZE) {
    tagSelectionError('Tag selection is too large')
  }

  return { existingTagIds, newTagNames }
}

// Resolves the selection a request wants to persist. `tags` is the legacy
// string-name input and replaces the selection; supplying both representations
// is ambiguous and rejected. An omitted field preserves the stored selection.
export function questionTagSelectionWrite(
  input: {
    tagSelection?: GeneratedQuestionTagSelectionInput | null
    tags?: string[] | null
  },
  stored: GeneratedQuestionTagSelection | null | undefined
): QuestionTagSelectionWrite {
  const hasSelection =
    input.tagSelection !== undefined && input.tagSelection !== null
  const hasLegacyTags = input.tags !== undefined
  if (hasSelection && hasLegacyTags) {
    tagSelectionError('Supply either tags or a tag selection, not both')
  }
  if (hasSelection) {
    return {
      mode: 'selection',
      selection: normalizeQuestionTagSelection(input.tagSelection),
    }
  }
  if (hasLegacyTags) {
    return {
      mode: 'legacy',
      selection: normalizeQuestionTagSelection({
        existingTagIds: [],
        newTagNames: input.tags ?? [],
      }),
    }
  }
  return stored
    ? { mode: 'selection', selection: normalizeQuestionTagSelection(stored) }
    : { mode: 'none' }
}

export function questionTagSelectionsEqual(
  left: GeneratedQuestionTagSelection | null | undefined,
  right: GeneratedQuestionTagSelection | null | undefined
): boolean {
  if (!left || !right) return !left === !right
  return (
    left.existingTagIds.length === right.existingTagIds.length &&
    left.existingTagIds.every(
      (id, index) => id === right.existingTagIds[index]
    ) &&
    left.newTagNames.length === right.newTagNames.length &&
    left.newTagNames.every((name, index) => name === right.newTagNames[index])
  )
}

// Existing ids are validated against the owner in the same transaction that
// writes the element, and new names resolve to an exact-name owner tag before
// any tag is created. `resolve-only` never creates a tag and reports whether
// the request can still be satisfied, keeping retry matching side-effect free.
export async function resolveQuestionTagSelection(
  transaction: DB.Prisma.TransactionClient,
  ownerId: string,
  selection: QuestionTagSelection,
  mode: QuestionTagResolutionMode = 'resolve-or-create'
): Promise<number[] | null> {
  const resolvedIds: number[] = []
  const seen = new Set<number>()

  if (selection.existingTagIds.length > 0) {
    const owned = await transaction.tag.findMany({
      where: { ownerId, id: { in: selection.existingTagIds } },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((tag) => tag.id))
    for (const tagId of selection.existingTagIds) {
      if (!ownedIds.has(tagId)) {
        tagSelectionError('Selected tags are not available to this owner')
      }
      if (!seen.has(tagId)) {
        seen.add(tagId)
        resolvedIds.push(tagId)
      }
    }
  }

  for (const name of selection.newTagNames) {
    const existing = await transaction.tag.findUnique({
      where: { ownerId_name: { ownerId, name } },
      select: { id: true },
    })
    if (existing) {
      if (!seen.has(existing.id)) {
        seen.add(existing.id)
        resolvedIds.push(existing.id)
      }
      continue
    }
    if (mode === 'resolve-only') return null

    const created = await transaction.tag.create({
      data: { name, owner: { connect: { id: ownerId } } },
      select: { id: true },
    })
    seen.add(created.id)
    resolvedIds.push(created.id)
  }

  return resolvedIds
}

const OWNER_NAME_TAG_COLUMNS = ['ownerId', 'name'] as const

// Constraint columns arrive as bare names in some reports and as quoted SQL
// identifiers in others. Only a complete wrapping quote pair is removed, so an
// unrecognized shape stays unrecognized instead of matching by accident.
function unquotedColumn(column: string): string {
  const trimmed = column.trim()
  const quote = trimmed[0]
  if (
    trimmed.length >= 3 &&
    (quote === '"' || quote === '`') &&
    trimmed[trimmed.length - 1] === quote
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function isOwnerNameColumnList(columns: unknown): boolean {
  if (!Array.isArray(columns)) return false
  const names = columns.map((column) =>
    typeof column === 'string' ? unquotedColumn(column) : ''
  )
  return OWNER_NAME_TAG_COLUMNS.every((column) => names.includes(column))
}

function isOwnerNameTagConflict(error: unknown): boolean {
  if (!(error instanceof DB.Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false
  const meta = error.meta as
    | {
        target?: unknown
        modelName?: unknown
        driverAdapterError?: { cause?: unknown }
      }
    | undefined
  if (typeof meta?.modelName === 'string' && meta.modelName !== 'Tag') {
    return false
  }
  if (typeof meta?.target === 'string') {
    return meta.target.includes('ownerId') && meta.target.includes('name')
  }
  if (Array.isArray(meta?.target)) return isOwnerNameColumnList(meta.target)

  // Prisma 7 driver adapters report the violated constraint on the cause of the
  // adapter error rather than on `target`.
  const cause = meta?.driverAdapterError?.cause as
    | { kind?: unknown; constraint?: { fields?: unknown } }
    | undefined
  if (cause?.kind !== 'UniqueConstraintViolation') return false
  return isOwnerNameColumnList(cause.constraint?.fields)
}

// Two builds can accept the same new tag concurrently. Retrying the whole
// transaction re-resolves each proposed name, so the loser connects to the tag
// the winner created instead of failing or creating a duplicate.
export async function withQuestionTagConflictRetry<T>(
  run: () => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      if (
        !isOwnerNameTagConflict(error) ||
        attempt >= MAX_TAG_NAME_CONFLICT_ATTEMPTS
      ) {
        throw error
      }
    }
  }
}

export { suggestGeneratedQuestionTags } from '@klicker-uzh/types'
