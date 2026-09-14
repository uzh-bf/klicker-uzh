import { z } from 'zod'
import {
  assertUniqueIdentifiers,
  ElementDomainIssueCode,
  issue,
  parseWithDomainErrors,
  type ElementReference,
  type ElementRelationContext,
} from './core.js'

const selectionOptionsSchema = z
  .object({
    hasSampleSolution: z.boolean(),
    numberOfInputs: z.number().int().positive(),
  })
  .strict()

const selectionAuthoringOptionsSchema = z
  .object({
    hasSampleSolution: z.boolean(),
    answerCollection: z.number().int().nonnegative(),
    numberOfInputs: z.number().int().positive(),
    correctAnswers: z.array(z.number().int().nonnegative()).nullish(),
  })
  .strict()

export function normalizeSelectionOptions(value: unknown) {
  return parseWithDomainErrors(selectionOptionsSchema, value)
}

export function parseSelectionAuthoringOptions(value: unknown) {
  return parseWithDomainErrors(selectionAuthoringOptionsSchema, value)
}

export function canonicalizeSelectionRelations<Id extends ElementReference>(
  options: Record<string, unknown>,
  relations?: ElementRelationContext<Id>
) {
  if (
    typeof relations?.answerCollectionId === 'undefined' &&
    typeof relations?.poolIds === 'undefined' &&
    typeof relations?.selectedIds === 'undefined'
  ) {
    return { selectedIds: [] as Id[] }
  }

  if (typeof relations?.answerCollectionId === 'undefined') {
    issue(ElementDomainIssueCode.INVALID_RELATION, ['relations'])
  }

  const poolIds = [...(relations.poolIds ?? [])]
  const selectedIds = [...(relations.selectedIds ?? [])]
  if (relations.poolIds) {
    assertUniqueIdentifiers(poolIds, ['relations', 'poolIds'])
  }

  const numberOfInputs = options.numberOfInputs as number
  const hasSampleSolution = options.hasSampleSolution === true
  if (relations.poolIds && numberOfInputs > poolIds.length) {
    issue(ElementDomainIssueCode.INVALID_RELATION, [
      'options',
      'numberOfInputs',
    ])
  }

  // Correct-answer refs are dormant when no sample solution is enabled.
  // Strip them before validating uniqueness or pool membership so stale
  // client state cannot make an otherwise valid edit/package fail.
  if (!hasSampleSolution) {
    return {
      answerCollectionId: relations.answerCollectionId,
      selectedIds: [] as Id[],
    }
  }

  assertUniqueIdentifiers(selectedIds, ['relations', 'selectedIds'])
  if (relations.poolIds) {
    const pool = new Set<ElementReference>(poolIds)
    if (selectedIds.some((id) => !pool.has(id))) {
      issue(ElementDomainIssueCode.INVALID_RELATION, [
        'relations',
        'selectedIds',
      ])
    }
  }
  if (selectedIds.length < numberOfInputs) {
    issue(ElementDomainIssueCode.INVALID_RELATION, ['relations', 'selectedIds'])
  }
  return {
    answerCollectionId: relations.answerCollectionId,
    selectedIds,
  }
}
