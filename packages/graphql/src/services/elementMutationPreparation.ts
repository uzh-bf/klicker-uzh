import * as DB from '@klicker-uzh/prisma/client'
import type { ElementManipulationInput } from '@klicker-uzh/types'
import {
  canonicalizeElementDomainUpdate,
  canonicalizeElementSharedFieldsPatch,
  ElementDomainValidationError,
} from '../lib/elementDomain.js'
import { parseCaseStudyAuthoringOptions } from '../lib/elementDomain/caseStudy.js'
import { parseSelectionAuthoringOptions } from '../lib/elementDomain/selection.js'
import validateElementInputs from '../lib/validateElementInputs.js'

export type PreviousElementMutationState = {
  status: DB.ElementStatus
  type: DB.ElementType
  name: string
  content: string
  explanation: string | null
  basePoints: boolean
  pointsMultiplier: number
  options: unknown
  answerCollectionId: number | null
  answerCollectionItems: readonly { id: number }[]
}

type AnswerCollectionEntryResolver = (
  answerCollectionId: number
) => Promise<readonly number[] | null>

function previousSharedFields(previous?: PreviousElementMutationState) {
  return previous
    ? {
        content: previous.content,
        explanation: previous.explanation,
        basePoints: previous.basePoints,
        pointsMultiplier: previous.pointsMultiplier,
      }
    : undefined
}

function previousOptions(previous?: PreviousElementMutationState) {
  const options = previous?.options
  return options && typeof options === 'object' && !Array.isArray(options)
    ? options
    : {}
}

function relationDisconnectIds({
  type,
  options,
  selectedIds,
  previous,
}: {
  type: typeof DB.ElementType.SELECTION | typeof DB.ElementType.CASE_STUDY
  options: Record<string, unknown>
  selectedIds: readonly number[]
  previous?: PreviousElementMutationState
}) {
  const previousIds =
    previous?.answerCollectionItems.map((entry) => entry.id) ?? []
  if (type === DB.ElementType.SELECTION && options.hasSampleSolution !== true) {
    return previousIds
  }
  return previousIds.filter((id) => !selectedIds.includes(id))
}

async function prepareCanonicalElementMutation(
  input: ElementManipulationInput,
  previous: PreviousElementMutationState | undefined,
  resolveAnswerCollectionEntryIds: AnswerCollectionEntryResolver
) {
  const shared = {
    type: input.type,
    content: input.content,
    explanation: input.explanation,
    basePoints: input.basePoints,
    pointsMultiplier: input.pointsMultiplier,
    previous: previousSharedFields(previous),
  }

  if (input.type === DB.ElementType.SELECTION) {
    const parsed = parseSelectionAuthoringOptions(input.options)
    const poolIds = await resolveAnswerCollectionEntryIds(
      parsed.answerCollection
    )
    if (!poolIds) return null

    const domain = canonicalizeElementDomainUpdate({
      ...shared,
      type: input.type,
      options: {
        hasSampleSolution: parsed.hasSampleSolution,
        numberOfInputs: parsed.numberOfInputs,
      },
      relations: {
        answerCollectionId: parsed.answerCollection,
        poolIds,
        selectedIds: parsed.correctAnswers ?? [],
      },
    })
    const answerCollectionId = domain.relations.answerCollectionId
    if (typeof answerCollectionId !== 'number') return null

    return {
      domain,
      relationWrite: {
        answerCollectionId,
        selectedIds: domain.relations.selectedIds,
        connectSelectedItems: domain.options.hasSampleSolution === true,
        disconnectIds: relationDisconnectIds({
          type: input.type,
          options: domain.options,
          selectedIds: domain.relations.selectedIds,
          previous,
        }),
      },
    }
  }

  if (input.type === DB.ElementType.CASE_STUDY) {
    const parsed = parseCaseStudyAuthoringOptions(input.options)
    const { answerCollection, collectionItemIds, ...options } = parsed
    const poolIds = await resolveAnswerCollectionEntryIds(answerCollection)
    if (!poolIds) return null

    const domain = canonicalizeElementDomainUpdate({
      ...shared,
      type: input.type,
      options,
      relations: {
        answerCollectionId: answerCollection,
        poolIds,
        selectedIds: collectionItemIds,
        caseSolutionReferenceKey: 'itemId',
      },
    })
    const answerCollectionId = domain.relations.answerCollectionId
    if (typeof answerCollectionId !== 'number') return null

    return {
      domain,
      relationWrite: {
        answerCollectionId,
        selectedIds: domain.relations.selectedIds,
        connectSelectedItems: true,
        disconnectIds: relationDisconnectIds({
          type: input.type,
          options: domain.options,
          selectedIds: domain.relations.selectedIds,
          previous,
        }),
      },
    }
  }

  return {
    domain: canonicalizeElementDomainUpdate({
      ...shared,
      type: input.type,
      options: input.options ?? {},
    }),
    relationWrite: undefined,
  }
}

export async function prepareElementMutation(
  input: ElementManipulationInput,
  previous: PreviousElementMutationState | undefined,
  resolveAnswerCollectionEntryIds: AnswerCollectionEntryResolver
) {
  try {
    if (!validateElementInputs(input)) return null

    const shouldWriteOptions =
      typeof previous === 'undefined' || typeof input.options !== 'undefined'
    let prepared
    if (shouldWriteOptions) {
      prepared = await prepareCanonicalElementMutation(
        input,
        previous,
        resolveAnswerCollectionEntryIds
      )
    } else {
      if (!previous) return null
      prepared = {
        domain: {
          ...canonicalizeElementSharedFieldsPatch({
            type: input.type,
            content: input.content,
            explanation: input.explanation,
            basePoints: input.basePoints,
            pointsMultiplier: input.pointsMultiplier,
            previous,
          }),
          options: previousOptions(previous),
          relations: {
            answerCollectionId: previous.answerCollectionId ?? undefined,
            selectedIds: previous.answerCollectionItems.map(
              (entry) => entry.id
            ),
          },
        },
        relationWrite: undefined,
      }
    }
    if (!prepared) return null

    const status = input.status ?? previous?.status
    const name = input.name ?? previous?.name
    if (typeof status === 'undefined' || typeof name !== 'string') return null

    return {
      ...prepared,
      status,
      name,
      shouldWriteOptions,
      answerCollectionId: prepared.domain.relations.answerCollectionId,
    }
  } catch (error) {
    if (error instanceof ElementDomainValidationError) return null
    throw error
  }
}
