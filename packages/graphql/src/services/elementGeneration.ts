import * as DB from '@klicker-uzh/prisma/client'
import type {
  GeneratedFlashcardEditable,
  GeneratedQuestionEditable,
} from '@klicker-uzh/types'
import { ELEMENT_GENERATION_CAPABILITIES } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { isElementGenerationCostConfigured } from './elementGenerationAccounting.js'
import {
  getFlashcardGenerationBuild,
  publishIncompleteFlashcardGeneration,
  retryFlashcardGeneration,
  saveGeneratedFlashcards,
  startFlashcardGeneration,
} from './flashcardGeneration.js'
import {
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
