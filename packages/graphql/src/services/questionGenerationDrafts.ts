import * as DB from '@klicker-uzh/prisma/client'
import type {
  GeneratedQuestionEditable,
  GeneratedQuestionOriginal,
  GeneratedQuestionWithProvenance,
  QuestionGenerationArtifactRef,
  QuestionGenerationItemType,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import { assertQuestionGenerationPreviewAccess } from './questionGenerationGraph.js'

const MAX_NAME_LENGTH = 500
const MAX_STEM_LENGTH = 20_000
const MAX_OPTION_LENGTH = 10_000
const MAX_OPTION_COUNT = 10
const MC_OPTION_COUNT = 5
const KPRIM_OPTION_COUNT = 4

export type UpdateGeneratedQuestionDraftInput = {
  draftId: string
  expectedRevision: number
  current: GeneratedQuestionEditableInputValue
}

export type GeneratedQuestionEditableInputValue = Omit<
  GeneratedQuestionEditable,
  'itemType' | 'context' | 'explanation' | 'choices'
> & {
  itemType?: QuestionGenerationItemType | null
  context?: string | null
  explanation?: string | null
  choices: Array<
    Omit<GeneratedQuestionEditable['choices'][number], 'feedback'> & {
      feedback?: string | null
    }
  >
}

export type GeneratedQuestionDecisionInput = 'OPEN' | 'ACCEPTED' | 'REJECTED'

function draftError(message: string): never {
  throw questionGenerationServiceError('DRAFT_INVALID', message)
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    return draftError(`${field} is invalid`)
  }
  return normalized
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number
): string | null {
  const normalized = value?.trim() ?? ''
  if (normalized.length > maxLength) return draftError(`${field} is invalid`)
  return normalized || null
}

export function normalizeGeneratedQuestionEditable(
  value: GeneratedQuestionEditableInputValue,
  expectedItemType?: QuestionGenerationItemType
): GeneratedQuestionEditable {
  const itemType = value.itemType ?? expectedItemType ?? 'SC'
  if (itemType !== 'SC' && itemType !== 'MC' && itemType !== 'KPRIM') {
    return draftError('Generated question type is not supported')
  }
  if (expectedItemType !== undefined && itemType !== expectedItemType) {
    return draftError('Generated question type cannot be changed')
  }
  if (
    !Array.isArray(value.choices) ||
    (itemType === 'SC' &&
      (value.choices.length < 2 || value.choices.length > MAX_OPTION_COUNT)) ||
    (itemType === 'MC' && value.choices.length !== MC_OPTION_COUNT) ||
    (itemType === 'KPRIM' && value.choices.length !== KPRIM_OPTION_COUNT)
  ) {
    return draftError(
      itemType === 'SC'
        ? 'A generated SC draft requires 2-10 choices'
        : itemType === 'MC'
          ? 'A generated MC draft requires exactly five choices'
          : 'A generated KPRIM draft requires exactly four statements'
    )
  }

  const choices = value.choices.map((choice, index) => ({
    id: requiredText(choice.id, `Choice ${index + 1} ID`, 100),
    label: requiredText(choice.label, `Choice ${index + 1} label`, 20),
    text: requiredText(
      choice.text,
      `Choice ${index + 1} text`,
      MAX_OPTION_LENGTH
    ),
    correct: choice.correct,
    feedback: optionalText(
      choice.feedback,
      `Choice ${index + 1} feedback`,
      MAX_OPTION_LENGTH
    ),
  }))
  if (
    choices.some((choice) => typeof choice.correct !== 'boolean') ||
    (itemType === 'SC' &&
      choices.filter((choice) => choice.correct).length !== 1) ||
    (itemType === 'MC' &&
      (choices.filter((choice) => choice.correct).length < 2 ||
        choices.filter((choice) => choice.correct).length > 4 ||
        choices.map((choice) => choice.label).join('') !== 'ABCDE')) ||
    new Set(choices.map((choice) => choice.id)).size !== choices.length ||
    new Set(choices.map((choice) => choice.label)).size !== choices.length
  ) {
    return draftError(`Generated ${itemType} draft choices are inconsistent`)
  }

  const feedbackCount = choices.filter(
    (choice) => choice.feedback !== null
  ).length
  if (feedbackCount !== 0 && feedbackCount !== choices.length) {
    return draftError(
      'Answer feedback must be provided for either every choice or no choice'
    )
  }

  return {
    itemType,
    name: requiredText(value.name, 'Draft name', MAX_NAME_LENGTH),
    stem: requiredText(value.stem, 'Draft stem', MAX_STEM_LENGTH),
    context: optionalText(value.context, 'Draft context', MAX_STEM_LENGTH),
    explanation: optionalText(
      value.explanation,
      'Draft explanation',
      MAX_STEM_LENGTH
    ),
    choices,
  }
}

