import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementManipulationInput,
  GeneratedFlashcardEditable,
  GeneratedQuestionEditable,
} from '@klicker-uzh/types'
import { ELEMENT_GENERATION_CAPABILITIES } from '@klicker-uzh/types'
import { isDeepStrictEqual } from 'node:util'
import type { ContextWithUser } from '../lib/context.js'
import validateAndProcessElementOptions from '../lib/validateAndProcessElementOptions.js'
import { isElementGenerationCostConfigured } from './elementGenerationAccounting.js'
import { manipulateElement } from './elements.js'
import {
  getFlashcardGenerationBuild,
  publishIncompleteFlashcardGeneration,
  retryFlashcardGeneration,
  saveGeneratedFlashcards,
  startFlashcardGeneration,
} from './flashcardGeneration.js'
import {
  normalizeGeneratedFlashcardEditable,
  setGeneratedFlashcardDecision,
  updateGeneratedFlashcardDraft,
} from './flashcardGenerationDrafts.js'
import {
  getQuestionGenerationBuild,
  reviewQuestionGenerationDesign,
  reviewQuestionGenerationPlan,
  saveGeneratedQuestions,
  startQuestionGeneration,
} from './questionGeneration.js'
import {
  setGeneratedQuestionDecision,
  updateGeneratedQuestionDraft,
} from './questionGenerationDrafts.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import {
  assertQuestionGenerationPreviewAccess,
  getQuestionGenerationSources,
} from './questionGenerationGraph.js'
import { isElementGenerationRuntimeConfigured } from './questionGenerationRuntime.js'

const QUESTION_TYPES = new Set<DB.ElementType>([
  DB.ElementType.SC,
  DB.ElementType.MC,
  DB.ElementType.KPRIM,
])
function isQuestionElementType(
  elementType: DB.ElementType
): elementType is 'SC' | 'MC' | 'KPRIM' {
  return QUESTION_TYPES.has(elementType)
}
const TERMINAL_EDITABLE_STATUSES = [
  DB.ElementGenerationBuildStatus.COMPLETED,
  DB.ElementGenerationBuildStatus.INCOMPLETE,
]

export type StartElementGenerationInput = {
  graphBuildId: string
  elementType: 'SC' | 'MC' | 'KPRIM' | 'FLASHCARD'
  language: string
  elementCount: number
  difficultyPreset?: string | null
  sourceScopes?: Array<{
    resourceId: string
    pageFrom?: number | null
    pageTo?: number | null
  }> | null
  objectives?: Array<{
    text: string
    bloomLevel?: string | null
  }> | null
  bloomLevels?: string[] | null
  idempotencyKey: string
}

export type GeneratedElementEditableInput = {
  name: string
  prompt: string
  context?: string | null
  explanation?: string | null
  choices?: Array<{
    id: string
    label: string
    text: string
    correct: boolean
    feedback?: string | null
  }> | null
  cardType?: 'definition' | 'formula' | 'calculation' | null
  tags?: string[] | null
}

export type KeepGeneratedElementDraftInput = {
  draftId: string
  expectedRevision: number
  status: DB.ElementStatus
  type: DB.ElementType
  name: string
  content: string
  explanation?: string | null
  basePoints: boolean
  pointsMultiplier: number
  tags?: string[] | null
  options?: ElementManipulationInput['options']
}

function serviceError(message: string): never {
  throw questionGenerationServiceError('INVALID_STAGE', message)
}

async function ownedBuildType(buildId: string, ctx: ContextWithUser) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const build = await ctx.prisma.elementGenerationBuild.findFirst({
    where: { id: buildId, ownerId: ctx.user.sub },
    select: { elementType: true },
  })
  if (!build) {
    throw questionGenerationServiceError(
      'QUESTION_GENERATION_BUILD_NOT_FOUND',
      'Element-generation build not found'
    )
  }
  return build.elementType
}

async function ownedDraftType(draftId: string, ctx: ContextWithUser) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const draft = await ctx.prisma.generatedElementDraft.findFirst({
    where: {
      id: draftId,
      build: { is: { ownerId: ctx.user.sub } },
    },
    select: { elementType: true },
  })
  if (!draft) {
    throw questionGenerationServiceError(
      'GENERATED_QUESTION_DRAFT_NOT_FOUND',
      'Generated element draft not found'
    )
  }
  return draft.elementType
}