function editableFromOriginal(
  original: GeneratedQuestionOriginal
): GeneratedQuestionEditable {
  return {
    itemType: original.itemType ?? 'SC',
    name: original.name,
    stem: original.stem,
    context: original.context,
    explanation: original.explanation,
    choices: original.choices.map((choice) => ({ ...choice })),
  }
}

export async function persistInitialGeneratedQuestionDrafts(
  input: {
    buildId: string
    leaseOwner: string
    questions: GeneratedQuestionWithProvenance[]
    resultManifestArtifact: QuestionGenerationArtifactRef
    finalBankArtifact: QuestionGenerationArtifactRef
    questionProvenanceIndexArtifact: QuestionGenerationArtifactRef | null
  },
  ctx: ContextWithUser
) {
  await ctx.prisma.$transaction(async (transaction) => {
    const build = await transaction.elementGenerationBuild.findFirst({
      where: {
        id: input.buildId,
        elementType: {
          in: [DB.ElementType.SC, DB.ElementType.MC, DB.ElementType.KPRIM],
        },
        status: DB.ElementGenerationBuildStatus.FINALIZING,
        syncLeaseOwner: input.leaseOwner,
      },
      select: { elementType: true },
    })
    if (!build) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Question-generation build completion lost its lease'
      )
    }
    if (
      input.questions.some(
        (question) => question.itemType !== build.elementType
      )
    ) {
      return draftError(
        'Generated question types do not match the requested element type'
      )
    }

    await transaction.generatedElementDraft.createMany({
      data: input.questions.map((question, order) => {
        const { provenance, ...original } = question
        return {
          buildId: input.buildId,
          sourceElementId: original.sourceQuestionId,
          order,
          duplicationIndex: 0,
          elementType: original.itemType,
          original,
          current: editableFromOriginal(original),
          bloomLevel: original.bloomLevel,
          targetDifficulty: original.targetDifficulty,
          predictedDifficulty: original.predictedDifficulty,
          qualityFlags: original.qualityFlags,
          citations: original.citations,
          provenance: provenance ?? DB.Prisma.DbNull,
        }
      }),
      skipDuplicates: true,
    })
    const draftCount = await transaction.generatedElementDraft.count({
      where: {
        buildId: input.buildId,
        duplicationIndex: 0,
      },
    })
    if (draftCount !== input.questions.length) {
      return draftError('Generated draft count does not match the final bank')
    }

    const completed = await transaction.elementGenerationBuild.updateMany({
      where: {
        id: input.buildId,
        elementType: build.elementType,
        status: DB.ElementGenerationBuildStatus.FINALIZING,
        syncLeaseOwner: input.leaseOwner,
      },
      data: {
        resultManifestArtifact: input.resultManifestArtifact,
        finalBankArtifact: input.finalBankArtifact,
        provenanceIndexArtifact:
          input.questionProvenanceIndexArtifact ?? DB.Prisma.DbNull,
        generatedElementCount: input.questions.length,
        status: DB.ElementGenerationBuildStatus.COMPLETED,
        stage: 'completed',
        completedAt: new Date(),
        lastSynchronizedAt: new Date(),
      },
    })
    if (completed.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Question-generation build completion lost its lease'
      )
    }
  })
}

async function findOwnedDraft(draftId: string, ctx: ContextWithUser) {
  const draft = await ctx.prisma.generatedElementDraft.findFirst({
    where: {
      id: draftId,
      elementType: {
        in: [DB.ElementType.SC, DB.ElementType.MC, DB.ElementType.KPRIM],
      },
      build: { is: { ownerId: ctx.user.sub } },
    },
    include: { build: { select: { status: true } } },
  })
  if (!draft) {
    throw questionGenerationServiceError(
      'GENERATED_QUESTION_DRAFT_NOT_FOUND',
      'Generated question draft not found'
    )
  }
  return draft
}