export async function startElementGeneration(
  input: StartElementGenerationInput,
  ctx: ContextWithUser
) {
  if (input.elementType === 'FLASHCARD') {
    if (
      input.difficultyPreset != null ||
      (input.sourceScopes?.length ?? 0) > 0 ||
      (input.bloomLevels?.length ?? 0) > 0 ||
      input.objectives?.some((objective) => objective.bloomLevel != null)
    ) {
      throw questionGenerationServiceError(
        'CONFIGURATION_INVALID',
        'Flashcard generation does not support difficulty, Bloom, or source scoping'
      )
    }
    return startFlashcardGeneration(
      {
        graphBuildId: input.graphBuildId,
        idempotencyKey: input.idempotencyKey,
        language: input.language,
        flashcardCount: input.elementCount,
        objectives: input.objectives?.map(({ text }) => ({ text })) ?? null,
      },
      ctx
    )
  }
  return startQuestionGeneration(
    {
      graphBuildId: input.graphBuildId,
      idempotencyKey: input.idempotencyKey,
      itemType: input.elementType,
      language: input.language,
      questionCount: input.elementCount,
      difficultyPreset: input.difficultyPreset ?? 'MIXED',
      sourceScopes: input.sourceScopes,
      objectives: input.objectives,
      bloomLevels: input.bloomLevels,
    },
    ctx
  )
}

export async function getElementGenerationBuild(
  buildId: string,
  ctx: ContextWithUser
) {
  const elementType = await ownedBuildType(buildId, ctx)
  return elementType === DB.ElementType.FLASHCARD
    ? getFlashcardGenerationBuild(buildId, ctx)
    : getQuestionGenerationBuild(buildId, ctx)
}

export async function reviewElementGeneration(
  gate: 'DESIGN' | 'PLAN',
  input: {
    buildId: string
    decision: 'APPROVE' | 'REJECT'
    warningsAcknowledged: boolean
  },
  ctx: ContextWithUser
) {
  const elementType = await ownedBuildType(input.buildId, ctx)
  if (!QUESTION_TYPES.has(elementType)) {
    return serviceError('This element type does not use review gates')
  }
  return gate === 'DESIGN'
    ? reviewQuestionGenerationDesign(input, ctx)
    : reviewQuestionGenerationPlan(input, ctx)
}

export async function retryElementGeneration(
  buildId: string,
  ctx: ContextWithUser
) {
  const elementType = await ownedBuildType(buildId, ctx)
  if (elementType !== DB.ElementType.FLASHCARD) {
    return serviceError('This element-generation workflow is not retryable')
  }
  return retryFlashcardGeneration(buildId, ctx)
}

export async function publishIncompleteElementGeneration(
  buildId: string,
  warningsAcknowledged: boolean,
  ctx: ContextWithUser
) {
  const elementType = await ownedBuildType(buildId, ctx)
  if (elementType !== DB.ElementType.FLASHCARD) {
    return serviceError('Only incomplete flashcard output can be published')
  }
  return publishIncompleteFlashcardGeneration(
    { buildId, acknowledgeIncomplete: warningsAcknowledged },
    ctx
  )
}

export async function saveGeneratedElements(
  buildId: string,
  ctx: ContextWithUser
) {
  const elementType = await ownedBuildType(buildId, ctx)
  return elementType === DB.ElementType.FLASHCARD
    ? saveGeneratedFlashcards(buildId, ctx)
    : saveGeneratedQuestions(buildId, ctx)
}

function normalizedKeepPayload(
  draft: DB.GeneratedElementDraft,
  input: KeepGeneratedElementDraftInput
) {
  if (draft.elementType === DB.ElementType.FLASHCARD) {
    if (input.type !== DB.ElementType.FLASHCARD) {
      throw questionGenerationServiceError(
        'DRAFT_INVALID',
        'Generated element type cannot be changed'
      )
    }
    const storedCurrent = draft.current as GeneratedFlashcardEditable
    const current = normalizeGeneratedFlashcardEditable({
      name: input.name,
      front: input.content,
      back: input.explanation ?? '',
      cardType: storedCurrent.cardType,
      tags: input.tags ?? [],
    })
    const elementInput: ElementManipulationInput = {
      status: input.status,
      type: DB.ElementType.FLASHCARD,
      name: current.name,
      content: current.front,
      explanation: current.back,
      // Flashcards never award points; the shared keep input still carries it.
      basePoints: false,
      pointsMultiplier: input.pointsMultiplier,
      tags: current.tags,
    }
    return { current, elementInput }
  }

  if (!isQuestionElementType(input.type) || draft.elementType !== input.type) {
    throw questionGenerationServiceError(
      'DRAFT_INVALID',
      'Generated element type cannot be changed'
    )
  }
  if (!input.options?.choices) {
    throw questionGenerationServiceError(
      'DRAFT_INVALID',
      'A generated assessment element requires answer choices'
    )
  }
  const storedCurrent = draft.current as GeneratedQuestionEditable
  const choices = [...input.options.choices]
    .sort((left, right) => left.ix - right.ix)
    .map((choice, index) => ({
      id: storedCurrent.choices[index]?.id ?? `${draft.id}-choice-${index + 1}`,
      label: String.fromCharCode(65 + index),
      text: choice.value,
      correct: choice.correct ?? false,
      feedback: choice.feedback ?? null,
    }))
  const questionType = input.type
  const current: GeneratedQuestionEditable = {
    itemType: questionType,
    name: input.name,
    stem: input.content,
    context: null,
    explanation: input.explanation ?? null,
    choices,
  }
  const elementInput: ElementManipulationInput = {
    status: input.status,
    type: questionType,
    name: current.name,
    content: current.stem,
    explanation: current.explanation,
    difficultyLevel: draft.targetDifficulty,
    options: {
      displayMode: input.options.displayMode,
      hasSampleSolution: input.options.hasSampleSolution,
      hasAnswerFeedbacks: input.options.hasAnswerFeedbacks,
      choices: current.choices.map((choice, index) => ({
        ix: index,
        value: choice.text,
        correct: choice.correct,
        feedback: choice.feedback,
      })),
    },
    basePoints: input.basePoints,
    pointsMultiplier: input.pointsMultiplier,
    tags: input.tags ?? [],
  }
  return { current, elementInput }
}

type SavedElementForRetry = {
  ownerId: string
  status: DB.ElementStatus
  type: DB.ElementType
  name: string
  content: string
  explanation: string | null
  basePoints: boolean
  pointsMultiplier: number
  difficultyLevel: number | null
  options: unknown
  tags: Array<{ name: string }>
}

function normalizedTagNames(tags: string[] | null | undefined) {
  return [...new Set(tags ?? [])].sort()
}

function savedElementMatchesKeepRequest(
  savedElement: SavedElementForRetry,
  elementInput: ElementManipulationInput,
  ownerId: string
) {
  const options = validateAndProcessElementOptions(
    elementInput.type,
    elementInput.options
  )
  if (options === null) return false

  const persistedOptions = JSON.parse(JSON.stringify(options))
  return (
    savedElement.ownerId === ownerId &&
    savedElement.status === elementInput.status &&
    savedElement.type === elementInput.type &&
    savedElement.name === elementInput.name &&
    savedElement.content === elementInput.content &&
    savedElement.explanation === (elementInput.explanation ?? null) &&
    savedElement.basePoints === elementInput.basePoints &&
    savedElement.pointsMultiplier === elementInput.pointsMultiplier &&
    savedElement.difficultyLevel === (elementInput.difficultyLevel ?? null) &&
    isDeepStrictEqual(savedElement.options, persistedOptions) &&
    isDeepStrictEqual(
      savedElement.tags.map((tag) => tag.name).sort(),
      normalizedTagNames(elementInput.tags)
    )
  )
}