function assertDraftCanChange(
  draft: Awaited<ReturnType<typeof findOwnedDraft>>
) {
  if (draft.build.status !== DB.ElementGenerationBuildStatus.COMPLETED) {
    throw questionGenerationServiceError(
      'INVALID_STAGE',
      'Generated question drafts can only change after build completion'
    )
  }
  if (draft.savedElementId !== null) {
    return draftError('A saved generated question draft is immutable')
  }
}

async function lockQuestionGenerationBuild(
  transaction: DB.Prisma.TransactionClient,
  buildId: string
) {
  await transaction.$queryRaw`
    SELECT "id"
    FROM "ElementGenerationBuild"
    WHERE "id" = ${buildId}::uuid
    FOR UPDATE
  `
}

export async function updateGeneratedQuestionDraft(
  input: UpdateGeneratedQuestionDraftInput,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const owned = await findOwnedDraft(input.draftId, ctx)
  assertDraftCanChange(owned)
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return draftError('Expected draft revision is invalid')
  }
  return ctx.prisma.$transaction(async (transaction) => {
    await lockQuestionGenerationBuild(transaction, owned.buildId)
    const draft = await transaction.generatedElementDraft.findFirst({
      where: {
        id: owned.id,
        build: { is: { ownerId: ctx.user.sub } },
      },
      include: { build: { select: { status: true } } },
    })
    if (!draft) {
      throw questionGenerationServiceError(
        'GENERATED_QUESTION_DRAFT_NOT_FOUND',
        'Generated question draft not found'
      )
    }
    assertDraftCanChange(draft)
    const storedCurrent = draft.current as GeneratedQuestionEditable
    const current = normalizeGeneratedQuestionEditable(
      input.current,
      storedCurrent.itemType ?? 'SC'
    )

    const updated = await transaction.generatedElementDraft.updateMany({
      where: {
        id: draft.id,
        revision: input.expectedRevision,
        savedElementId: null,
      },
      data: { current, revision: { increment: 1 } },
    })
    if (updated.count !== 1) {
      throw questionGenerationServiceError(
        'CONCURRENT_MODIFICATION',
        'Generated question draft was changed by another request'
      )
    }
    return transaction.generatedElementDraft.findUniqueOrThrow({
      where: { id: draft.id },
    })
  })
}

export async function duplicateGeneratedQuestionDraft(
  draftId: string,
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  const owned = await findOwnedDraft(draftId, ctx)
  assertDraftCanChange(owned)

  return ctx.prisma.$transaction(async (transaction) => {
    await lockQuestionGenerationBuild(transaction, owned.buildId)
    const draft = await transaction.generatedElementDraft.findFirst({
      where: {
        id: draftId,
        savedElementId: null,
        build: {
          is: {
            ownerId: ctx.user.sub,
            status: DB.ElementGenerationBuildStatus.COMPLETED,
          },
        },
      },
    })
    if (!draft) {
      return draftError('Generated question draft can no longer be duplicated')
    }
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

export async function setGeneratedQuestionDecision(
  input: { draftId: string; decision: GeneratedQuestionDecisionInput },
  ctx: ContextWithUser
) {
  await assertQuestionGenerationPreviewAccess(ctx)
  if (!Object.values(DB.GeneratedElementDecision).includes(input.decision)) {
    return draftError('Generated question decision is invalid')
  }
  const draft = await findOwnedDraft(input.draftId, ctx)
  if (draft.savedElementId !== null && draft.decision !== input.decision) {
    return draftError('A saved generated question decision is immutable')
  }
  if (draft.build.status !== DB.ElementGenerationBuildStatus.COMPLETED) {
    throw questionGenerationServiceError(
      'INVALID_STAGE',
      'Generated question decisions require a completed build'
    )
  }
  if (draft.decision === input.decision) return draft

  const updated = await ctx.prisma.generatedElementDraft.updateMany({
    where: {
      id: draft.id,
      savedElementId: null,
      build: {
        is: { status: DB.ElementGenerationBuildStatus.COMPLETED },
      },
    },
    data: { decision: input.decision },
  })
  if (updated.count !== 1) {
    throw questionGenerationServiceError(
      'CONCURRENT_MODIFICATION',
      'Generated question draft was saved by another request'
    )
  }
  return ctx.prisma.generatedElementDraft.findUniqueOrThrow({
    where: { id: draft.id },
    include: { build: { select: { status: true } } },
  })
}