export async function keepGeneratedElementDraft(
  input: KeepGeneratedElementDraftInput,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw questionGenerationServiceError(
      'DRAFT_INVALID',
      'Expected draft revision is invalid'
    )
  }

  return ctx.prisma.$transaction(async (transaction) => {
    const owned = await transaction.generatedElementDraft.findFirst({
      where: {
        id: input.draftId,
        build: { is: { ownerId: ctx.user.sub } },
      },
      select: { buildId: true },
    })
    if (!owned) {
      throw questionGenerationServiceError(
        'GENERATED_QUESTION_DRAFT_NOT_FOUND',
        'Generated element draft not found'
      )
    }
    await transaction.$queryRaw`
      SELECT "id"
      FROM "ElementGenerationBuild"
      WHERE "id" = ${owned.buildId}::uuid
      FOR UPDATE
    `
    const draft = await transaction.generatedElementDraft.findFirst({
      where: {
        id: input.draftId,
        build: { is: { ownerId: ctx.user.sub } },
      },
      include: {
        build: { select: { status: true } },
        savedElement: {
          select: {
            ownerId: true,
            status: true,
            type: true,
            name: true,
            content: true,
            explanation: true,
            basePoints: true,
            pointsMultiplier: true,
            difficultyLevel: true,
            options: true,
            tags: { select: { name: true } },
          },
        },
      },
    })
    if (!draft) {
      throw questionGenerationServiceError(
        'GENERATED_QUESTION_DRAFT_NOT_FOUND',
        'Generated element draft not found'
      )
    }
    const validStatuses: DB.ElementGenerationBuildStatus[] =
      draft.elementType === DB.ElementType.FLASHCARD
        ? TERMINAL_EDITABLE_STATUSES
        : [DB.ElementGenerationBuildStatus.COMPLETED]
    if (!validStatuses.includes(draft.build.status)) {
      throw questionGenerationServiceError(
        'INVALID_STAGE',
        'Generated elements can only be kept after terminal publication'
      )
    }

    const { current, elementInput } = normalizedKeepPayload(draft, input)
    if (draft.savedElementId !== null) {
      if (
        draft.decision === DB.GeneratedElementDecision.ACCEPTED &&
        draft.revision === input.expectedRevision + 1 &&
        draft.savedElement !== null &&
        savedElementMatchesKeepRequest(
          draft.savedElement,
          elementInput,
          ctx.user.sub
        )
      ) {
        return draft
      }
      if (draft.revision === input.expectedRevision + 1) {
        throw questionGenerationServiceError(
          'CONCURRENT_MODIFICATION',
          'The saved element does not match this retry request'
        )
      }
      throw questionGenerationServiceError(
        'DRAFT_INVALID',
        'A saved generated element is immutable'
      )
    }
    const canKeep =
      draft.decision === DB.GeneratedElementDecision.OPEN ||
      draft.decision === DB.GeneratedElementDecision.ACCEPTED
    if (!canKeep) {
      throw questionGenerationServiceError(
        'DRAFT_INVALID',
        'Only an open or accepted unsaved generated element can be kept'
      )
    }
    if (draft.revision !== input.expectedRevision) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Generated element draft was changed by another request'
      )
    }

    const element = await manipulateElement(elementInput, {
      ...ctx,
      prisma: transaction,
    })
    if (!element) {
      throw questionGenerationServiceError(
        'SAVE_VALIDATION_FAILED',
        'Generated element is not a valid element'
      )
    }
    const savedAt = new Date()
    const linked = await transaction.generatedElementDraft.updateMany({
      where: {
        id: draft.id,
        revision: input.expectedRevision,
        decision: draft.decision,
        savedElementId: null,
      },
      data: {
        current,
        revision: { increment: 1 },
        decision: DB.GeneratedElementDecision.ACCEPTED,
        savedElementId: element.id,
        savedAt,
      },
    })
    if (linked.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Generated element draft was changed by another request'
      )
    }
    return transaction.generatedElementDraft.findUniqueOrThrow({
      where: { id: draft.id },
    })
  })
}

export async function updateGeneratedElementDraft(
  input: {
    draftId: string
    expectedRevision: number
    current: GeneratedElementEditableInput
  },
  ctx: ContextWithUser
) {
  const elementType = await ownedDraftType(input.draftId, ctx)
  if (elementType === DB.ElementType.FLASHCARD) {
    if (
      !input.current.explanation ||
      !input.current.cardType ||
      input.current.context != null ||
      (input.current.choices?.length ?? 0) > 0
    ) {
      throw questionGenerationServiceError(
        'DRAFT_INVALID',
        'A flashcard requires front, back, and card type without answer choices'
      )
    }
    const current: GeneratedFlashcardEditable = {
      name: input.current.name,
      front: input.current.prompt,
      back: input.current.explanation,
      cardType: input.current.cardType,
      tags: input.current.tags ?? [],
    }
    return updateGeneratedFlashcardDraft(
      {
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        current,
      },
      ctx
    )
  }
  if (
    !isQuestionElementType(elementType) ||
    !input.current.choices ||
    input.current.cardType != null ||
    (input.current.tags?.length ?? 0) > 0
  ) {
    throw questionGenerationServiceError(
      'DRAFT_INVALID',
      'An assessment element requires answer choices'
    )
  }
  const current: GeneratedQuestionEditable = {
    itemType: elementType,
    name: input.current.name,
    stem: input.current.prompt,
    context: input.current.context ?? null,
    explanation: input.current.explanation ?? null,
    choices: input.current.choices.map((choice) => ({
      ...choice,
      feedback: choice.feedback ?? null,
    })),
  }
  return updateGeneratedQuestionDraft(
    {
      draftId: input.draftId,
      expectedRevision: input.expectedRevision,
      current,
    },
    ctx
  )
}

export async function duplicateGeneratedElementDraft(
  draftId: string,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  return ctx.prisma.$transaction(async (transaction) => {
    const draft = await transaction.generatedElementDraft.findFirst({
      where: {
        id: draftId,
        savedElementId: null,
        build: {
          is: {
            ownerId: ctx.user.sub,
            status: { in: TERMINAL_EDITABLE_STATUSES },
          },
        },
      },
    })
    if (!draft) {
      throw questionGenerationServiceError(
        'DRAFT_INVALID',
        'Generated element draft can no longer be duplicated'
      )
    }
    await transaction.$queryRaw`
      SELECT "id"
      FROM "ElementGenerationBuild"
      WHERE "id" = ${draft.buildId}::uuid
      FOR UPDATE
    `
    const maximum = await transaction.generatedElementDraft.aggregate({
      where: {
        buildId: draft.buildId,
        sourceElementId: draft.sourceElementId,
      },
      _max: { duplicationIndex: true },
    })
    return transaction.generatedElementDraft.create({
      data: {
        buildId: draft.buildId,
        sourceElementId: draft.sourceElementId,
        order: draft.order,
        duplicationIndex: (maximum._max.duplicationIndex ?? 0) + 1,
        elementType: draft.elementType,
        parentDraftId: draft.id,
        original: draft.original,
        current: draft.current,
        bloomLevel: draft.bloomLevel,
        targetDifficulty: draft.targetDifficulty,
        predictedDifficulty: draft.predictedDifficulty,
        qualityFlags: draft.qualityFlags,
        citations: draft.citations,
        provenance: draft.provenance ?? DB.Prisma.DbNull,
      },
    })
  })
}

export async function setGeneratedElementDecision(
  draftId: string,
  decision: 'OPEN' | 'ACCEPTED' | 'REJECTED',
  ctx: ContextWithUser
) {
  const elementType = await ownedDraftType(draftId, ctx)
  return elementType === DB.ElementType.FLASHCARD
    ? setGeneratedFlashcardDecision({ draftId, decision }, ctx)
    : setGeneratedQuestionDecision({ draftId, decision }, ctx)
}

export async function getElementGenerationSources(ctx: ContextWithUser) {
  return getQuestionGenerationSources(ctx)
}

export async function getElementGenerationCapabilities(ctx: ContextWithUser) {
  await assertQuestionGenerationPreviewAccess(ctx)
  return {
    elementTypes: [...ELEMENT_GENERATION_CAPABILITIES.elementTypes],
    languages: [...ELEMENT_GENERATION_CAPABILITIES.languages],
    bloomLevels: [...ELEMENT_GENERATION_CAPABILITIES.bloomLevels],
    difficultyLevels: [...ELEMENT_GENERATION_CAPABILITIES.difficultyLevels],
    typeCapabilities: ELEMENT_GENERATION_CAPABILITIES.elementTypes.map(
      (elementType) => ({
        elementType,
        reviewGates: [
          ...ELEMENT_GENERATION_CAPABILITIES.reviewGates[elementType],
        ],
        supportsSourceScopes: elementType !== 'FLASHCARD',
        supportsDifficulty: elementType !== 'FLASHCARD',
        supportsBloomLevels: elementType !== 'FLASHCARD',
        supportsRetry: elementType === 'FLASHCARD',
        supportsIncompletePublication: elementType === 'FLASHCARD',
      })
    ),
    supportsIndividualRegeneration:
      ELEMENT_GENERATION_CAPABILITIES.supportsIndividualRegeneration,
    configured:
      isElementGenerationRuntimeConfigured(ctx.elementGenerationRuntime) &&
      isElementGenerationCostConfigured(),
  }
}
